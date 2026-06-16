// -----------------------------------------------------------------------------
// ONEDRIVE LOADER (live-fetch prototype)
// -----------------------------------------------------------------------------
// Granny's workbook lives in personal OneDrive behind an "anyone with the link"
// share URL. The documented trick to turn a share link into a direct-download is
// the OneDrive "shares" API: base64url-encode the URL, prefix "u!", and ask for
// /root/content. That endpoint follows redirects to the raw .xlsx bytes.
//
// Whether a *browser* can fetch it depends on CORS — proven at runtime by
// `probeOneDrive()`. If CORS blocks it, we fall back to demo data (and later a
// scheduled server-side import).
// -----------------------------------------------------------------------------

export const ONEDRIVE_SHARE_URL =
  "https://1drv.ms/x/c/1f677a749499d8fa/IQBtz3JP3HvlTZRgdgQnyHfFAdUHalPFEZxDfoU37ZPznNQ";

// base64url per RFC4648, as the OneDrive shares API expects.
function base64Url(str) {
  const b64 = typeof btoa === "function"
    ? btoa(str)
    : Buffer.from(str, "utf-8").toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

export function shareToDirectUrl(shareUrl = ONEDRIVE_SHARE_URL) {
  return `https://api.onedrive.com/v1.0/shares/${base64Url(shareUrl)}/root/content`;
}

// Fetch the raw workbook bytes in the browser. Throws on network/CORS failure.
export async function fetchWorkbookBytes(shareUrl = ONEDRIVE_SHARE_URL) {
  const url = shareToDirectUrl(shareUrl);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`OneDrive responded ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

// Lightweight diagnostic used by the prototype test: did the browser fetch work,
// or was it CORS-blocked? Returns a plain object we can log/report.
export async function probeOneDrive(shareUrl = ONEDRIVE_SHARE_URL) {
  const url = shareToDirectUrl(shareUrl);
  try {
    const res = await fetch(url, { redirect: "follow" });
    const buf = await res.arrayBuffer();
    return { ok: res.ok, status: res.status, bytes: buf.byteLength, url, blocked: false };
  } catch (e) {
    return { ok: false, blocked: true, error: String(e && e.message || e), url };
  }
}
