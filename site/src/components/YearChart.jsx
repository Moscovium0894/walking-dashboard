import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// Total distance per year since 2009 — the long view.
export default function YearChart({ data, bestYear }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e9e2d4" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6256" }} interval={0} angle={-30} textAnchor="end" height={42} />
        <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} unit="mi" width={56} />
        <Tooltip
          formatter={(v, _n, p) => [`${v} mi · ${p.payload.walks} walks`, "Distance"]}
          cursor={{ fill: "rgba(47,125,79,0.08)" }}
        />
        <Bar dataKey="distance" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={bestYear && d.label === bestYear.label ? "#f4a72c" : "#5aa06f"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
