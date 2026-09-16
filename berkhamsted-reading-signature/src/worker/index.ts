/**
 * Request router.
 *
 * The route table is the security boundary, so it is deliberately explicit
 * rather than pattern-driven: everything under /admin requires a session, and
 * everything under /signature is public and read-only. There is no route that
 * writes to the database without a session and a CSRF token.
 */

import { searchBooks, fetchCover } from './books';
import {
  CSRF_COOKIE,
  clearedCookieHeaders,
  createSession,
  destroySession,
  getSession,
  readCookie,
  sessionCookieHeaders,
  sha256Hex,
  verifyCredentials,
  verifyCsrf,
} from './auth';
import {
  getCurrentBook,
  getImage,
  getSignatureData,
  hasImage,
  putImage,
  deleteImage,
  setCurrentBook,
  updateProfile,
  bumpRevision,
  type ImageKey,
} from './db';
import { readConfig, type Env } from './env';
import {
  LOGIN_RULE,
  MUTATION_RULE,
  SEARCH_RULE,
  clientKey,
  consume,
  purgeExpired,
  reset,
} from './rateLimit';
import {
  adminSecurityHeaders,
  html,
  notFound,
  publicSecurityHeaders,
  redirect,
} from './security';
import {
  renderSignatureDocument,
  renderSignatureHtml,
  renderSignatureText,
  type SignatureOptions,
} from './signature';
import {
  bookPage,
  dashboardPage,
  loginPage,
  profilePage,
  signaturePage,
  COPY_SCRIPT,
} from './ui/pages';
import { validateBook, validateImageUpload, validateProfile, validateSearchQuery } from './validate';

/**
 * Hosts whose images the thumbnail proxy will fetch.
 *
 * The proxy exists so the admin pages can keep a `img-src 'self'` policy while
 * still showing search-result covers. The allowlist is what stops it becoming
 * an open proxy that could be pointed at internal addresses.
 */
const THUMBNAIL_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

/** Short codes carried in the URL after a redirect, rendered as banners. */
const NOTICES: Record<string, string> = {
  'book-set': 'Your current book has been updated. The signature is already showing it.',
  'profile-saved': 'Profile saved.',
  'logo-saved': 'Logo uploaded.',
  'logo-removed': 'Logo removed.',
  'signed-out': 'You have been signed out.',
};

const ERRORS: Record<string, string> = {
  csrf: 'That form had expired. Please try again.',
  'rate-limited': 'Too many requests. Please wait a moment and try again.',
  'cover-failed': 'The book was saved, but its cover could not be downloaded.',
};

let cachedScriptHash: string | null = null;

/** CSP hash for the one inline script, computed once per isolate. */
async function copyScriptHash(): Promise<string> {
  if (cachedScriptHash !== null) return cachedScriptHash;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(COPY_SCRIPT));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  cachedScriptHash = `sha256-${btoa(binary)}`;
  return cachedScriptHash;
}

/** Read a form field as text, ignoring a File entry rather than stringifying it. */
function formText(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}

function adminHtml(body: string, scriptHashes: string[] = []): Response {
  return html(body, { headers: adminSecurityHeaders(scriptHashes) });
}

function signatureOptionsFor(
  url: URL,
  slug: string,
  hasLogo: boolean,
  hasCover: boolean,
): SignatureOptions {
  return { origin: url.origin, slug, hasLogo, hasCover };
}

/** Serve a stored image with long-lived, revision-keyed caching. */
function imageResponse(
  image: { contentType: string; bytes: ArrayBuffer; etag: string },
  request: Request,
  headers: Record<string, string>,
): Response {
  const etag = `"${image.etag}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, ...headers } });
  }

  return new Response(image.bytes, {
    headers: {
      'Content-Type': image.contentType,
      ETag: etag,
      // Safe to cache hard because every URL carries the revision, so a changed
      // book produces a different URL rather than a stale hit.
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...headers,
    },
  });
}

/** A 1x1 transparent GIF, served when an image is requested but absent. */
const EMPTY_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function emptyImage(headers: Record<string, string>): Response {
  // A transparent pixel rather than a 404: email clients render a missing
  // image as a broken-image icon, which looks worse than nothing at all.
  return new Response(EMPTY_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=300',
      ...headers,
    },
  });
}

// --- Public signature routes --------------------------------------------

async function handleSignature(request: Request, env: Env, url: URL): Promise<Response | null> {
  const config = readConfig(env);
  const segments = url.pathname.split('/').filter((part) => part !== '');

  // /signature/<slug>[/<asset>]
  if (segments[0] !== 'signature') return null;

  const slugSegment = segments[1] ?? '';
  const baseSlug = slugSegment.endsWith('.txt') ? slugSegment.slice(0, -4) : slugSegment;
  if (baseSlug !== config.slug) return null;

  const asset = segments[2];
  const headers = publicSecurityHeaders();

  if (asset === 'logo.png' || asset === 'cover.jpg') {
    const key: ImageKey = asset === 'logo.png' ? 'logo' : 'cover';
    const image = await getImage(env, key);
    return image === null
      ? emptyImage(headers)
      : imageResponse(image, request, {
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
        });
  }

  if (asset !== undefined) return notFound();

  const data = await getSignatureData(env);
  const [logoPresent, coverPresent] = await Promise.all([
    hasImage(env, 'logo'),
    hasImage(env, 'cover'),
  ]);
  const options = signatureOptionsFor(url, config.slug, logoPresent, coverPresent);

  // The signature itself is cached only briefly. Its images are immutable and
  // revision-keyed, so the document is the only thing that needs to turn over
  // quickly when the book changes.
  const cacheHeaders = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' };

  if (slugSegment.endsWith('.txt')) {
    return new Response(renderSignatureText(data), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers, ...cacheHeaders },
    });
  }

  return html(renderSignatureDocument(data, options), {
    headers: { ...headers, ...cacheHeaders },
  });
}

// --- Admin ---------------------------------------------------------------

function loginRedirect(): Response {
  return redirect('/admin/login');
}

async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const config = readConfig(env);
  const path = url.pathname;
  const method = request.method;

  // --- Login ---
  if (path === '/admin/login') {
    if (method === 'GET') {
      const existing = await getSession(env, request);
      if (existing !== null) return redirect('/admin');
      return adminHtml(
        loginPage({
          configured: config.configured,
          error: ERRORS[url.searchParams.get('error') ?? ''] ?? null,
          notice: NOTICES[url.searchParams.get('ok') ?? ''] ?? null,
        }),
      );
    }

    if (method === 'POST') {
      const identifier = clientKey(request);
      const limit = await consume(env, 'login', identifier, LOGIN_RULE);

      if (!limit.allowed) {
        return adminHtml(
          loginPage({
            configured: config.configured,
            error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
          }),
        );
      }

      const form = await request.formData();
      const username = formText(form, 'username');
      const password = formText(form, 'password');

      if (!(await verifyCredentials(env, username, password))) {
        // One message for every failure mode, so the response never reveals
        // whether the username was the part that was wrong.
        return adminHtml(
          loginPage({
            configured: config.configured,
            error: config.configured
              ? 'Incorrect username or password.'
              : 'This deployment has no administrator configured yet.',
          }),
        );
      }

      await reset(env, 'login', identifier);
      const session = await createSession(env);

      const headers = new Headers({ Location: '/admin' });
      for (const cookie of sessionCookieHeaders(session)) headers.append('Set-Cookie', cookie);
      return new Response(null, { status: 303, headers });
    }

    return notFound();
  }

  // Everything past this point requires a session.
  const session = await getSession(env, request);
  if (session === null) return loginRedirect();

  const csrfToken = readCookie(request, CSRF_COOKIE) ?? '';

  // --- Logout ---
  if (path === '/admin/logout' && method === 'POST') {
    await destroySession(env, session.token);
    const headers = new Headers({ Location: '/admin/login?ok=signed-out' });
    for (const cookie of clearedCookieHeaders()) headers.append('Set-Cookie', cookie);
    return new Response(null, { status: 303, headers });
  }

  /** Shared guard for every state-changing request. */
  const guardMutation = async (form: FormData): Promise<Response | null> => {
    const limit = await consume(env, 'mutate', clientKey(request), MUTATION_RULE);
    if (!limit.allowed) return redirect(`${url.pathname}?error=rate-limited`);

    const ok = await verifyCsrf(request, session, formText(form, 'csrf'));
    return ok ? null : redirect(`${url.pathname}?error=csrf`);
  };

  const notice = NOTICES[url.searchParams.get('ok') ?? ''] ?? null;
  const error = ERRORS[url.searchParams.get('error') ?? ''] ?? null;

  const buildContext = async () => {
    const data = await getSignatureData(env);
    const [logoPresent, coverPresent] = await Promise.all([
      hasImage(env, 'logo'),
      hasImage(env, 'cover'),
    ]);
    const options = signatureOptionsFor(url, config.slug, logoPresent, coverPresent);
    return { data, options, publicUrl: `${url.origin}/signature/${config.slug}` };
  };

  // --- Dashboard ---
  if (path === '/admin' && method === 'GET') {
    const { data, options, publicUrl } = await buildContext();
    return adminHtml(
      dashboardPage({ data, signatureOptions: options, publicUrl, notice, error }),
    );
  }

  // --- Signature ---
  if (path === '/admin/signature' && method === 'GET') {
    const { data, options, publicUrl } = await buildContext();
    return adminHtml(
      signaturePage({
        data,
        signatureOptions: options,
        publicUrl,
        signatureHtml: renderSignatureHtml(data, options),
        notice,
      }),
      [await copyScriptHash()],
    );
  }

  // --- Change book ---
  if (path === '/admin/book') {
    if (method === 'GET') {
      const rawQuery = url.searchParams.get('q');
      const current = await getCurrentBook(env);

      if (rawQuery === null) {
        return adminHtml(
          bookPage({
            csrfToken,
            query: '',
            results: [],
            warnings: [],
            searched: false,
            errors: {},
            notice,
            error,
            current,
          }),
        );
      }

      const validated = validateSearchQuery(rawQuery);
      if (!validated.ok) {
        return adminHtml(
          bookPage({
            csrfToken,
            query: rawQuery,
            results: [],
            warnings: [],
            searched: false,
            errors: validated.errors,
            current,
          }),
        );
      }

      const limit = await consume(env, 'search', clientKey(request), SEARCH_RULE);
      if (!limit.allowed) {
        return adminHtml(
          bookPage({
            csrfToken,
            query: rawQuery,
            results: [],
            warnings: [],
            searched: false,
            errors: { query: 'Too many searches. Please wait a moment.' },
            current,
          }),
        );
      }

      const outcome = await searchBooks(env, validated.value ?? '');
      return adminHtml(
        bookPage({
          csrfToken,
          query: validated.value ?? '',
          results: outcome.results,
          warnings: outcome.warnings,
          searched: true,
          errors: {},
          notice,
          error,
          current,
        }),
      );
    }

    if (method === 'POST') {
      const form = await request.formData();
      const blocked = await guardMutation(form);
      if (blocked !== null) return blocked;

      const validated = validateBook(form);
      if (!validated.ok || validated.value === undefined) {
        return adminHtml(
          bookPage({
            csrfToken,
            query: '',
            results: [],
            warnings: [],
            searched: false,
            errors: validated.errors,
            error: 'Please correct the highlighted fields.',
            current: await getCurrentBook(env),
          }),
        );
      }

      await setCurrentBook(env, validated.value);

      // Download the cover so the signature serves it from our own origin.
      // Failure here is reported but does not undo the book change.
      let coverFailed = false;
      if (validated.value.coverUrl !== null) {
        const cover = await fetchCover(validated.value.coverUrl);
        if (cover === null) {
          coverFailed = true;
          await deleteImage(env, 'cover');
        } else {
          await putImage(
            env,
            'cover',
            cover.contentType,
            cover.bytes,
            await sha256Hex(`${validated.value.title}:${cover.bytes.byteLength}:${Date.now()}`),
          );
        }
      } else {
        await deleteImage(env, 'cover');
      }

      await bumpRevision(env);
      return redirect(coverFailed ? '/admin?error=cover-failed' : '/admin?ok=book-set');
    }

    return notFound();
  }

  // --- Profile ---
  if (path === '/admin/profile') {
    if (method === 'GET') {
      const { data } = await buildContext();
      return adminHtml(
        profilePage({
          csrfToken,
          data,
          hasLogo: await hasImage(env, 'logo'),
          errors: {},
          notice,
          error,
        }),
      );
    }

    if (method === 'POST') {
      const form = await request.formData();
      const blocked = await guardMutation(form);
      if (blocked !== null) return blocked;

      const validated = validateProfile(form);
      if (!validated.ok || validated.value === undefined) {
        const { data } = await buildContext();
        return adminHtml(
          profilePage({
            csrfToken,
            data,
            hasLogo: await hasImage(env, 'logo'),
            errors: validated.errors,
            error: 'Please correct the highlighted fields.',
          }),
        );
      }

      await updateProfile(env, validated.value);
      return redirect('/admin/profile?ok=profile-saved');
    }

    return notFound();
  }

  // --- Logo upload ---
  if (path === '/admin/logo' && method === 'POST') {
    const form = await request.formData();
    const blocked = await guardMutation(form);
    if (blocked !== null) return blocked;

    const validated = await validateImageUpload(form.get('logo'));
    if (!validated.ok || validated.value === undefined) {
      const { data } = await buildContext();
      return adminHtml(
        profilePage({
          csrfToken,
          data,
          hasLogo: await hasImage(env, 'logo'),
          errors: validated.errors,
          error: 'The logo could not be uploaded.',
        }),
      );
    }

    await putImage(
      env,
      'logo',
      validated.value.contentType,
      validated.value.bytes,
      await sha256Hex(`logo:${validated.value.bytes.byteLength}:${Date.now()}`),
    );
    await bumpRevision(env);
    return redirect('/admin/profile?ok=logo-saved');
  }

  if (path === '/admin/logo/delete' && method === 'POST') {
    const form = await request.formData();
    const blocked = await guardMutation(form);
    if (blocked !== null) return blocked;

    await deleteImage(env, 'logo');
    await bumpRevision(env);
    return redirect('/admin/profile?ok=logo-removed');
  }

  // --- Authenticated image previews ---
  if (path === '/admin/image/cover' || path === '/admin/image/logo') {
    const key: ImageKey = path.endsWith('logo') ? 'logo' : 'cover';
    const image = await getImage(env, key);
    const headers = { 'Cross-Origin-Resource-Policy': 'same-origin' };
    return image === null ? emptyImage(headers) : imageResponse(image, request, headers);
  }

  // --- Thumbnail proxy for search results ---
  if (path === '/admin/thumb' && method === 'GET') {
    const target = url.searchParams.get('url') ?? '';
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return notFound();
    }

    if (parsed.protocol !== 'https:' || !THUMBNAIL_HOSTS.has(parsed.hostname)) {
      return notFound();
    }

    const upstream = await fetchCover(parsed.toString());
    if (upstream === null) return emptyImage({});

    return new Response(upstream.bytes, {
      headers: {
        'Content-Type': upstream.contentType,
        'Cache-Control': 'public, max-age=3600',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  }

  return notFound();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Public signature first: it is the hot path and needs no session lookup.
      const signature = await handleSignature(request, env, url);
      if (signature !== null) return signature;

      if (url.pathname === '/') {
        return redirect('/admin');
      }

      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        // Housekeeping runs after the response, so it never adds latency.
        ctx.waitUntil(purgeExpired(env));
        return await handleAdmin(request, env, url);
      }

      if (url.pathname === '/robots.txt') {
        return new Response('User-agent: *\nDisallow: /\n', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      return notFound();
    } catch (error) {
      // Never leak an internal error to the client. The detail goes to the
      // Workers log, where observability is enabled.
      console.error('Unhandled error', error);
      return new Response('Something went wrong.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
