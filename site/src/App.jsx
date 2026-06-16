import { useEffect, useState } from "react";
import { loadWalks, USING_DEMO_DATA } from "./data/source.js";
import { computeStats } from "./data/stats.js";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWalks()
      .then((walks) => setStats(computeStats(walks)))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="centered muted">Couldn’t load walks: {error}</div>;
  }
  if (!stats) {
    return (
      <div className="centered loading">
        <div className="boot">🥾</div>
        <p>Lacing up…</p>
      </div>
    );
  }
  return <Dashboard stats={stats} demo={USING_DEMO_DATA} />;
}
