#!/usr/bin/env node
/**
 * One-time helper: sign in to your personal Microsoft account and print a
 * refresh token for the Worker. Uses the device-code flow, so there's no local
 * web server — you just visit a URL and type a code.
 *
 *   node get-refresh-token.mjs <MS_CLIENT_ID>
 *
 * The app registration must have "Allow public client flows" = Yes.
 */
const clientId = process.argv[2];
if (!clientId) {
  console.error("Usage: node get-refresh-token.mjs <MS_CLIENT_ID>");
  process.exit(1);
}

const BASE = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const scope = "Files.Read.All offline_access";

const dc = await (await fetch(`${BASE}/devicecode`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: clientId, scope }),
})).json();

if (dc.error) { console.error("devicecode error:", dc); process.exit(1); }

console.log(`\n  1. Go to: ${dc.verification_uri}`);
console.log(`  2. Enter code: ${dc.user_code}`);
console.log(`  3. Sign in as the account that owns the spreadsheet and approve.\n`);
console.log("Waiting for you to finish…");

const interval = (dc.interval || 5) * 1000;
const deadline = Date.now() + dc.expires_in * 1000;

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, interval));
  const tok = await (await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: dc.device_code,
    }),
  })).json();

  if (tok.refresh_token) {
    console.log("\n✅ Success. Set these as Worker secrets:\n");
    console.log("MS_CLIENT_ID    =", clientId);
    console.log("MS_REFRESH_TOKEN=", tok.refresh_token, "\n");
    process.exit(0);
  }
  if (tok.error && tok.error !== "authorization_pending" && tok.error !== "slow_down") {
    console.error("Token error:", tok.error_description || tok.error);
    process.exit(1);
  }
}
console.error("Timed out waiting for sign-in.");
process.exit(1);
