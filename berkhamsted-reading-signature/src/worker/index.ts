/**
 * Request router.
 *
 * The route table is the security boundary, so it is explicit rather than
 * pattern-driven. Two rules hold everywhere:
 *
 *  1. Everything under /admin requires a session, and the acting user is read
 *     from that session row. No route takes a user id from the request, so
 *     there is no parameter an attacker could change to act as someone else.
 *  2. Everything under /signature is public and read-only. It resolves a user
 *     from the slug in the path, and can only ever read.
 */

import { fetchCover, searchBooks } from './books';
import {
  CSRF_COOKIE,
  authenticate,
  clearedCookieHeaders,
  createSession,
  destroySession,
  getSession,
  hashPassword,
  readCookie,
  sessionCookieHeaders,
  sha256Hex,
  verifyCsrf,
  type ActiveSession,
} from './auth';
import { decodeAsset } from './assets.generated';
import {
  bumpRevision,
  createUser,
  deleteImage,
  getCurrentBook,
  getImage,
  getSignatureData,
  getUserById,
  getUserBySlug,
  hasImage,
  putImage,
  setCurrentBook,
  setSignatureImageState,
  slugTaken,
  updateProfile,
  usernameTaken,
  type ImageKey,
  type User,
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
  json,
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
import { COPY_JS, CROPPER_JS } from './ui/clientScripts';
import { SIGNATURE_IMAGE_JS } from './ui/signatureImageScript';
import {
  bookPage,
  dashboardPage,
  loginPage,
  profilePage,
  registerPage,
  signaturePage,
} from './ui/pages';
import {
  validateBook,
  validateImageUpload,
  validateProfile,
  validateRegistration,
  validateSearchQuery,
} from './validate';

/**
 * Hosts whose images the thumbnail proxy will fetch.
 *
 * The allowlist is what stops it becoming an open proxy that could be aimed at
 * an internal address.
 */
const THUMBNAIL_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

const NOTICES: Record<string, string> = {
  'book-set': 'Your current book has been updated.',
  'profile-saved': 'Profile saved.',
  'logo-saved': 'Logo uploaded.',
  'logo-removed': 'Logo removed.',
  'signed-out': 'You have been signed out.',
  registered: 'Welcome. Set your house, school and current book to finish your signature.',
};

const ERRORS: Record<string, string> = {
  csrf: 'That form had expired. Please try again.',
  'rate-limited': 'Too many requests. Please wait a moment and try again.',
  'cover-failed': 'The book was saved, but its cover could not be downloaded.',
};

function adminHtml(body: string): Response {
  return html(body, { headers: adminSecurityHeaders() });
}

/** Serve a client script with a long cache life; content is fixed per deploy. */
function scriptResponse(source: string): Response {
  return new Response(source, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Read a form field as text, ignoring a File entry rather than stringifying it. */
function formText(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}

function signatureOptionsFor(url: URL, slug: string, hasCover: boolean): SignatureOptions {
  // hasLogo is always true: the logo route falls back to the built-in crest.
  return { origin: url.origin, slug, hasLogo: true, hasCover };
}

function imageResponse(
  image: { contentType: string; bytes: ArrayBuffer; etag: string },
  request: Request,
  headers: Record<string, string>,
  cacheControl = 'public, max-age=31536000, immutable',
): Response {
  const etag = `"${image.etag}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, ...headers } });
  }

  return new Response(image.bytes, {
    headers: {
      'Content-Type': image.contentType,
      ETag: etag,
      'Cache-Control': cacheControl,
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
  // A transparent pixel rather than a 404: mail clients render a missing image
  // as a broken-image icon, which looks worse than nothing.
  return new Response(EMPTY_GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=300', ...headers },
  });
}

// --- Public signature ----------------------------------------------------

async function handleSignature(request: Request, env: Env, url: URL): Promise<Response | null> {
  const segments = url.pathname.split('/').filter((part) => part !== '');
  if (segments[0] !== 'signature') return null;

  const slugSegment = segments[1] ?? '';
  const slug = slugSegment.replace(/\.(txt|png)$/, '');
  if (slug === '') return notFound();

  // Public signatures are strictly read-only. Nothing here mutates, but say so
  // explicitly rather than quietly serving a body in reply to a POST.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('The signature is read-only.', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const user = await getUserBySlug(env, slug);
  if (user === null) return notFound('No signature found at that address.');

  const asset = segments[2];
  const headers = publicSecurityHeaders();
  const crossOrigin = {
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
  };

  // The whole signature as one image. Its address never changes, because an
  // already-sent email cannot be given a new URL - that is the entire point.
  // Caching is therefore short and revalidated rather than immutable.
  if (slugSegment.endsWith('.png') && asset === undefined) {
    const image = await getImage(env, user.id, 'signature');
    if (image === null) return emptyImage({ ...headers, ...crossOrigin });
    return imageResponse(
      image,
      request,
      { ...headers, ...crossOrigin },
      'public, max-age=300, must-revalidate',
    );
  }

  const PUBLIC_ASSETS: Record<string, ImageKey> = { 'logo.png': 'logo', 'cover.jpg': 'cover' };

  if (asset !== undefined) {
    if (!(asset in PUBLIC_ASSETS)) return notFound();

    const key = PUBLIC_ASSETS[asset] as ImageKey;
    const image = await getImage(env, user.id, key);
    if (image !== null) return imageResponse(image, request, crossOrigin);

    // No uploaded logo, so serve the built-in crest rather than a blank pixel.
    if (key === 'logo') {
      const fallback = decodeAsset('berkhamsted-logo.png');
      if (fallback !== null) {
        return new Response(fallback, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
            ...crossOrigin,
          },
        });
      }
    }
    return emptyImage({ ...headers, ...crossOrigin });
  }

  const data = await getSignatureData(env, user);
  if (data === null) return notFound('That signature is not set up yet.');

  const coverPresent = await hasImage(env, user.id, 'cover');
  const options = signatureOptionsFor(url, user.slug, coverPresent);
  const cacheHeaders = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' };

  if (slugSegment.endsWith('.txt')) {
    return new Response(renderSignatureText(data), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers, ...cacheHeaders },
    });
  }

  return html(renderSignatureDocument(data, options), { headers: { ...headers, ...cacheHeaders } });
}

// --- Registration and sign-in -------------------------------------------

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const config = readConfig(env);

  if (request.method === 'GET') {
    if ((await getSession(env, request)) !== null) return redirect('/admin');
    return adminHtml(registerPage({ signupRestricted: config.signupRestricted, errors: {} }));
  }

  if (request.method !== 'POST') return notFound();

  // Registration shares the login budget: an open signup form on a public
  // Worker is otherwise an invitation to script account creation.
  const identifier = clientKey(request);
  const limit = await consume(env, 'register', identifier, LOGIN_RULE);
  if (!limit.allowed) {
    return adminHtml(
      registerPage({
        signupRestricted: config.signupRestricted,
        errors: {},
        error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
      }),
    );
  }

  const form = await request.formData();

  const fail = (errors: Record<string, string>, message?: string): Response =>
    adminHtml(
      registerPage({
        signupRestricted: config.signupRestricted,
        errors,
        error: message ?? 'Please correct the highlighted fields.',
        values: {
          username: formText(form, 'username'),
          slug: formText(form, 'slug'),
          name: formText(form, 'name'),
          dateOfBirth: formText(form, 'dateOfBirth'),
        },
      }),
    );

  if (config.signupRestricted && formText(form, 'code').trim() !== config.signupCode) {
    return fail({ code: 'That invitation code is not right.' });
  }

  const validated = validateRegistration(form);
  if (!validated.ok || validated.value === undefined) return fail(validated.errors);

  const { username, slug, password, name, dateOfBirth } = validated.value;

  if (await usernameTaken(env, username)) return fail({ username: 'That username is already taken.' });
  if (await slugTaken(env, slug)) return fail({ slug: 'That web address is already taken.' });

  const { hash, salt } = await hashPassword(env, password);
  const userId = await createUser(env, {
    username,
    slug,
    passwordHash: hash,
    passwordSalt: salt,
    name,
    dateOfBirth,
  });

  // Null means a UNIQUE violation: another registration won the race.
  if (userId === null) {
    return fail({ username: 'That username or web address was just taken. Please try another.' });
  }

  const session = await createSession(env, userId);
  const headers = new Headers({ Location: '/admin?ok=registered' });
  for (const cookie of sessionCookieHeaders(session)) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

async function handleLogin(request: Request, env: Env, url: URL): Promise<Response> {
  const config = readConfig(env);

  if (request.method === 'GET') {
    if ((await getSession(env, request)) !== null) return redirect('/admin');
    return adminHtml(
      loginPage({
        signupRestricted: config.signupRestricted,
        error: ERRORS[url.searchParams.get('error') ?? ''] ?? null,
        notice: NOTICES[url.searchParams.get('ok') ?? ''] ?? null,
      }),
    );
  }

  if (request.method !== 'POST') return notFound();

  const identifier = clientKey(request);
  const limit = await consume(env, 'login', identifier, LOGIN_RULE);

  if (!limit.allowed) {
    return adminHtml(
      loginPage({
        signupRestricted: config.signupRestricted,
        error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
      }),
    );
  }

  const form = await request.formData();
  const userId = await authenticate(env, formText(form, 'username'), formText(form, 'password'));

  if (userId === null) {
    // One message for every failure mode, so the response never reveals which
    // part was wrong or whether the account exists.
    return adminHtml(
      loginPage({
        signupRestricted: config.signupRestricted,
        error: 'Incorrect username or password.',
      }),
    );
  }

  await reset(env, 'login', identifier);
  const session = await createSession(env, userId);

  const headers = new Headers({ Location: '/admin' });
  for (const cookie of sessionCookieHeaders(session)) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

// --- Signed-in area ------------------------------------------------------

async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
  session: ActiveSession,
  user: User,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const csrfToken = readCookie(request, CSRF_COOKIE) ?? '';

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

  // Every read below is scoped to `user`, which came from the session row.
  const context = async () => {
    const data = await getSignatureData(env, user);
    if (data === null) throw new Error(`Profile missing for user ${user.id}`);

    const [coverPresent, logoPresent, originalPresent] = await Promise.all([
      hasImage(env, user.id, 'cover'),
      hasImage(env, user.id, 'logo'),
      hasImage(env, user.id, 'logo-original'),
    ]);

    return {
      data,
      options: signatureOptionsFor(url, user.slug, coverPresent),
      publicUrl: `${url.origin}/signature/${user.slug}`,
      imageUrl: `${url.origin}/signature/${user.slug}.png`,
      logoPresent,
      originalPresent,
    };
  };

  if (path === '/admin' && method === 'GET') {
    const c = await context();
    return adminHtml(
      dashboardPage({
        data: c.data,
        signatureOptions: c.options,
        publicUrl: c.publicUrl,
        username: user.username,
        notice,
        error,
      }),
    );
  }

  if (path === '/admin/signature' && method === 'GET') {
    const c = await context();
    return adminHtml(
      signaturePage({
        data: c.data,
        signatureOptions: c.options,
        publicUrl: c.publicUrl,
        signatureHtml: renderSignatureHtml(c.data, c.options),
        csrfToken,
        imageUrl: c.imageUrl,
        imageSize:
          user.imageWidth !== null && user.imageHeight !== null
            ? { width: user.imageWidth, height: user.imageHeight }
            : null,
        imageStale: user.imageRevision !== c.data.revision,
        notice,
      }),
    );
  }

  if (path === '/admin/signature/image' && method === 'POST') {
    const form = await request.formData();
    const blocked = await guardMutation(form);
    if (blocked !== null) return blocked;

    const validated = await validateImageUpload(form.get('image'));
    if (!validated.ok || validated.value === undefined) {
      return json({ error: 'The rendered image was not accepted.' }, { status: 400 });
    }

    const width = Number.parseInt(formText(form, 'width'), 10);
    const height = Number.parseInt(formText(form, 'height'), 10);
    const revision = Number.parseInt(formText(form, 'revision'), 10);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      return json({ error: 'Missing image dimensions.' }, { status: 400 });
    }

    await putImage(
      env,
      user.id,
      'signature',
      validated.value.contentType,
      validated.value.bytes,
      await sha256Hex(`sig:${user.id}:${validated.value.bytes.byteLength}:${Date.now()}`),
    );

    // Stamped with the revision it was rendered from, not the current one: if
    // the details changed mid-render it is already stale and gets redrawn.
    await setSignatureImageState(env, user.id, Number.isFinite(revision) ? revision : 0, width, height);

    return json({ ok: true });
  }

  if (path === '/admin/book') {
    if (method === 'GET') {
      const rawQuery = url.searchParams.get('q');
      const current = await getCurrentBook(env, user.id);
      const base = { csrfToken, current, notice, error };

      if (rawQuery === null) {
        return adminHtml(
          bookPage({ ...base, query: '', results: [], warnings: [], searched: false, errors: {} }),
        );
      }

      const validated = validateSearchQuery(rawQuery);
      if (!validated.ok) {
        return adminHtml(
          bookPage({
            ...base,
            query: rawQuery,
            results: [],
            warnings: [],
            searched: false,
            errors: validated.errors,
          }),
        );
      }

      const limit = await consume(env, 'search', clientKey(request), SEARCH_RULE);
      if (!limit.allowed) {
        return adminHtml(
          bookPage({
            ...base,
            query: rawQuery,
            results: [],
            warnings: [],
            searched: false,
            errors: { query: 'Too many searches. Please wait a moment.' },
          }),
        );
      }

      const outcome = await searchBooks(env, validated.value ?? '');
      return adminHtml(
        bookPage({
          ...base,
          query: validated.value ?? '',
          results: outcome.results,
          warnings: outcome.warnings,
          searched: true,
          errors: {},
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
            current: await getCurrentBook(env, user.id),
          }),
        );
      }

      await setCurrentBook(env, user.id, validated.value);

      let coverFailed = false;
      if (validated.value.coverUrl !== null) {
        const cover = await fetchCover(validated.value.coverUrl);
        if (cover === null) {
          coverFailed = true;
          await deleteImage(env, user.id, 'cover');
        } else {
          await putImage(
            env,
            user.id,
            'cover',
            cover.contentType,
            cover.bytes,
            await sha256Hex(`cover:${user.id}:${cover.bytes.byteLength}:${Date.now()}`),
          );
        }
      } else {
        await deleteImage(env, user.id, 'cover');
      }

      await bumpRevision(env, user.id);
      // Straight to the signature page, which redraws the image immediately.
      return redirect(
        coverFailed ? '/admin/signature?error=cover-failed' : '/admin/signature?ok=book-set',
      );
    }

    return notFound();
  }

  if (path === '/admin/profile') {
    const renderProfile = async (
      errors: Record<string, string>,
      message?: string,
    ): Promise<Response> => {
      const c = await context();
      return adminHtml(
        profilePage({
          csrfToken,
          data: c.data,
          hasLogo: c.logoPresent,
          hasOriginal: c.originalPresent,
          username: user.username,
          publicUrl: c.publicUrl,
          errors,
          notice: message === undefined ? notice : null,
          error: message ?? error,
        }),
      );
    };

    if (method === 'GET') return renderProfile({});

    if (method === 'POST') {
      const form = await request.formData();
      const blocked = await guardMutation(form);
      if (blocked !== null) return blocked;

      const validated = validateProfile(form);
      if (!validated.ok || validated.value === undefined) {
        return renderProfile(validated.errors, 'Please correct the highlighted fields.');
      }

      await updateProfile(env, user.id, validated.value);
      return redirect('/admin/profile?ok=profile-saved');
    }

    return notFound();
  }

  if (path === '/admin/logo' && method === 'POST') {
    const form = await request.formData();
    const blocked = await guardMutation(form);
    if (blocked !== null) return blocked;

    const validated = await validateImageUpload(form.get('logo'));
    if (!validated.ok || validated.value === undefined) {
      const c = await context();
      return adminHtml(
        profilePage({
          csrfToken,
          data: c.data,
          hasLogo: c.logoPresent,
          hasOriginal: c.originalPresent,
          username: user.username,
          publicUrl: c.publicUrl,
          errors: validated.errors,
          error: 'The logo could not be uploaded.',
        }),
      );
    }

    await putImage(
      env,
      user.id,
      'logo',
      validated.value.contentType,
      validated.value.bytes,
      await sha256Hex(`logo:${user.id}:${validated.value.bytes.byteLength}:${Date.now()}`),
    );

    const originalField = form.get('logoOriginal');
    if (originalField instanceof File && originalField.size > 0) {
      const original = await validateImageUpload(originalField);
      if (original.ok && original.value !== undefined) {
        await putImage(
          env,
          user.id,
          'logo-original',
          original.value.contentType,
          original.value.bytes,
          await sha256Hex(`orig:${user.id}:${original.value.bytes.byteLength}:${Date.now()}`),
        );
      }
    } else if (!(await hasImage(env, user.id, 'logo-original'))) {
      await putImage(
        env,
        user.id,
        'logo-original',
        validated.value.contentType,
        validated.value.bytes,
        await sha256Hex(`orig:${user.id}:${validated.value.bytes.byteLength}:${Date.now()}`),
      );
    }

    await bumpRevision(env, user.id);
    return redirect('/admin/profile?ok=logo-saved');
  }

  if (path === '/admin/logo/delete' && method === 'POST') {
    const form = await request.formData();
    const blocked = await guardMutation(form);
    if (blocked !== null) return blocked;

    await Promise.all([
      deleteImage(env, user.id, 'logo'),
      deleteImage(env, user.id, 'logo-original'),
    ]);
    await bumpRevision(env, user.id);
    return redirect('/admin/profile?ok=logo-removed');
  }

  // Authenticated previews. Always the signed-in user's own images: the key is
  // chosen from a fixed map and the user id comes from the session.
  const ADMIN_IMAGES: Record<string, ImageKey> = {
    '/admin/image/cover': 'cover',
    '/admin/image/logo': 'logo',
    '/admin/image/logo-original': 'logo-original',
    '/admin/image/signature': 'signature',
  };

  if (path in ADMIN_IMAGES) {
    const key = ADMIN_IMAGES[path] as ImageKey;
    const image = await getImage(env, user.id, key);
    const headers = { 'Cross-Origin-Resource-Policy': 'same-origin' };
    return image === null ? emptyImage(headers) : imageResponse(image, request, headers);
  }

  if (path === '/admin/thumb' && method === 'GET') {
    const target = url.searchParams.get('url') ?? '';
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return notFound();
    }

    if (parsed.protocol !== 'https:' || !THUMBNAIL_HOSTS.has(parsed.hostname)) return notFound();

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
      // Public signature first: the hot path, and it needs no session lookup.
      const signature = await handleSignature(request, env, url);
      if (signature !== null) return signature;

      // Fixed site branding, embedded in the bundle at build time.
      if (url.pathname.startsWith('/assets/')) {
        const bytes = decodeAsset(url.pathname.slice('/assets/'.length));
        if (bytes === null) return notFound();
        return new Response(bytes, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      // Static and identical for everyone, so they need no session.
      if (url.pathname === '/admin/js/cropper.js') return scriptResponse(CROPPER_JS);
      if (url.pathname === '/admin/js/copy.js') return scriptResponse(COPY_JS);
      if (url.pathname === '/admin/js/signature-image.js') return scriptResponse(SIGNATURE_IMAGE_JS);

      if (url.pathname === '/robots.txt') {
        return new Response('User-agent: *\nDisallow: /\n', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      if (url.pathname === '/') return redirect('/admin');

      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        ctx.waitUntil(purgeExpired(env));

        if (url.pathname === '/admin/register') return await handleRegister(request, env);
        if (url.pathname === '/admin/login') return await handleLogin(request, env, url);

        const session = await getSession(env, request);
        if (session === null) return redirect('/admin/login');

        // Identity comes from the session row and nowhere else.
        const user = await getUserById(env, session.userId);
        if (user === null) {
          // The account was removed while the session lived on.
          await destroySession(env, session.token);
          const headers = new Headers({ Location: '/admin/login' });
          for (const cookie of clearedCookieHeaders()) headers.append('Set-Cookie', cookie);
          return new Response(null, { status: 303, headers });
        }

        return await handleAdmin(request, env, url, session, user);
      }

      return notFound();
    } catch (error) {
      // Never leak an internal error to the client. Detail goes to the Workers
      // log, where observability is enabled.
      console.error('Unhandled error', error);
      return new Response('Something went wrong.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
