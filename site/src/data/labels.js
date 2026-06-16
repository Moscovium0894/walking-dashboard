// -----------------------------------------------------------------------------
// EDITABLE LOOKUPS  —  the human-friendly meanings behind Granny's shorthand.
// -----------------------------------------------------------------------------
// These are the ONLY places to edit when the owner confirms what the codes mean
// or where a place is. Everything downstream (footwear stats, the map) reads
// from here, so a one-line change here relabels the whole dashboard.
// -----------------------------------------------------------------------------

// --- code1 (spreadsheet column E) — most likely FOOTWEAR --------------------
// Values seen in the real sheet: n(172) b(9) s(7) sa(5) o(2) f(1).
// Meanings TBC with the owner — labels below are best-guess placeholders.
// Edit the `label` text once confirmed; the `emoji`/`color` are just for flair.
export const CODE1_FOOTWEAR = {
  n:  { label: "Trainers",        emoji: "👟", color: "#2f7d4f" },
  b:  { label: "Boots",           emoji: "🥾", color: "#b45309" },
  s:  { label: "Sandals",         emoji: "🩴", color: "#0ea5e9" },
  sa: { label: "Sandals (other)", emoji: "👡", color: "#9b6bd1" },
  o:  { label: "Other shoes",     emoji: "👞", color: "#6b7280" },
  f:  { label: "Wellies",         emoji: "🌧️", color: "#16a34a" },
};
export const CODE1_FALLBACK = { label: "Other", emoji: "👣", color: "#9aa0a6" };

// --- code2 (spreadsheet column F) — meaning TBC -----------------------------
// Values seen: s(190) b(5). Placeholder labels until the owner confirms.
export const CODE2 = {
  s: { label: "Type S", emoji: "🅢" },
  b: { label: "Type B", emoji: "🅑" },
};
export const CODE2_FALLBACK = { label: "Unknown", emoji: "•" };

// --- Places → map coordinates (Arnside / Silverdale / Morecambe Bay area) ----
// Informal names from the "Start Place" column. Coordinates are approximate and
// EDITABLE. Unknown places simply don't get a map pin (still counted in stats).
// `key` matching is case-insensitive and ignores a leading "*".
export const PLACES = {
  home:              { label: "Home",             lat: 54.1850, lng: -2.8300 },
  arnside:           { label: "Arnside",          lat: 54.2003, lng: -2.8327 },
  silverdale:        { label: "Silverdale",       lat: 54.1690, lng: -2.8170 },
  morecambe:         { label: "Morecambe",        lat: 54.0700, lng: -2.8700 },
  milnthorpe:        { label: "Milnthorpe",       lat: 54.2240, lng: -2.7700 },
  holme:             { label: "Holme",            lat: 54.2360, lng: -2.7470 },
  "levens hall":     { label: "Levens Hall",      lat: 54.2640, lng: -2.7770 },
  "beetham nurseries":{ label: "Beetham Nurseries",lat: 54.1980, lng: -2.7720 },
  beetham:           { label: "Beetham",          lat: 54.1980, lng: -2.7720 },
  crooklands:        { label: "Crooklands",       lat: 54.2330, lng: -2.7300 },
  sizergh:           { label: "Sizergh",          lat: 54.2870, lng: -2.7900 },
  tesco:             { label: "Tesco (Milnthorpe)",lat: 54.2255, lng: -2.7685 },
  "capitol centre":  { label: "Capitol Centre",   lat: 53.7340, lng: -2.6750 },
  jennifers:         { label: "Jennifer's",       lat: 54.1900, lng: -2.8100 },
  "jennifer's":      { label: "Jennifer's",       lat: 54.1900, lng: -2.8100 },
};

// Normalize a free-text place into a lookup key.
export function placeKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^\*+/, "")     // some places are starred, e.g. "*Arnside"
    .replace(/\s+/g, " ");
}

export function lookupPlace(raw) {
  const k = placeKey(raw);
  return PLACES[k] || null;
}

export function lookupFootwear(code) {
  const k = String(code || "").trim().toLowerCase();
  return CODE1_FOOTWEAR[k] || CODE1_FALLBACK;
}

// --- Weather keywords (scanned from the free-text Notes column) --------------
// First match wins, in this order. Editable.
export const WEATHER_RULES = [
  { name: "Sunny",  emoji: "☀️", re: /\b(sun|sunny|fine|clear|bright|lovely|glorious)\b/i },
  { name: "Rainy",  emoji: "🌧️", re: /\b(rain|rainy|shower|showers|wet|drizzle|downpour)\b/i },
  { name: "Snowy",  emoji: "❄️", re: /\b(snow|snowy|sleet)\b/i },
  { name: "Frosty", emoji: "🧊", re: /\b(frost|frosty|ice|icy|freezing)\b/i },
  { name: "Windy",  emoji: "💨", re: /\b(wind|windy|breezy|gale|blowy)\b/i },
  { name: "Foggy",  emoji: "🌫️", re: /\b(fog|foggy|mist|misty|murky)\b/i },
  { name: "Cloudy", emoji: "⛅", re: /\b(cloud|cloudy|overcast|grey|gray|dull)\b/i },
  { name: "Cold",   emoji: "🥶", re: /\b(cold|chilly|cool)\b/i },
  { name: "Warm",   emoji: "🌤️", re: /\b(warm|hot|mild|muggy|humid)\b/i },
];

export function weatherFromNotes(notes) {
  const text = String(notes || "");
  for (const rule of WEATHER_RULES) {
    if (rule.re.test(text)) return { name: rule.name, emoji: rule.emoji };
  }
  return { name: "Not noted", emoji: "•" };
}
