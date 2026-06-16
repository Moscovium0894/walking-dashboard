// -----------------------------------------------------------------------------
// STATS ENGINE — turns a list of normalized walks into every number the
// dashboard shows. Pure functions, no UI. Works for demo data today and the
// real spreadsheet later, unchanged.
// -----------------------------------------------------------------------------

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const km2mi = (km) => km * 0.621371;

export function computeStats(walks) {
  if (!walks.length) return null;

  // "Today" = the most recent walk date, so this-week/month always have data.
  const dates = walks.map((w) => w.walk_date).sort();
  const lastDate = new Date(dates[dates.length - 1] + "T12:00:00");
  const firstDate = new Date(dates[0] + "T12:00:00");

  const totalDistance = sum(walks, (w) => w.distance_km);
  const totalDuration = sum(walks, (w) => w.duration_min || 0);
  const totalSteps = sum(walks, (w) => w.steps || 0);
  const totalAscent = sum(walks, (w) => w.ascent_m || 0);
  const count = walks.length;

  const dayMs = 86400000;
  const within = (w, days) =>
    (lastDate - new Date(w.walk_date + "T12:00:00")) / dayMs < days;

  const thisWeek = walks.filter((w) => within(w, 7));
  const thisMonthKey = lastDate.toISOString().slice(0, 7);
  const thisMonth = walks.filter((w) => w.walk_date.slice(0, 7) === thisMonthKey);
  const thisYearKey = lastDate.getFullYear();
  const thisYear = walks.filter((w) => +w.walk_date.slice(0, 4) === thisYearKey);

  const longest = walks.reduce((a, b) => (b.distance_km > a.distance_km ? b : a));

  // Weighted average pace (min/km), and a friendly average distance.
  const pacedWalks = walks.filter((w) => w.duration_min && w.distance_km);
  const avgPace =
    pacedWalks.length
      ? sum(pacedWalks, (w) => w.duration_min) / sum(pacedWalks, (w) => w.distance_km)
      : 0;
  const avgDistance = totalDistance / count;

  // Current streak: consecutive days ending at lastDate that have a walk.
  const daySet = new Set(dates);
  let streak = 0;
  for (let d = new Date(lastDate); ; d.setDate(d.getDate() - 1)) {
    if (daySet.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }

  // Longest-ever streak.
  const sortedDays = [...daySet].sort();
  let best = 0, run = 0, prev = null;
  for (const ds of sortedDays) {
    if (prev && (new Date(ds) - new Date(prev)) / dayMs === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = ds;
  }

  // Per year.
  const byYear = groupAgg(walks, (w) => w.walk_date.slice(0, 4));
  const years = Object.keys(byYear).sort();
  const yearSeries = years.map((y) => ({
    label: y,
    distance: round(byYear[y].distance),
    walks: byYear[y].count,
  }));
  const bestYear = yearSeries.reduce((a, b) => (b.distance > a.distance ? b : a));

  // Last 12 months for the headline chart.
  const monthSeries = lastNMonths(lastDate, 12).map((key) => {
    const ws = walks.filter((w) => w.walk_date.slice(0, 7) === key);
    const [y, m] = key.split("-");
    return {
      key,
      label: `${MONTHS[+m - 1]} ${y.slice(2)}`,
      distance: round(sum(ws, (w) => w.distance_km)),
      walks: ws.length,
    };
  });

  // Day of week.
  const dow = DOW.map((name, i) => {
    const ws = walks.filter((w) => new Date(w.walk_date + "T12:00:00").getDay() === i);
    return { name, short: DOW_SHORT[i], walks: ws.length, distance: round(sum(ws, (w) => w.distance_km)) };
  });
  const favouriteDay = dow.reduce((a, b) => (b.walks > a.walks ? b : a));

  // Time of day.
  const tod = [
    { name: "Morning",   emoji: "🌅", test: (h) => h >= 5 && h < 11 },
    { name: "Midday",    emoji: "🌞", test: (h) => h >= 11 && h < 15 },
    { name: "Afternoon", emoji: "🌤️", test: (h) => h >= 15 && h < 19 },
    { name: "Evening",   emoji: "🌙", test: (h) => h >= 19 || h < 5 },
  ].map((b) => ({
    name: b.name,
    emoji: b.emoji,
    value: walks.filter((w) => Number.isFinite(w.hour) && b.test(w.hour)).length,
  })).filter((b) => b.value > 0);

  // Weather.
  const weatherMap = {};
  for (const w of walks) {
    if (!w.weather) continue;
    weatherMap[w.weather] = weatherMap[w.weather] || { name: w.weather, emoji: w.weather_emoji, value: 0 };
    weatherMap[w.weather].value++;
  }
  const weather = Object.values(weatherMap).sort((a, b) => b.value - a.value);

  // Footwear.
  const shoeMap = {};
  for (const w of walks) {
    if (!w.shoe) continue;
    const s = (shoeMap[w.shoe] = shoeMap[w.shoe] || {
      name: w.shoe, color: w.shoe_color || "#16a34a", walks: 0, distance: 0, first: w.walk_date, last: w.walk_date,
    });
    s.walks++;
    s.distance += w.distance_km;
    if (w.walk_date < s.first) s.first = w.walk_date;
    if (w.walk_date > s.last) s.last = w.walk_date;
  }
  const shoes = Object.values(shoeMap)
    .map((s) => ({ ...s, distance: round(s.distance), miles: round(km2mi(s.distance)) }))
    .sort((a, b) => b.distance - a.distance);
  const favouriteShoe = shoes[0];
  const lastWalkDate = dates[dates.length - 1];
  const currentShoe = shoes.find((s) => s.last === lastWalkDate) || shoes[0];

  // Locations (grouped by route name, averaged coords for the map).
  const locMap = {};
  for (const w of walks) {
    const l = (locMap[w.name] = locMap[w.name] || {
      name: w.name, walks: 0, distance: 0, latSum: 0, lngSum: 0, n: 0,
    });
    l.walks++;
    l.distance += w.distance_km;
    if (Number.isFinite(w.lat)) { l.latSum += w.lat; l.lngSum += w.lng; l.n++; }
  }
  const locations = Object.values(locMap)
    .map((l) => ({
      name: l.name,
      walks: l.walks,
      distance: round(l.distance),
      lat: l.n ? l.latSum / l.n : undefined,
      lng: l.n ? l.lngSum / l.n : undefined,
    }))
    .sort((a, b) => b.walks - a.walks);
  const favouritePlace = locations[0];

  // Recent walks (newest first).
  const recent = [...walks].sort((a, b) => b.walk_date.localeCompare(a.walk_date)).slice(0, 12);

  const yearsActive = (lastDate - firstDate) / (365.25 * dayMs);
  const walksPerWeek = count / Math.max(1, (lastDate - firstDate) / (7 * dayMs));

  return {
    today: lastDate.toISOString().slice(0, 10),
    firstWalk: dates[0],
    yearsActive: round(yearsActive, 1),

    totals: {
      walks: count,
      distanceKm: round(totalDistance),
      distanceMi: round(km2mi(totalDistance)),
      durationMin: Math.round(totalDuration),
      durationHours: round(totalDuration / 60),
      durationDays: round(totalDuration / 60 / 24, 1),
      steps: Math.round(totalSteps),
      ascentM: Math.round(totalAscent),
    },

    thisWeek: { walks: thisWeek.length, distanceKm: round(sum(thisWeek, (w) => w.distance_km)) },
    thisMonth: { walks: thisMonth.length, distanceKm: round(sum(thisMonth, (w) => w.distance_km)), label: `${MONTHS[lastDate.getMonth()]} ${lastDate.getFullYear()}` },
    thisYear: { walks: thisYear.length, distanceKm: round(sum(thisYear, (w) => w.distance_km)) },

    avgPace: round(avgPace, 1),
    avgPaceLabel: paceLabel(avgPace),
    avgDistance: round(avgDistance),
    walksPerWeek: round(walksPerWeek, 1),

    longest: { name: longest.name, distanceKm: round(longest.distance_km), date: longest.walk_date },
    streak,
    bestStreak: best,

    yearSeries,
    bestYear,
    monthSeries,
    dow,
    favouriteDay,
    tod,
    weather,
    shoes,
    favouriteShoe,
    currentShoe,
    locations,
    favouritePlace,
    recent,

    funFacts: funFacts({ totalDistance, totalAscent, totalSteps, totalDuration }),
  };
}

// --- helpers ----------------------------------------------------------------
function round(n, dp = 1) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function groupAgg(walks, keyFn) {
  const out = {};
  for (const w of walks) {
    const k = keyFn(w);
    out[k] = out[k] || { count: 0, distance: 0 };
    out[k].count++;
    out[k].distance += w.distance_km;
  }
  return out;
}

function lastNMonths(endDate, n) {
  const keys = [];
  const d = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(m.toISOString().slice(0, 7));
  }
  return keys;
}

export function paceLabel(minPerKm) {
  if (!minPerKm) return "—";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function funFacts({ totalDistance, totalAscent, totalSteps, totalDuration }) {
  const EVEREST = 8849;        // m, height above sea level
  const LEJOG = 1407;          // km, Land's End → John o' Groats
  const EARTH = 40075;         // km, equatorial circumference
  const MOON = 384400;         // km
  const EIFFEL_STAIRS = 1665;  // steps to the top

  return [
    {
      emoji: "🏔️",
      headline: `${(totalAscent / EVEREST).toFixed(1)}×`,
      text: `the height of Everest climbed — ${Math.round(totalAscent).toLocaleString()} m of ascent in all.`,
    },
    {
      emoji: "🏴",
      headline: `${(totalDistance / LEJOG).toFixed(1)}×`,
      text: `the length of Britain — far enough to walk Land's End to John o' Groats ${(totalDistance / LEJOG).toFixed(1)} times.`,
    },
    {
      emoji: "🌍",
      headline: `${((totalDistance / EARTH) * 100).toFixed(1)}%`,
      text: `of the way around the whole world (${Math.round(totalDistance).toLocaleString()} km of ${EARTH.toLocaleString()} km).`,
    },
    {
      emoji: "👣",
      headline: `${Math.round(totalSteps).toLocaleString()}`,
      text: `steps taken — that's the Eiffel Tower's stairs climbed ${Math.round(totalSteps / EIFFEL_STAIRS).toLocaleString()} times.`,
    },
    {
      emoji: "⏱️",
      headline: `${Math.round(totalDuration / 60).toLocaleString()} hrs`,
      text: `spent walking — about ${(totalDuration / 60 / 24).toFixed(0)} full days on the move.`,
    },
    {
      emoji: "🚀",
      headline: `${((totalDistance / MOON) * 100).toFixed(3)}%`,
      text: `of the way to the Moon — every step counts!`,
    },
  ];
}
