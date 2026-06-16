import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Reusable donut for categorical splits (time of day, weather).
// data: [{ name, value, emoji? }]
const PALETTE = ["#2f7d4f", "#f4a72c", "#4d8fd6", "#9b6bd1", "#e06666", "#39b3a6"];

export default function DonutChart({ data, height = 220 }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [`${v} walks (${Math.round((v / total) * 100)}%)`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.name}>
            <span className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{d.emoji ? `${d.emoji} ` : ""}{d.name}</span>
            <strong>{Math.round((d.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
