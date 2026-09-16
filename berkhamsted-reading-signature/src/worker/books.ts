/**
 * Book search against Google Books and Open Library.
 *
 * Both are queried in parallel and their results merged, because each has
 * material gaps: Google Books has better metadata for recent trade fiction,
 * Open Library has better coverage of older and out-of-print editions and more
 * reliable cover images for them.
 *
 * Neither requires an API key for volume search, which is why no key is
 * configured anywhere in this project. All calls happen server-side regardless,
 * so if a key were ever needed it would stay out of the browser.
 */

import { normaliseWhitespace, safeHttpUrl } from '../shared/sanitize';
import type { BookSearchResult } from '../shared/types';
import type { Env } from './env';

/** Upstream calls are abandoned after this, so one slow API cannot hang a search. */
const UPSTREAM_TIMEOUT_MS = 6000;

/** Search results are cached for an hour; book metadata does not move quickly. */
const CACHE_TTL_SECONDS = 60 * 60;

const MAX_RESULTS = 12;

/** Identify ourselves, which is what Open Library asks of API consumers. */
const USER_AGENT = 'berkhamsted-reading-signature (Cloudflare Worker)';

export interface SearchOutcome {
  results: BookSearchResult[];
  /** Human-readable notes about partial failure, shown in the UI. */
  warnings: string[];
}

/** Fetch with a timeout, returning null rather than throwing. */
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    // 429 and 5xx are both "try again later" as far as the caller is concerned.
    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return normaliseWhitespace(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Pull a four-digit year out of whatever date format an API happens to use. */
function extractYear(value: unknown): number | null {
  const text = firstString(value);
  if (text === null) return null;
  const match = /\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/.exec(text);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(year) ? year : null;
}

function cleanIsbn(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
}

// --- Google Books --------------------------------------------------------

function parseGoogleBooks(payload: unknown): BookSearchResult[] {
  const root = asRecord(payload);
  if (root === null) return [];

  const results: BookSearchResult[] = [];

  for (const item of asArray(root.items)) {
    const entry = asRecord(item);
    const info = asRecord(entry?.volumeInfo);
    if (info === null) continue;

    const title = firstString(info.title);
    if (title === null) continue;

    const subtitle = firstString(info.subtitle);
    const fullTitle = subtitle === null ? title : `${title}: ${subtitle}`;

    // A missing author is common for anthologies and some editions.
    const author = firstString(info.authors) ?? '';

    let isbn: string | null = null;
    for (const identifier of asArray(info.industryIdentifiers)) {
      const record = asRecord(identifier);
      const type = firstString(record?.type);
      if (type === 'ISBN_13') {
        isbn = cleanIsbn(firstString(record?.identifier));
        break;
      }
      if (type === 'ISBN_10' && isbn === null) {
        isbn = cleanIsbn(firstString(record?.identifier));
      }
    }

    const links = asRecord(info.imageLinks);
    const rawCover = firstString(links?.thumbnail) ?? firstString(links?.smallThumbnail);
    // Google serves these over http in some responses; force https so the
    // signature never mixes schemes.
    const coverUrl = rawCover === null ? null : safeHttpUrl(rawCover.replace(/^http:/, 'https:'));

    results.push({
      id: `google:${firstString(entry?.id) ?? fullTitle}`,
      title: fullTitle,
      author,
      coverUrl,
      isbn,
      publicationYear: extractYear(info.publishedDate),
      source: 'google-books',
    });
  }

  return results;
}

// --- Open Library --------------------------------------------------------

function parseOpenLibrary(payload: unknown): BookSearchResult[] {
  const root = asRecord(payload);
  if (root === null) return [];

  const results: BookSearchResult[] = [];

  for (const item of asArray(root.docs)) {
    const doc = asRecord(item);
    if (doc === null) continue;

    const title = firstString(doc.title);
    if (title === null) continue;

    const author = firstString(doc.author_name) ?? '';
    const isbn = cleanIsbn(firstString(doc.isbn));

    // Prefer the stable cover_i identifier over an ISBN-derived URL: it is the
    // specific edition Open Library matched, so it is less likely to 404.
    const coverId = typeof doc.cover_i === 'number' ? doc.cover_i : null;
    const coverUrl =
      coverId !== null
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : isbn !== null
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
          : null;

    results.push({
      id: `openlibrary:${firstString(doc.key) ?? title}`,
      title,
      author,
      coverUrl,
      isbn,
      publicationYear:
        typeof doc.first_publish_year === 'number'
          ? doc.first_publish_year
          : extractYear(doc.publish_date),
      source: 'open-library',
    });
  }

  return results;
}

// --- Merging -------------------------------------------------------------

/** Normalise a title/author pair into a key for duplicate detection. */
function dedupeKey(result: BookSearchResult): string {
  if (result.isbn !== null) return `isbn:${result.isbn}`;
  const title = result.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const author = result.author.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `ta:${title}|${author}`;
}

/**
 * Merge the two result sets, preferring whichever entry is more complete.
 *
 * The same book routinely appears in both sources with different gaps, so
 * rather than picking a winner by source we score each candidate on how much
 * usable metadata it carries.
 */
function mergeResults(sets: BookSearchResult[][]): BookSearchResult[] {
  const score = (result: BookSearchResult): number =>
    (result.coverUrl !== null ? 4 : 0) +
    (result.author !== '' ? 2 : 0) +
    (result.publicationYear !== null ? 1 : 0) +
    (result.isbn !== null ? 1 : 0);

  const best = new Map<string, BookSearchResult>();

  // Interleave so neither source dominates the head of the list.
  const maxLength = Math.max(...sets.map((set) => set.length), 0);
  for (let index = 0; index < maxLength; index += 1) {
    for (const set of sets) {
      const result = set[index];
      if (result === undefined) continue;

      const key = dedupeKey(result);
      const existing = best.get(key);
      if (existing === undefined || score(result) > score(existing)) {
        best.set(key, result);
      }
    }
  }

  return Array.from(best.values()).slice(0, MAX_RESULTS);
}

// --- Cache ---------------------------------------------------------------

async function readCache(env: Env, key: string): Promise<BookSearchResult[] | null> {
  try {
    const row = await env.DB.prepare(
      'SELECT payload FROM book_cache WHERE cache_key = ? AND expires_at > ?',
    )
      .bind(key, Math.floor(Date.now() / 1000))
      .first<{ payload: string }>();

    if (!row) return null;
    const parsed: unknown = JSON.parse(row.payload);
    return Array.isArray(parsed) ? (parsed as BookSearchResult[]) : null;
  } catch {
    return null;
  }
}

async function writeCache(env: Env, key: string, results: BookSearchResult[]): Promise<void> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;
    await env.DB.prepare(
      `INSERT INTO book_cache (cache_key, payload, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload, expires_at = excluded.expires_at`,
    )
      .bind(key, JSON.stringify(results), expiresAt)
      .run();

    await env.DB.prepare('DELETE FROM book_cache WHERE expires_at < ?')
      .bind(Math.floor(Date.now() / 1000))
      .run();
  } catch {
    // A cache write failure must not fail the search.
  }
}

// --- Public API ----------------------------------------------------------

/** Search both providers, returning merged results and any partial failures. */
export async function searchBooks(env: Env, query: string): Promise<SearchOutcome> {
  const cacheKey = `search:${query.toLowerCase()}`;

  const cached = await readCache(env, cacheKey);
  if (cached !== null) return { results: cached, warnings: [] };

  const encoded = encodeURIComponent(query);

  const [google, openLibrary] = await Promise.all([
    fetchJson(
      `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=${MAX_RESULTS}&printType=books`,
    ),
    fetchJson(
      `https://openlibrary.org/search.json?q=${encoded}&limit=${MAX_RESULTS}` +
        '&fields=key,title,author_name,isbn,cover_i,first_publish_year,publish_date',
    ),
  ]);

  const warnings: string[] = [];
  if (google === null) warnings.push('Google Books did not respond; showing Open Library results only.');
  if (openLibrary === null)
    warnings.push('Open Library did not respond; showing Google Books results only.');

  const results = mergeResults([parseGoogleBooks(google), parseOpenLibrary(openLibrary)]);

  // Only cache a complete result set, so a transient outage is not frozen in.
  if (results.length > 0 && warnings.length === 0) {
    await writeCache(env, cacheKey, results);
  }

  return { results, warnings };
}

export interface FetchedCover {
  contentType: string;
  bytes: ArrayBuffer;
}

/** Largest cover we will store, to keep D1 rows and email payloads sensible. */
const MAX_COVER_BYTES = 800_000;

/**
 * Download a cover so it can be stored and re-served from our own origin.
 *
 * Returns null on any failure. A missing cover is a normal state the signature
 * handles, so it is never worth failing a book change over.
 */
export async function fetchCover(url: string): Promise<FetchedCover | null> {
  const safe = safeHttpUrl(url);
  if (safe === null) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(safe, {
      signal: controller.signal,
      headers: { Accept: 'image/*', 'User-Agent': USER_AGENT },
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get('Content-Type') ?? '').split(';')[0]?.trim() ?? '';
    if (!contentType.startsWith('image/')) return null;

    const bytes = await response.arrayBuffer();

    // Open Library answers a missing cover with a 1x1 placeholder rather than
    // a 404, so anything implausibly small is treated as "no cover".
    if (bytes.byteLength < 1024 || bytes.byteLength > MAX_COVER_BYTES) return null;

    return { contentType, bytes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
