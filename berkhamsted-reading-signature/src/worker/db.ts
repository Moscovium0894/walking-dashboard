/**
 * Database access.
 *
 * Every statement here is prepared and parameterised. No query in this file is
 * built by string concatenation with user input, which is what keeps SQL
 * injection off the table even though the admin UI writes free text.
 */

import type { Book, BookSource, Profile, SignatureData } from '../shared/types';
import { calculateSchoolYear } from '../shared/schoolYear';
import type { Env } from './env';

interface ProfileRow {
  name: string;
  date_of_birth: string;
  house: string;
  school: string;
  subtitle: string;
  show_house: number;
  show_year: number;
  show_school: number;
  show_subtitle: number;
  updated_at: string;
}

interface BookRow {
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  publication_year: number | null;
  source: string;
  updated_at: string;
}

const VALID_SOURCES: readonly BookSource[] = ['google-books', 'open-library', 'manual'];

function toBookSource(value: string): BookSource {
  return (VALID_SOURCES as readonly string[]).includes(value) ? (value as BookSource) : 'manual';
}

export async function getProfile(env: Env): Promise<Profile> {
  const row = await env.DB.prepare(
    `SELECT name, date_of_birth, house, school, subtitle,
            show_house, show_year, show_school, show_subtitle, updated_at
     FROM profile WHERE id = 1`,
  ).first<ProfileRow>();

  if (!row) {
    throw new Error('Profile row is missing. Has the database migration been applied?');
  }

  return {
    name: row.name,
    dateOfBirth: row.date_of_birth,
    house: row.house,
    school: row.school,
    subtitle: row.subtitle,
    showHouse: row.show_house === 1,
    showYear: row.show_year === 1,
    showSchool: row.show_school === 1,
    showSubtitle: row.show_subtitle === 1,
    updatedAt: row.updated_at,
  };
}

export async function updateProfile(
  env: Env,
  profile: Omit<Profile, 'updatedAt'>,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE profile
     SET name = ?, date_of_birth = ?, house = ?, school = ?, subtitle = ?,
         show_house = ?, show_year = ?, show_school = ?, show_subtitle = ?, updated_at = ?
     WHERE id = 1`,
  )
    .bind(
      profile.name,
      profile.dateOfBirth,
      profile.house,
      profile.school,
      profile.subtitle,
      profile.showHouse ? 1 : 0,
      profile.showYear ? 1 : 0,
      profile.showSchool ? 1 : 0,
      profile.showSubtitle ? 1 : 0,
      new Date().toISOString(),
    )
    .run();

  await bumpRevision(env);
}

export async function getCurrentBook(env: Env): Promise<Book | null> {
  const row = await env.DB.prepare(
    `SELECT title, author, cover_url, isbn, publication_year, source, updated_at
     FROM current_book WHERE id = 1`,
  ).first<BookRow>();

  if (!row) return null;

  return {
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url,
    isbn: row.isbn,
    publicationYear: row.publication_year,
    source: toBookSource(row.source),
    updatedAt: row.updated_at,
  };
}

export async function setCurrentBook(
  env: Env,
  book: Omit<Book, 'updatedAt'>,
): Promise<void> {
  // Single-row table, so upsert on the pinned primary key.
  await env.DB.prepare(
    `INSERT INTO current_book (id, title, author, cover_url, isbn, publication_year, source, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       author = excluded.author,
       cover_url = excluded.cover_url,
       isbn = excluded.isbn,
       publication_year = excluded.publication_year,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  )
    .bind(
      book.title,
      book.author,
      book.coverUrl,
      book.isbn,
      book.publicationYear,
      book.source,
      new Date().toISOString(),
    )
    .run();

  await bumpRevision(env);
}

// --- Stored images -------------------------------------------------------

/**
 * Images we hold bytes for, and therefore serve from our own origin.
 *
 * 'signature'     the whole signature rendered to a PNG by the dashboard. This
 *                 is what an already-sent email loads, so it is the only way
 *                 text can update after the fact.
 * 'logo'          the crop used in the email signature, full colour on white.
 * 'logo-original' the untouched upload, kept so the crop can be redone later
 *                 without asking for the file again.
 *
 * The site's own branding is NOT here. The masthead and login logo are static
 * assets baked into the build, deliberately not editable through the admin UI.
 */
export type ImageKey = 'cover' | 'logo' | 'logo-original' | 'signature';

export interface StoredImage {
  contentType: string;
  bytes: ArrayBuffer;
  etag: string;
}

/**
 * Store an image as bytes.
 *
 * The signature then serves every image from our own origin, so it keeps
 * working if an upstream cover URL disappears or starts rejecting hotlinks,
 * which is a common failure mode for book-cover CDNs.
 */
export async function putImage(
  env: Env,
  key: ImageKey,
  contentType: string,
  bytes: ArrayBuffer,
  etag: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO images (key, content_type, bytes, etag, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       content_type = excluded.content_type,
       bytes = excluded.bytes,
       etag = excluded.etag,
       updated_at = excluded.updated_at`,
  )
    .bind(key, contentType, bytes, etag, new Date().toISOString())
    .run();
}

/**
 * Normalise a BLOB read back from D1.
 *
 * D1 hands BLOB columns back as a plain array of byte values rather than an
 * ArrayBuffer. Passing that array straight to a Response serialises it as text
 * and the image arrives empty, so it is converted here. Both representations
 * are accepted so this keeps working if the binding's behaviour changes.
 */
function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]).buffer;
  return null;
}

export async function getImage(env: Env, key: ImageKey): Promise<StoredImage | null> {
  const row = await env.DB.prepare(
    'SELECT content_type, bytes, etag FROM images WHERE key = ?',
  )
    .bind(key)
    .first<{ content_type: string; bytes: unknown; etag: string }>();

  if (!row) return null;

  const bytes = toArrayBuffer(row.bytes);
  if (bytes === null || bytes.byteLength === 0) return null;

  return { contentType: row.content_type, bytes, etag: row.etag };
}

export async function deleteImage(env: Env, key: ImageKey): Promise<void> {
  await env.DB.prepare('DELETE FROM images WHERE key = ?').bind(key).run();
}

/** Whether an image exists, without pulling its bytes into memory. */
export async function hasImage(env: Env, key: ImageKey): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 AS present FROM images WHERE key = ?')
    .bind(key)
    .first<{ present: number }>();
  return row !== null;
}

// --- Settings and revision ----------------------------------------------

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(key, value)
    .run();
}

export async function getRevision(env: Env): Promise<number> {
  const value = await getSetting(env, 'revision');
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

/**
 * Increment the revision.
 *
 * Every URL the email signature references carries this value as a query
 * parameter, so changing the book or the profile changes those URLs and any
 * cached copy of the old cover is bypassed immediately rather than lingering
 * until a TTL expires.
 */
export async function bumpRevision(env: Env): Promise<number> {
  const next = (await getRevision(env)) + 1;
  await setSetting(env, 'revision', String(next));
  return next;
}

/**
 * The revision the stored signature image was rendered at.
 *
 * When this falls behind the live revision the image is stale, and the
 * dashboard rebuilds it on the next visit.
 */
export async function getSignatureImageRevision(env: Env): Promise<number> {
  const value = await getSetting(env, 'signature_image_revision');
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setSignatureImageRevision(env: Env, revision: number): Promise<void> {
  await setSetting(env, 'signature_image_revision', String(revision));
}

/** Pixel dimensions of the stored signature image, for the <img> tag. */
export interface SignatureImageSize {
  width: number;
  height: number;
}

export async function getSignatureImageSize(env: Env): Promise<SignatureImageSize | null> {
  const raw = await getSetting(env, 'signature_image_size');
  if (raw === null) return null;
  const [width, height] = raw.split('x').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width: width as number, height: height as number };
}

export async function setSignatureImageSize(
  env: Env,
  size: SignatureImageSize,
): Promise<void> {
  await setSetting(env, 'signature_image_size', `${size.width}x${size.height}`);
}

// --- Composed read model -------------------------------------------------

/** Everything the dashboard and the public signature need, in one read. */
export async function getSignatureData(env: Env): Promise<SignatureData> {
  const [profile, book, revision] = await Promise.all([
    getProfile(env),
    getCurrentBook(env),
    getRevision(env),
  ]);

  const year = calculateSchoolYear(profile.dateOfBirth);

  return {
    profile,
    book,
    year: {
      label: year.label,
      yearGroup: year.yearGroup,
      academicYearLabel: year.academicYearLabel,
      status: year.status,
    },
    revision,
  };
}
