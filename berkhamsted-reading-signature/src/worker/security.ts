/**
 * Response construction and security headers.
 *
 * This repository is public, so the login mechanism is fully visible to anyone
 * who wants to attack it. The defences here therefore assume the attacker has
 * read the source, and rely on secrets and rate limits rather than obscurity.
 */

/**
 * Headers applied to every admin response.
 *
 * The CSP is strict and needs no hashes or 'unsafe-inline' for scripts: the
 * the signed-in pages load their small scripts from /js/, so a plain
 * `script-src 'self'` covers them. blob: is allowed for images because the
 * logo cropper previews a locally selected file before it is uploaded.
 */
export function adminSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "form-action 'self'",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'none'",
      "connect-src 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  };
}

/**
 * Headers for the public signature.
 *
 * Looser than the admin headers by necessity: the signature is embedded in
 * third-party email clients and webmail, so it must be framable and its images
 * must be loadable cross-origin. It still carries no script of any kind.
 */
export function publicSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "base-uri 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  };
}

export interface ResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

export function html(body: string, options: ResponseOptions = {}): Response {
  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...options.headers,
    },
  });
}

export function json(data: unknown, options: ResponseOptions = {}): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...options.headers,
    },
  });
}

export function redirect(location: string, options: ResponseOptions = {}): Response {
  return new Response(null, {
    status: options.status ?? 303,
    headers: {
      Location: location,
      ...options.headers,
    },
  });
}

export function notFound(message = 'Not found'): Response {
  return new Response(message, {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Apply a header map to an existing response without rebuilding its body. */
export function withHeaders(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    merged.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
