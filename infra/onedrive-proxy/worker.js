/**
 * Granny Walks — OneDrive live proxy (Cloudflare Worker)
 * ---------------------------------------------------------------------------
 * Keeps the dashboard LIVE ON EVERY REFRESH without any manual step, while
 * Granny just keeps editing her Excel file in OneDrive.
 *
 * Why this exists: her workbook is SharePoint-migrated personal OneDrive, which
 * Microsoft will NOT let anyone download anonymously (every public endpoint
 * returns 401). CORS is actually open — the wall is authentication. So this
 * tiny Worker authenticates with a stored Microsoft refresh token, downloads
 * the file live via Microsoft Graph, and re-serves the raw .xlsx bytes with
 * permissive CORS + no-store. The static site fetches THIS Worker on every load.
 *
 * Secrets (set with `wrangler secret put`):
 *   MS_CLIENT_ID       - the Azure app (public client) Application (client) ID
 *   MS_REFRESH_TOKEN   - a refresh token from a one-time sign-in (scopes:
 *                        "Files.Read offline_access")
 * Vars (wrangler.toml [vars] or KV):
 *   FILE_PATH          - path of the workbook in the drive, e.g.
 *                        "Documents/Granny Walking.xlsx"
 *   ALLOW_ORIGIN       - your site origin, e.g.
 *                        "https://moscovium0894.github.io" (or "*")
 * Optional binding:
 *   TOKENS (KV)        - if bound, the rotating refresh token is persisted here
 *                        so it never goes stale. Highly recommended.
 *
 * See README.md in this folder for the 10-minute one-time setup.
 */

const TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      const accessToken = await getAccessToken(env);
      const path = encodeURIComponent(env.FILE_PATH).replace(/%2F/g, "/");
      const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`;

      const res = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "follow",
        cf: { cacheTtl: 0 },
      });
      if (!res.ok) {
        const body = await res.text();
        return json({ error: "graph_download_failed", status: res.status, body: body.slice(0, 300) }, 502, cors);
      }
      return new Response(res.body, {
        headers: {
          ...cors,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "inline; filename=walks.xlsx",
        },
      });
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500, cors);
    }
  },
};

// Exchange the (rotating) refresh token for a fresh access token. If a KV
// binding is present, persist the new refresh token so it never expires.
async function getAccessToken(env) {
  const refreshToken =
    (env.TOKENS && (await env.TOKENS.get("refresh_token"))) || env.MS_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("No refresh token configured");

  const form = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "Files.Read offline_access",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token_refresh_failed: ${data.error || res.status}`);

  if (env.TOKENS && data.refresh_token) {
    await env.TOKENS.put("refresh_token", data.refresh_token);
  }
  return data.access_token;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
