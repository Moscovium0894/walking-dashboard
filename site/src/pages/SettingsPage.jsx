import { useSettings } from "../settings/SettingsContext.jsx";
import { FOOTWEAR, PLACES } from "../data/labels.js";

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={`seg ${value === o.value ? "on" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, desc, children }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc muted">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

// Tidy, granny-friendly settings. Persisted in localStorage, applied everywhere.
export default function SettingsPage({ stats }) {
  const { settings, set, toggle, reset } = useSettings();

  return (
    <div className="page-scroll page-pad">
      <h1 className="page-title">⚙️ Settings</h1>

      <div className="card">
        <Row title="Distance units" desc="How distances are shown across the app.">
          <Segmented value={settings.units} onChange={(v) => set("units", v)}
            options={[{ value: "mi", label: "Miles" }, { value: "km", label: "Kilometres" }]} />
        </Row>
        <Row title="Headline numbers" desc="Big numbers tidy and rounded, or exact to the decimal.">
          <Segmented value={settings.numbers} onChange={(v) => set("numbers", v)}
            options={[{ value: "rounded", label: "Rounded" }, { value: "detailed", label: "Exact" }]} />
        </Row>
        <Row title="Appearance" desc="Higher contrast is easier on the eyes.">
          <Segmented value={settings.theme} onChange={(v) => set("theme", v)}
            options={[{ value: "warm", label: "Warm" }, { value: "contrast", label: "High contrast" }]} />
        </Row>
        <Row title="Show Grandad" desc="Include Grandad’s supporting footwear details.">
          <Segmented value={settings.showGrandad ? "on" : "off"} onChange={() => toggle("showGrandad")}
            options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
        </Row>
      </div>

      <div className="card">
        <h2>Footwear legend</h2>
        <p className="card-note">What the shoe codes mean (E = Granny, F = Grandad). Edit in <code>labels.js</code>.</p>
        <div className="legend-grid">
          {Object.entries(FOOTWEAR).map(([code, m]) => (
            <div className="legend-item" key={code}>
              <span className="legend-code">{code}</span>
              <span>{m.emoji} {m.label}</span>
            </div>
          ))}
          <div className="legend-item"><span className="legend-code">o</span><span>↳ treated as “new shoes”</span></div>
        </div>
      </div>

      <div className="card">
        <h2>Known places</h2>
        <p className="card-note">Used to place pins on the map. Edit coordinates in <code>labels.js</code>.</p>
        <div className="legend-grid">
          {[...new Map(Object.values(PLACES).map((p) => [p.label, p])).values()].map((p) => (
            <div className="legend-item" key={p.label}>📍 {p.label}</div>
          ))}
        </div>
      </div>

      <div className="card set-about">
        <h2>About</h2>
        <p className="muted">
          {stats.totals.walks.toLocaleString("en-GB")} walks since {stats.firstYear}.
          Data is {stats.allWalks[0]?.source === "demo" ? "sample data shaped like Granny’s spreadsheet" : "from Granny’s spreadsheet"}.
        </p>
        <button className="link-btn" onClick={reset}>Reset settings to defaults</button>
      </div>
    </div>
  );
}
