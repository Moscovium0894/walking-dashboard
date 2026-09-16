/**
 * The admin pages.
 *
 * Every page is a pure function from data to HTML. Nothing here touches the
 * database or the request, which keeps the rendering testable and makes it
 * obvious that no page can leak a value it was not handed.
 */

import { escapeHtml } from '../../shared/sanitize';
import type { BookSearchResult, SignatureData } from '../../shared/types';
import { calculateSchoolYear } from '../../shared/schoolYear';
import { SITE_LOGO, layout } from './layout';
import { BRAND, buildCredentialLine, renderSignatureHtml, type SignatureOptions } from '../signature';

/** Chrome shared by every page that renders the masthead. */
export interface ChromeOptions {
  /** Reserved for future page chrome. The masthead logo is a fixed asset. */
  readonly _chrome?: never;
}

/** Hidden CSRF input, included in every form that changes state. */
function csrfField(token: string): string {
  return `<input type="hidden" name="csrf" value="${escapeHtml(token)}" />`;
}

function fieldError(errors: Record<string, string>, name: string): string {
  const message = errors[name];
  return message ? `<p class="field-error">${escapeHtml(message)}</p>` : '';
}

function invalidAttr(errors: Record<string, string>, name: string): string {
  return errors[name] ? ' aria-invalid="true"' : '';
}

// --- Login ---------------------------------------------------------------

export interface LoginPageOptions {
  error?: string | null;
  notice?: string | null;
  /** True when registration needs an invitation code. */
  signupRestricted: boolean;
}

export function loginPage(options: LoginPageOptions): string {

  const body = `<div class="login-wrap">
  <div class="login-card">
    <div class="login-crest">
      <img src="${SITE_LOGO}" alt="Berkhamsted School" />
    </div>
    ${options.error ? `<div class="banner bad" role="alert">${escapeHtml(options.error)}</div>` : ''}
    ${options.notice ? `<div class="banner ok" role="status">${escapeHtml(options.notice)}</div>` : ''}
    <div class="panel">
      <h2>Sign in</h2>
      <form method="post" action="/">
        <div class="field">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" autocomplete="username" required autofocus />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required />
        </div>
        <button class="btn" type="submit" style="width:100%;">Sign in</button>
      </form>
    </div>
    <p style="text-align:center;font-size:0.9rem;">
      No account yet? <a href="/register">Create one</a>${
        options.signupRestricted ? ' — you will need an invitation code.' : '.'
      }
    </p>
  </div>
</div>`;

  return layout(body, { title: 'Sign in', chromeless: true });
}


// --- Register ------------------------------------------------------------

export interface RegisterPageOptions {
  errors: Record<string, string>;
  error?: string | null;
  signupRestricted: boolean;
  values?: { username?: string; slug?: string; name?: string; dateOfBirth?: string };
}

export function registerPage(options: RegisterPageOptions): string {
  const v = options.values ?? {};
  const { errors } = options;

  const body = `<div class="login-wrap">
  <div class="login-card" style="max-width:480px;">
    <div class="login-crest">
      <img src="${SITE_LOGO}" alt="Berkhamsted School" />
    </div>
    ${options.error ? `<div class="banner bad" role="alert">${escapeHtml(options.error)}</div>` : ''}
    <div class="panel">
      <h2>Create an account</h2>
      <p style="color:var(--muted);font-size:0.9rem;">
        Your signature is yours alone. Nobody else can change it, and you cannot change anyone
        else's.
      </p>
      <form method="post" action="/register">
        ${
          options.signupRestricted
            ? `<div class="field">
                 <label for="code">Invitation code</label>
                 <input type="text" id="code" name="code" required${invalidAttr(errors, 'code')} />
                 ${fieldError(errors, 'code')}
               </div>`
            : ''
        }
        <div class="field">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required autocomplete="username"
                 value="${escapeHtml(v.username ?? '')}"${invalidAttr(errors, 'username')} />
          ${fieldError(errors, 'username')}
          <p class="hint">What you sign in with. Letters, numbers, full stops, hyphens, underscores.</p>
        </div>
        <div class="field">
          <label for="slug">Signature web address</label>
          <input type="text" id="slug" name="slug" placeholder="leave blank to use your username"
                 value="${escapeHtml(v.slug ?? '')}"${invalidAttr(errors, 'slug')} />
          ${fieldError(errors, 'slug')}
          <p class="hint">Your signature will live at <code>/signature/&lt;this&gt;</code>. It is public.</p>
        </div>
        <div class="field">
          <label for="name">Name to show in the signature</label>
          <input type="text" id="name" name="name" required maxlength="80"
                 value="${escapeHtml(v.name ?? '')}"${invalidAttr(errors, 'name')} />
          ${fieldError(errors, 'name')}
        </div>
        <div class="field">
          <label for="dateOfBirth">Date of birth</label>
          <input type="date" id="dateOfBirth" name="dateOfBirth" required
                 value="${escapeHtml(v.dateOfBirth ?? '')}"${invalidAttr(errors, 'dateOfBirth')} />
          ${fieldError(errors, 'dateOfBirth')}
          <p class="hint">Used only to work out your year group, which is never stored.</p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="new-password"${invalidAttr(errors, 'password')} />
          ${fieldError(errors, 'password')}
          <p class="hint">At least 12 characters. Four random words is easier to remember and harder to guess.</p>
        </div>
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input type="password" id="confirm" name="confirm" required autocomplete="new-password"${invalidAttr(errors, 'confirm')} />
          ${fieldError(errors, 'confirm')}
        </div>
        <button class="btn" type="submit" style="width:100%;">Create account</button>
      </form>
    </div>
    <p style="text-align:center;font-size:0.9rem;">
      Already have an account? <a href="/">Sign in</a>.
    </p>
    <p style="text-align:center;font-size:0.78rem;color:var(--muted);">
      There is no password reset. If you lose your password the account cannot be recovered.
    </p>
  </div>
</div>`;

  return layout(body, { title: 'Create an account', chromeless: true });
}

// --- Dashboard -----------------------------------------------------------

export interface DashboardPageOptions extends ChromeOptions {
  data: SignatureData;
  signatureOptions: SignatureOptions;
  publicUrl: string;
  username: string;
  notice?: string | null;
  error?: string | null;
}

export function dashboardPage(options: DashboardPageOptions): string {
  const { data, publicUrl } = options;
  const { profile, book, year } = data;

  const yearNote =
    year.status === 'at-school'
      ? `Academic year ${escapeHtml(year.academicYearLabel)}`
      : 'Outside school years';

  const coverBlock = book
    ? options.signatureOptions.hasCover
      ? `<img src="/images/cover?v=${data.revision}" alt="Cover of ${escapeHtml(book.title)}" />`
      : '<div class="no-cover">No cover<br />stored</div>'
    : '<div class="no-cover">No book<br />set</div>';

  const body = `
<div class="page-head">
  <h1>Dashboard</h1>
  <p>Your signature updates itself wherever you have already pasted it, whenever you change your book or profile.</p>
</div>

<div class="panel" style="padding:0;">
  <div class="identity">
    <div class="identity-cell">
      <div class="identity-label">Who</div>
      <div class="identity-value">${escapeHtml(profile.name)}</div>
      <div class="identity-sub">${escapeHtml(profile.house ? `${profile.house} House` : 'No house set')}</div>
    </div>
    <div class="identity-cell">
      <div class="identity-label">Year</div>
      <div class="identity-value">${escapeHtml(year.label)}</div>
      <div class="identity-sub">${yearNote} · calculated, not stored</div>
    </div>
    <div class="identity-cell">
      <div class="identity-label">Reading</div>
      <div class="identity-value">${escapeHtml(book ? book.title : 'Nothing set')}</div>
      <div class="identity-sub">${escapeHtml(book?.author || (book ? 'Author unknown' : 'Choose a book to begin'))}</div>
    </div>
  </div>
</div>

<div class="grid two">
  <div class="panel">
    <h2>Current book</h2>
    <div class="cover-block">
      ${coverBlock}
      <div>
        ${
          book
            ? `<dl class="summary" style="display:block;">
                 <dd style="font-family:Georgia,serif;font-size:1.05rem;color:var(--navy);font-weight:700;">${escapeHtml(book.title)}</dd>
                 <dd style="color:var(--muted);margin-top:0.2rem;">${escapeHtml(book.author || 'Author unknown')}</dd>
                 ${book.publicationYear ? `<dd style="color:var(--muted);font-size:0.85rem;margin-top:0.35rem;">Published ${book.publicationYear}</dd>` : ''}
                 ${book.isbn ? `<dd style="color:var(--muted);font-size:0.85rem;">ISBN ${escapeHtml(book.isbn)}</dd>` : ''}
               </dl>`
            : '<p style="color:var(--muted);">No book is set yet. The signature will omit the reading section until you choose one.</p>'
        }
        <div class="actions">
          <a class="btn small" href="/book">${book ? 'Change book' : 'Choose a book'}</a>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>Signature preview</h2>
    ${renderSignatureHtml(data, options.signatureOptions)}
    <div class="actions">
      <a class="btn small" href="/signature">Get the signature</a>
      <a class="btn small secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Open public URL</a>
    </div>
  </div>
</div>

<div class="panel">
  <h2>Public signature address</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Anyone with this link can view the signature. Nobody can change it without signing in here.
  </p>
  <input type="text" readonly value="${escapeHtml(publicUrl)}" aria-label="Public signature URL" />
</div>`;

  return layout(body, {
    title: 'Dashboard',
    active: 'dashboard',
    username: options.username,
    notice: options.notice ?? null,
    error: options.error ?? null,
  });
}

// --- Change book ---------------------------------------------------------

export interface BookPageOptions extends ChromeOptions {
  csrfToken: string;
  query: string;
  results: BookSearchResult[];
  warnings: string[];
  searched: boolean;
  errors: Record<string, string>;
  notice?: string | null;
  error?: string | null;
  current: SignatureData['book'];
}

function resultItem(result: BookSearchResult, csrfToken: string): string {
  // Routed through our own proxy so the admin pages keep a strict
  // `img-src 'self'` policy and no request leaks to a third party from here.
  const cover =
    result.coverUrl !== null
      ? `<img src="/thumb?url=${encodeURIComponent(result.coverUrl)}" alt="" loading="lazy" />`
      : '<div class="no-cover">NO COVER</div>';

  const meta = [
    result.author || 'Author unknown',
    result.publicationYear !== null ? String(result.publicationYear) : null,
    result.isbn !== null ? `ISBN ${result.isbn}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join('  ·  ');

  // The chosen result is posted back in full rather than by index, so the
  // selection cannot be confused by a differently-ordered repeat search.
  return `<li class="result">
  ${cover}
  <div class="result-body">
    <div class="result-title">${escapeHtml(result.title)}</div>
    <div class="result-meta">${escapeHtml(meta)}</div>
    <form method="post" action="/book">
      ${csrfField(csrfToken)}
      <input type="hidden" name="action" value="select" />
      <input type="hidden" name="title" value="${escapeHtml(result.title)}" />
      <input type="hidden" name="author" value="${escapeHtml(result.author)}" />
      <input type="hidden" name="coverUrl" value="${escapeHtml(result.coverUrl ?? '')}" />
      <input type="hidden" name="isbn" value="${escapeHtml(result.isbn ?? '')}" />
      <input type="hidden" name="publicationYear" value="${escapeHtml(
        result.publicationYear !== null ? String(result.publicationYear) : '',
      )}" />
      <input type="hidden" name="source" value="${escapeHtml(result.source)}" />
      <button class="btn small" type="submit">Make this my current book</button>
    </form>
  </div>
</li>`;
}

export function bookPage(options: BookPageOptions): string {
  const { results, warnings, searched, errors, csrfToken } = options;

  const warningBanners = warnings
    .map((warning) => `<div class="banner info">${escapeHtml(warning)}</div>`)
    .join('');

  const resultsBlock = !searched
    ? ''
    : results.length === 0
      ? `<div class="banner info">
           No books matched that search. Try a different spelling, search by author,
           or add the book manually below.
         </div>`
      : `<ul class="results">${results.map((result) => resultItem(result, csrfToken)).join('\n')}</ul>`;

  const body = `
<div class="page-head">
  <h1>Change book</h1>
  <p>Search for what you are reading, or enter it by hand if the search cannot find it.</p>
</div>

${
  options.current
    ? `<div class="banner info">
         Currently reading <strong>${escapeHtml(options.current.title)}</strong>${
           options.current.author ? ` by ${escapeHtml(options.current.author)}` : ''
         }.
       </div>`
    : ''
}

<div class="panel">
  <h2>Search</h2>
  <form method="get" action="/book" role="search">
    <div class="field">
      <label for="q">Title, author or ISBN</label>
      <input type="search" id="q" name="q" value="${escapeHtml(options.query)}"
             placeholder="e.g. Wolf Hall, or 9780007230204"${invalidAttr(errors, 'query')} />
      ${fieldError(errors, 'query')}
      <p class="hint">Searches Google Books and Open Library together. Results are cached for an hour.</p>
    </div>
    <button class="btn" type="submit">Search</button>
  </form>
  ${warningBanners}
  ${resultsBlock}
</div>

<div class="panel">
  <h2>Enter manually</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Use this when the search cannot find your book, or when you want to correct its details.
  </p>
  <form method="post" action="/book">
    ${csrfField(csrfToken)}
    <input type="hidden" name="action" value="manual" />
    <div class="grid two">
      <div class="field">
        <label for="title">Title</label>
        <input type="text" id="title" name="title" required maxlength="200"${invalidAttr(errors, 'title')} />
        ${fieldError(errors, 'title')}
      </div>
      <div class="field">
        <label for="author">Author</label>
        <input type="text" id="author" name="author" maxlength="160"${invalidAttr(errors, 'author')} />
        ${fieldError(errors, 'author')}
      </div>
    </div>
    <div class="grid two">
      <div class="field">
        <label for="publicationYear">Publication year</label>
        <input type="number" id="publicationYear" name="publicationYear" min="1000" max="2100"${invalidAttr(errors, 'publicationYear')} />
        ${fieldError(errors, 'publicationYear')}
      </div>
      <div class="field">
        <label for="isbn">ISBN</label>
        <input type="text" id="isbn" name="isbn" maxlength="20"${invalidAttr(errors, 'isbn')} />
        ${fieldError(errors, 'isbn')}
      </div>
    </div>
    <div class="field">
      <label for="coverUrl">Cover image URL</label>
      <input type="url" id="coverUrl" name="coverUrl" placeholder="https://..."${invalidAttr(errors, 'coverUrl')} />
      ${fieldError(errors, 'coverUrl')}
      <p class="hint">Optional. The image is downloaded and stored here, so the signature keeps working if the original link stops.</p>
    </div>
    <button class="btn" type="submit">Set as current book</button>
  </form>
</div>`;

  return layout(body, {
    title: 'Change book',
    active: 'book',
    notice: options.notice ?? null,
    error: options.error ?? null,
  });
}

// --- Profile -------------------------------------------------------------

export interface ProfilePageOptions extends ChromeOptions {
  csrfToken: string;
  data: SignatureData;
  username: string;
  publicUrl: string;
  /** Whether a custom signature logo has been uploaded. */
  hasLogo: boolean;
  /** Whether the untouched upload is still held, so the crop can be redone. */
  hasOriginal: boolean;
  errors: Record<string, string>;
  notice?: string | null;
  error?: string | null;
}

export function profilePage(options: ProfilePageOptions): string {
  const { profile } = options.data;
  const { errors, csrfToken } = options;

  // Show what the current date of birth resolves to, so the calculation is
  // visible rather than something the user has to take on trust.
  let yearExplanation = '';
  try {
    const year = calculateSchoolYear(profile.dateOfBirth);
    yearExplanation = `Born in the ${year.cohortStart}/${String((year.cohortStart + 1) % 100).padStart(2, '0')} cohort, so in academic year ${year.academicYearLabel} this is <strong>${escapeHtml(year.label)}</strong>.`;
  } catch {
    yearExplanation = 'The date of birth could not be interpreted.';
  }

  const check = (name: string, label: string, checked: boolean): string =>
    `<div class="check">
       <input type="checkbox" id="${name}" name="${name}"${checked ? ' checked' : ''} />
       <label for="${name}">${escapeHtml(label)}</label>
     </div>`;

  const body = `
<div class="page-head">
  <h1>Profile</h1>
  <p>Your year group is calculated from your date of birth and cannot be set by hand.</p>
</div>

<div class="panel">
  <h2>Details</h2>
  <form method="post" action="/profile">
    ${csrfField(csrfToken)}
    <div class="grid two">
      <div class="field">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required maxlength="80"
               value="${escapeHtml(profile.name)}"${invalidAttr(errors, 'name')} />
        ${fieldError(errors, 'name')}
      </div>
      <div class="field">
        <label for="dateOfBirth">Date of birth</label>
        <input type="date" id="dateOfBirth" name="dateOfBirth" required
               value="${escapeHtml(profile.dateOfBirth)}"${invalidAttr(errors, 'dateOfBirth')} />
        ${fieldError(errors, 'dateOfBirth')}
        <p class="hint">${yearExplanation}</p>
      </div>
    </div>
    <div class="grid two">
      <div class="field">
        <label for="house">House</label>
        <input type="text" id="house" name="house" maxlength="40"
               value="${escapeHtml(profile.house)}"${invalidAttr(errors, 'house')} />
        ${fieldError(errors, 'house')}
      </div>
      <div class="field">
        <label for="school">School</label>
        <input type="text" id="school" name="school" maxlength="100"
               value="${escapeHtml(profile.school)}"${invalidAttr(errors, 'school')} />
        ${fieldError(errors, 'school')}
      </div>
    </div>
    <div class="field">
      <label for="subtitle">Subtitle</label>
      <input type="text" id="subtitle" name="subtitle" maxlength="100"
             value="${escapeHtml(profile.subtitle)}"${invalidAttr(errors, 'subtitle')} />
      ${fieldError(errors, 'subtitle')}
      <p class="hint">Optional line beneath the school, e.g. a role or a form.</p>
    </div>

    <fieldset style="border:1px solid var(--rule);border-radius:2px;padding:1rem;margin:0 0 1rem;">
      <legend style="font-size:0.8rem;font-weight:600;color:var(--navy);padding:0 0.4rem;">Show in signature</legend>
      <div class="checks">
        ${check('showYear', 'Year group', profile.showYear)}
        ${check('showHouse', 'House', profile.showHouse)}
        ${check('showSchool', 'School', profile.showSchool)}
        ${check('showSubtitle', 'Subtitle', profile.showSubtitle)}
      </div>
    </fieldset>

    <button class="btn" type="submit">Save profile</button>
  </form>
</div>

<div class="panel" id="logo-cropper">
  <h2>Signature logo</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    The logo shown in your <strong>email signature</strong>. It defaults to the school crest;
    upload your own and crop it if you want something different.
  </p>
  <p class="hint">
    The logo in the bar at the top of this site and on the sign-in page is part of the site's
    design and is not editable here.
  </p>

  <div class="logo-slot" style="max-width:420px;">
    <h3>Currently used</h3>
    <div class="surface">
      <img src="${
        options.hasLogo
          ? `/images/logo?v=${options.data.revision}`
          : escapeHtml(SITE_LOGO)
      }" alt="Logo used in the signature" />
    </div>
    <p class="hint" style="margin:0;">
      ${options.hasLogo ? 'Your uploaded crop.' : 'The default school crest.'}
    </p>
    ${
      options.hasOriginal
        ? `<div class="actions" style="margin-top:0.75rem;">
             <button class="btn secondary small" type="button" id="crop-recrop"
                     data-src="/images/logo-original?v=${options.data.revision}">Re-crop</button>
           </div>`
        : ''
    }
  </div>

  <form method="post" action="/profile/logo" enctype="multipart/form-data" id="logo-form" style="margin-top:1.5rem;">
    ${csrfField(csrfToken)}
    <div class="field">
      <label for="logo-file">Upload a different logo</label>
      <input type="file" id="logo-file" name="logo"
             accept="image/png,image/jpeg,image/gif,image/webp"${invalidAttr(errors, 'logo')} />
      ${fieldError(errors, 'logo')}
      <p class="hint">PNG, JPEG, GIF or WebP, up to 1.5MB. Transparent PNG works best.</p>
    </div>

    <button class="btn" type="submit" id="logo-submit">Upload</button>

    <div id="crop-panel" hidden>
      <div class="field">
        <label id="crop-heading">Crop for the email signature</label>
        <div class="crop-stage" id="crop-stage">
          <img id="crop-image" alt="" />
          <div class="crop-box" id="crop-box" tabindex="0" role="application"
               aria-label="Crop area. Arrow keys move it, hold Alt and use arrow keys to resize.">
            <span class="crop-handle" data-handle="nw"></span>
            <span class="crop-handle" data-handle="n"></span>
            <span class="crop-handle" data-handle="ne"></span>
            <span class="crop-handle" data-handle="e"></span>
            <span class="crop-handle" data-handle="se"></span>
            <span class="crop-handle" data-handle="s"></span>
            <span class="crop-handle" data-handle="sw"></span>
            <span class="crop-handle" data-handle="w"></span>
          </div>
        </div>
        <p class="hint" id="crop-dims"></p>
        <p class="hint" id="crop-status" role="status"></p>
      </div>

      <div class="crop-previews">
        <div class="crop-preview-pane">
          <div class="crop-preview-label">As it will appear in the signature</div>
          <div class="crop-preview-surface on-white">
            <img id="crop-preview" alt="Preview of the cropped logo" />
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn" type="submit" id="crop-save">Save crop</button>
        <button class="btn secondary small" type="button" id="crop-reset">Reset crop</button>
        <button class="btn secondary small" type="button" id="crop-cancel">Cancel</button>
      </div>
    </div>
  </form>

  ${
    options.hasLogo
      ? `<form method="post" action="/profile/logo/delete" style="margin-top:1rem;">
           ${csrfField(csrfToken)}
           <button class="btn secondary small" type="submit">Revert to the default crest</button>
         </form>`
      : ''
  }
</div>`;

  return layout(body, {
    title: 'Profile',
    active: 'profile',
    username: options.username,
    scripts: ['/js/cropper.js'],
    notice: options.notice ?? null,
    error: options.error ?? null,
  });
}

// --- Signature -----------------------------------------------------------

export interface SignaturePageOptions extends ChromeOptions {
  data: SignatureData;
  signatureOptions: SignatureOptions;
  publicUrl: string;
  signatureHtml: string;
  notice?: string | null;
  csrfToken: string;
  /** Stable public address of the rendered signature image. */
  imageUrl: string;
  /** Pixel size of the stored image, for the img tag. */
  imageSize: { width: number; height: number } | null;
  /** True when the stored image predates the current details. */
  imageStale: boolean;
}

/**
 * The payload the canvas renderer draws from.
 *
 * Passed as a data attribute rather than an inline script so the page needs no
 * script-src exception.
 */
function signatureRenderPayload(options: SignaturePageOptions): string {
  const { data } = options;
  return JSON.stringify({
    revision: data.revision,
    name: data.profile.name,
    credentials: buildCredentialLine(data),
    school: data.profile.showSchool ? data.profile.school : '',
    subtitle: data.profile.showSubtitle ? data.profile.subtitle : '',
    // The public logo route, not the admin one: it falls back to the built-in
    // crest when nothing has been uploaded, whereas /images/logo returns a
    // transparent pixel that the canvas would scale into an empty band.
    logoUrl: `/signature/${options.signatureOptions.slug}/logo.png?v=${data.revision}`,
    coverUrl: options.signatureOptions.hasCover
      ? `/images/cover?v=${data.revision}`
      : null,
    book: data.book ? { title: data.book.title, author: data.book.author } : null,
    colours: {
      navy: BRAND.navy,
      rose: BRAND.rose,
      gold: BRAND.gold,
      muted: BRAND.muted,
    },
  });
}

/**
 * Inline script for the copy button.
 *
 * This is the only JavaScript in the project. It is progressive enhancement:
 * the textarea is selectable and copyable without it, and the button is only
 * revealed once the script has run.
 */
export const COPY_SCRIPT = `(function(){
  var button = document.getElementById('copy-button');
  var source = document.getElementById('signature-html');
  var status = document.getElementById('copy-status');
  if (!button || !source) return;
  button.hidden = false;
  button.addEventListener('click', function(){
    source.select();
    var done = function(ok){
      status.textContent = ok ? 'Copied to clipboard.' : 'Press Ctrl+C or Cmd+C to copy.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(source.value).then(function(){ done(true); }, function(){ done(false); });
    } else {
      done(false);
    }
  });
})();`;

export function signaturePage(options: SignaturePageOptions): string {
  const { data, publicUrl, signatureHtml, imageUrl, imageSize } = options;

  // The email-ready snippet: one image at a fixed address. Because the address
  // never changes, an already-pasted signature picks up new details by itself.
  const altText = [
    data.profile.name,
    buildCredentialLine(data),
    data.profile.showSchool ? data.profile.school : '',
    data.book ? `Currently reading ${data.book.title}${data.book.author ? ` by ${data.book.author}` : ''}` : '',
  ]
    .filter((part) => part !== '')
    .join(' — ');

  const imageSnippet =
    `<a href="${escapeHtml(publicUrl)}"><img src="${escapeHtml(imageUrl)}"` +
    (imageSize ? ` width="${imageSize.width}"` : '') +
    ` alt="${escapeHtml(altText)}" style="display:block;border:0;outline:none;text-decoration:none;` +
    (imageSize ? `width:${imageSize.width}px;max-width:100%;height:auto;` : '') +
    `" /></a>`;

  const body = `
<div class="page-head">
  <h1>Signature</h1>
  <p>Paste this into your email client once. It keeps itself up to date.</p>
</div>

<div class="panel" id="signature-image"
     data-csrf="${escapeHtml(options.csrfToken)}"
     data-stale="${options.imageStale ? 'true' : 'false'}"
     data-signature="${escapeHtml(signatureRenderPayload(options))}">
  <h2>Your signature</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Everything below — your name, year, house, school, book and cover — is drawn into a single
    image at a fixed address. Change any of it and every signature you have already sent starts
    showing the new version, with nothing to re-paste.
  </p>

  <div class="email-chrome">
    <div class="email-chrome-bar">To: someone@example.com &nbsp;·&nbsp; Subject: Prep</div>
    <div class="email-chrome-body">
      <p>Dear Sir,</p>
      <p>Please find my essay attached.</p>
      <p>With thanks,</p>
      <hr class="sep" />
      <img id="signature-image-preview" data-src="${escapeHtml(imageUrl)}"
           src="${escapeHtml(imageUrl)}"${imageSize ? ` width="${imageSize.width}"` : ''}
           alt="${escapeHtml(altText)}"
           style="display:block;max-width:100%;height:auto;" />
    </div>
  </div>

  <div class="actions">
    <button class="btn secondary small" type="button" id="signature-image-rebuild" hidden>Rebuild image</button>
    <span id="signature-image-status" role="status" style="font-size:0.85rem;color:var(--muted);"></span>
  </div>
</div>

<div class="panel">
  <h2>Copy this into your email signature</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Select everything in the box and copy it, then paste into your email signature editor.
  </p>
  <label class="visually-hidden" for="signature-html">Email signature HTML</label>
  <textarea class="code" id="signature-html" readonly spellcheck="false" style="min-height:120px;">${escapeHtml(imageSnippet)}</textarea>
  <div class="actions">
    <button class="btn" type="button" id="copy-button" hidden>Copy HTML</button>
    <span id="copy-status" role="status" style="font-size:0.85rem;color:var(--muted);"></span>
  </div>
  <p class="hint">
    In Outlook on Windows it usually pastes better to open the
    <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">public signature page</a>,
    select the signature there and copy that instead.
  </p>
</div>

<div class="panel">
  <h2>Stable addresses</h2>
  <dl class="summary" style="grid-template-columns:8rem 1fr;">
    <dt>Image</dt>
    <dd><input type="text" readonly value="${escapeHtml(imageUrl)}" aria-label="Signature image URL" /></dd>
    <dt>Web page</dt>
    <dd><input type="text" readonly value="${escapeHtml(publicUrl)}" aria-label="Public signature URL" /></dd>
  </dl>
  <p class="hint">
    Neither address ever changes. Anyone with them can view your signature; nobody can alter it
    without signing in here.
  </p>
</div>

<div class="panel">
  <h2>Text version</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    The same signature built from real text rather than an image. It is sharper and can be read
    by screen readers, but <strong>only the cover updates by itself</strong> — the words are fixed
    at the moment you copy them, so you would need to re-copy this after every change. Use it only
    if an email client refuses the image.
  </p>
  <label class="visually-hidden" for="signature-html-text">Text-based email signature HTML</label>
  <textarea class="code" id="signature-html-text" readonly spellcheck="false">${escapeHtml(signatureHtml)}</textarea>
</div>

<div class="panel">
  <h2>Before you paste it</h2>
  <ul style="font-size:0.9rem;color:var(--ink);padding-left:1.2rem;">
    <li style="margin-bottom:0.5rem;">
      <strong>Remote images.</strong> The signature loads when the email is opened. Most clients
      show it straight away for a sender the reader has written to before; some, including Outlook
      on Windows with default settings, ask them to click “Download pictures” first. The alt text
      carries your details in the meantime.
    </li>
    <li style="margin-bottom:0.5rem;">
      <strong>Gmail caches images on its own servers.</strong> A change can take a while to appear
      for Gmail readers even though the address is unchanged. Everywhere else it updates within
      about five minutes.
    </li>
    <li>
      <strong>Old emails show your current book.</strong> That is the intended behaviour: the
      signature is always live rather than a snapshot of the day you sent it.
    </li>
  </ul>
</div>`;

  return layout(body, {
    title: 'Signature',
    active: 'signature',
    notice: options.notice ?? null,
    scripts: ['/js/copy.js', '/js/signature-image.js'],
  });
}
