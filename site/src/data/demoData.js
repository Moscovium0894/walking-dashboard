// -----------------------------------------------------------------------------
// DEMO DATA GENERATOR
// -----------------------------------------------------------------------------
// Realistic, varied sample walking data so the dashboard looks alive before
// Granny's real spreadsheet lands. Everything is generated deterministically
// (seeded PRNG) so the numbers are stable across page loads.
//
// This file only PRODUCES walk rows. It knows nothing about the UI. When the
// real spreadsheet arrives, `src/data/source.js` stops calling this and reads
// the sheet instead — the rest of the app is unchanged.
// -----------------------------------------------------------------------------

// Deterministic PRNG (mulberry32) so the demo is identical every load.
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

// Anchor the demo "today" so "this week / this month" always have data.
const TODAY = new Date("2026-06-15T09:00:00");

// Named local walks, each clustered around the same town (fictional home base
// in the West Country). Coordinates are real-ish so the map looks right.
const ROUTES = [
  { name: "Riverside Loop",      lat: 50.7720, lng: -3.9960, base: 4.2,  ascent: 35  },
  { name: "Bluebell Wood",       lat: 50.7805, lng: -3.9740, base: 3.1,  ascent: 60  },
  { name: "The Common",          lat: 50.7668, lng: -4.0120, base: 2.6,  ascent: 20  },
  { name: "Canal Towpath",       lat: 50.7588, lng: -3.9805, base: 6.5,  ascent: 15  },
  { name: "Hilltop Circuit",     lat: 50.7910, lng: -3.9520, base: 7.8,  ascent: 240 },
  { name: "Church Lane & Back",  lat: 50.7702, lng: -3.9888, base: 1.8,  ascent: 25  },
  { name: "Meadow Mile",         lat: 50.7635, lng: -3.9700, base: 1.6,  ascent: 10  },
  { name: "Old Railway Trail",   lat: 50.7530, lng: -3.9420, base: 8.4,  ascent: 70  },
  { name: "Seafront Stroll",     lat: 50.6190, lng: -3.4140, base: 5.0,  ascent: 30  },
  { name: "Park Lap",            lat: 50.7745, lng: -3.9930, base: 2.0,  ascent: 12  },
  { name: "Beacon Ridge",        lat: 50.8050, lng: -3.9100, base: 9.6,  ascent: 320 },
  { name: "Millpond & Orchard",  lat: 50.7600, lng: -4.0050, base: 3.6,  ascent: 45  },
];

// Granny's shoe collection over the years. Each pair has a "bought" date; a walk
// is attributed to whichever pair was the most recently bought on its date — so
// pairs naturally retire as new ones arrive (~yearly, like real walking shoes,
// giving each a believable few-hundred-mile life rather than thousands).
const SHOES = [
  { name: "Hoka Bondi 8 (lilac)",  from: "2025-10-01", color: "#a78bdb" },
  { name: "Hoka Bondi 7 (blue)",   from: "2024-11-01", color: "#3b82f6" },
  { name: "Brooks Ghost 15",       from: "2024-02-01", color: "#22a06b" },
  { name: "Merrell Moab 3 (boot)", from: "2023-04-01", color: "#b45309" },
  { name: "New Balance 880 v12",   from: "2022-05-01", color: "#ef4444" },
  { name: "Asics Gel-Venture",     from: "2021-06-01", color: "#0ea5e9" },
  { name: "Salomon X Ultra 4",     from: "2020-07-01", color: "#8b5cf6" },
  { name: "Brooks Ghost 12",       from: "2019-08-01", color: "#16a34a" },
  { name: "Hi-Tec Bandera (boot)", from: "2018-05-01", color: "#a16207" },
  { name: "Karrimor Summit",       from: "2017-04-01", color: "#0891b2" },
  { name: "New Balance 770",       from: "2015-09-01", color: "#dc2626" },
  { name: "Merrell Siren (boot)",  from: "2013-05-01", color: "#92400e" },
  { name: "Hi-Tec Penrith",        from: "2011-06-01", color: "#7c3aed" },
  { name: "Clarks Wave (old)",     from: "2009-01-01", color: "#6b7280" },
];

const WEATHERS = [
  { name: "Sunny",  emoji: "☀️", weight: 5 },
  { name: "Cloudy", emoji: "⛅", weight: 5 },
  { name: "Rainy",  emoji: "🌧️", weight: 3 },
  { name: "Windy",  emoji: "💨", weight: 2 },
  { name: "Frosty", emoji: "❄️", weight: 1 },
];

function pickWeather(rng, month) {
  // Bias seasons a little: more frost in winter, more sun in summer.
  const weights = WEATHERS.map((w) => {
    let x = w.weight;
    if (w.name === "Frosty") x += month <= 1 || month === 11 ? 4 : -1;
    if (w.name === "Sunny") x += month >= 4 && month <= 8 ? 4 : 0;
    if (w.name === "Rainy") x += month >= 9 && month <= 11 ? 2 : 0;
    return Math.max(0.2, x);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < WEATHERS.length; i++) {
    if ((r -= weights[i]) <= 0) return WEATHERS[i];
  }
  return WEATHERS[0];
}

function shoeForDate(dateStr) {
  // Most recently bought pair that already existed on this date.
  let chosen = SHOES[SHOES.length - 1];
  let best = -Infinity;
  for (const s of SHOES) {
    const t = new Date(s.from).getTime();
    if (t <= new Date(dateStr).getTime() && t > best) {
      best = t;
      chosen = s;
    }
  }
  return chosen;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// Generate the full history: ~4–5 walks/week from 2009 to "today".
export function generateWalks() {
  const rng = mulberry32(20260616);
  const walks = [];
  const start = new Date("2009-01-05T00:00:00");
  let id = 1;

  for (
    let day = new Date(start);
    day <= TODAY;
    day.setDate(day.getDate() + 1)
  ) {
    const dow = day.getDay(); // 0 Sun .. 6 Sat
    const month = day.getMonth();

    // Probability she walked today. Higher at weekends, lower deep winter.
    let p = 0.55;
    if (dow === 0 || dow === 6) p += 0.2;
    if (month === 0 || month === 1) p -= 0.12;
    if (month >= 5 && month <= 8) p += 0.1;

    // Guarantee a tidy current streak: walk every day in the last 9 days.
    const daysToToday = Math.round((TODAY - day) / 86400000);
    const forceWalk = daysToToday >= 0 && daysToToday < 9;

    if (!forceWalk && rng() > p) continue;

    const route = ROUTES[Math.floor(rng() * ROUTES.length)];
    const dateStr = fmtDate(day);

    // Distance: route base ± noise; occasional long-walk days.
    const long = rng() < 0.08 ? 1.35 : 1;
    const distance = +(route.base * (0.82 + rng() * 0.36) * long).toFixed(2);

    // Pace minutes/km — Granny's brisk amble, varies with weather/age over years.
    const yearsIn = day.getFullYear() - 2009;
    const pace = 12.5 + yearsIn * 0.06 + (rng() - 0.5) * 1.6; // min/km
    const duration = +(distance * pace).toFixed(0);

    const ascent = Math.round(route.ascent * (0.7 + rng() * 0.7));
    const steps = Math.round(distance * (1340 + rng() * 120));

    // Time of day, morning-weighted.
    const r = rng();
    const hour = r < 0.55 ? 7 + Math.floor(rng() * 4)   // morning 7–10
              : r < 0.85 ? 11 + Math.floor(rng() * 4)   // midday 11–14
              :            15 + Math.floor(rng() * 4);   // afternoon 15–18

    const weather = pickWeather(rng, month);
    const shoe = shoeForDate(dateStr);

    // Small per-walk jitter on coordinates so map points spread a touch.
    const lat = +(route.lat + (rng() - 0.5) * 0.012).toFixed(5);
    const lng = +(route.lng + (rng() - 0.5) * 0.012).toFixed(5);

    walks.push({
      id: id++,
      garmin_activity_id: null,
      walk_date: dateStr,
      hour,
      name: route.name,
      distance_km: distance,
      duration_min: duration,
      pace_min_km: +pace.toFixed(2),
      ascent_m: ascent,
      steps,
      lat,
      lng,
      shoe: shoe.name,
      shoe_color: shoe.color,
      weather: weather.name,
      weather_emoji: weather.emoji,
      source: "historical",
      status: "confirmed",
    });
  }

  return walks;
}

export const DEMO_META = {
  today: fmtDate(TODAY),
  shoes: SHOES,
  routes: ROUTES,
};
