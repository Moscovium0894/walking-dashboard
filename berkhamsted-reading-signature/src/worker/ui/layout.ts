/**
 * The admin dashboard shell.
 *
 * Server-rendered HTML with no client-side framework. The interface is built
 * from ordinary forms, so it works without JavaScript, degrades predictably and
 * keeps every credential and every decision on the server.
 */

import { escapeHtml } from '../../shared/sanitize';
import { BRAND } from '../signature';

export type NavKey = 'dashboard' | 'book' | 'profile' | 'signature';

export interface LayoutOptions {
  title: string;
  active?: NavKey;
  /** Rendered as a success banner above the content. */
  notice?: string | null;
  /** Rendered as an error banner above the content. */
  error?: string | null;
  /** Omits the navigation, for the login page. */
  chromeless?: boolean;
  /** Extra <head> content, e.g. a page-specific inline script. */
  head?: string;
}

const NAV_ITEMS: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'book', href: '/admin/book', label: 'Change book' },
  { key: 'profile', href: '/admin/profile', label: 'Profile' },
  { key: 'signature', href: '/admin/signature', label: 'Signature' },
];

/**
 * Stylesheet for the dashboard.
 *
 * Deliberately one small sheet rather than a framework: the whole interface is
 * four pages of forms and panels, and a utility-class library would be more
 * code than the thing it styles.
 */
function styles(): string {
  return `
:root {
  --navy: ${BRAND.navy};
  --navy-soft: #16305C;
  --gold: ${BRAND.gold};
  --rose: ${BRAND.rose};
  --cream: ${BRAND.cream};
  --ink: ${BRAND.ink};
  --muted: ${BRAND.muted};
  --rule: ${BRAND.rule};
  --panel: #FFFFFF;
  --shadow: 0 1px 2px rgba(10, 33, 66, 0.06), 0 8px 24px rgba(10, 33, 66, 0.06);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-family: Georgia, 'Times New Roman', Times, serif; color: var(--navy); margin: 0; font-weight: 700; }
h1 { font-size: 1.75rem; letter-spacing: -0.01em; }
h2 { font-size: 1.15rem; }
h3 { font-size: 0.95rem; }
p { margin: 0 0 1rem; }
p:last-child { margin-bottom: 0; }
a { color: var(--navy); }

/* --- Masthead --- */
.masthead { background: var(--navy); color: #fff; border-bottom: 3px solid var(--gold); }
.masthead-inner {
  max-width: 1040px; margin: 0 auto; padding: 1.15rem 1.25rem;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
}
.wordmark {
  font-family: Georgia, 'Times New Roman', Times, serif;
  font-size: 1.05rem; letter-spacing: 0.22em; text-transform: uppercase; color: #fff;
  text-decoration: none; font-weight: 700;
}
.wordmark span { display: block; font-size: 0.6rem; letter-spacing: 0.3em; color: var(--gold); font-weight: 400; margin-top: 2px; }
.masthead form { margin: 0; }

/* --- Navigation --- */
nav.primary { background: var(--navy-soft); }
nav.primary ul {
  max-width: 1040px; margin: 0 auto; padding: 0 1.25rem; list-style: none;
  display: flex; gap: 0.25rem; overflow-x: auto;
}
nav.primary a {
  display: block; padding: 0.8rem 1rem; color: rgba(255,255,255,0.78); text-decoration: none;
  font-size: 0.875rem; letter-spacing: 0.04em; white-space: nowrap; border-bottom: 3px solid transparent;
}
nav.primary a:hover { color: #fff; background: rgba(255,255,255,0.06); }
nav.primary a[aria-current='page'] { color: #fff; border-bottom-color: var(--gold); font-weight: 600; }

/* --- Layout --- */
main { max-width: 1040px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.page-head { margin-bottom: 1.5rem; }
.page-head p { color: var(--muted); margin: 0.35rem 0 0; font-size: 0.925rem; }

.panel {
  background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
  box-shadow: var(--shadow); padding: 1.5rem; margin-bottom: 1.25rem;
}
.panel > h2 { padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); margin-bottom: 1.15rem; }
.grid { display: grid; gap: 1.25rem; }
@media (min-width: 860px) { .grid.two { grid-template-columns: 1fr 1fr; } }

/* --- Identity strip: who / year / book, at a glance --- */
.identity { display: grid; gap: 0; }
@media (min-width: 720px) { .identity { grid-template-columns: repeat(3, 1fr); } }
.identity-cell { padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--rule); }
@media (min-width: 720px) {
  .identity-cell { border-bottom: none; border-right: 1px solid var(--rule); }
  .identity-cell:last-child { border-right: none; }
}
.identity-cell:last-child { border-bottom: none; }
.identity-label {
  font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.3rem;
}
.identity-value { font-family: Georgia, serif; font-size: 1.3rem; color: var(--navy); font-weight: 700; line-height: 1.25; }
.identity-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.15rem; }

/* --- Forms --- */
.field { margin-bottom: 1.15rem; }
label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--navy); margin-bottom: 0.35rem; letter-spacing: 0.02em; }
input[type=text], input[type=password], input[type=date], input[type=number], input[type=search], input[type=url], input[type=file], textarea {
  width: 100%; padding: 0.6rem 0.7rem; font: inherit; font-size: 0.95rem;
  border: 1px solid var(--rule); border-radius: 2px; background: #fff; color: var(--ink);
}
input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible {
  outline: 2px solid var(--navy); outline-offset: 2px;
}
.hint { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }
.field-error { font-size: 0.8rem; color: var(--rose); margin-top: 0.3rem; font-weight: 600; }
input[aria-invalid='true'] { border-color: var(--rose); }

.checks { display: grid; gap: 0.5rem; }
.check { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; }
.check input { width: 1rem; height: 1rem; margin: 0; accent-color: var(--navy); }
.check label { margin: 0; font-weight: 400; font-size: 0.9rem; color: var(--ink); }

/* --- Buttons --- */
.btn {
  display: inline-block; padding: 0.6rem 1.15rem; font: inherit; font-size: 0.9rem; font-weight: 600;
  border-radius: 2px; border: 1px solid var(--navy); background: var(--navy); color: #fff;
  cursor: pointer; text-decoration: none; letter-spacing: 0.02em;
}
.btn:hover { background: #16305C; }
.btn.secondary { background: transparent; color: var(--navy); }
.btn.secondary:hover { background: rgba(10,33,66,0.06); }
.btn.small { padding: 0.4rem 0.8rem; font-size: 0.82rem; }
.btn.link { border-color: transparent; background: transparent; color: var(--navy); text-decoration: underline; padding-left: 0; }
.actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 1.25rem; }

/* --- Banners --- */
.banner { padding: 0.85rem 1.1rem; border-radius: 2px; margin-bottom: 1.25rem; font-size: 0.9rem; border-left: 3px solid; }
.banner.ok { background: #EEF6F1; border-color: #2FA46C; color: #17512F; }
.banner.bad { background: #FBEEEE; border-color: var(--rose); color: #7A1A1E; }
.banner.info { background: #F0F3F8; border-color: var(--navy); color: var(--navy); }

/* --- Search results --- */
.results { list-style: none; margin: 1.25rem 0 0; padding: 0; display: grid; gap: 0.75rem; }
.result {
  display: flex; gap: 1rem; padding: 0.9rem; border: 1px solid var(--rule); border-radius: 2px; background: #fff;
}
.result:hover { border-color: var(--navy); }
.result img, .result .no-cover {
  width: 56px; height: 84px; object-fit: cover; flex: 0 0 56px; border-radius: 2px; background: var(--cream);
  border: 1px solid var(--rule);
}
.result .no-cover { display: flex; align-items: center; justify-content: center; font-size: 0.55rem; color: var(--muted); text-align: center; letter-spacing: 0.06em; }
.result-body { flex: 1; min-width: 0; }
.result-title { font-family: Georgia, serif; font-weight: 700; color: var(--navy); font-size: 1rem; line-height: 1.3; }
.result-meta { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.result form { margin: 0.6rem 0 0; }

/* --- Preview --- */
.preview-frame {
  width: 100%; min-height: 260px; border: 1px solid var(--rule); border-radius: 2px; background: #fff;
}
.email-chrome { border: 1px solid var(--rule); border-radius: 3px; overflow: hidden; background: #fff; }
.email-chrome-bar { background: #F4F5F7; border-bottom: 1px solid var(--rule); padding: 0.65rem 0.9rem; font-size: 0.8rem; color: var(--muted); }
.email-chrome-body { padding: 1.25rem; font-family: Georgia, serif; font-size: 0.9rem; color: var(--ink); }
.email-chrome-body .sep { height: 1px; background: var(--rule); margin: 1.25rem 0; border: 0; }

textarea.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.75rem;
  line-height: 1.5; min-height: 220px; white-space: pre; overflow-wrap: normal; overflow-x: auto;
}

dl.summary { margin: 0; display: grid; gap: 0.7rem; }
@media (min-width: 560px) { dl.summary { grid-template-columns: 9rem 1fr; gap: 0.7rem 1rem; } }
dl.summary dt { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); padding-top: 0.15rem; }
dl.summary dd { margin: 0; color: var(--ink); }

.cover-block { display: flex; gap: 1.25rem; align-items: flex-start; }
.cover-block img { width: 94px; border-radius: 2px; border: 1px solid var(--rule); }
.cover-block .no-cover {
  width: 94px; height: 140px; display: flex; align-items: center; justify-content: center;
  border: 1px dashed var(--rule); border-radius: 2px; color: var(--muted); font-size: 0.7rem; text-align: center; background: var(--cream);
}

/* --- Login --- */
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.login-card { width: 100%; max-width: 380px; }
.login-crest {
  text-align: center; margin-bottom: 1.5rem; font-family: Georgia, serif;
  font-size: 1.05rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--navy); font-weight: 700;
}
.login-crest span { display: block; font-size: 0.6rem; letter-spacing: 0.3em; color: var(--muted); font-weight: 400; margin-top: 4px; }

footer.site { max-width: 1040px; margin: 0 auto; padding: 0 1.25rem 2.5rem; color: var(--muted); font-size: 0.8rem; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
`.trim();
}

/** Render a full admin page. */
export function layout(body: string, options: LayoutOptions): string {
  const banners = [
    options.error ? `<div class="banner bad" role="alert">${escapeHtml(options.error)}</div>` : '',
    options.notice
      ? `<div class="banner ok" role="status">${escapeHtml(options.notice)}</div>`
      : '',
  ].join('');

  const nav = options.chromeless
    ? ''
    : `<nav class="primary" aria-label="Sections">
    <ul>
      ${NAV_ITEMS.map(
        (item) =>
          `<li><a href="${item.href}"${
            item.key === options.active ? ' aria-current="page"' : ''
          }>${escapeHtml(item.label)}</a></li>`,
      ).join('\n      ')}
    </ul>
  </nav>`;

  const masthead = options.chromeless
    ? ''
    : `<header class="masthead">
    <div class="masthead-inner">
      <a class="wordmark" href="/admin">Berkhamsted<span>Reading signature</span></a>
      <form method="post" action="/admin/logout">
        <button class="btn secondary small" type="submit" style="border-color:rgba(255,255,255,0.4);color:#fff;">Sign out</button>
      </form>
    </div>
  </header>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(options.title)} — Berkhamsted Reading Signature</title>
<style>${styles()}</style>
${options.head ?? ''}
</head>
<body>
${masthead}
${nav}
${options.chromeless ? body : `<main>${banners}${body}</main>`}
</body>
</html>`;
}
