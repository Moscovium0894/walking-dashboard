// App navigation. Bottom tab bar on iPhone (thumb-friendly), a top bar on
// laptop. The active item gets an animated sliding pill.
const ITEMS = [
  { id: "home", icon: "🏠", label: "Home" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "search", icon: "🔍", label: "Search" },
  { id: "explore", icon: "📊", label: "Stats" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

export default function NavBar({ route, navigate }) {
  const activeIndex = Math.max(0, ITEMS.findIndex((i) => i.id === route));
  return (
    <nav className="navbar" aria-label="Main">
      <div className="nav-inner">
        <span
          className="nav-pill"
          style={{ "--count": ITEMS.length, "--idx": activeIndex }}
          aria-hidden="true"
        />
        {ITEMS.map((it) => (
          <button
            key={it.id}
            className={`nav-item ${route === it.id ? "active" : ""}`}
            onClick={() => navigate(it.id)}
            aria-current={route === it.id ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
