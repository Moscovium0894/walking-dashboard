import { paceLabel } from "../data/stats.js";

// Rounded headline figure (e.g. 6,974.8 → 6,970). The whole tile is tappable and
// opens the metric's drill-down (trend + meaning + exact rolling odometer).
export function roundedDisplay(metric) {
  if (metric.isPace) return paceLabel(Math.round(metric.exact * 4) / 4); // nearest 15s
  const r = metric.roundTo || 1;
  const rounded = Math.round(metric.exact / r) * r;
  return rounded.toLocaleString("en-GB");
}

export default function StatTile({ metric, onOpen }) {
  return (
    <button
      className="stat-card stat-tap"
      style={{ "--accent": metric.accent }}
      onClick={() => onOpen(metric)}
      aria-label={`${metric.label}. Tap for detail.`}
    >
      <div className="stat-emoji" aria-hidden="true">{metric.emoji}</div>
      <div className="stat-value">
        {roundedDisplay(metric)}
        {metric.unit && <span className="stat-unit">{metric.unit}</span>}
      </div>
      <div className="stat-label">{metric.label}</div>
      <div className="stat-more">View detailed →</div>
    </button>
  );
}
