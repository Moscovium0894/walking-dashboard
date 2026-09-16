/**
 * The URL scheme, in one place.
 *
 *   /                      sign in when signed out, dashboard when signed in
 *   /register              create an account
 *   /logout                POST only
 *   /book                  choose the current book
 *   /profile               name, year, house, school, logo
 *   /signature             GET your snippet; POST the rendered image
 *   /signature/<account>   the public signature
 *   /signature/<account>.png   the image an email points at
 *   /signature/<account>.txt   plain-text fallback
 *   /signature/<account>/logo.png, /cover.jpg
 *   /images/<key>          private previews of your own images
 *   /thumb?url=            search-result thumbnail proxy
 *   /assets/<file>.png     fixed site branding
 *   /js/<file>.js          client scripts
 *
 * Account names live under /signature/ rather than at the root, so they can
 * never shadow one of the application's own pages: /signature/<anything> is
 * always somebody's signature, and every other path is always the application.
 * The reserved list below therefore exists only to stop names that would be
 * confusing or invite impersonation, not to prevent routing collisions.
 */

export const ROUTES = {
  home: '/',
  register: '/register',
  logout: '/logout',
  book: '/book',
  profile: '/profile',
  logo: '/profile/logo',
  logoDelete: '/profile/logo/delete',
  signature: '/signature',
  thumb: '/thumb',
  robots: '/robots.txt',
} as const;

export const ROUTE_PREFIXES = ['/assets/', '/js/', '/images/', '/signature/'] as const;

/**
 * Account names nobody may register.
 *
 * Not needed for routing, since accounts are namespaced. These are names that
 * would mislead a reader of the URL or let someone pose as the site itself.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'about', 'account', 'admin', 'administrator', 'api', 'assets', 'auth',
  'berkhamsted', 'book', 'books', 'contact', 'css', 'dashboard', 'docs', 'help', 'home',
  'images', 'img', 'index', 'js', 'login', 'logout', 'mail', 'me', 'new',
  'null', 'official', 'owner', 'password', 'privacy', 'profile', 'register',
  'root', 'security', 'settings', 'signature', 'signin', 'signout', 'signup',
  'staff', 'static', 'support', 'system', 'terms', 'test', 'thumb',
  'undefined', 'user', 'users', 'www',
]);

/** True when a slug is one nobody may register. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Paths that require a session. Anything else signed-out is simply not found. */
export function isPrivatePath(pathname: string): boolean {
  if (pathname === ROUTES.home) return true;
  if (pathname === ROUTES.signature) return true;

  for (const route of [ROUTES.logout, ROUTES.book, ROUTES.profile, ROUTES.logo, ROUTES.logoDelete, ROUTES.thumb]) {
    if (pathname === route) return true;
  }
  return pathname.startsWith('/images/');
}
