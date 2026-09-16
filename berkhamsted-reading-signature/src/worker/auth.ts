/**
 * Authentication, sessions and CSRF.
 *
 * Shape of the design:
 *
 *  * Anyone may register, but an account can only ever act on itself. The user
 *    id comes from the session row, never from the request, so there is no
 *    parameter an attacker could change to reach somebody else's data.
 *  * Each account has its own random salt, so two people choosing the same
 *    password store different hashes and one cracked password reveals nothing
 *    about another account.
 *  * An optional PASSWORD_PEPPER is mixed in. It is not required: with it, a
 *    leaked database cannot be attacked offline; without it, the per-user salt
 *    and PBKDF2 still apply, which is ordinary practice.
 *  * Passwords are never compared as strings. Both sides go through PBKDF2 and
 *    the digests are compared in constant time, and an unknown username still
 *    does the full derivation, so response timing reveals neither the password
 *    nor whether the account exists.
 *  * Sessions are server-side. Only the SHA-256 of the cookie token is stored,
 *    so read access to the database does not yield a usable session, and
 *    logging out deletes the row rather than trusting the client to forget.
 */

import { getCredentialsByUsername } from './db';
import type { Env } from './env';
import { readConfig } from './env';

export const SESSION_COOKIE = '__Host-brs_session';
export const CSRF_COOKIE = '__Host-brs_csrf';

/** Sessions last a week: convenient, but not indefinite. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * PBKDF2 iteration count.
 *
 * This runs on every login attempt and Workers caps CPU per request, so it is a
 * compromise between hardening and staying inside that budget. It is one layer
 * of several: logins are rate limited and the hashes are peppered.
 */
const PBKDF2_ITERATIONS = 100_000;

export interface Session {
  token: string;
  csrfToken: string;
}

export interface ActiveSession {
  token: string;
  csrfHash: string;
  userId: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cryptographically random token, URL and cookie safe. */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** Hex SHA-256, used to store tokens without storing the tokens themselves. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compare two strings without leaking where they diverge.
 *
 * Both inputs are hashed first, so the comparison always runs over 32 bytes and
 * the time taken reveals nothing, not even the expected value's length.
 */
export async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);

  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);

  let difference = 0;
  for (let i = 0; i < bytesA.length; i += 1) {
    difference |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return difference === 0;
}

/**
 * Derive a password digest.
 *
 * Salted per account and peppered with SESSION_SECRET, which is not in the
 * database.
 */
async function derivePassword(password: string, salt: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`${salt}:${pepper}`),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return toBase64Url(new Uint8Array(bits));
}

export interface HashedPassword {
  hash: string;
  salt: string;
}

/** Hash a new password with a fresh random salt. */
export async function hashPassword(env: Env, password: string): Promise<HashedPassword> {
  const salt = randomToken(16);
  const hash = await derivePassword(password, salt, readConfig(env).pepper);
  return { hash, salt };
}

/**
 * Verify a username and password, returning the user id or null.
 *
 * An unknown username still performs a full derivation against a dummy salt, so
 * the response takes the same time whether or not the account exists. Without
 * that, an attacker could enumerate valid usernames by timing alone.
 */
export async function authenticate(
  env: Env,
  username: string,
  password: string,
): Promise<number | null> {
  const config = readConfig(env);
  const credentials = await getCredentialsByUsername(env, username);

  const salt = credentials?.passwordSalt ?? 'absent-account-placeholder-salt';
  const expected = credentials?.passwordHash ?? '';

  const supplied = await derivePassword(password, salt, config.pepper);

  // An account with an empty hash has not had its password set yet, and must
  // never authenticate however the comparison turns out.
  const matches = expected !== '' && (await constantTimeEquals(supplied, expected));

  return matches && credentials ? credentials.id : null;
}

// --- Sessions ------------------------------------------------------------

export async function createSession(env: Env, userId: number): Promise<Session> {
  const token = randomToken();
  const csrfToken = randomToken();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, csrf_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(
      await sha256Hex(token),
      userId,
      await sha256Hex(csrfToken),
      new Date().toISOString(),
      now + SESSION_TTL_SECONDS,
    )
    .run();

  // Clear expired rows opportunistically so the table cannot grow without bound.
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();

  return { token, csrfToken };
}

/** Read a cookie value without regex backtracking surprises. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

/**
 * Resolve the session for a request, or null when unauthenticated.
 *
 * The user id returned here is the only source of identity in the application.
 */
export async function getSession(env: Env, request: Request): Promise<ActiveSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await env.DB.prepare(
    'SELECT user_id, csrf_hash, expires_at FROM sessions WHERE id = ?',
  )
    .bind(await sha256Hex(token))
    .first<{ user_id: number; csrf_hash: string; expires_at: number }>();

  if (!row) return null;

  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    await destroySession(env, token);
    return null;
  }

  return { token, csrfHash: row.csrf_hash, userId: row.user_id };
}

export async function destroySession(env: Env, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
}

/**
 * Validate a submitted CSRF token against the session.
 *
 * Belt and braces: the token must match the session's stored hash AND the
 * request must be same-origin. Either alone would be adequate for modern
 * browsers; together they also cover clients that omit Origin.
 */
export async function verifyCsrf(
  request: Request,
  session: { csrfHash: string },
  submittedToken: string,
): Promise<boolean> {
  const origin = request.headers.get('Origin');
  if (origin !== null) {
    const expected = new URL(request.url).origin;
    if (origin !== expected) return false;
  }

  if (!submittedToken) return false;
  return constantTimeEquals(await sha256Hex(submittedToken), session.csrfHash);
}

/**
 * Set-Cookie headers for a new session.
 *
 * The `__Host-` prefix is enforced by browsers: it requires Secure, Path=/ and
 * no Domain, which stops a subdomain writing a cookie this Worker would accept.
 */
export function sessionCookieHeaders(session: Session): string[] {
  const attributes = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
  return [
    `${SESSION_COOKIE}=${session.token}; ${attributes}`,
    // Readable by the page so forms can embed it. Useless without the HttpOnly
    // session cookie it is bound to.
    `${CSRF_COOKIE}=${session.csrfToken}; Path=/; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  ];
}

export function clearedCookieHeaders(): string[] {
  const expired = 'Path=/; Secure; Max-Age=0';
  return [`${SESSION_COOKIE}=; HttpOnly; ${expired}`, `${CSRF_COOKIE}=; ${expired}`];
}
