import { useMemo, useState } from "react";
import { useUnits } from "../settings/SettingsContext.jsx";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Calendar with a heat-map per day — good for spotting streaks and gaps. Tap a
// day to see that walk (or walks).
export default function CalendarPage({ stats }) {
  const u = useUnits();
  const byDate = stats.byDate;
  const last = new Date(stats.today + "T12:00:00");
  const [cur, setCur] = useState({ y: last.getFullYear(), m: last.getMonth() });
  const [selected, setSelected] = useState(stats.today);

  const maxDist = useMemo(() => Math.max(...Object.values(byDate).map((b) => b.distance), 1), [byDate]);

  const first = new Date(cur.y, cur.m, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(cur.y, cur.m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);

  const go = (delta) => {
    let m = cur.m + delta, y = cur.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setCur({ y, m });
  };

  const monthMiles = useMemo(() => {
    let mi = 0, n = 0;
    for (let d = 1; d <= daysIn; d++) { const b = byDate[iso(cur.y, cur.m, d)]; if (b) { mi += b.distance; n += b.walks; } }
    return { mi, n };
  }, [cur, byDate, daysIn]);

  const sel = selected ? byDate[selected] : null;

  return (
    <div className="page-scroll page-pad">
      <h1 className="page-title">📅 Calendar</h1>

      <div className="card cal-card">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => go(-1)} aria-label="Previous month">‹</button>
          <div className="cal-title">{MONTHS[cur.m]} {cur.y}</div>
          <button className="cal-nav" onClick={() => go(1)} aria-label="Next month">›</button>
        </div>
        <p className="card-note cal-sub">{monthMiles.n} walks · {u.fmtDist(monthMiles.mi)} this month</p>

        <div className="cal-grid cal-dow">
          {DOW.map((d) => <div key={d} className="cal-dowlabel">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d == null) return <div key={i} className="cal-cell empty" />;
            const key = iso(cur.y, cur.m, d);
            const b = byDate[key];
            const intensity = b ? Math.min(1, 0.25 + (b.distance / maxDist) * 0.75) : 0;
            return (
              <button
                key={i}
                className={`cal-cell ${b ? "has" : ""} ${selected === key ? "sel" : ""}`}
                style={b ? { background: `rgba(47,125,79,${intensity})`, color: intensity > 0.55 ? "#fff" : "var(--ink)" } : undefined}
                onClick={() => setSelected(key)}
                title={b ? `${u.fmtDist(b.distance)}` : "no walk"}
              >
                <span className="cal-num">{d}</span>
                {b && <span className="cal-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card cal-detail">
        {sel ? (
          <>
            <h2>{new Date(selected + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
            {sel.items.map((w, i) => (
              <div className="cal-walk" key={i}>
                <div className="cal-walk-main">
                  <strong>{w.place || w.name}</strong>
                  <span className="cal-walk-dist">{u.fmtDist(w.distance)}</span>
                </div>
                <div className="muted cal-walk-sub">
                  {Number.isFinite(w.hour) ? `${String(w.hour).padStart(2, "0")}:${String(w.minute ?? 0).padStart(2, "0")} · ` : ""}
                  {w.weather_emoji} {w.weather} · 👵 {w.shoe}{w.grandad_shoe ? ` · 👴 ${w.grandad_shoe}` : ""}
                </div>
                {w.notes && <div className="cal-walk-notes">“{w.notes}”</div>}
              </div>
            ))}
          </>
        ) : (
          <p className="muted">No walk recorded on this day. Tap a green day to see it.</p>
        )}
      </div>
    </div>
  );
}
