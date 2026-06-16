function sum(walks, key) {
  return walks.reduce((t, w) => t + (Number(w[key]) || 0), 0);
}

export default function StatsBar({ walks }) {
  const totalKm = sum(walks, "distance_km");
  const thisYear = new Date().getFullYear();
  const thisYearKm = sum(
    walks.filter((w) => w.walk_date && new Date(w.walk_date).getFullYear() === thisYear),
    "distance_km"
  );
  const latest = walks[0]; // already sorted desc by date

  const stats = [
    { label: "Total walks", value: walks.length.toLocaleString() },
    { label: "Total distance", value: `${totalKm.toFixed(1)} km` },
    { label: `Distance in ${thisYear}`, value: `${thisYearKm.toFixed(1)} km` },
    {
      label: "Latest walk",
      value: latest?.walk_date
        ? new Date(latest.walk_date).toLocaleDateString()
        : "—",
    },
  ];

  return (
    <section className="stats">
      {stats.map((s) => (
        <div className="card stat" key={s.label}>
          <div className="stat-value">{s.value}</div>
          <div className="stat-label muted">{s.label}</div>
        </div>
      ))}
    </section>
  );
}
