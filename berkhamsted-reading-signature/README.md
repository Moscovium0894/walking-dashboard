# Berkhamsted Reading Signature

A private admin site that keeps track of the book you are currently reading, and
serves a matching email signature from a stable public address.

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
8. [Uploading the logo](#8-uploading-the-logo)
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

The signature contains **no JavaScript**. Email clients do not run it, so it is
built as a table-based HTML fragment with inline styles, which is the only thing
that renders consistently from Outlook to Gmail to Apple Mail.

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
| `/signature/otto` | public | the signature as an HTML document |
| `/signature/otto.txt` | public | plain-text fallback |
| `/signature/otto/logo.png` | public | the logo, from D1 |
| `/signature/otto/cover.jpg` | public | the current cover, from D1 |
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
    ui/              the admin pages
migrations/          D1 migrations
dist/worker.js       the built single-file bundle (committed, see below)
```

`dist/worker.js` is committed on purpose. It is what you paste into the
Cloudflare dashboard if you are deploying that way. CI fails if it is out of
date relative to the source.

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

…or, if you have no terminal available, open the database in the dashboard,
go to the **Console** tab, paste the contents of
[`migrations/0001_init.sql`](migrations/0001_init.sql) and run it.

The migration creates the tables and seeds the default profile. It does **not**
store a year group — that is calculated on every read.

### Schema

| Table | Holds |
|---|---|
| `profile` | one row: name, date of birth, house, school, subtitle, visibility flags |
| `current_book` | one row: title, author, cover URL, ISBN, year, source |
| `images` | the logo and cover bytes, so no third-party image host is needed |
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

Three secrets are required. Set them on the Worker in the Cloudflare dashboard:
**Workers & Pages → your Worker → Settings → Variables and Secrets → Add**, with
type **Secret**.

| Name | What it is | How to choose it |
|---|---|---|
| `ADMIN_USERNAME` | your login username | anything |
| `ADMIN_PASSWORD` | your login password | 20+ characters from a password manager |
| `SESSION_SECRET` | key used to salt password derivation | 48+ random characters |

Until all three are set, the login page says so plainly and refuses every
sign-in attempt. The public signature still works.

No book-API key is needed. Google Books and Open Library volume search are both
unauthenticated, and all calls happen server-side regardless.

**Never commit any of these.** This repository is public.

---

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
   [`dist/worker.js`](dist/worker.js). On a public repository you can copy it
   from the `raw.githubusercontent.com` URL without signing in to GitHub.
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

## 8. Uploading the logo

The logo is **not** in this repository, and this project will not generate or
download a substitute.

Sign in, go to **Profile → Berkhamsted logo**, and upload the official PNG. It
is stored in D1 and served from `/signature/otto/logo.png`, so the signature
does not depend on any other host.

PNG, JPEG, GIF or WebP up to 1.5MB. Around 600px wide is ideal — it displays at
150px, so that stays sharp on high-DPI screens. The file type is verified from
its actual bytes, not the name or the browser-supplied type.

Until a logo is uploaded, the signature shows a dashed box marked `LOGO` rather
than a broken image.

---

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

Go to **Signature**, then either copy the HTML or use the public URL.

**Outlook (web), Gmail, Apple Mail:** select everything in the **Copy the HTML**
box, copy it, and paste it into the signature editor in your email settings.

**Outlook (Windows desktop):** open the public URL in a browser, select the
signature on the page, copy, and paste into File → Options → Mail → Signatures.
Pasting rendered content works better there than pasting raw HTML.

Two things worth knowing:

- **Remote images.** The logo and cover load from the Worker when the email is
  opened. Most clients show them immediately for a known sender; some, including
  Outlook on Windows with default settings, ask the reader to click "Download
  pictures" first. The text is unaffected.
- **Old emails update too.** Because images are fetched when the email is
  opened, an email you sent last term will show your *current* book, not the one
  you were reading when you sent it. That is usually what people want from this
  kind of signature, but it is worth knowing.

---

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
