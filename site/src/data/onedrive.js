// -----------------------------------------------------------------------------
// ONEDRIVE LOADER  (live-on-refresh)
// -----------------------------------------------------------------------------
// Goal: the site reads Granny's workbook live, on every refresh, link only.
//
// WHAT WE FOUND (2026-06-16, tested in-browser AND server-side):
//   • The file is **migratedtospo=true** — SharePoint-backed personal OneDrive.
//   • api.onedrive.com actually SENDS permissive CORS headers (the browser can
//     read the response) — so CORS is NOT the blocker.
//   • Every anonymous endpoint returns **401 "unauthenticated"**. Microsoft
//     requires authentication to download this file, even server-side. A plain
//     (un-authenticated) CORS proxy therefore CANNOT fetch it either.
//
// CONSEQUENCE:
//   Tier 1 (direct browser fetch)  → not possible (401, though CORS is open).
//   Tier 2 (dumb CORS proxy)       → not possible (the wall is auth, not CORS).
//   Tier 2b (AUTHENTICATED Worker) → works: a tiny Cloudflare Worker that holds
//                                    a Microsoft refresh token, calls Graph to
//                                    download the file, and re-serves it with
//                                    Access-Control-Allow-Origin. Live on refresh,
//                                    no scheduled rebuild. See infra/onedrive-proxy/.
//
// This module supports both the (kept-for-reference) direct attempt and the
// authenticated-Worker path, always with cache-busting so refreshes get the
// latest saved edits, never a stale CDN copy.
// -----------------------------------------------------------------------------

export const ONEDRIVE_SHARE_URL =
  "https://1drv.ms/x/c/1f677a749499d8fa/IQBtz3JP3HvlTZRgdgQnyHfFAdUHalPFEZxDfoU37ZPznNQ";

// Set this to your deployed Worker URL to go live (see infra/onedrive-proxy/).
export const ONEDRIVE_PROXY_URL = "";

const NO_CACHE = { cache: "no-store", headers: { "cache-control": "no-cache" } };

// A fresh value each call so neither the browser nor any CDN serves a stale copy.
function bust() {
  // Date.now is fine in the browser; guard for SSR/test contexts.
  return `cb=${typeof Date !== "undefined" ? Date.now() : Math.round(performance.now())}`;
}

// base64url per the OneDrive "shares" API.
function base64Url(str) {
  const b64 = typeof btoa === "function" ? btoa(str) : Buffer.from(str, "utf-8").toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

export function shareToDirectUrl(shareUrl = ONEDRIVE_SHARE_URL) {
  return `https://api.onedrive.com/v1.0/shares/${base64Url(shareUrl)}/root/content`;
}

// Tier 2b: fetch through the authenticated Worker (the live path). The Worker
// handles the Microsoft auth + returns the raw .xlsx with permissive CORS.
export async function fetchViaProxy(proxyUrl = ONEDRIVE_PROXY_URL) {
  if (!proxyUrl) throw new Error("No ONEDRIVE_PROXY_URL configured");
  const url = `${proxyUrl}${proxyUrl.includes("?") ? "&" : "?"}${bust()}`;
  const res = await fetch(url, NO_CACHE);
  if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
  return await res.arrayBuffer();
}

// Tier 1 (kept for reference): direct browser fetch. Currently 401s.
export async function fetchWorkbookBytes(shareUrl = ONEDRIVE_SHARE_URL) {
  const url = `${shareToDirectUrl(shareUrl)}?${bust()}`;
  const res = await fetch(url, { redirect: "follow", ...NO_CACHE });
  if (!res.ok) throw new Error(`OneDrive responded ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

// Diagnostic used by the prototype test.
export async function probeOneDrive(shareUrl = ONEDRIVE_SHARE_URL) {
  const url = `${shareToDirectUrl(shareUrl)}?${bust()}`;
  try {
    const res = await fetch(url, { redirect: "follow", ...NO_CACHE });
    const buf = await res.arrayBuffer();
    return { ok: res.ok, status: res.status, type: res.type, bytes: buf.byteLength, url, blocked: false };
  } catch (e) {
    return { ok: false, blocked: true, error: String((e && e.message) || e), url };
  }
}
