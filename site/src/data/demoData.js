// -----------------------------------------------------------------------------
// DEMO DATA GENERATOR  (modelled on Granny's REAL spreadsheet)
// -----------------------------------------------------------------------------
// Realistic sample walks so the dashboard looks alive before the live OneDrive
// fetch is switched on. Deliberately shaped like the real data:
//   • distances in MILES (~1–14), West Country... no — Arnside/Silverdale/
//     Morecambe Bay (Lancashire/Cumbria) place names,
//   • footwear as code1 letters (n/b/s/sa/o/f) via the editable label lookup,
//   • weather written into the free-text Notes (mined back out downstream),
//   • a Start Time and "Time Taken", no elevation/step columns (the real sheet
//     has none — steps are estimated, elevation is dropped).
// Deterministic (seeded PRNG) so the numbers are stable across loads.
// -----------------------------------------------------------------------------

import { lookupFootwear, PLACES } from "./labels.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = new Date("2026-06-15T09:00:00");

// Real-ish routes around the Arnside/Silverdale/Morecambe Bay area. Each ties to
// a Start Place that exists in the PLACES lookup so the map is populated.
const ROUTES = [
  { name: "Home", baseMi: 2.2, weight: 101 },
  { name: "Arnside", baseMi: 4.0, weight: 26 },
  { name: "Silverdale", baseMi: 3.4, weight: 22 },
  { name: "Morecambe", baseMi: 5.2, weight: 18 },
  { name: "Milnthorpe", baseMi: 3.0, weight: 14 },
  { name: "Holme", baseMi: 3.6, weight: 11 },
  { name: "Levens Hall", baseMi: 4.8, weight: 9 },
  { name: "Beetham Nurseries", baseMi: 2.6, weight: 8 },
  { name: "Crooklands", baseMi: 5.6, weight: 7 },
  { name: "Sizergh", baseMi: 6.2, weight: 7 },
  { name: "Tesco", baseMi: 1.6, weight: 6 },
  { name: "Jennifer's", baseMi: 2.0, weight: 9 },
];

// Footwear codes with the same distribution flavour as the real sheet (n dominant).
const FOOT_CODES = [
  { code: "n", weight: 172 },
  { code: "b", weight: 9 },
  { code: "s", weight: 7 },
  { code: "sa", weight: 5 },
  { code: "o", weight: 2 },
  { code: "f", weight: 1 },
];

// Weather phrases dropped into Notes, seasonally weighted; downstream code mines
// the category back out (proving the Notes-parsing path).
const WEATHER_NOTES = [
  { phrase: "Lovely and sunny", season: "summer" },
  { phrase: "Bright and clear", season: "summer" },
  { phrase: "Warm, a bit muggy", season: "summer" },
  { phrase: "Grey and overcast", season: "any" },
  { phrase: "Cloudy but dry", season: "any" },
  { phrase: "Showers on and off", season: "any" },
  { phrase: "Rain most of the way", season: "winter" },
  { phrase: "Cold and breezy", season: "winter" },
  { phrase: "Hard frost this morning", season: "winter" },
  { phrase: "Misty over the bay", season: "any" },
  { phrase: "Windy along the front", season: "any" },
];

function weightedPick(rng, items) {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const it of items) if ((r -= it.weight) <= 0) return it;
  return items[items.length - 1];
}

function seasonOf(month) {
  if (month >= 5 && month <= 8) return "summer";
  if (month <= 1 || month === 11) return "winter";
  return "any";
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

export function generateWalks() {
  const rng = mulberry32(20260616);
  const walks = [];
  const start = new Date("2016-01-09T00:00:00"); // history goes back to ~2016

  for (let day = new Date(start); day <= TODAY; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    const month = day.getMonth();

    let p = 0.5;
    if (dow === 0 || dow === 6) p += 0.18;
    if (month === 0 || month === 1) p -= 0.12;
    if (month >= 5 && month <= 8) p += 0.1;

    const daysToToday = Math.round((TODAY - day) / 86400000);
    const forceWalk = daysToToday >= 0 && daysToToday < 9; // tidy current streak
    if (!forceWalk && rng() > p) continue;

    const route = weightedPick(rng, ROUTES);
    const long = rng() < 0.07 ? 1.5 : 1;
    const distance = +(route.baseMi * (0.8 + rng() * 0.4) * long).toFixed(1); // MILES

    // Pace ~17–22 min/mile (a steady amble), drifting a touch slower over years.
    const yearsIn = day.getFullYear() - 2016;
    const pace = 18.5 + yearsIn * 0.12 + (rng() - 0.5) * 2.4; // min/mile
    const duration = Math.round(distance * pace);

    const startHour = rng() < 0.6 ? 8 + Math.floor(rng() * 3)
                    : rng() < 0.8 ? 11 + Math.floor(rng() * 3)
                    :               14 + Math.floor(rng() * 3);
    const startMin = Math.floor(rng() * 60);

    const foot = weightedPick(rng, FOOT_CODES);
    const meta = lookupFootwear(foot.code);
    const place = PLACES[route.name.toLowerCase()] || null;

    const season = seasonOf(month);
    const choices = WEATHER_NOTES.filter((w) => w.season === season || w.season === "any");
    const note = choices[Math.floor(rng() * choices.length)].phrase;

    const lat = place ? +(place.lat + (rng() - 0.5) * 0.01).toFixed(5) : undefined;
    const lng = place ? +(place.lng + (rng() - 0.5) * 0.01).toFixed(5) : undefined;

    walks.push({
      walk_date: fmtDate(day),
      name: route.name,
      place: place ? place.label : route.name,
      placeKey: route.name.toLowerCase(),
      lat,
      lng,
      distance,                  // MILES (canonical)
      duration_min: duration,
      pace_min_mi: +pace.toFixed(2),
      hour: startHour,
      minute: startMin,
      steps: Math.round(distance * 2050),
      code1: foot.code,
      code2: rng() < 0.97 ? "s" : "b",
      shoe: meta.label,
      shoe_color: meta.color,
      shoe_emoji: meta.emoji,
      weather: undefined,        // intentionally derived from notes downstream
      notes: note,
      description: `${route.name} loop`,
      source: "demo",
    });
  }

  return walks;
}
