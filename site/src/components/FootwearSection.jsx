import { useState } from "react";
import { useSettings, useUnits } from "../settings/SettingsContext.jsx";

const fmtDay = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Footwear, with Granny in the spotlight. Grandad is a supporting detail, and
// there's a fun little "odd shoes out" comparison she enjoys.
export default function FootwearSection({ footwear }) {
  const { settings } = useSettings();
  const u = useUnits();
  const [showDiff, setShowDiff] = useState(false);

  const max = Math.max(...footwear.granny.map((s) => s.distance), 1);

  return (
    <div className="card">
      <h2>👟 The shoe drawer</h2>
      <p className="card-note">Miles Granny has walked in each kind of footwear</p>

      <div className="shoe-highlights">
        <div className="shoe-badge">
          <span className="shoe-badge-emoji">{footwear.favourite.emoji}</span>
          <div>
            <div className="shoe-badge-label">Granny’s most-walked</div>
            <div className="shoe-badge-name">{footwear.favourite.name}</div>
            <div className="shoe-badge-sub">{u.fmtDist(footwear.favourite.distance)} · {footwear.favourite.walks} walks</div>
          </div>
        </div>
        {footwear.grannyKinds.length > 1 && (
          <div className="kind-split">
            {footwear.grannyKinds.map((k) => (
              <span className="kind-pill" key={k.name}>{k.emoji} {k.name} <strong>{k.value}</strong></span>
            ))}
          </div>
        )}
      </div>

      <ul className="shoe-bars">
        {footwear.granny.map((s) => (
          <li key={s.name}>
            <div className="shoe-row-top">
              <span className="shoe-name"><span className="shoe-dot" style={{ background: s.color }} />{s.emoji} {s.name}</span>
              <span className="shoe-miles">{u.fmtDist(s.distance)}</span>
            </div>
            <div className="shoe-track"><div className="shoe-fill" style={{ width: `${(s.distance / max) * 100}%`, background: s.color }} /></div>
            <div className="shoe-sub muted">{s.walks} walks</div>
          </li>
        ))}
      </ul>

      {settings.showGrandad && (
        <div className="grandad-note">
          <p>
            👞 Walked <strong>with Grandad</strong> on {footwear.togetherCount.toLocaleString("en-GB")} walks
            {footwear.grandad[0] && <> — most often in his {footwear.grandad[0].emoji} {footwear.grandad[0].name.toLowerCase()}.</>}
          </p>

          <button className="diff-toggle" onClick={() => setShowDiff((v) => !v)}>
            🧦 Odd shoes out: <strong>{footwear.diffCount}</strong> days their footwear didn’t match {showDiff ? "▲" : "▼"}
          </button>

          {showDiff && (
            <div className="diff-list">
              {footwear.diffWalks.slice(0, 30).map((d, i) => (
                <div className="diff-row" key={i}>
                  <span className="diff-date">{fmtDay(d.walk_date)}</span>
                  <span className="diff-place">{d.place}</span>
                  <span className="diff-shoes">
                    <span title="Granny">👵 {d.granny_emoji} {d.granny_shoe}</span>
                    <span className="diff-vs">vs</span>
                    <span title="Grandad">👴 {d.grandad_emoji} {d.grandad_shoe}</span>
                  </span>
                </div>
              ))}
              {footwear.diffWalks.length > 30 && <p className="muted diff-more">…and {footwear.diffWalks.length - 30} more.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
