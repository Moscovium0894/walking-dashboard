/** Bindings and configuration available to the Worker. */
export interface Env {
  /** D1 database binding. */
  DB: D1Database;

  /** Path segment for the public signature: /signature/<slug>. */
  SIGNATURE_SLUG?: string;

  // --- Secrets. Set in the Cloudflare dashboard, never in source. ---

  /** Administrator username. */
  ADMIN_USERNAME?: string;
  /** Administrator password, compared against after key derivation. */
  ADMIN_PASSWORD?: string;
  /** Random key used to sign session cookies. */
  SESSION_SECRET?: string;
}

/** Configuration resolved from the environment, with defaults applied. */
export interface Config {
  slug: string;
  adminUsername: string;
  adminPassword: string;
  sessionSecret: string;
  /** True when every secret needed to log in is present. */
  configured: boolean;
}

const DEFAULT_SLUG = 'otto';

/**
 * Read configuration from the environment.
 *
 * Deliberately does not throw when secrets are missing. A half-configured
 * deployment should still serve the public signature and show a clear setup
 * message on the login page, rather than returning an opaque 500.
 */
export function readConfig(env: Env): Config {
  const adminUsername = (env.ADMIN_USERNAME ?? '').trim();
  const adminPassword = env.ADMIN_PASSWORD ?? '';
  const sessionSecret = env.SESSION_SECRET ?? '';

  const slugCandidate = (env.SIGNATURE_SLUG ?? '').trim().toLowerCase();
  const slug = /^[a-z0-9-]{1,40}$/.test(slugCandidate) ? slugCandidate : DEFAULT_SLUG;

  return {
    slug,
    adminUsername,
    adminPassword,
    sessionSecret,
    configured: adminUsername !== '' && adminPassword !== '' && sessionSecret !== '',
  };
}
