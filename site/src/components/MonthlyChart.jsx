import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// Distance per month for the last 12 months. `data` values are already in the
// display unit; `unit` is the label ("mi"/"km").
export default function MonthlyChart({ data, unit = "mi" }) {
  const max = Math.max(...data.map((d) => d.distance), 1);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e9e2d4" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6256" }} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} unit={unit} width={56} />
        <Tooltip
          formatter={(v, _n, p) => [`${v} ${unit} · ${p.payload.walks} walks`, "Distance"]}
          cursor={{ fill: "rgba(47,125,79,0.08)" }}
        />
        <Bar dataKey="distance" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.distance >= max * 0.999 ? "#f4a72c" : "#2f7d4f"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
