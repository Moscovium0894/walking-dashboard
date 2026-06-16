// Footwear stats — which shoes, miles per pair, favourites. A spreadsheet-lover's
// delight: a clear ranked bar of distance per pair plus the headline pair.
export default function ShoeStats({ shoes, favourite, current }) {
  const max = Math.max(...shoes.map((s) => s.distance), 1);
  return (
    <div className="shoe-stats">
      <div className="shoe-highlights">
        <div className="shoe-badge">
          <span className="shoe-badge-emoji">👟</span>
          <div>
            <div className="shoe-badge-label">Favourite pair</div>
            <div className="shoe-badge-name">{favourite.name}</div>
            <div className="shoe-badge-sub">{favourite.miles} miles · {favourite.walks} walks</div>
          </div>
        </div>
        <div className="shoe-badge">
          <span className="shoe-badge-emoji">✨</span>
          <div>
            <div className="shoe-badge-label">On her feet now</div>
            <div className="shoe-badge-name">{current.name}</div>
            <div className="shoe-badge-sub">{current.miles} miles so far</div>
          </div>
        </div>
      </div>

      <ul className="shoe-bars">
        {shoes.map((s) => (
          <li key={s.name}>
            <div className="shoe-row-top">
              <span className="shoe-name">
                <span className="shoe-dot" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="shoe-miles">{s.miles} mi</span>
            </div>
            <div className="shoe-track">
              <div
                className="shoe-fill"
                style={{ width: `${(s.distance / max) * 100}%`, background: s.color }}
              />
            </div>
            <div className="shoe-sub muted">
              {s.distance} km · {s.walks} walks · {s.first.slice(0, 4)}–{s.last.slice(0, 4)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
