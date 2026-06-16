import { useMemo, useState } from "react";
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar, LineChart, Line, Cell,
} from "recharts";
import { EXPLORER_METRICS, EXPLORER_GROUPINGS, aggregateSeries } from "../data/stats.js";
import { useUnits } from "../settings/SettingsContext.jsx";

// Build-your-own chart: pick a metric + how to group it, see it over time.
// Simple and tap-friendly, but flexible.
export default function ExplorerPage({ stats }) {
  const u = useUnits();
  const [metricId, setMetricId] = useState("distance");
  const [grouping, setGrouping] = useState("year");
  const [chart, setChart] = useState("bar");

  const metric = EXPLORER_METRICS.find((m) => m.id === metricId);

  const data = useMemo(() => {
    const raw = aggregateSeries(stats.allWalks, metricId, grouping);
    const conv = metric.isDistance ? (v) => u.d(v) : metric.isPace ? (v) => Math.round(u.pace(v) * 10) / 10 : (v) => v;
    return raw.map((r) => ({ ...r, value: conv(r.value) }));
  }, [stats, metricId, grouping, metric, u]);

  const unitLabel = metric.isDistance ? u.distUnit : metric.isPace ? u.paceUnit : "";
  const best = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] || { value: 0 });
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="page-scroll page-pad">
      <h1 className="page-title">📊 Stats explorer</h1>
      <p className="card-note">Pick what to look at, and how to group it.</p>

      <div className="explorer-controls">
        <div className="control-group">
          <label className="control-label">Show me</label>
          <div className="chip-row">
            {EXPLORER_METRICS.map((m) => (
              <button key={m.id} className={`chip ${metricId === m.id ? "on" : ""}`} onClick={() => setMetricId(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Grouped</label>
          <div className="chip-row">
            {EXPLORER_GROUPINGS.map((g) => (
              <button key={g.id} className={`chip ${grouping === g.id ? "on" : ""}`} onClick={() => setGrouping(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">As a</label>
          <div className="chip-row">
            <button className={`chip ${chart === "bar" ? "on" : ""}`} onClick={() => setChart("bar")}>📊 Bars</button>
            <button className={`chip ${chart === "line" ? "on" : ""}`} onClick={() => setChart("line")}>📈 Line</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="explorer-summary">
          <span><strong>{metric.label}</strong>{unitLabel ? ` (${unitLabel})` : ""} · {grouping}</span>
          <span className="muted">{data.length} points{best.label ? ` · peak ${best.label}` : ""}</span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          {chart === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e9e2d4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b6256" }} interval={data.length > 18 ? Math.floor(data.length / 12) : 0} angle={-32} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} width={48} />
              <Tooltip cursor={{ fill: "rgba(47,125,79,0.08)" }} formatter={(v) => [`${v}${unitLabel ? " " + unitLabel : ""}`, metric.label]} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.label === best.label ? "#f4a72c" : "#2f7d4f"} />)}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e9e2d4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b6256" }} interval={data.length > 18 ? Math.floor(data.length / 12) : 0} angle={-32} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} width={48} />
              <Tooltip formatter={(v) => [`${v}${unitLabel ? " " + unitLabel : ""}`, metric.label]} />
              <Line type="monotone" dataKey="value" stroke="#2f7d4f" strokeWidth={3} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
        {(metric.agg === "sum" || metric.agg === "count") && (
          <p className="card-note explorer-total">Total across all time: <strong>{Math.round(total).toLocaleString("en-GB")}{unitLabel ? ` ${unitLabel}` : ""}</strong></p>
        )}
      </div>
    </div>
  );
}
