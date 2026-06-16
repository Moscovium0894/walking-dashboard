import { useMemo, useState } from "react";
import { useUnits } from "../settings/SettingsContext.jsx";

const fmtDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const MAX = 300;

// Search + full walk log. Matches place, description, notes/weather, date and
// footwear. Empty box = the whole log, newest first.
export default function SearchPage({ stats }) {
  const u = useUnits();
  const [q, setQ] = useState("");

  const all = useMemo(
    () => [...stats.allWalks].sort((a, b) => b.walk_date.localeCompare(a.walk_date)),
    [stats]
  );

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all;
    const terms = query.split(/\s+/);
    return all.filter((w) => {
      const hay = [
        w.walk_date, w.place, w.name, w.description, w.notes, w.weather,
        w.shoe, w.grandad_shoe, fmtDay(w.walk_date),
      ].filter(Boolean).join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [q, all]);

  const shown = results.slice(0, MAX);

  return (
    <div className="page-scroll page-pad">
      <h1 className="page-title">🔍 Search walks</h1>

      <div className="search-bar">
        <input
          className="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “Arnside”, “rain”, “boots”, “2019”…"
          autoFocus
        />
        {q && <button className="search-clear" onClick={() => setQ("")} aria-label="Clear">✕</button>}
      </div>

      <div className="search-chips">
        {["Arnside", "Morecambe", "rain", "sunny", "boots", "sandals"].map((c) => (
          <button key={c} className="chip" onClick={() => setQ(c)}>{c}</button>
        ))}
      </div>

      <p className="card-note search-count">
        {results.length.toLocaleString("en-GB")} {results.length === 1 ? "walk" : "walks"}
        {results.length > MAX && ` (showing first ${MAX})`}
      </p>

      <div className="result-list">
        {shown.map((w, i) => (
          <div className="result-row" key={w.walk_date + i}>
            <div className="result-top">
              <span className="result-place">{w.place || w.name}</span>
              <span className="result-dist">{u.fmtDist(w.distance)}</span>
            </div>
            <div className="result-meta muted">
              {fmtDay(w.walk_date)}
              {Number.isFinite(w.hour) ? ` · ${String(w.hour).padStart(2, "0")}:${String(w.minute ?? 0).padStart(2, "0")}` : ""}
              {w.weather ? ` · ${w.weather_emoji} ${w.weather}` : ""}
              {` · 👵 ${w.shoe}`}
            </div>
            {w.notes && <div className="result-notes">“{w.notes}”</div>}
          </div>
        ))}
        {!shown.length && <p className="muted">No walks match “{q}”. Try a place, a year, or weather.</p>}
      </div>
    </div>
  );
}
