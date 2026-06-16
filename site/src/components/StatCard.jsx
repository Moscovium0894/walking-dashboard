// A big, friendly stat: large number, clear label, optional sub-line + emoji.
export default function StatCard({ emoji, value, unit, label, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { "--accent": accent } : undefined}>
      <div className="stat-emoji" aria-hidden="true">{emoji}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
