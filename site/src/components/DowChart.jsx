import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// Which days of the week Granny walks most.
export default function DowChart({ data, favourite }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e9e2d4" />
        <XAxis dataKey="short" tick={{ fontSize: 13, fill: "#6b6256" }} />
        <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} width={40} allowDecimals={false} />
        <Tooltip
          formatter={(v, _n, p) => [`${v} walks · ${p.payload.distance} mi`, p.payload.name]}
          cursor={{ fill: "rgba(47,125,79,0.08)" }}
        />
        <Bar dataKey="walks" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={favourite && d.name === favourite.name ? "#f4a72c" : "#4d8fd6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
