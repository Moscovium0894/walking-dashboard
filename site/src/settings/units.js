// Unit helper. Canonical distance is MILES; this converts/formats for display
// based on the user's setting. Pace flips min/mile ⇄ min/km too.
export const MI_TO_KM = 1.60934;

function round(n, dp = 1) { const f = Math.pow(10, dp); return Math.round(n * f) / f; }

export function makeUnits(unit) {
  const km = unit === "km";
  const conv = (mi) => (km ? mi * MI_TO_KM : mi);
  return {
    unit: km ? "km" : "mi",
    isKm: km,
    conv,
    // number only (converted, rounded)
    d: (mi, dp = 1) => round(conv(mi), dp),
    // "12.3 mi" / "19.8 km"
    fmtDist: (mi, dp = 1) => `${round(conv(mi), dp).toLocaleString("en-GB")} ${km ? "km" : "mi"}`,
    distUnit: km ? "km" : "mi",
    // pace minutes per unit
    pace: (minPerMi) => (minPerMi ? (km ? minPerMi / MI_TO_KM : minPerMi) : 0),
    paceUnit: km ? "/km" : "/mi",
    paceLabel: (minPerMi) => {
      if (!minPerMi) return "—";
      const p = km ? minPerMi / MI_TO_KM : minPerMi;
      const m = Math.floor(p);
      const s = Math.round((p - m) * 60);
      return `${m}:${String(s).padStart(2, "0")} ${km ? "/km" : "/mi"}`;
    },
  };
}
