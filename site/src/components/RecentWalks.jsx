const fmt = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

const clock = (h, m) =>
  Number.isFinite(h) ? `${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}` : "—";

// The latest walks as a clean, readable table (real spreadsheet columns).
export default function RecentWalks({ walks, u }) {
  return (
    <div className="table-wrap">
      <table className="walks-table">
        <thead>
          <tr>
            <th>Date</th><th>From</th><th className="num">Distance</th>
            <th className="num">Start</th><th className="num">Time</th>
            <th className="num">Pace</th><th>Weather</th><th>Footwear</th>
          </tr>
        </thead>
        <tbody>
          {walks.map((w, i) => (
            <tr key={w.walk_date + w.name + i}>
              <td>{fmt(w.walk_date)}</td>
              <td className="strong">{w.place || w.name}</td>
              <td className="num">{u ? u.fmtDist(w.distance) : `${w.distance} mi`}</td>
              <td className="num">{clock(w.hour, w.minute)}</td>
              <td className="num">{w.duration_min ? `${w.duration_min} min` : "—"}</td>
              <td className="num">{u ? u.paceLabel(w.pace_min_mi) : "—"}</td>
              <td>{w.weather_emoji} {w.weather}</td>
              <td className="muted">{w.shoe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
