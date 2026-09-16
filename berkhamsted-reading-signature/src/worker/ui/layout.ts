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

/** Fixed site branding, served from the Worker. Not administrator-editable. */
export const SITE_LOGO = '/assets/berkhamsted-logo.png';
export const SITE_WORDMARK = '/assets/berkhamsted-wordmark.png';

export interface LayoutOptions {
  title: string;
  active?: NavKey;
  /** Rendered as a success banner above the content. */
  notice?: string | null;
  /** Rendered as an error banner above the content. */
  error?: string | null;
  /** Omits the navigation, for the login page. */
  chromeless?: boolean;
  /** Client scripts to load, e.g. ['/js/cropper.js']. */
  scripts?: string[];
  /** Signed-in username, shown beside the sign-out button. */
  username?: string | null;
}

const NAV_ITEMS: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: 'dashboard', href: '/', label: 'Dashboard' },
  { key: 'book', href: '/book', label: 'Change book' },
  { key: 'profile', href: '/profile', label: 'Profile' },
  { key: 'signature', href: '/signature', label: 'Signature' },
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
  --paper: #FFFFFF;
  --wash: ${BRAND.wash};
  --ink: ${BRAND.ink};
  --muted: ${BRAND.muted};
  --rule: ${BRAND.rule};
  --shadow: 0 1px 2px rgba(10, 33, 66, 0.05), 0 8px 24px rgba(10, 33, 66, 0.05);
}

* { box-sizing: border-box; }

/* A class setting display outranks the user agent's [hidden] rule, so the
   hidden attribute would silently do nothing on .btn elements. That would
   leave the copy button visible with JavaScript disabled, and the upload
   button visible while cropping, so state it explicitly. */
[hidden] { display: none !important; }

body {
  margin: 0;
  background: var(--paper);
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

/* --- Masthead. The logo sits centred; sign-out is pinned right. --- */
.masthead { background: var(--navy); border-bottom: 3px solid var(--gold); }
.masthead-inner {
  max-width: 1040px; margin: 0 auto; padding: 1rem 1.25rem;
  display: flex; align-items: center; justify-content: center; position: relative; min-height: 76px;
}
.masthead-logo {
  /* brightness(0) crushes every opaque pixel to black, invert(1) then lifts it
     to white. Alpha is untouched, so a transparent logo stays transparent and
     a navy crest reads cleanly against the navy bar. */
  display: block; height: 44px; width: auto; max-width: 340px;
  filter: brightness(0) invert(1);
}
.wordmark {
  font-family: Georgia, 'Times New Roman', Times, serif; text-align: center;
  font-size: 1.05rem; letter-spacing: 0.22em; text-transform: uppercase; color: #fff;
  text-decoration: none; font-weight: 700;
}
.wordmark span { display: block; font-size: 0.6rem; letter-spacing: 0.3em; color: var(--gold); font-weight: 400; margin-top: 2px; }
.masthead-account {
  position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; gap: 0.75rem;
}
.masthead-account form { margin: 0; }
.masthead-user { color: rgba(255,255,255,0.8); font-size: 0.82rem; }
@media (max-width: 700px) { .masthead-user { display: none; } }
@media (max-width: 560px) {
  .masthead-inner { justify-content: flex-start; padding-right: 6.5rem; }
  .masthead-logo { height: 34px; }
}

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
  background: var(--paper); border: 1px solid var(--rule); border-radius: 3px;
  box-shadow: var(--shadow); padding: 1.5rem; margin-bottom: 1.25rem;
}
.panel > h2 { padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); margin-bottom: 1.15rem; }
.grid { display: grid; gap: 1.25rem; }
@media (min-width: 860px) { .grid.two { grid-template-columns: 1fr 1fr; } }
.grid.two.top { align-items: start; }

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
input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
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
.btn[disabled] { opacity: 0.55; cursor: default; }
.btn.secondary { background: transparent; color: var(--navy); }
.btn.secondary:hover { background: rgba(10,33,66,0.06); }
.btn.small { padding: 0.4rem 0.8rem; font-size: 0.82rem; }
.actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 1.25rem; }

/* --- Banners --- */
.banner { padding: 0.85rem 1.1rem; border-radius: 2px; margin-bottom: 1.25rem; font-size: 0.9rem; border-left: 3px solid; }
.banner.ok { background: #EEF6F1; border-color: #2FA46C; color: #17512F; }
.banner.bad { background: #FBEEEE; border-color: var(--rose); color: #7A1A1E; }
.banner.info { background: var(--wash); border-color: var(--navy); color: var(--navy); }

/* --- Search results --- */
.results { list-style: none; margin: 1.25rem 0 0; padding: 0; display: grid; gap: 0.75rem; }
.result {
  display: flex; gap: 1rem; padding: 0.9rem; border: 1px solid var(--rule); border-radius: 2px; background: #fff;
}
.result:hover { border-color: var(--navy); }
.result img, .result .no-cover {
  width: 56px; height: 84px; object-fit: cover; flex: 0 0 56px; border-radius: 2px; background: var(--wash);
  border: 1px solid var(--rule);
}
.result .no-cover { display: flex; align-items: center; justify-content: center; font-size: 0.55rem; color: var(--muted); text-align: center; letter-spacing: 0.06em; }
.result-body { flex: 1; min-width: 0; }
.result-title { font-family: Georgia, serif; font-weight: 700; color: var(--navy); font-size: 1rem; line-height: 1.3; }
.result-meta { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.result form { margin: 0.6rem 0 0; }

/* --- Email preview --- */
.email-chrome { border: 1px solid var(--rule); border-radius: 3px; overflow: hidden; background: #fff; }
.email-chrome-bar { background: var(--wash); border-bottom: 1px solid var(--rule); padding: 0.65rem 0.9rem; font-size: 0.8rem; color: var(--muted); }
.email-chrome-body { padding: 1.25rem; font-family: Georgia, serif; font-size: 0.9rem; color: var(--ink); }
.email-chrome-body .sep { height: 1px; background: var(--rule); margin: 1.25rem 0; border: 0; }

textarea.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.75rem;
  line-height: 1.5; min-height: 220px; white-space: pre; overflow-wrap: normal; overflow-x: auto;
}

dl.summary { margin: 0; display: grid; gap: 0.7rem; }
dl.summary dt { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); padding-top: 0.15rem; }
dl.summary dd { margin: 0; color: var(--ink); }

.cover-block { display: flex; gap: 1.25rem; align-items: flex-start; }
.cover-block img { width: 94px; border-radius: 2px; border: 1px solid var(--rule); }
.cover-block .no-cover {
  width: 94px; height: 140px; display: flex; align-items: center; justify-content: center;
  border: 1px dashed var(--rule); border-radius: 2px; color: var(--muted); font-size: 0.7rem; text-align: center; background: var(--wash);
}

/* --- Logo cropper --- */
.crop-stage {
  position: relative; margin: 0 auto; background: var(--wash);
  background-image: linear-gradient(45deg, #E8EAEE 25%, transparent 25%, transparent 75%, #E8EAEE 75%),
                    linear-gradient(45deg, #E8EAEE 25%, transparent 25%, transparent 75%, #E8EAEE 75%);
  background-size: 16px 16px; background-position: 0 0, 8px 8px;
  border: 1px solid var(--rule); user-select: none; touch-action: none; overflow: hidden;
}
.crop-stage img { display: block; max-width: 100%; -webkit-user-drag: none; user-select: none; }
.crop-box {
  position: absolute; border: 2px solid var(--navy); box-shadow: 0 0 0 9999px rgba(10, 33, 66, 0.45);
  cursor: move; touch-action: none;
}
/* Handles sit wholly inside the crop box. Straddling the edge would put them
   half outside the stage whenever the crop is flush against the image border -
   which is the default - where the stage's overflow:hidden clips them and they
   cannot be grabbed at all. */
.crop-handle {
  position: absolute; width: 16px; height: 16px; background: #fff;
  border: 2px solid var(--navy); border-radius: 2px; touch-action: none;
}
.crop-handle[data-handle=nw] { left: 0; top: 0; cursor: nwse-resize; }
.crop-handle[data-handle=ne] { right: 0; top: 0; cursor: nesw-resize; }
.crop-handle[data-handle=sw] { left: 0; bottom: 0; cursor: nesw-resize; }
.crop-handle[data-handle=se] { right: 0; bottom: 0; cursor: nwse-resize; }
.crop-handle[data-handle=n] { left: 50%; top: 0; margin-left: -8px; cursor: ns-resize; }
.crop-handle[data-handle=s] { left: 50%; bottom: 0; margin-left: -8px; cursor: ns-resize; }
.crop-handle[data-handle=w] { left: 0; top: 50%; margin-top: -8px; cursor: ew-resize; }
.crop-handle[data-handle=e] { right: 0; top: 50%; margin-top: -8px; cursor: ew-resize; }

.crop-previews { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-top: 1.25rem; }
.crop-preview-pane { flex: 1 1 200px; }
.crop-preview-label { font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem; }
.crop-preview-surface { padding: 0.9rem; border: 1px solid var(--rule); border-radius: 2px; display: flex; align-items: center; justify-content: center; min-height: 72px; }
.crop-preview-surface.on-white { background: #fff; }
.crop-preview-surface.on-navy { background: var(--navy); }
.crop-preview-surface img { max-width: 100%; max-height: 48px; display: block; }
.crop-preview-surface.on-navy img { filter: brightness(0) invert(1); }

.logo-slots { display: grid; gap: 1.25rem; }
@media (min-width: 720px) { .logo-slots { grid-template-columns: 1fr 1fr; } }
.logo-slot { border: 1px solid var(--rule); border-radius: 2px; padding: 1rem; }
.logo-slot h3 { margin-bottom: 0.3rem; }
.logo-slot .surface {
  margin: 0.75rem 0; padding: 0.9rem; border-radius: 2px; display: flex; align-items: center;
  justify-content: center; min-height: 76px; border: 1px solid var(--rule);
}
.logo-slot .surface.on-navy { background: var(--navy); }
.logo-slot .surface.on-navy img { filter: brightness(0) invert(1); }
.logo-slot .surface img { max-width: 100%; max-height: 52px; display: block; }
.logo-slot .empty { color: var(--muted); font-size: 0.8rem; }

/* --- Login --- */
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.login-card { width: 100%; max-width: 380px; }
.login-crest { text-align: center; margin-bottom: 1.5rem; }
.login-crest img { max-width: 220px; max-height: 96px; width: auto; height: auto; display: inline-block; }
.login-crest .wordmark { color: var(--navy); }
.login-crest .wordmark span { color: var(--muted); }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
`.trim();
}

/**
 * Masthead brand.
 *
 * A fixed static asset, not something the administrator can change: the site's
 * own branding is part of the design. The wordmark is used rather than the full
 * crest because the rose is illegible at 44px tall.
 */
function brandMark(): string {
  return `<a href="/" aria-label="Berkhamsted reading signature, dashboard">
        <img class="masthead-logo" src="${SITE_WORDMARK}" alt="Berkhamsted" />
      </a>`;
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
      ${brandMark()}
      <div class="masthead-account">
        ${
          options.username
            ? `<span class="masthead-user">${escapeHtml(options.username)}</span>`
            : ''
        }
        <form method="post" action="/profile/logout">
          <button class="btn secondary small" type="submit" style="border-color:rgba(255,255,255,0.4);color:#fff;">Sign out</button>
        </form>
      </div>
    </div>
  </header>`;

  const scripts = (options.scripts ?? [])
    .map((src) => `<script src="${escapeHtml(src)}" defer></script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(options.title)} — Berkhamsted Reading Signature</title>
<style>${styles()}</style>
${scripts}
</head>
<body>
${masthead}
${nav}
${options.chromeless ? body : `<main>${banners}${body}</main>`}
</body>
</html>`;
}
