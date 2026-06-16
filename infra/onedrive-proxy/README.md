# OneDrive live proxy (Cloudflare Worker)

Makes the dashboard **live on every refresh** while Granny just keeps editing her
Excel workbook in OneDrive — no manual export, no scheduled rebuild.

## Why a Worker (and why an *authenticated* one)

We tested fetching the workbook directly. Findings (2026-06-16):

| Approach | Result |
|---|---|
| Direct browser fetch (`api.onedrive.com/shares/.../content`) | **401** — but note: **CORS is open** (`type:cors`). The blocker is *authentication*, not CORS. |
| Raw `1drv.ms` link in the browser | CORS-blocked |
| Server-side fetch (what a dumb proxy would do) | **401 / 403** — the file is `migratedtospo=true` (SharePoint-backed) and Microsoft refuses anonymous download |

So a *plain* CORS proxy can't help — there is no anonymous URL to proxy. This
Worker authenticates with a stored Microsoft refresh token, downloads the file
live via Microsoft Graph, and re-serves the raw `.xlsx` with permissive CORS +
`no-store`. Still no scheduled rebuild; still live on refresh.

## One-time setup (~10 minutes)

You'll do this once; after that it runs itself.

### 1. Register an app (free)
1. Go to <https://entra.microsoft.com> → **App registrations** → **New registration**.
2. Name: `granny-walks`. Supported accounts: **Personal Microsoft accounts only**.
3. Create it and copy the **Application (client) ID** → this is `MS_CLIENT_ID`.
4. Open **Authentication** → under **Advanced settings** set
   **Allow public client flows** = **Yes** → Save. (Enables the device-code sign-in;
   no redirect URI needed.)

### 2. Get a refresh token (one sign-in, device code)
```bash
cd infra/onedrive-proxy
node get-refresh-token.mjs <MS_CLIENT_ID>
```
It prints a short code and a URL. Visit the URL, enter the code, sign in with
**your own Microsoft account** (it doesn't have to be Granny's — Graph redeems
her share link for any signed-in user) and approve **Files.Read.All** — it then
prints `MS_REFRESH_TOKEN`.

### 3. Deploy the Worker
```bash
npm i -g wrangler
wrangler login
wrangler kv namespace create TOKENS         # optional but recommended
# edit wrangler.toml: set ALLOW_ORIGIN (and the KV id if using it)
wrangler secret put MS_CLIENT_ID
wrangler secret put MS_REFRESH_TOKEN
wrangler deploy
```
Wrangler prints your Worker URL, e.g. `https://granny-walks.<you>.workers.dev`.

### 4. Point the site at it
In `site/src/data/onedrive.js` set:
```js
export const ONEDRIVE_PROXY_URL = "https://granny-walks.<you>.workers.dev";
```
and in `site/src/data/source.js` set `export const DATA_MODE = "proxy";`
Commit & push — the site is now live from the spreadsheet.

## Notes
- No file path needed — the Worker reads Granny's **share link** (`SHARE_URL` in
  `wrangler.toml`, already filled in) via Graph `/shares`.
- Binding the **TOKENS** KV namespace lets the Worker persist the rotating
  refresh token, so it never goes stale.
- The Worker only ever returns this one file, with CORS limited to your site
  origin (`ALLOW_ORIGIN`).
