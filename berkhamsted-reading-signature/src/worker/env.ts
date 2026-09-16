/**
 * Bindings and configuration.
 *
 * The application runs with no secrets set at all. Passwords are hashed with a
 * per-user random salt held in the database, which is standard practice; the
 * optional PASSWORD_PEPPER below is defence in depth on top of that, not a
 * requirement.
 */
export interface Env {
  /** D1 database binding. The only binding the application needs. */
  DB: D1Database;

  /**
   * Optional extra secret mixed into every password hash.
   *
   * Because it lives outside the database, setting it means a leaked database
   * alone cannot be attacked offline. Setting or changing it invalidates every
   * existing password, so it is best chosen before anyone registers.
   */
  PASSWORD_PEPPER?: string;

  /**
   * Optional. When set, registration requires this code, turning an open site
   * into an invite-only one without a code change.
   */
  SIGNUP_CODE?: string;
}

export interface Config {
  /** Empty when unset, which is supported. */
  pepper: string;
  signupCode: string;
  /** True when registration requires an invitation code. */
  signupRestricted: boolean;
}

export function readConfig(env: Env): Config {
  const signupCode = (env.SIGNUP_CODE ?? '').trim();
  return {
    pepper: env.PASSWORD_PEPPER ?? '',
    signupCode,
    signupRestricted: signupCode !== '',
  };
}
