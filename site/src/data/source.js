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
//   "json"     → fetch a pre-built walks.json (RECOMMENDED: produced by a
//                scheduled GitHub Action that reads the OneDrive workbook
//                server-side, so there's no browser CORS problem). Same-origin.
//   "onedrive" → live-fetch the workbook directly in the browser (prototype —
//                currently NOT viable: the api.onedrive.com shares endpoint
//                returns 401 for this share type and the raw 1drv.ms link is
//                CORS-blocked. Kept for reference / if the link type changes.)
//   "auto"     → try OneDrive, fall back to demo if the browser fetch fails.
// -----------------------------------------------------------------------------

import { generateWalks } from "./demoData.js";
import { fetchWorkbookBytes } from "./onedrive.js";
import { parseWorkbook } from "./parseWorkbook.js";
import { weatherFromNotes } from "./labels.js";

export const DATA_MODE = "demo";
export const USING_DEMO_DATA = DATA_MODE === "demo";

export async function loadWalks() {
  if (DATA_MODE === "json") return normalizeAll(await loadFromJson());
  if (DATA_MODE === "onedrive") return normalizeAll(await loadFromOneDrive());
  if (DATA_MODE === "auto") {
    try {
      return normalizeAll(await loadFromOneDrive());
    } catch (e) {
      console.warn("OneDrive fetch failed, using demo data:", e.message);
      return normalizeAll(generateWalks());
    }
  }
  return normalizeAll(generateWalks());
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
