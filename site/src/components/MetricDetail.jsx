import { useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import Odometer from "./Odometer.jsx";
import { useUnits } from "../settings/SettingsContext.jsx";

// Drill-down for one metric: the exact value as a rolling ODOMETER on top, the
// metric GRAPHED OVER TIME below, then the plain-English meaning and a yearly
// breakdown. Distances/pace respect the chosen units.
export default function MetricDetail({ metric, onClose }) {
  const u = useUnits();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!metric) return null;

  // Unit-aware view of the numbers.
  const conv = metric.isDistance ? (v) => u.d(v) : metric.isPace ? (v) => u.pace(v) : (v) => v;
  const unitLabel = metric.isDistance ? ` ${u.distUnit}` : metric.isPace ? ` ${u.paceUnit}` : metric.unit;
  const exact = conv(metric.exact);
  const yearly = metric.yearly.map((y) => ({ ...y, value: Math.round(conv(y.value) * 10) / 10 }));
  const best = yearly.reduce((a, b) => (b.value > a.value ? b : a), yearly[0] || { value: 0 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={metric.label}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-head">
          <span className="modal-emoji">{metric.emoji}</span>
          <h2>{metric.label}</h2>
        </div>

        {/* 1 — exact value as the rolling odometer (on top) */}
        <p className="modal-exact-label">The exact figure</p>
        <Odometer value={exact} decimals={metric.decimals} suffix={unitLabel} />
        {metric.isPace && <p className="modal-pace">{u.paceLabel(metric.exact)}</p>}

        {/* 2 — the metric graphed over time (below) */}
        <h3 className="modal-subhead">{metric.yearlyLabel}{unitLabel.trim() ? ` (${unitLabel.trim()})` : ""}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={yearly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9e2d4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6256" }} interval={0} angle={-30} textAnchor="end" height={42} />
            <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} width={48} />
            <Tooltip cursor={{ fill: "rgba(47,125,79,0.08)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {yearly.map((d, i) => (
                <Cell key={i} fill={d.label === best.label ? "#f4a72c" : metric.accent} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 3 — what it means + 4 — yearly breakdown */}
        <p className="modal-explain">{metric.explain}</p>
        <div className="modal-table-wrap">
          <table className="modal-table">
            <tbody>
              {yearly.map((y) => (
                <tr key={y.label}>
                  <td>{y.label}</td>
                  <td className="num">{y.value.toLocaleString("en-GB")}{unitLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
