// -----------------------------------------------------------------------------
// DATA SOURCE  —  the single place the dashboard gets its walks from.
// -----------------------------------------------------------------------------
// Canonical unit is MILES (that's what Granny records). Each walk looks like:
//   { walk_date:"2026-06-14", name, place, lat, lng, distance(MILES),
//     duration_min, pace_min_mi, hour, minute, steps, shoe, shoe_color,
//     weather, weather_emoji, description, notes, source }
//
// DATA_MODE controls where data comes from. Demo data is modelled on the REAL
// spreadsheet structure (miles, Arnside/Silverdale places, footwear codes,
// weather in the notes), so the dashboard looks and behaves the same when the
// live sheet is wired in.
//   "demo"     → rich generated sample data (default while we finalise wiring)
//   "proxy"    → LIVE on every refresh via the authenticated Cloudflare Worker
//                (infra/onedrive-proxy/). The Worker holds a Microsoft token,
//                downloads the workbook live and re-serves it with CORS. This is
//                the "always live, no manual step" path — set ONEDRIVE_PROXY_URL
//                in onedrive.js and flip DATA_MODE to "proxy".
//   "onedrive" → direct browser fetch (kept for reference; currently 401s — the
//                file is SharePoint-migrated and needs auth, though CORS is open).
//   "json"     → fetch a pre-built walks.json (scheduled-import fallback).
//   "auto"     → try the proxy, fall back to demo if it isn't reachable.
// -----------------------------------------------------------------------------

import { generateWalks } from "./demoData.js";
import { fetchWorkbookBytes, fetchViaProxy } from "./onedrive.js";
import { parseWorkbook } from "./parseWorkbook.js";
import { weatherFromNotes } from "./labels.js";

export const DATA_MODE = "demo";
export const USING_DEMO_DATA = DATA_MODE === "demo";

export async function loadWalks() {
  if (DATA_MODE === "proxy") return normalizeAll(await loadFromProxy());
  if (DATA_MODE === "json") return normalizeAll(await loadFromJson());
  if (DATA_MODE === "onedrive") return normalizeAll(await loadFromOneDrive());
  if (DATA_MODE === "auto") {
    try {
      return normalizeAll(await loadFromProxy());
    } catch (e) {
      console.warn("Live fetch failed, using demo data:", e.message);
      return normalizeAll(generateWalks());
    }
  }
  return normalizeAll(generateWalks());
}

// LIVE: authenticated Worker → raw .xlsx → parse. No CORS issue, no stale cache.
export async function loadFromProxy() {
  const { walks } = parseWorkbook(await fetchViaProxy());
  return walks;
}

// Fetch a pre-built walks.json sitting next to the site (same-origin, no CORS).
// The scheduled importer writes it from the real spreadsheet.
export async function loadFromJson() {
  const url = `${import.meta.env.BASE_URL}walks.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`walks.json ${res.status}`);
  return await res.json();
}

export async function loadFromOneDrive() {
  const bytes = await fetchWorkbookBytes();
  const { walks } = parseWorkbook(bytes);
  return walks;
}

// --- Normalization: tolerate missing/odd fields -----------------------------
function normalizeAll(rows) {
  return rows
    .filter((w) => w && w.walk_date && Number.isFinite(w.distance) && w.distance > 0)
    .map((w) => {
      const weather = w.weather ? { name: w.weather, emoji: w.weather_emoji } : weatherFromNotes(w.notes);
      return {
        ...w,
        weather: weather.name,
        weather_emoji: weather.emoji,
        pace_min_mi:
          w.pace_min_mi ??
          (w.duration_min && w.distance ? +(w.duration_min / w.distance).toFixed(2) : undefined),
        steps: w.steps ?? Math.round(w.distance * 2050),
      };
    })
    .sort((a, b) => a.walk_date.localeCompare(b.walk_date));
}
