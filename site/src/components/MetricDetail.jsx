import { useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import Odometer from "./Odometer.jsx";
import { paceLabel } from "../data/stats.js";

// Drill-down view for a single metric: the exact value as a rolling odometer,
// what it means in plain English, a trend over time, and a yearly breakdown.
export default function MetricDetail({ metric, onClose }) {
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
  const best = metric.yearly.reduce((a, b) => (b.value > a.value ? b : a), metric.yearly[0] || { value: 0 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={metric.label}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-head">
          <span className="modal-emoji">{metric.emoji}</span>
          <h2>{metric.label}</h2>
        </div>

        <p className="modal-exact-label">The exact figure</p>
        <Odometer
          value={metric.isPace ? Math.floor(metric.exact * 60) / 60 : metric.exact}
          decimals={metric.decimals}
          suffix={metric.unit}
        />
        {metric.isPace && <p className="modal-pace">{paceLabel(metric.exact)}</p>}

        <p className="modal-explain">{metric.explain}</p>

        <h3 className="modal-subhead">{metric.yearlyLabel}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={metric.yearly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9e2d4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6256" }} interval={0} angle={-30} textAnchor="end" height={42} />
            <YAxis tick={{ fontSize: 12, fill: "#6b6256" }} width={48} />
            <Tooltip cursor={{ fill: "rgba(47,125,79,0.08)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {metric.yearly.map((d, i) => (
                <Cell key={i} fill={d.label === best.label ? "#f4a72c" : metric.accent} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="modal-table-wrap">
          <table className="modal-table">
            <tbody>
              {metric.yearly.map((y) => (
                <tr key={y.label}>
                  <td>{y.label}</td>
                  <td className="num">{y.value.toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
