export default function WalkList({ walks }) {
  if (walks.length === 0) {
    return (
      <p className="muted">
        No walks yet. Once we import Granny's spreadsheet (and the Garmin
        pipeline runs), they'll appear here.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th className="num">Distance</th>
            <th className="num">Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {walks.map((w) => (
            <tr key={w.id}>
              <td>{w.walk_date ? new Date(w.walk_date).toLocaleDateString() : "—"}</td>
              <td>{w.name || "—"}</td>
              <td className="num">
                {w.distance_km != null ? `${Number(w.distance_km).toFixed(1)} km` : "—"}
              </td>
              <td className="num">
                {w.duration_min != null ? `${Math.round(w.duration_min)} min` : "—"}
              </td>
              <td>
                <span className={`badge badge-${w.status}`}>{w.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
