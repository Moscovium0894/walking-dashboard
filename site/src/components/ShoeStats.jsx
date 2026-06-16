// Footwear stats — built from the spreadsheet's code1 column (n/b/s/sa/o/f),
// relabelled via the editable lookup. Shows miles walked in each type.
export default function ShoeStats({ shoes, favourite }) {
  const max = Math.max(...shoes.map((s) => s.distance), 1);
  return (
    <div className="shoe-stats">
      <div className="shoe-highlights">
        <div className="shoe-badge">
          <span className="shoe-badge-emoji">{favourite.emoji}</span>
          <div>
            <div className="shoe-badge-label">Most-walked footwear</div>
            <div className="shoe-badge-name">{favourite.name}</div>
            <div className="shoe-badge-sub">{favourite.distance.toLocaleString("en-GB")} miles · {favourite.walks} walks</div>
          </div>
        </div>
      </div>

      <ul className="shoe-bars">
        {shoes.map((s) => (
          <li key={s.name}>
            <div className="shoe-row-top">
              <span className="shoe-name">
                <span className="shoe-dot" style={{ background: s.color }} />
                {s.emoji} {s.name}
              </span>
              <span className="shoe-miles">{s.distance.toLocaleString("en-GB")} mi</span>
            </div>
            <div className="shoe-track">
              <div className="shoe-fill" style={{ width: `${(s.distance / max) * 100}%`, background: s.color }} />
            </div>
            <div className="shoe-sub muted">{s.walks} walks</div>
          </li>
        ))}
      </ul>
      <p className="muted shoe-foot-note">
        Footwear comes from the sheet's code column — labels are easily corrected once confirmed.
      </p>
    </div>
  );
}
