import { useEffect, useState } from "react";
import { loadWalks, USING_DEMO_DATA } from "./data/source.js";
import { computeStats } from "./data/stats.js";
import { SettingsProvider } from "./settings/SettingsContext.jsx";
import { useHashRoute } from "./nav/useHashRoute.js";
import NavBar from "./components/NavBar.jsx";
import MetricDetail from "./components/MetricDetail.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import ExplorerPage from "./pages/ExplorerPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function App() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWalks()
      .then((walks) => setStats(computeStats(walks)))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="centered muted">Couldn’t load walks: {error}</div>;
  if (!stats) {
    return (
      <div className="centered loading">
        <div className="boot">🥾</div>
        <p>Lacing up…</p>
      </div>
    );
  }
  return (
    <SettingsProvider>
      <Shell stats={stats} demo={USING_DEMO_DATA} />
    </SettingsProvider>
  );
}

function Shell({ stats, demo }) {
  const [route, navigate] = useHashRoute();
  const [metric, setMetric] = useState(null);
  const open = (m) => setMetric(m);

  const pages = {
    home: <DashboardPage stats={stats} demo={demo} openMetric={open} navigate={navigate} />,
    calendar: <CalendarPage stats={stats} />,
    search: <SearchPage stats={stats} />,
    explore: <ExplorerPage stats={stats} />,
    settings: <SettingsPage stats={stats} />,
  };

  return (
    <div className="app-shell">
      <main className="page-area">
        <div className="page-anim" key={route}>
          {pages[route] || pages.home}
        </div>
      </main>
      <NavBar route={route} navigate={navigate} />
      {metric && <MetricDetail metric={metric} onClose={() => setMetric(null)} />}
    </div>
  );
}
