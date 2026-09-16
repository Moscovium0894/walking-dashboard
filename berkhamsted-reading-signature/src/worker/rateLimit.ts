/**
 * Fixed-window rate limiting, backed by D1.
 *
 * D1 rather than KV because it keeps the deployment to a single storage
 * binding, and the write volume here is trivial next to D1's free allowance.
 *
 * A fixed window can admit up to twice the limit across a window boundary. That
 * is an accepted trade-off: the purpose is to make online password guessing
 * hopeless and to stop a mutation endpoint being hammered, and doubling a limit
 * of five attempts per fifteen minutes changes nothing about either.
 */

import type { Env } from './env';

export interface RateLimitRule {
  /** Maximum requests permitted within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Login is the sensitive one: this repository is public, so the login endpoint
 * is a known, reachable target. Five attempts per quarter hour per IP makes
 * guessing a strong password infeasible while staying out of the way of
 * somebody genuinely mistyping.
 */
export const LOGIN_RULE: RateLimitRule = { limit: 5, windowSeconds: 15 * 60 };

/** Mutations are authenticated already; this is a guard against runaway loops. */
export const MUTATION_RULE: RateLimitRule = { limit: 60, windowSeconds: 60 };

/** Book search hits third-party APIs, so it gets its own, tighter budget. */
export const SEARCH_RULE: RateLimitRule = { limit: 30, windowSeconds: 60 };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

/**
 * Identify the caller.
 *
 * `CF-Connecting-IP` is set by Cloudflare's edge and cannot be spoofed by the
 * client, unlike `X-Forwarded-For`, so it is the only header trusted here.
 */
export function clientKey(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * Consume one unit from a bucket.
 *
 * Failure is deliberately closed for login: if the database errors while
 * checking the limit, the request is refused rather than admitted, so a
 * database problem cannot become a way to bypass throttling.
 */
export async function consume(
  env: Env,
  scope: string,
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const bucket = `${scope}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % rule.windowSeconds);

  try {
    // Reset the row when it belongs to an earlier window, otherwise increment.
    await env.DB.prepare(
      `INSERT INTO rate_limit (bucket, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN rate_limit.window_start = excluded.window_start
                      THEN rate_limit.count + 1 ELSE 1 END,
         window_start = excluded.window_start`,
    )
      .bind(bucket, windowStart)
      .run();

    const row = await env.DB.prepare('SELECT count FROM rate_limit WHERE bucket = ?')
      .bind(bucket)
      .first<{ count: number }>();

    const count = row?.count ?? 1;
    const retryAfter = windowStart + rule.windowSeconds - now;

    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfter: Math.max(1, retryAfter),
    };
  } catch {
    return { allowed: false, remaining: 0, retryAfter: rule.windowSeconds };
  }
}

/** Clear a bucket, used after a successful login so a valid user is not punished. */
export async function reset(env: Env, scope: string, identifier: string): Promise<void> {
  try {
    await env.DB.prepare('DELETE FROM rate_limit WHERE bucket = ?')
      .bind(`${scope}:${identifier}`)
      .run();
  } catch {
    // Best effort only: failing to clear a bucket is harmless.
  }
}

/** Remove rows from windows that have long since passed. */
export async function purgeExpired(env: Env): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  try {
    await env.DB.prepare('DELETE FROM rate_limit WHERE window_start < ?').bind(cutoff).run();
  } catch {
    // Best effort.
  }
}
