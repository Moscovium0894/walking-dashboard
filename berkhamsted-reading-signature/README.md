# Berkhamsted Reading Signature

A site where anyone can create an account, record the book they are currently
reading, and get an email signature that keeps itself up to date.

Each account owns its own signature and can only ever change its own. There is
no administrator and no shared state.

Change your book here, and every email signature you have already installed
starts showing the new one. You never rebuild the signature by hand.

This project is entirely separate from the `walking-dashboard` application in
the same repository. It lives in this directory, has its own dependencies and
its own workflow, and shares nothing with it.

---

## Contents

1. [What it does](#1-what-it-does)
2. [Architecture](#2-architecture)
3. [Local development](#3-local-development)
4. [Database setup](#4-database-setup)
5. [Cloudflare setup](#5-cloudflare-setup)
6. [Secrets](#6-secrets)
7. [Deployment](#7-deployment)
8. [Logos](#8-logos)
9. [Signing in](#9-signing-in)
10. [Changing your book](#10-changing-your-book)
11. [Changing your profile](#11-changing-your-profile)
12. [Installing the signature in an email client](#12-installing-the-signature-in-an-email-client)
13. [How the year is calculated](#13-how-the-year-is-calculated)
14. [Security](#14-security)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. What it does

The public signature shows:

- the Berkhamsted logo
- your name
- your house
- your year group, **calculated automatically** from your date of birth
- your school
- the cover, title and author of the book you are currently reading

The private dashboard lets you search for a book, make it current, edit your
profile, upload the logo, and copy the signature HTML.

The signature contains **no JavaScript**. Email clients do not run it.

It is served as a **single image at a fixed address**, which is what lets an
already-sent signature update itself. A mail client makes no requests except for
images, so text baked into the HTML would freeze at the moment it was copied.
Drawing the whole signature into one image means the name, year group, house,
school, book title, author and cover all change the moment you change them, with
nothing to re-paste.

A table-based HTML version is also offered for clients that refuse images, but
only its cover updates; its text is fixed at copy time.

---

## 2. Architecture

Everything is one Cloudflare Worker plus one D1 database. There is no separate
frontend build, no static asset hosting, and no third-party service.

```
Browser ──▶ Cloudflare Worker ──▶ D1 (profile, book, images, sessions)
                    │
                    └──▶ Google Books / Open Library   (book search, server-side)

Email client ──▶ /signature/otto/cover.jpg   (bytes served from D1, never a third party)
```

| Path | Access | Purpose |
|---|---|---|
| `/signature/otto.png` | public | **the signature as one image — what email points at** |
| `/signature/otto` | public | the signature as an HTML document |
| `/signature/otto.txt` | public | plain-text fallback |
| `/signature/otto/logo.png` | public | the signature logo, uploaded or default |
| `/assets/*.png` | public | fixed site branding, embedded in the build |
| `/signature/otto/cover.jpg` | public | the current cover, from D1 |
| `/admin/js/*.js` | public | the two progressive-enhancement scripts |
| `/admin` | private | dashboard |
| `/admin/book` | private | search and change book |
| `/admin/profile` | private | profile and logo |
| `/admin/signature` | private | preview and copy HTML |

The admin interface is **server-rendered HTML forms**. There is no client-side
framework. That is a deliberate choice: it keeps every credential and every
authorisation decision on the server, it works without JavaScript, and it lets
the whole application bundle into a single file that can be pasted into the
Cloudflare dashboard.

### Source layout

```
src/
  shared/
    schoolYear.ts    the year-group calculation (the tested core)
    sanitize.ts      output escaping and URL validation
    types.ts
  worker/
    index.ts         router and the security boundary
    auth.ts          passwords, sessions, CSRF
    db.ts            all D1 access, every query parameterised
    books.ts         Google Books + Open Library, merged and cached
    signature.ts     the email HTML
    rateLimit.ts     fixed-window limiting, in D1
    security.ts      response helpers and security headers
    validate.ts      input validation
    assets.generated.ts  base64 brand images (generated, committed)
    ui/
      layout.ts        page shell, navigation and stylesheet
      pages.ts         the four admin pages
      clientScripts.ts the logo cropper and copy button
migrations/          D1 migrations
dist/worker.js       readable bundle, for wrangler (committed)
dist/worker.min.js   minified bundle, for pasting into the dashboard (committed)
```

Both bundles are committed on purpose: `dist/worker.min.js` is what you paste
into the Cloudflare dashboard if you deploy that way. CI fails if either is out
of date relative to the source.

---

## 3. Local development

Requires Node 20 or newer.

```bash
cd berkhamsted-reading-signature
npm install

# Local secrets. This file is gitignored; never commit it.
cat > .dev.vars <<'EOF'
ADMIN_USERNAME=admin
ADMIN_PASSWORD=whatever-you-like-locally
SESSION_SECRET=any-long-random-string-for-local-use
EOF

npm run db:migrate:local      # create the local database
npm run dev                   # http://localhost:8787
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run verify` | lint, typecheck, test and build — run this before committing |
| `npm test` | tests only |
| `npm run build` | rebuild `dist/worker.js` |
| `npm run deploy` | build and `wrangler deploy` (needs `wrangler login`) |

---

## 4. Database setup

**In the Cloudflare dashboard:** Storage & Databases → D1 SQL Database →
**Create**. Name it exactly `berkhamsted-reading-signature`. Choose Western
Europe as the location hint if you are in the UK.

Then either run the migration with Wrangler:

```bash
npm run db:migrate:remote
```

…or, if you have no terminal available, open the database in the dashboard, go
to the **Console** tab and paste this file, which is the same schema with the
comments stripped so it works even if the paste loses its line breaks:

<https://raw.githubusercontent.com/Moscovium0894/walking-dashboard/refs/heads/feature/berkhamsted-reading-signature/berkhamsted-reading-signature/docs/d1-console-paste.sql>

The migration creates the tables and seeds the default profile. It does **not**
store a year group — that is calculated on every read.

### Schema

| Table | Holds |
|---|---|
| `profile` | one row: name, date of birth, house, school, subtitle, visibility flags |
| `current_book` | one row: title, author, cover URL, ISBN, year, source |
| `images` | the rendered signature PNG, the uploaded logo, its original, and the cover |
| `settings` | the revision counter used for cache busting |
| `sessions` | hashed session and CSRF tokens |
| `rate_limit` | fixed-window counters |
| `book_cache` | cached search results |

---

## 5. Cloudflare setup

You need the **Database ID** of the D1 database you just created. It is shown on
the database's page in the dashboard. It is a resource identifier, not a
credential, and is safe to commit.

Put it in [`wrangler.jsonc`](wrangler.jsonc), replacing
`PLACEHOLDER_REPLACE_WITH_D1_DATABASE_ID`.

---

## 6. Secrets

**None are required.** The application runs with the D1 binding alone.

Passwords are hashed with PBKDF2 and a per-account random salt held in the
database, which is ordinary practice. Sessions are random tokens stored as
hashes, so they need no signing key either.

Two optional secrets are available, set under **Settings → Variables and
Secrets** with type **Secret**:

| Name | Effect |
|---|---|
| `SIGNUP_CODE` | When set, registration requires this code. Turns an open site into an invite-only one. |
| `PASSWORD_PEPPER` | Mixed into every password hash. Because it lives outside the database, a leaked database alone cannot be attacked offline. |

`PASSWORD_PEPPER` invalidates every existing password when set or changed, so
choose it before anyone registers, or not at all.

No book-API key is needed. Google Books and Open Library volume search are both
unauthenticated, and all calls happen server-side regardless.

**Never commit either of these.** This repository is public.

## 7. Deployment

### Option A — Workers Builds (recommended)

Cloudflare watches the repository and deploys on push. No API token, no GitHub
secrets.

1. Workers & Pages → **Create** → **Workers** → **Import a repository**.
2. Authorise Cloudflare's GitHub App for `walking-dashboard`.
3. Configure:
   - **Root directory:** `berkhamsted-reading-signature`
   - **Build command:** `npm run build`
   - **Deploy command:**
     `npx wrangler d1 migrations apply berkhamsted-reading-signature --remote && npx wrangler deploy`
   - **Branch:** `feature/berkhamsted-reading-signature`
4. Add the three secrets from section 6.

The Worker name in the dashboard must match `name` in `wrangler.jsonc`, or the
build fails.

### Option B — paste into the dashboard

No terminal and no Git integration needed.

1. Create the D1 database and run the migration through its **Console** tab
   (section 4).
2. Workers & Pages → **Create** → **Workers** → start from the Hello World
   template and name it `berkhamsted-reading-signature`.
3. Open **Edit code**, delete the template, and paste the whole of
   `dist/worker.min.js`. The repository is public, so you can copy it straight
   from GitHub without signing in:

   <https://raw.githubusercontent.com/Moscovium0894/walking-dashboard/refs/heads/feature/berkhamsted-reading-signature/berkhamsted-reading-signature/dist/worker.min.js>

   Use the **minified** file, not `dist/worker.js`. A paste that loses its line
   breaks would turn the readable bundle into a single comment and deploy a
   Worker that does nothing; the minified build has no line comments and
   survives, which the build verifies on every run.

   Note the `refs/heads/` in that URL. This branch name contains a slash, so the
   form without it is ambiguous about where the branch ends and the path begins.
4. **Deploy**.
5. Settings → **Bindings** → Add → **D1 database**, variable name `DB`, pointing
   at `berkhamsted-reading-signature`.
6. Settings → **Variables and Secrets** → add the three secrets from section 6.
7. Deploy again so the bindings take effect.

Repeat steps 3–4 whenever you want to pick up a new version.

### Option C — from your own machine

```bash
npx wrangler login          # browser sign-in, no API token to copy
npm run db:migrate:remote
npm run deploy
```

### Continuous integration

[`.github/workflows/berkhamsted-reading-signature.yml`](../.github/workflows/berkhamsted-reading-signature.yml)
runs lint, typecheck, tests and build on every push touching this directory. It
needs no secrets and does not deploy. It is path-filtered, so it never runs for
the walking-dashboard application and cannot affect its workflows.

---

## 8. Logos

There are two separate things, and only one of them is editable.

### The site's own branding — fixed

The masthead and the sign-in page use files committed to the repository:

| File | Used for |
|---|---|
| `public/assets/berkhamsted-logo.png` | the sign-in page, and the signature's default |
| `public/assets/berkhamsted-wordmark.png` | the masthead, recoloured white in CSS |

These are **not** editable through the dashboard. The site's branding is part of
its design, not user content, so there is no route by which an administrator, or
anyone else, can change it. To change them, replace the files and redeploy.

They are embedded into the bundle at build time by `scripts/embed-assets.mjs`,
which writes `src/worker/assets.generated.ts` and is run by `npm run build`.
That keeps the application a single pasteable file with no separate asset
upload. **Commit the regenerated file** alongside any image change; CI fails if
they are out of step. They are served from `/assets/<name>.png`.

The masthead uses the wordmark rather than the full crest because the rose is
illegible at 44px tall, and recolours it white with a CSS filter
(`brightness(0) invert(1)`) which flattens opaque pixels to white and leaves
alpha alone, so the navy crest reads against the navy bar.

Licensing and attribution: [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md).

### The signature logo — editable

The logo in your **email signature** defaults to the crest above. To use
something else, go to **Profile → Signature logo** and upload a file.

PNG, JPEG, GIF or WebP up to 1.5MB; a transparent PNG is ideal. The file type is
verified from its actual bytes, not from its name or the type the browser
claims.

#### Cropping

Choosing a file opens a cropper on the whole image. Drag a handle to resize the
crop, drag inside it to move it, or drag on the image outside the box to draw a
new region. Arrow keys nudge it; hold Alt and use the arrow keys to resize. A
live preview shows the result.

The untouched upload is kept, so **Re-crop** lets you adjust it later without
finding the file again. **Revert to the default crest** removes both.

Cropping happens in the browser on a canvas, because Workers have no image
decoder. The crop rectangle is held in natural image pixels throughout, so the
export is an exact pixel region of the source whatever size it is displayed at,
and PNG output with no canvas fill preserves transparency.

The cropper is progressive enhancement: with JavaScript disabled the form still
uploads the file, uncropped.

## 9. Signing in

Go to `/admin`. You will be redirected to `/admin/login`.

There is **no registration**. There is exactly one administrator, whose
credentials come from the Worker secrets. There is no password reset: if you
lose the password, change `ADMIN_PASSWORD` in the Cloudflare dashboard.

After five failed attempts from one IP address, sign-in is blocked for fifteen
minutes.

---

## 10. Changing your book

**Change book** → type a title, author or ISBN → **Search**.

Results come from Google Books and Open Library together, merged and
de-duplicated, preferring whichever source has the more complete record. Click
**Make this my current book**.

The cover is downloaded and stored at that moment, so the signature keeps
working even if the original cover URL later disappears.

If the search cannot find your book, use **Enter manually** lower down the page.
That form also lets you correct details or supply your own cover URL.

The signature updates immediately — there is nothing else to do.

---

## 11. Changing your profile

**Profile** lets you edit your name, date of birth, house, school and an
optional subtitle, and choose which of those appear in the signature.

The year group is not editable. It is derived from your date of birth.

---

## 12. Installing the signature in an email client

Go to **Signature** and copy the snippet. It is one line pointing at your
signature image:

```html
<a href="https://…/signature/otto"><img src="https://…/signature/otto.png" width="460" alt="…" /></a>
```

Paste that into the signature editor in your email settings. **Once.** You never
touch it again: the address is fixed, and the picture behind it is redrawn
whenever you change anything.

**Outlook on Windows** often pastes rendered content better than raw HTML. Open
the public signature page in a browser, select the signature, copy, and paste
that into File → Options → Mail → Signatures.

### How the image stays current

The Worker has no font rasteriser, and shipping one would add megabytes to a
bundle that is deployed by pasting it into a dashboard editor. The browser
already has fonts and a canvas, so the dashboard does the drawing:

1. You change your book or profile. The revision counter increments.
2. Next time you open the dashboard, it notices the stored image was rendered at
   an older revision, redraws the signature on a canvas and uploads the PNG.
3. `/signature/otto.png` serves the new bytes at the same address as before.

So the image refreshes when you next visit the dashboard, which is the same
visit in which you changed the book. The **Signature** page shows the status and
has a **Rebuild image** button if you ever want to force it.

### Things worth knowing

- **Remote images.** The signature loads when the email is opened. Some clients,
  including Outlook on Windows with default settings, ask the reader to click
  "Download pictures" first. The alt text carries your details until they do.
- **Gmail caches images on its own servers.** A change can take a while to reach
  Gmail readers even though the address has not changed. Elsewhere it appears
  within about five minutes.
- **Old emails show your current book.** That is intended: the signature is live,
  not a snapshot of the day you sent it.
- **The image is not selectable text.** That is the price of it updating itself.
  The alt text carries the same information for screen readers and for clients
  with images turned off.

## 13. How the year is calculated

The year group is **never stored**. It is calculated from your date of birth
every time it is shown, so it advances by itself on 1 September.

It is deliberately *not* derived from age, because age does not determine year
group in England. Two pupils the same age can be in different years.

The rules, as implemented in
[`src/shared/schoolYear.ts`](src/shared/schoolYear.ts):

1. A pupil born between 1 September of year *Y* and 31 August of *Y+1* belongs
   to cohort *Y*.
2. That cohort starts Reception in September *Y+5*.
3. Each academic year advances the group by one.

So:

```
yearGroup = academicYearStart − cohortStart − 5
```

Worked through for the default profile:

| | |
|---|---|
| Date of birth | 31 January 2012 |
| 1 September on or before it | 1 September 2011, so cohort = 2011 |
| On 1 September 2026 | academic year start = 2026 |
| Year group | 2026 − 2011 − 5 = **Year 10** |

On 31 August 2026 the same pupil is still Year 9. The boundary is the cutoff
date, not the birthday.

Every policy decision — the cutoff date, the reception offset, the first and
last year groups — lives in `ENGLAND_SCHOOL_YEAR_CONFIG`. To change the rules,
change that object; the arithmetic does not need touching.

This is covered by 33 tests including the boundary cases, births either side of
the cutoff, Reception through Year 13, leap years, invalid input and timezone
independence.

---

## 14. Security

This repository is **public**, so the login mechanism is fully visible to
anyone who wants to attack it. It is designed on that assumption: security rests
on secrets and rate limits, never on obscurity.

**Authentication**
- One administrator, credentials from Worker secrets. No registration, no user
  table, no password reset endpoint.
- Passwords are compared as PBKDF2-SHA256 digests (100,000 iterations) in
  constant time. Username and password are both always fully evaluated, so
  neither a valid username nor the password's length leaks through timing.
- Sessions are server-side, and only the SHA-256 of each token is stored, so
  read access to the database yields nothing replayable. Logging out deletes the
  row, so revocation is real.
- Cookies use the `__Host-` prefix with `HttpOnly`, `Secure`, `SameSite=Lax`.

**Authorisation**
- Every route under `/admin` requires a session. Everything under `/signature`
  is read-only. There is no route that writes to the database without both a
  session and a CSRF token.

**Request integrity**
- CSRF token on every mutating form, compared by hash in constant time, plus a
  same-origin check on the `Origin` header.
- Rate limiting on login (5 per 15 minutes), mutations (60/min) and search
  (30/min), keyed on `CF-Connecting-IP`, which the client cannot forge. It
  **fails closed**: a database error refuses the request rather than allowing it.

**Injection and output**
- Every D1 query is prepared and parameterised.
- Every user-controlled value is HTML-escaped at the point of output.
- Cover URLs are restricted to `http`/`https`, so a `javascript:` URL cannot
  reach a `src` attribute.
- Uploads are validated by magic bytes, not by the supplied content type.
- The thumbnail proxy has a host allowlist, so it cannot be pointed at an
  internal address.

**Headers**
- Strict CSP on admin pages: `default-src 'none'`, no third-party origins, and
  the single inline script admitted by hash rather than `unsafe-inline`.
- `nosniff`, `Referrer-Policy`, frame protection and HSTS throughout.
- The public signature carries `script-src 'none'`.

**What is deliberately public:** the signature, its images, and the profile
fields you have chosen to show. Anyone with the URL can view them. Nobody can
change them.

---

## 15. Troubleshooting

**The build fails with "Worker name does not match"**
The Worker's name in the Cloudflare dashboard must equal `name` in
`wrangler.jsonc` (`berkhamsted-reading-signature`).

**"Profile row is missing. Has the database migration been applied?"**
The tables exist but are empty, or the migration never ran. Run
`npm run db:migrate:remote`, or paste `migrations/0001_init.sql` into the D1
Console.

**The login page says it is not configured**
One or more of `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` is missing.
Add them under Settings → Variables and Secrets, with type **Secret**, then
deploy again.

**Locked out after too many attempts**
Wait fifteen minutes, or clear the throttle:
`npx wrangler d1 execute berkhamsted-reading-signature --remote --command "DELETE FROM rate_limit"`

**The signature shows a dashed LOGO box**
No logo has been uploaded. See section 8.

**A book has no cover**
Not every edition has one. Set the book manually and supply a cover URL, or pick
a different edition from the search results. The signature shows a marked
placeholder rather than breaking.

**Search returns nothing, or warns that a provider did not respond**
Both providers are rate-limited and occasionally slow. The search falls back to
whichever responded and tells you so. Try again shortly.

**The cover in my email is stale**
Image URLs carry a revision that increments on every change, so this should not
happen. If it does, confirm the revision changed by viewing the public
signature's source, then check whether your email client has cached the image
itself.

**`npm ci` fails in CI**
`package-lock.json` is out of step with `package.json`. Run `npm install`
locally and commit the updated lockfile.
