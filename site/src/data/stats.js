// -----------------------------------------------------------------------------
// STATS ENGINE — normalized walks → every number the dashboard shows.
// Canonical unit is MILES. No elevation/steps columns exist in the real sheet,
// so elevation is dropped and steps are an estimate. Pure functions, no UI.
// Also builds per-metric DRILL-DOWN descriptors (yearly breakdown + plain-English
// explanation + exact value for the rolling odometer).
// -----------------------------------------------------------------------------

import { lookupFootwear } from "./labels.js";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const mi2km = (mi) => mi * 1.60934;

export function computeStats(walks) {
  if (!walks.length) return null;

  const dates = walks.map((w) => w.walk_date).sort();
  const lastDate = new Date(dates[dates.length - 1] + "T12:00:00");
  const firstDate = new Date(dates[0] + "T12:00:00");
  const dayMs = 86400000;

  const totalDistance = sum(walks, (w) => w.distance);          // miles
  const totalDuration = sum(walks, (w) => w.duration_min || 0); // minutes
  const totalSteps = sum(walks, (w) => w.steps || 0);
  const count = walks.length;

  const within = (w, days) => (lastDate - new Date(w.walk_date + "T12:00:00")) / dayMs < days;
  const thisWeek = walks.filter((w) => within(w, 7));
  const thisMonthKey = lastDate.toISOString().slice(0, 7);
  const thisMonth = walks.filter((w) => w.walk_date.slice(0, 7) === thisMonthKey);
  const thisYearKey = lastDate.getFullYear();
  const thisYear = walks.filter((w) => +w.walk_date.slice(0, 4) === thisYearKey);

  const longest = walks.reduce((a, b) => (b.distance > a.distance ? b : a));

  const pacedWalks = walks.filter((w) => w.duration_min && w.distance);
  const avgPace = pacedWalks.length
    ? sum(pacedWalks, (w) => w.duration_min) / sum(pacedWalks, (w) => w.distance)
    : 0;
  const avgDistance = totalDistance / count;

  // Streaks (consecutive calendar days with a walk).
  const daySet = new Set(dates);
  let streak = 0;
  for (let d = new Date(lastDate); ; d.setDate(d.getDate() - 1)) {
    if (daySet.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  const sortedDays = [...daySet].sort();
  let best = 0, run = 0, prev = null;
  for (const ds of sortedDays) {
    if (prev && (new Date(ds) - new Date(prev)) / dayMs === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = ds;
  }

  // Per-year aggregates (used widely + for drill-downs).
  const years = [...new Set(dates.map((d) => d.slice(0, 4)))].sort();
  const yearAgg = years.map((y) => {
    const ws = walks.filter((w) => w.walk_date.slice(0, 4) === y);
    const paced = ws.filter((w) => w.duration_min && w.distance);
    return {
      label: y,
      walks: ws.length,
      distance: round(sum(ws, (w) => w.distance)),
      hours: round(sum(ws, (w) => w.duration_min || 0) / 60),
      steps: Math.round(sum(ws, (w) => w.steps || 0)),
      longest: ws.length ? round(Math.max(...ws.map((w) => w.distance))) : 0,
      pace: paced.length ? round(sum(paced, (w) => w.duration_min) / sum(paced, (w) => w.distance), 1) : 0,
    };
  });
  const yearSeries = yearAgg.map((y) => ({ label: y.label, distance: y.distance, walks: y.walks }));
  const bestYear = yearSeries.reduce((a, b) => (b.distance > a.distance ? b : a));

  // Last 12 months.
  const monthSeries = lastNMonths(lastDate, 12).map((key) => {
    const ws = walks.filter((w) => w.walk_date.slice(0, 7) === key);
    const [y, m] = key.split("-");
    return { key, label: `${MONTHS[+m - 1]} ${y.slice(2)}`, distance: round(sum(ws, (w) => w.distance)), walks: ws.length };
  });

  // Day of week.
  const dow = DOW.map((name, i) => {
    const ws = walks.filter((w) => new Date(w.walk_date + "T12:00:00").getDay() === i);
    return { name, short: DOW_SHORT[i], walks: ws.length, distance: round(sum(ws, (w) => w.distance)) };
  });
  const favouriteDay = dow.reduce((a, b) => (b.walks > a.walks ? b : a));

  // Time of day (from Start Time).
  const tod = [
    { name: "Morning",   emoji: "🌅", test: (h) => h >= 5 && h < 11 },
    { name: "Midday",    emoji: "🌞", test: (h) => h >= 11 && h < 14 },
    { name: "Afternoon", emoji: "🌤️", test: (h) => h >= 14 && h < 18 },
    { name: "Evening",   emoji: "🌙", test: (h) => h >= 18 || h < 5 },
  ].map((b) => ({ name: b.name, emoji: b.emoji, value: walks.filter((w) => Number.isFinite(w.hour) && b.test(w.hour)).length }))
   .filter((b) => b.value > 0);

  // Weather (mined from notes upstream).
  const weatherMap = {};
  for (const w of walks) {
    if (!w.weather) continue;
    weatherMap[w.weather] = weatherMap[w.weather] || { name: w.weather, emoji: w.weather_emoji, value: 0 };
    weatherMap[w.weather].value++;
  }
  const weather = Object.values(weatherMap).sort((a, b) => b.value - a.value);

  // Footwear — per person. Granny (col E) is the star; Grandad (col F) supports.
  const grannyShoes = footwearAgg(walks, "granny_code");
  const grandadShoes = footwearAgg(walks.filter((w) => w.grandad_code), "grandad_code");
  const favouriteShoe = grannyShoes[0];
  const grannyKinds = kindSplit(walks, "granny_code");

  const togetherCount = walks.filter((w) => w.together).length;
  const soloCount = count - togetherCount;
  const matchCount = walks.filter((w) => w.footwear_match === true).length;
  const diffWalks = walks
    .filter((w) => w.footwear_match === false)
    .sort((a, b) => b.walk_date.localeCompare(a.walk_date))
    .map((w) => ({ walk_date: w.walk_date, place: w.place || w.name, distance: w.distance,
      granny_shoe: w.granny_shoe, granny_emoji: w.granny_emoji,
      grandad_shoe: w.grandad_shoe, grandad_emoji: w.grandad_emoji }));
  const footwear = {
    granny: grannyShoes, grandad: grandadShoes, favourite: favouriteShoe,
    grannyKinds, togetherCount, soloCount, matchCount,
    diffCount: diffWalks.length, diffWalks,
  };
  // back-compat for any component still reading these
  const shoes = grannyShoes;

  // Locations (by place).
  const locMap = {};
  for (const w of walks) {
    const key = w.place || w.name || "—";
    const l = (locMap[key] = locMap[key] || { name: key, walks: 0, distance: 0, lat: w.lat, lng: w.lng });
    l.walks++;
    l.distance += w.distance;
    if (Number.isFinite(w.lat)) { l.lat = w.lat; l.lng = w.lng; }
  }
  const locations = Object.values(locMap).map((l) => ({ ...l, distance: round(l.distance) })).sort((a, b) => b.walks - a.walks);
  const favouritePlace = locations[0];

  const recent = [...walks].sort((a, b) => b.walk_date.localeCompare(a.walk_date)).slice(0, 12);

  const yearsActive = (lastDate - firstDate) / (365.25 * dayMs);
  const walksPerWeek = count / Math.max(1, (lastDate - firstDate) / (7 * dayMs));

  // --- Drill-down metric descriptors ---------------------------------------
  const yb = (field) => yearAgg.map((y) => ({ label: y.label, value: y[field] }));
  const metrics = [
    {
      id: "distance", emoji: "📏", label: "Total distance", accent: "#2f7d4f",
      exact: totalDistance, unit: " mi", decimals: 1, roundTo: 100, isDistance: true,
      explain: `Every mile Granny has walked and logged since ${years[0]} — that's about ${Math.round(mi2km(totalDistance)).toLocaleString()} km.`,
      yearly: yb("distance"), yearlyLabel: "Distance per year",
    },
    {
      id: "walks", emoji: "🚶‍♀️", label: "Total walks", accent: "#4d8fd6",
      exact: count, unit: "", decimals: 0, roundTo: 10,
      explain: `Each separate walk she recorded. She averages ${round(walksPerWeek, 1)} walks a week and ${round(avgDistance, 1)} miles a walk.`,
      yearly: yb("walks"), yearlyLabel: "Walks per year",
    },
    {
      id: "time", emoji: "⏱️", label: "Time on her feet", accent: "#9b6bd1",
      exact: totalDuration / 60, unit: " hrs", decimals: 1, roundTo: 10,
      explain: `Total walking time — roughly ${round(totalDuration / 60 / 24, 1)} whole days out on the paths.`,
      yearly: yb("hours"), yearlyLabel: "Hours per year",
    },
    {
      id: "steps", emoji: "👣", label: "Steps (est.)", accent: "#39b3a6",
      exact: totalSteps, unit: "", decimals: 0, roundTo: 1000,
      explain: "Estimated from distance (about 2,050 steps a mile) — the spreadsheet doesn't record steps directly.",
      yearly: yb("steps"), yearlyLabel: "Steps per year",
    },
    {
      id: "streak", emoji: "🔥", label: "Current streak", accent: "#e06666",
      exact: streak, unit: " days", decimals: 0, roundTo: 1,
      explain: `Consecutive days with a walk, right up to her latest. Her best ever run is ${best} days in a row.`,
      yearly: yb("walks"), yearlyLabel: "Walks per year",
    },
    {
      id: "longest", emoji: "🏅", label: "Longest walk", accent: "#f4a72c",
      exact: longest.distance, unit: " mi", decimals: 1, roundTo: 1, isDistance: true,
      explain: `Her single longest walk: ${round(longest.distance, 1)} miles from ${longest.name} on ${prettyDate(longest.walk_date)}.`,
      yearly: yb("longest"), yearlyLabel: "Longest walk each year",
    },
    {
      id: "pace", emoji: "🐢", label: "Average pace", accent: "#5aa06f",
      exact: avgPace, unit: " /mi", decimals: 1, roundTo: 1, isPace: true,
      explain: "Her typical minutes-per-mile — a steady, enjoyable amble rather than a race.",
      yearly: yearAgg.map((y) => ({ label: y.label, value: y.pace })), yearlyLabel: "Average pace each year (min/mi)",
    },
    {
      id: "thisYear", emoji: "📅", label: `${thisYearKey} so far`, accent: "#0ea5e9",
      exact: round(sum(thisYear, (w) => w.distance)), unit: " mi", decimals: 1, roundTo: 10, isDistance: true,
      explain: `Miles walked in ${thisYearKey} so far, across ${thisYear.length} walks.`,
      yearly: yb("distance"), yearlyLabel: "Distance per year",
    },
  ];

  // Calendar: date → summary (for the heat-map / day tap).
  const byDate = {};
  for (const w of walks) {
    const b = (byDate[w.walk_date] = byDate[w.walk_date] || { date: w.walk_date, walks: 0, distance: 0, items: [] });
    b.walks++; b.distance = round(b.distance + w.distance, 1); b.items.push(w);
  }

  // "On this day" across the years (same month + day as the latest walk).
  const md = lastDate.toISOString().slice(5, 10);
  const onThisDay = walks
    .filter((w) => w.walk_date.slice(5) === md && w.walk_date !== dates[dates.length - 1])
    .sort((a, b) => b.walk_date.localeCompare(a.walk_date));

  return {
    today: lastDate.toISOString().slice(0, 10),
    firstWalk: dates[0],
    firstYear: years[0],
    yearsActive: round(yearsActive, 1),

    totals: {
      walks: count,
      distanceMi: round(totalDistance),
      distanceKm: round(mi2km(totalDistance)),
      durationMin: Math.round(totalDuration),
      durationHours: round(totalDuration / 60),
      durationDays: round(totalDuration / 60 / 24, 1),
      steps: Math.round(totalSteps),
    },

    thisWeek: { walks: thisWeek.length, distanceMi: round(sum(thisWeek, (w) => w.distance)) },
    thisMonth: { walks: thisMonth.length, distanceMi: round(sum(thisMonth, (w) => w.distance)), label: `${MONTHS[lastDate.getMonth()]} ${lastDate.getFullYear()}` },
    thisYear: { walks: thisYear.length, distanceMi: round(sum(thisYear, (w) => w.distance)) },

    avgPace: round(avgPace, 1),
    avgPaceLabel: paceLabel(avgPace),
    avgDistance: round(avgDistance, 1),
    walksPerWeek: round(walksPerWeek, 1),

    longest: { name: longest.name, distanceMi: round(longest.distance), date: longest.walk_date },
    streak,
    bestStreak: best,

    yearSeries, bestYear, monthSeries, dow, favouriteDay, tod, weather,
    shoes, favouriteShoe, footwear, locations, favouritePlace, recent,
    byDate, onThisDay, allWalks: walks,
    metrics,
    funFacts: funFacts({ totalDistance, totalSteps, totalDuration }),
  };
}

// --- footwear helpers -------------------------------------------------------
function footwearAgg(walks, codeField) {
  const map = {};
  for (const w of walks) {
    const code = w[codeField];
    if (!code) continue;
    const meta = lookupFootwear(code);
    const s = (map[meta.label] = map[meta.label] || { name: meta.label, color: meta.color, emoji: meta.emoji, kind: meta.kind, walks: 0, distance: 0 });
    s.walks++; s.distance += w.distance;
  }
  return Object.values(map).map((s) => ({ ...s, distance: round(s.distance) })).sort((a, b) => b.distance - a.distance);
}

function kindSplit(walks, codeField) {
  const KINDS = { boots: { name: "Boots", emoji: "🥾", value: 0 }, shoes: { name: "Shoes", emoji: "👟", value: 0 }, sandals: { name: "Sandals", emoji: "🩴", value: 0 }, flipflops: { name: "Flip-flops", emoji: "🩴", value: 0 } };
  for (const w of walks) {
    if (!w[codeField]) continue;
    const meta = lookupFootwear(w[codeField]);
    if (KINDS[meta.kind]) KINDS[meta.kind].value++;
  }
  return Object.values(KINDS).filter((k) => k.value > 0);
}

// --- helpers ----------------------------------------------------------------
function round(n, dp = 1) { const f = Math.pow(10, dp); return Math.round(n * f) / f; }

function lastNMonths(endDate, n) {
  const keys = [];
  const d = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(m.toISOString().slice(0, 7));
  }
  return keys;
}

export function paceLabel(minPerMile) {
  if (!minPerMile) return "—";
  const m = Math.floor(minPerMile);
  const s = Math.round((minPerMile - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function prettyDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function funFacts({ totalDistance, totalSteps, totalDuration }) {
  const LEJOG = 874;          // miles, Land's End → John o' Groats
  const EARTH = 24901;        // miles, equator
  const MOON = 238855;        // miles
  const BAY = 8;              // miles, the classic Morecambe Bay cross-sands walk
  const EIFFEL_STAIRS = 1665; // steps to the top

  return [
    { emoji: "🏴", headline: `${(totalDistance / LEJOG).toFixed(1)}×`, text: `the length of Britain — far enough to walk Land's End to John o' Groats ${(totalDistance / LEJOG).toFixed(1)} times.` },
    { emoji: "🌊", headline: `${Math.round(totalDistance / BAY).toLocaleString()}×`, text: `across Morecambe Bay — that many crossings of the famous cross-sands walk on her doorstep.` },
    { emoji: "🌍", headline: `${((totalDistance / EARTH) * 100).toFixed(1)}%`, text: `of the way around the whole world (${Math.round(totalDistance).toLocaleString()} of ${EARTH.toLocaleString()} miles).` },
    { emoji: "👣", headline: `${Math.round(totalSteps).toLocaleString()}`, text: `steps taken — like climbing the Eiffel Tower's stairs ${Math.round(totalSteps / EIFFEL_STAIRS).toLocaleString()} times.` },
    { emoji: "⏱️", headline: `${Math.round(totalDuration / 60).toLocaleString()} hrs`, text: `spent walking — about ${(totalDuration / 60 / 24).toFixed(0)} full days on the move.` },
    { emoji: "🚀", headline: `${((totalDistance / MOON) * 100).toFixed(2)}%`, text: `of the way to the Moon — every single step counts!` },
  ];
}

// ============================================================================
// EXPLORER — build-your-own chart. Pick a metric + grouping → a time series.
// Distance metrics are returned in MILES (canonical); the UI converts to km.
// ============================================================================
export const EXPLORER_METRICS = [
  { id: "distance",    label: "Distance",        agg: "sum",   field: (w) => w.distance,          isDistance: true },
  { id: "walks",       label: "Number of walks", agg: "count" },
  { id: "time",        label: "Time (hours)",    agg: "sum",   field: (w) => (w.duration_min || 0) / 60 },
  { id: "steps",       label: "Steps (est.)",    agg: "sum",   field: (w) => w.steps || 0 },
  { id: "avgDistance", label: "Avg walk length", agg: "avg",   field: (w) => w.distance,          isDistance: true },
  { id: "pace",        label: "Average pace",    agg: "avgw",  field: (w) => w.duration_min, weight: (w) => w.distance, need: (w) => w.duration_min && w.distance, isPace: true },
];

export const EXPLORER_GROUPINGS = [
  { id: "week",  label: "By week" },
  { id: "month", label: "By month" },
  { id: "year",  label: "By year" },
];

function groupKey(iso, grouping) {
  if (grouping === "year") return iso.slice(0, 4);
  if (grouping === "month") return iso.slice(0, 7);
  // ISO week (Mon-based), key "YYYY-Www"
  const d = new Date(iso + "T12:00:00");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function aggregateSeries(walks, metricId, grouping) {
  const metric = EXPLORER_METRICS.find((m) => m.id === metricId) || EXPLORER_METRICS[0];
  const buckets = new Map();
  for (const w of walks) {
    if (metric.need && !metric.need(w)) continue;
    const key = groupKey(w.walk_date, grouping);
    const b = buckets.get(key) || { key, n: 0, total: 0, wsum: 0, wn: 0 };
    b.n++;
    if (metric.agg === "sum" || metric.agg === "avg") b.total += metric.field(w);
    if (metric.agg === "avgw") { b.total += metric.field(w); b.wsum += metric.weight(w); }
    buckets.set(key, b);
  }
  const rows = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  return rows.map((b) => {
    let value;
    if (metric.agg === "count") value = b.n;
    else if (metric.agg === "sum") value = b.total;
    else if (metric.agg === "avg") value = b.n ? b.total / b.n : 0;
    else if (metric.agg === "avgw") value = b.wsum ? b.total / b.wsum : 0;
    return { label: prettyGroupLabel(b.key, grouping), value: Math.round(value * 10) / 10, count: b.n };
  });
}

function prettyGroupLabel(key, grouping) {
  if (grouping === "year") return key;
  if (grouping === "month") {
    const [y, m] = key.split("-");
    return `${MONTHS[+m - 1]} ${y.slice(2)}`;
  }
  return key.replace("-W", " w"); // 2026 w24
}
