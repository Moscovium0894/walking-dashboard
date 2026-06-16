import { useSettings } from "../settings/SettingsContext.jsx";

// Headline figure honouring the units + rounded/detailed setting. The whole tile
// is tappable and opens the metric's drill-down (odometer + trend + meaning).
export function displayValue(metric, u, numbers) {
  if (metric.isPace) {
    if (numbers === "detailed") return u.paceLabel(metric.exact);
    return u.paceLabel(Math.round(metric.exact * 4) / 4);
  }
  let v = metric.isDistance ? u.conv(metric.exact) : metric.exact;
  if (numbers === "detailed") {
    return (Math.round(v * 10) / 10).toLocaleString("en-GB");
  }
  const r = metric.roundTo || 1;
  return (Math.round(v / r) * r).toLocaleString("en-GB");
}

function unitFor(metric, u) {
  if (metric.isPace) return ` ${u.paceUnit}`;
  if (metric.isDistance) return ` ${u.distUnit}`;
  return metric.unit;
}

export default function StatTile({ metric, onOpen }) {
  const { settings, units } = useSettings();
  return (
    <button
      className="stat-card stat-tap"
      style={{ "--accent": metric.accent }}
      onClick={() => onOpen(metric)}
      aria-label={`${metric.label}. Tap for detail.`}
    >
      <div className="stat-emoji" aria-hidden="true">{metric.emoji}</div>
      <div className="stat-value">
        {displayValue(metric, units, settings.numbers)}
        {!metric.isPace && <span className="stat-unit">{unitFor(metric, units)}</span>}
      </div>
      <div className="stat-label">{metric.label}</div>
      <div className="stat-more">View detailed →</div>
    </button>
  );
}
