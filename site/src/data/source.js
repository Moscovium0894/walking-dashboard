// -----------------------------------------------------------------------------
// DATA SOURCE  —  the single place the dashboard gets its walks from.
// -----------------------------------------------------------------------------
// Right now this returns rich DEMO data so the site looks alive. When Granny's
// real spreadsheet is ready, this is the ONLY file that changes: swap the body
// of loadWalks() for the sheet loader below. Nothing else in the app needs to
// know where the data came from.
//
// The app expects each walk to look like this (a "normalized walk"):
//   {
//     walk_date:   "2026-06-14",   // ISO date, required
//     name:        "Riverside Loop",
//     distance_km: 4.2,
//     duration_min: 58,
//     ascent_m:    35,
//     steps:       5900,
//     pace_min_km: 12.9,           // optional — derived if missing
//     hour:        9,              // optional — hour of day (0–23)
//     lat: 50.77, lng: -3.99,      // optional — for the map
//     shoe: "Hoka Bondi 7",        // optional
//     weather: "Sunny",            // optional
//   }
// -----------------------------------------------------------------------------

import { generateWalks } from "./demoData.js";

// Flip this to false (and fill in loadFromSheet) when the real sheet is wired up.
export const USING_DEMO_DATA = true;

export async function loadWalks() {
  if (USING_DEMO_DATA) {
    return normalizeAll(generateWalks());
  }
  return normalizeAll(await loadFromSheet());
}

// --- Normalization: tolerate messy real-world rows -------------------------
function normalizeAll(rows) {
  return rows
    .map(normalizeRow)
    .filter((w) => w && w.walk_date && Number.isFinite(w.distance_km))
    .sort((a, b) => a.walk_date.localeCompare(b.walk_date));
}

function num(v) {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normalizeRow(r) {
  const distance_km = num(r.distance_km ?? r.distance ?? r.km ?? r.miles);
  const duration_min = num(r.duration_min ?? r.duration ?? r.minutes);
  const w = {
    walk_date: (r.walk_date ?? r.date ?? "").toString().slice(0, 10),
    name: r.name ?? r.location ?? r.route ?? "Walk",
    distance_km,
    duration_min,
    ascent_m: num(r.ascent_m ?? r.ascent ?? r.elevation) ?? 0,
    steps: num(r.steps) ?? (distance_km ? Math.round(distance_km * 1380) : 0),
    pace_min_km:
      num(r.pace_min_km) ??
      (distance_km && duration_min ? +(duration_min / distance_km).toFixed(2) : undefined),
    hour: num(r.hour),
    lat: num(r.lat),
    lng: num(r.lng),
    shoe: r.shoe ?? r.shoes ?? r.footwear,
    shoe_color: r.shoe_color,
    weather: r.weather,
    weather_emoji: r.weather_emoji,
  };
  return w;
}

// --- FUTURE: read Granny's real spreadsheet --------------------------------
// When ready, set USING_DEMO_DATA = false and implement one of these.
//
// Option A — a CSV committed in the repo (built into the site):
//   import walksCsv from "./walks.csv?raw";
//   async function loadFromSheet() { return parseCsv(walksCsv); }
//
// Option B — a Google Sheet "Published to the web" as CSV (live, no rebuild):
//   const SHEET_CSV_URL = "https://docs.google.com/.../pub?output=csv";
//   async function loadFromSheet() {
//     const res = await fetch(SHEET_CSV_URL);
//     return parseCsv(await res.text());
//   }
//
// A tiny CSV parser (header row → objects) is included for whichever we pick:
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cells[i]));
    return obj;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Placeholder so the build is happy until a real loader is chosen.
async function loadFromSheet() {
  throw new Error("Real spreadsheet loader not configured yet — see source.js");
}
