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
import { layout } from './layout';
import { renderSignatureHtml, type SignatureOptions } from '../signature';

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
  configured: boolean;
}

export function loginPage(options: LoginPageOptions): string {
  const setupWarning = options.configured
    ? ''
    : `<div class="banner info">
         <strong>Not configured yet.</strong> Set <code>ADMIN_USERNAME</code>,
         <code>ADMIN_PASSWORD</code> and <code>SESSION_SECRET</code> as secrets on this
         Worker in the Cloudflare dashboard, then reload this page.
       </div>`;

  const body = `<div class="login-wrap">
  <div class="login-card">
    <div class="login-crest">Berkhamsted<span>Reading signature</span></div>
    ${setupWarning}
    ${options.error ? `<div class="banner bad" role="alert">${escapeHtml(options.error)}</div>` : ''}
    ${options.notice ? `<div class="banner ok" role="status">${escapeHtml(options.notice)}</div>` : ''}
    <div class="panel">
      <h2>Sign in</h2>
      <form method="post" action="/admin/login">
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
    <p style="text-align:center;font-size:0.8rem;color:var(--muted);">
      This is a private administration area. There is no public registration.
    </p>
  </div>
</div>`;

  return layout(body, { title: 'Sign in', chromeless: true });
}

// --- Dashboard -----------------------------------------------------------

export interface DashboardPageOptions {
  data: SignatureData;
  signatureOptions: SignatureOptions;
  publicUrl: string;
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
      ? `<img src="/admin/image/cover?v=${data.revision}" alt="Cover of ${escapeHtml(book.title)}" />`
      : '<div class="no-cover">No cover<br />stored</div>'
    : '<div class="no-cover">No book<br />set</div>';

  const body = `
<div class="page-head">
  <h1>Dashboard</h1>
  <p>Your signature updates automatically whenever you change your book or profile.</p>
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
          <a class="btn small" href="/admin/book">${book ? 'Change book' : 'Choose a book'}</a>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>Signature preview</h2>
    ${renderSignatureHtml(data, options.signatureOptions)}
    <div class="actions">
      <a class="btn small" href="/admin/signature">Get the HTML</a>
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
    notice: options.notice ?? null,
    error: options.error ?? null,
  });
}

// --- Change book ---------------------------------------------------------

export interface BookPageOptions {
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
      ? `<img src="/admin/thumb?url=${encodeURIComponent(result.coverUrl)}" alt="" loading="lazy" />`
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
    <form method="post" action="/admin/book">
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
  <form method="get" action="/admin/book" role="search">
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
  <form method="post" action="/admin/book">
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

export interface ProfilePageOptions {
  csrfToken: string;
  data: SignatureData;
  hasLogo: boolean;
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
  <form method="post" action="/admin/profile">
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

<div class="panel">
  <h2>Berkhamsted logo</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Upload the official logo as a PNG. It is stored here and served from this Worker, so the
    signature does not depend on any other host. Until one is uploaded the signature shows a
    marked placeholder rather than a broken image.
  </p>
  ${
    options.hasLogo
      ? `<p><img src="/admin/image/logo?v=${options.data.revision}" alt="Current logo"
              style="max-width:240px;border:1px solid var(--rule);border-radius:2px;background:var(--navy);padding:0.5rem;" /></p>`
      : '<div class="banner info">No logo uploaded yet.</div>'
  }
  <form method="post" action="/admin/logo" enctype="multipart/form-data">
    ${csrfField(csrfToken)}
    <div class="field">
      <label for="logo">Logo file</label>
      <input type="file" id="logo" name="logo" accept="image/png,image/jpeg,image/gif,image/webp"${invalidAttr(errors, 'logo')} />
      ${fieldError(errors, 'logo')}
      <p class="hint">PNG, JPEG, GIF or WebP, up to 1.5MB. Around 600px wide works best.</p>
    </div>
    <button class="btn" type="submit">Upload logo</button>
  </form>
  ${
    options.hasLogo
      ? `<form method="post" action="/admin/logo/delete" style="margin-top:0.75rem;">
           ${csrfField(csrfToken)}
           <button class="btn secondary small" type="submit">Remove logo</button>
         </form>`
      : ''
  }
</div>`;

  return layout(body, {
    title: 'Profile',
    active: 'profile',
    notice: options.notice ?? null,
    error: options.error ?? null,
  });
}

// --- Signature -----------------------------------------------------------

export interface SignaturePageOptions {
  data: SignatureData;
  signatureOptions: SignatureOptions;
  publicUrl: string;
  signatureHtml: string;
  notice?: string | null;
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
  const { data, publicUrl, signatureHtml } = options;

  const body = `
<div class="page-head">
  <h1>Signature</h1>
  <p>Paste this into your email client once. It updates itself whenever you change your book.</p>
</div>

<div class="panel">
  <h2>How it will look in an email</h2>
  <div class="email-chrome">
    <div class="email-chrome-bar">To: someone@example.com &nbsp;·&nbsp; Subject: Prep</div>
    <div class="email-chrome-body">
      <p>Dear Sir,</p>
      <p>Please find my essay attached.</p>
      <p>With thanks,</p>
      <hr class="sep" />
      ${renderSignatureHtml(data, options.signatureOptions)}
    </div>
  </div>
</div>

<div class="panel">
  <h2>Copy the HTML</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    Select everything in the box and copy it, then paste into your email signature editor.
  </p>
  <label class="visually-hidden" for="signature-html">Email signature HTML</label>
  <textarea class="code" id="signature-html" readonly spellcheck="false">${escapeHtml(signatureHtml)}</textarea>
  <div class="actions">
    <button class="btn" type="button" id="copy-button" hidden>Copy HTML</button>
    <span id="copy-status" role="status" style="font-size:0.85rem;color:var(--muted);"></span>
  </div>
</div>

<div class="panel">
  <h2>Stable public address</h2>
  <p style="color:var(--muted);font-size:0.9rem;">
    This address always shows your current book. It needs no sign-in to view, and cannot be edited by anyone who opens it.
  </p>
  <input type="text" readonly value="${escapeHtml(publicUrl)}" aria-label="Public signature URL" />
</div>

<div class="panel">
  <h2>Before you paste it</h2>
  <p style="font-size:0.9rem;">Two things worth knowing about how email clients treat this:</p>
  <ul style="font-size:0.9rem;color:var(--ink);padding-left:1.2rem;">
    <li style="margin-bottom:0.5rem;">
      <strong>Remote images.</strong> The logo and cover load from this Worker when the email is
      opened. Most clients show them straight away for a sender the recipient has written to
      before; some, including Outlook on Windows with the default settings, ask the reader to
      click “Download pictures” first. The text of your signature is unaffected either way.
    </li>
    <li style="margin-bottom:0.5rem;">
      <strong>Updating.</strong> Because the images are fetched when the email is opened, an
      already-sent email may show your newer book rather than the one you were reading when you
      sent it. If you would rather old emails froze, say so and the cover can be pinned per send
      instead.
    </li>
    <li>
      <strong>Gmail</strong> sometimes strips the outer table's left border rule. The signature is
      built so it still reads correctly if that happens.
    </li>
  </ul>
</div>`;

  return layout(body, {
    title: 'Signature',
    active: 'signature',
    notice: options.notice ?? null,
    head: `<script>${COPY_SCRIPT}</script>`,
  });
}
