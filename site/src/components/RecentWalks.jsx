import { paceLabel } from "../data/stats.js";

const fmt = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

// The latest walks as a clean, readable table.
export default function RecentWalks({ walks }) {
  return (
    <div className="table-wrap">
      <table className="walks-table">
        <thead>
          <tr>
            <th>Date</th><th>Walk</th><th className="num">Distance</th>
            <th className="num">Time</th><th className="num">Pace</th>
            <th className="num">Climb</th><th>Weather</th><th>Shoes</th>
          </tr>
        </thead>
        <tbody>
          {walks.map((w) => (
            <tr key={w.walk_date + w.name}>
              <td>{fmt(w.walk_date)}</td>
              <td className="strong">{w.name}</td>
              <td className="num">{w.distance_km} km</td>
              <td className="num">{w.duration_min} min</td>
              <td className="num">{paceLabel(w.pace_min_km)}</td>
              <td className="num">{w.ascent_m} m</td>
              <td>{w.weather_emoji} {w.weather}</td>
              <td className="muted">{w.shoe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
