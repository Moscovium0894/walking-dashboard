/**
 * Database access.
 *
 * Two invariants hold throughout:
 *
 *  1. Every statement is prepared and parameterised. No query is assembled by
 *     string concatenation with user input.
 *  2. Every row that belongs to somebody is reached through a userId parameter.
 *     There is no exported function that reads or writes a profile, book or
 *     image without being told whose it is, so there is no query shape that
 *     could return another account's data by omission.
 *
 * The userId always comes from the session, never from the request, so it
 * cannot be chosen by the caller.
 */

import type { Book, BookSource, Profile, SignatureData } from '../shared/types';
import { calculateSchoolYear } from '../shared/schoolYear';
import type { Env } from './env';

// --- Users ---------------------------------------------------------------

export interface User {
  id: number;
  username: string;
  slug: string;
  revision: number;
  imageRevision: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

interface UserRow {
  id: number;
  username: string;
  slug: string;
  revision: number;
  image_revision: number;
  image_width: number | null;
  image_height: number | null;
}

/** Credentials, read only by the login path. */
export interface UserCredentials {
  id: number;
  passwordHash: string;
  passwordSalt: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    slug: row.slug,
    revision: row.revision,
    imageRevision: row.image_revision,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
  };
}

const USER_COLUMNS = 'id, username, slug, revision, image_revision, image_width, image_height';

export async function getUserById(env: Env, userId: number): Promise<User | null> {
  const row = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(userId)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getUserBySlug(env: Env, slug: string): Promise<User | null> {
  const row = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE slug = ?`)
    .bind(slug)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getCredentialsByUsername(
  env: Env,
  username: string,
): Promise<UserCredentials | null> {
  const row = await env.DB.prepare(
    'SELECT id, password_hash, password_salt FROM users WHERE username_lower = ?',
  )
    .bind(username.trim().toLowerCase())
    .first<{ id: number; password_hash: string; password_salt: string }>();

  return row
    ? { id: row.id, passwordHash: row.password_hash, passwordSalt: row.password_salt }
    : null;
}

export async function countUsers(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  return row?.total ?? 0;
}

export async function slugTaken(env: Env, slug: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 AS hit FROM users WHERE slug = ?')
    .bind(slug)
    .first<{ hit: number }>();
  return row !== null;
}

export async function usernameTaken(env: Env, username: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 AS hit FROM users WHERE username_lower = ?')
    .bind(username.trim().toLowerCase())
    .first<{ hit: number }>();
  return row !== null;
}

export interface NewUser {
  username: string;
  slug: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  dateOfBirth: string;
}

/**
 * Create an account and seed its profile.
 *
 * Relies on the UNIQUE constraints rather than a prior existence check alone,
 * so two simultaneous registrations for the same name cannot both succeed.
 */
export async function createUser(env: Env, user: NewUser): Promise<number | null> {
  const now = new Date().toISOString();

  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, username_lower, slug, password_hash, password_salt, revision, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    )
      .bind(
        user.username,
        user.username.toLowerCase(),
        user.slug,
        user.passwordHash,
        user.passwordSalt,
        now,
      )
      .run();

    const userId = Number(result.meta.last_row_id);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    await env.DB.prepare(
      `INSERT INTO profiles (user_id, name, date_of_birth, house, school, subtitle,
                             show_house, show_year, show_school, show_subtitle, updated_at)
       VALUES (?, ?, ?, '', '', '', 1, 1, 1, 0, ?)`,
    )
      .bind(userId, user.name, user.dateOfBirth, now)
      .run();

    return userId;
  } catch {
    // Almost certainly a UNIQUE violation on username_lower or slug.
    return null;
  }
}

/** Set a password. Used when the original single-user account is adopted. */
export async function setUserPassword(
  env: Env,
  userId: number,
  passwordHash: string,
  passwordSalt: string,
): Promise<void> {
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(passwordHash, passwordSalt, userId)
    .run();
}

export async function setUsername(env: Env, userId: number, username: string): Promise<void> {
  await env.DB.prepare('UPDATE users SET username = ?, username_lower = ? WHERE id = ?')
    .bind(username, username.toLowerCase(), userId)
    .run();
}

// --- Profile -------------------------------------------------------------

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

export async function getProfile(env: Env, userId: number): Promise<Profile | null> {
  const row = await env.DB.prepare(
    `SELECT name, date_of_birth, house, school, subtitle,
            show_house, show_year, show_school, show_subtitle, updated_at
     FROM profiles WHERE user_id = ?`,
  )
    .bind(userId)
    .first<ProfileRow>();

  if (!row) return null;

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
  userId: number,
  profile: Omit<Profile, 'updatedAt'>,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE profiles
     SET name = ?, date_of_birth = ?, house = ?, school = ?, subtitle = ?,
         show_house = ?, show_year = ?, show_school = ?, show_subtitle = ?, updated_at = ?
     WHERE user_id = ?`,
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
      userId,
    )
    .run();

  await bumpRevision(env, userId);
}

// --- Book ----------------------------------------------------------------

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

export async function getCurrentBook(env: Env, userId: number): Promise<Book | null> {
  const row = await env.DB.prepare(
    `SELECT title, author, cover_url, isbn, publication_year, source, updated_at
     FROM books WHERE user_id = ?`,
  )
    .bind(userId)
    .first<BookRow>();

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
  userId: number,
  book: Omit<Book, 'updatedAt'>,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO books (user_id, title, author, cover_url, isbn, publication_year, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       title = excluded.title,
       author = excluded.author,
       cover_url = excluded.cover_url,
       isbn = excluded.isbn,
       publication_year = excluded.publication_year,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  )
    .bind(
      userId,
      book.title,
      book.author,
      book.coverUrl,
      book.isbn,
      book.publicationYear,
      book.source,
      new Date().toISOString(),
    )
    .run();

  await bumpRevision(env, userId);
}

// --- Images --------------------------------------------------------------

/**
 * Images we hold bytes for, per user.
 *
 * 'signature'     the whole signature rendered to a PNG by the dashboard. This
 *                 is what an already-sent email loads, so it is the only way
 *                 text can update after the fact.
 * 'logo'          the crop used in the email signature.
 * 'logo-original' the untouched upload, kept so the crop can be redone.
 * 'cover'         the current book's cover, fetched when the book is set.
 *
 * The site's own branding is NOT here. The masthead and login logo are static
 * assets baked into the build, deliberately not editable by anyone.
 */
export type ImageKey = 'cover' | 'logo' | 'logo-original' | 'signature';

export interface StoredImage {
  contentType: string;
  bytes: ArrayBuffer;
  etag: string;
}

/**
 * Normalise a BLOB read back from D1.
 *
 * D1 hands BLOB columns back as a plain array of byte values rather than an
 * ArrayBuffer. Passing that array straight to a Response serialises it as text
 * and the image arrives empty, so it is converted here.
 */
function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]).buffer;
  return null;
}

export async function putImage(
  env: Env,
  userId: number,
  key: ImageKey,
  contentType: string,
  bytes: ArrayBuffer,
  etag: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_images (user_id, key, content_type, bytes, etag, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET
       content_type = excluded.content_type,
       bytes = excluded.bytes,
       etag = excluded.etag,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, key, contentType, bytes, etag, new Date().toISOString())
    .run();
}

export async function getImage(
  env: Env,
  userId: number,
  key: ImageKey,
): Promise<StoredImage | null> {
  const row = await env.DB.prepare(
    'SELECT content_type, bytes, etag FROM user_images WHERE user_id = ? AND key = ?',
  )
    .bind(userId, key)
    .first<{ content_type: string; bytes: unknown; etag: string }>();

  if (!row) return null;

  const bytes = toArrayBuffer(row.bytes);
  if (bytes === null || bytes.byteLength === 0) return null;

  return { contentType: row.content_type, bytes, etag: row.etag };
}

export async function deleteImage(env: Env, userId: number, key: ImageKey): Promise<void> {
  await env.DB.prepare('DELETE FROM user_images WHERE user_id = ? AND key = ?')
    .bind(userId, key)
    .run();
}

export async function hasImage(env: Env, userId: number, key: ImageKey): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS present FROM user_images WHERE user_id = ? AND key = ?',
  )
    .bind(userId, key)
    .first<{ present: number }>();
  return row !== null;
}

// --- Revisions -----------------------------------------------------------

/**
 * Increment a user's revision.
 *
 * Every URL their signature references carries this value, so changing the book
 * or profile changes those URLs and any cached copy is bypassed at once.
 */
export async function bumpRevision(env: Env, userId: number): Promise<void> {
  await env.DB.prepare('UPDATE users SET revision = revision + 1 WHERE id = ?').bind(userId).run();
}

export async function setSignatureImageState(
  env: Env,
  userId: number,
  revision: number,
  width: number,
  height: number,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE users SET image_revision = ?, image_width = ?, image_height = ? WHERE id = ?',
  )
    .bind(revision, width, height, userId)
    .run();
}

// --- Global settings -----------------------------------------------------

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

// --- Composed read model -------------------------------------------------

/** Everything the dashboard and a public signature need, for one user. */
export async function getSignatureData(env: Env, user: User): Promise<SignatureData | null> {
  const [profile, book] = await Promise.all([
    getProfile(env, user.id),
    getCurrentBook(env, user.id),
  ]);

  if (profile === null) return null;

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
    revision: user.revision,
  };
}
