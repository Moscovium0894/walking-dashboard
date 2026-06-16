// -----------------------------------------------------------------------------
// WORKBOOK PARSER — turns Granny's real Excel workbook into normalized walks.
// -----------------------------------------------------------------------------
// Robust by design, because the sheets are inconsistent:
//   • ONE SHEET PER YEAR ("2016".."2026"); "Blank" and "Weekly distance graph"
//     are ignored.
//   • Column layout DIFFERS between years, so we DETECT the header row per sheet
//     and map columns BY HEADER NAME, with positional fallbacks.
//   • Blank rows are week spacers (skip). Some Date cells hold stray text
//     ("xus","b") — validate and skip.
//   • Distances are MILES. Footwear comes from code1 (col E). Weather is mined
//     from the free-text Notes column.
// -----------------------------------------------------------------------------

import * as XLSX from "xlsx";
import { lookupFootwear, normFootwearCode, lookupPlace, placeKey, weatherFromNotes } from "./labels.js";

const YEAR_RE = /^(20\d{2})$/;

// Header keyword → canonical field. Checked in order; first hit wins per column.
const HEADER_MAP = [
  ["date", /^date/i],
  ["startTime", /start.*time|^time$/i],
  ["timeTaken", /time\s*taken|duration|taken/i],
  ["startPlace", /start.*place|^place|from|location/i],
  ["distance", /dist|miles|mile/i],
  ["description", /desc|route|walk|where/i],
  ["notes", /note|weather|condition|comment/i],
  ["week", /^week/i],
  ["total", /total/i],
];

export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const walks = [];
  let grandTotalCell = null;

  for (const sheetName of wb.SheetNames) {
    if (!YEAR_RE.test(sheetName.trim())) continue; // skip Blank, graph sheets
    const year = +sheetName.trim();
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    const { headerIdx, cols } = detectColumns(rows);
    const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c == null || c === "")) continue; // week spacer

      const walk = buildWalk(row, cols, year);
      if (walk) walks.push(walk);

      // capture a running grand total if present (informational)
      if (cols.total != null) {
        const tv = num(row[cols.total]);
        if (tv && tv > (grandTotalCell || 0)) grandTotalCell = tv;
      }
    }
  }

  walks.sort((a, b) => a.walk_date.localeCompare(b.walk_date));
  return { walks, grandTotalCell };
}

// Find the header row (first row that looks like headers) and build a
// field → columnIndex map. Falls back to the known current-layout positions.
function detectColumns(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] || [];
    const cols = {};
    let hits = 0;
    row.forEach((cell, idx) => {
      const text = String(cell ?? "").trim();
      if (!text) return;
      for (const [field, re] of HEADER_MAP) {
        if (cols[field] == null && re.test(text)) {
          cols[field] = idx;
          hits++;
          break;
        }
      }
    });
    // A real header row has a date column and at least one distance/place hint.
    if (cols.date != null && (cols.distance != null || cols.startPlace != null)) {
      inferCodeColumns(cols);
      return { headerIdx: i, cols };
    }
  }
  // Fallback: assume the documented CURRENT layout (A..K).
  return {
    headerIdx: -1,
    cols: {
      date: 0, startTime: 1, timeTaken: 2, startPlace: 3,
      code1: 4, code2: 5, distance: 6, description: 7, notes: 8, week: 9, total: 10,
    },
  };
}

// code1/code2 usually sit (unlabelled) between Start Place and Distance.
function inferCodeColumns(cols) {
  if (cols.startPlace != null && cols.distance != null) {
    const gap = cols.distance - cols.startPlace;
    if (gap >= 3) { cols.code1 = cols.startPlace + 1; cols.code2 = cols.startPlace + 2; }
    else if (gap === 2) { cols.code1 = cols.startPlace + 1; }
  }
}

function buildWalk(row, cols, year) {
  const date = parseDate(row[cols.date], year);
  if (!date) return null;

  const distance = num(row[cols.distance]); // MILES
  if (!(distance > 0) || distance > 60) return null; // skip junk/typos

  const startPlaceRaw = text(row[cols.startPlace]);
  const description = text(row[cols.description]);
  const notes = text(row[cols.notes]);
  const code1 = text(row[cols.code1]);   // E = Granny's shoes
  const code2 = text(row[cols.code2]);   // F = Grandad's shoes

  const gCode = normFootwearCode(code1);
  const gaCode = normFootwearCode(code2);
  const foot = lookupFootwear(code1);            // Granny (the star)
  const grandad = gaCode ? lookupFootwear(code2) : null;
  const together = !!gaCode;
  const place = lookupPlace(startPlaceRaw);
  const weather = weatherFromNotes(notes);
  const { hour, minute } = parseClock(row[cols.startTime]);
  const duration_min = parseDuration(row[cols.timeTaken]);

  const name = startPlaceRaw || description || "Walk";

  return {
    walk_date: date,
    name,
    place: place ? place.label : (startPlaceRaw || "—"),
    placeKey: placeKey(startPlaceRaw),
    lat: place ? place.lat : undefined,
    lng: place ? place.lng : undefined,
    distance,                          // canonical unit = MILES
    duration_min: duration_min ?? undefined,
    pace_min_mi: duration_min && distance ? +(duration_min / distance).toFixed(2) : undefined,
    hour: Number.isFinite(hour) ? hour : undefined,
    minute: Number.isFinite(minute) ? minute : undefined,
    steps: Math.round(distance * 2050),   // estimate (no step column in the sheet)
    code1: code1 || undefined,
    code2: code2 || undefined,
    // Granny is the star: `shoe*` = her footwear.
    shoe: foot.label,
    shoe_color: foot.color,
    shoe_emoji: foot.emoji,
    granny_code: gCode || undefined,
    granny_shoe: foot.label,
    granny_emoji: foot.emoji,
    // Grandad is a supporting detail (present on ~most walks).
    grandad_code: gaCode || undefined,
    grandad_shoe: grandad ? grandad.label : undefined,
    grandad_emoji: grandad ? grandad.emoji : undefined,
    together,
    footwear_match: together ? gCode === gaCode : null,
    weather: weather.name,
    weather_emoji: weather.emoji,
    description: description || undefined,
    notes: notes || undefined,
    source: "spreadsheet",
  };
}

// --- cell coercion helpers --------------------------------------------------
function text(v) {
  if (v == null) return "";
  return String(v).trim();
}

function num(v) {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// Dates may be JS Date (cellDates), Excel serial number, or text. Validate hard.
function parseDate(v, year) {
  if (v instanceof Date && !isNaN(v)) return isoLocal(v);
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const d = XLSX.SSF ? excelSerialToDate(v) : null;
    if (d) return isoLocal(d);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || /^[a-z]{1,4}$/i.test(s)) return null; // stray text like "xus","b"
    const d = new Date(s);
    if (!isNaN(d) && d.getFullYear() >= 2000 && d.getFullYear() <= year + 1) {
      return isoLocal(d);
    }
  }
  return null;
}

function excelSerialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d) ? null : d;
}

function isoLocal(d) {
  // Use UTC parts to avoid timezone drift shifting the day.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "9.11" decimal clock → 09:11.
function parseClock(v) {
  const n = num(v);
  if (n == null) return { hour: undefined, minute: undefined };
  const hour = Math.floor(n);
  const minute = Math.round((n - hour) * 100);
  if (hour < 0 || hour > 23 || minute > 59) return { hour: undefined, minute: undefined };
  return { hour, minute };
}

// "3 hr 34 min" / "1 hr" / "45 min" / "2:15" → minutes.
function parseDuration(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return +hm[1] * 60 + +hm[2];
  let mins = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h)\b/);
  const m = s.match(/(\d+)\s*(?:min|mins|m)\b/);
  if (h) mins += parseFloat(h[1]) * 60;
  if (m) mins += parseFloat(m[1]);
  if (!h && !m) {
    const justNum = num(s);
    if (justNum && justNum < 12) return Math.round(justNum * 60); // "3" hrs
  }
  return mins > 0 ? Math.round(mins) : null;
}
