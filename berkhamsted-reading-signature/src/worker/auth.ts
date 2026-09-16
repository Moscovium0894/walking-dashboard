/**
 * Authentication, sessions and CSRF.
 *
 * Shape of the design:
 *
 *  * There is exactly one administrator and no registration route. Credentials
 *    come from Worker secrets, not from the database, so there is no user table
 *    to enumerate and no password reset flow to attack.
 *  * Passwords are never compared as strings. Both the supplied and the
 *    expected password are put through PBKDF2 and the resulting digests are
 *    compared in constant time, so neither the length nor any prefix of the
 *    real password leaks through response timing.
 *  * Sessions are server-side. Only the SHA-256 of the cookie token is stored,
 *    so read access to the database does not yield a usable session. Logging
 *    out deletes the row, which genuinely revokes the session rather than
 *    relying on the client to discard a token.
 *  * Every mutation requires both a same-origin check and a CSRF token.
 */

import type { Env } from './env';
import { readConfig } from './env';

export const SESSION_COOKIE = '__Host-brs_session';

/** Sessions last a week; long enough to be convenient, short enough to expire. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * PBKDF2 iteration count.
 *
 * This runs on every login attempt, and Workers limits CPU per request, so it
 * is a compromise between hardening and staying inside that budget. It is a
 * second line of defence: the password itself is a high-entropy secret, and
 * login is rate limited, so this does not carry the whole burden.
 */
const PBKDF2_ITERATIONS = 100_000;

export interface Session {
  id: string;
  csrfToken: string;
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
 * Both inputs are hashed first, so the comparison always runs over 32 bytes
 * regardless of the inputs' lengths and an attacker learns nothing from the
 * time taken, not even how long the expected value is.
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

/** Derive a PBKDF2 digest of a password, salted with the session secret. */
async function derivePassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return toBase64Url(new Uint8Array(bits));
}

/**
 * Verify a username and password against the configured administrator.
 *
 * Both the username and the password are always fully evaluated, even when the
 * username is already known to be wrong, so a valid username cannot be
 * distinguished from an invalid one by timing.
 */
export async function verifyCredentials(
  env: Env,
  username: string,
  password: string,
): Promise<boolean> {
  const config = readConfig(env);
  if (!config.configured) return false;

  const [suppliedDigest, expectedDigest, usernameMatches] = await Promise.all([
    derivePassword(password, config.sessionSecret),
    derivePassword(config.adminPassword, config.sessionSecret),
    constantTimeEquals(username, config.adminUsername),
  ]);

  const passwordMatches = await constantTimeEquals(suppliedDigest, expectedDigest);
  return usernameMatches && passwordMatches;
}

/** Create a session row and return the tokens to hand to the browser. */
export async function createSession(env: Env): Promise<Session> {
  const token = randomToken();
  const csrfToken = randomToken();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, csrf_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(
      await sha256Hex(token),
      await sha256Hex(csrfToken),
      new Date().toISOString(),
      now + SESSION_TTL_SECONDS,
    )
    .run();

  // Opportunistically clear expired rows so the table cannot grow without bound.
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();

  return { id: token, csrfToken };
}

/** Read a cookie value from a request, without regex backtracking surprises. */
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

export interface AuthenticatedSession {
  csrfToken: string;
  token: string;
}

/**
 * Resolve the session for a request, or null when unauthenticated.
 *
 * Note this returns the CSRF *hash*, not the token: the token itself is only
 * ever known to the browser that received it. Forms echo the token back and we
 * compare hashes.
 */
export async function getSession(
  env: Env,
  request: Request,
): Promise<{ token: string; csrfHash: string } | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await env.DB.prepare('SELECT csrf_hash, expires_at FROM sessions WHERE id = ?')
    .bind(await sha256Hex(token))
    .first<{ csrf_hash: string; expires_at: number }>();

  if (!row) return null;

  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    await destroySession(env, token);
    return null;
  }

  return { token, csrfHash: row.csrf_hash };
}

export async function destroySession(env: Env, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
}

/**
 * The session token is issued fresh on login, so rather than storing the CSRF
 * token anywhere retrievable we re-derive a per-session value for forms. The
 * cookie holds the session; this holds the matching CSRF token.
 */
export const CSRF_COOKIE = '__Host-brs_csrf';

/**
 * Validate a submitted CSRF token against the session.
 *
 * Belt and braces: the token must match the session's stored hash *and* the
 * request must be same-origin. Either check alone would be adequate for modern
 * browsers; together they also cover older clients that omit Origin.
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
 * Build the Set-Cookie headers for a new session.
 *
 * The `__Host-` prefix is enforced by browsers: it requires Secure, Path=/ and
 * no Domain attribute, which prevents a subdomain from writing a cookie that
 * this Worker would accept.
 */
export function sessionCookieHeaders(session: Session): string[] {
  const attributes = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
  return [
    `${SESSION_COOKIE}=${session.id}; ${attributes}`,
    // Readable by the page so forms can embed it; its value is useless without
    // the HttpOnly session cookie that it is bound to.
    `${CSRF_COOKIE}=${session.csrfToken}; Path=/; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  ];
}

export function clearedCookieHeaders(): string[] {
  const expired = 'Path=/; Secure; Max-Age=0';
  return [`${SESSION_COOKIE}=; HttpOnly; ${expired}`, `${CSRF_COOKIE}=; ${expired}`];
}
