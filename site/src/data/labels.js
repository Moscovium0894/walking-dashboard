// -----------------------------------------------------------------------------
// EDITABLE LOOKUPS  —  the human-friendly meanings behind Granny's shorthand.
// -----------------------------------------------------------------------------
// These are the ONLY places to edit when the owner confirms what the codes mean
// or where a place is. Everything downstream (footwear stats, the map) reads
// from here, so a one-line change here relabels the whole dashboard.
// -----------------------------------------------------------------------------

// --- Footwear legend (CONFIRMED by the owner) -------------------------------
// Column E = GRANNY's shoes, Column F = GRANDAD's shoes. Same letter legend for
// both. This is the single editable lookup — change a label here and it updates
// everywhere (per-person stats, the comparison side-stat, search, etc.).
//   b = boots · sa = sandals · f = flip-flops · n = new shoes · s = old shoes
//   o = a data-entry slip → treated as "n" (new shoes)
export const FOOTWEAR = {
  b:  { label: "Boots",       emoji: "🥾", color: "#b45309", kind: "boots" },
  sa: { label: "Sandals",     emoji: "🩴", color: "#0ea5e9", kind: "sandals" },
  f:  { label: "Flip-flops",  emoji: "🩴", color: "#e0a800", kind: "flipflops" },
  n:  { label: "New shoes",   emoji: "👟", color: "#2f7d4f", kind: "shoes" },
  s:  { label: "Old shoes",   emoji: "👞", color: "#5aa06f", kind: "shoes" },
};
export const FOOTWEAR_FALLBACK = { label: "Not noted", emoji: "👣", color: "#9aa0a6", kind: "unknown" };

// Normalise a raw code: lower-case, and fold the "o" data-entry mistake into "n".
export function normFootwearCode(code) {
  const k = String(code || "").trim().toLowerCase();
  return k === "o" ? "n" : k;
}

export function lookupFootwear(code) {
  const k = normFootwearCode(code);
  return FOOTWEAR[k] || FOOTWEAR_FALLBACK;
}

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
