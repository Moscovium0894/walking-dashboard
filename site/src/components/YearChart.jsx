import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function YearChart({ walks }) {
  const byYear = {};
  for (const w of walks) {
    if (!w.walk_date) continue;
    const year = new Date(w.walk_date).getFullYear();
    byYear[year] = (byYear[year] || 0) + (Number(w.distance_km) || 0);
  }
  const data = Object.keys(byYear)
    .sort()
    .map((year) => ({ year, km: Math.round(byYear[year] * 10) / 10 }));

  if (data.length === 0) {
    return <p className="muted">No walks yet — the chart will fill in once data is added.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" />
        <YAxis unit=" km" width={60} />
        <Tooltip formatter={(v) => [`${v} km`, "Distance"]} />
        <Bar dataKey="km" fill="#5b8c5a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
