import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import StatsBar from "./StatsBar.jsx";
import YearChart from "./YearChart.jsx";
import WalkList from "./WalkList.jsx";
import WalkMap from "./WalkMap.jsx";

export default function Dashboard({ session }) {
  const [walks, setWalks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("walks")
      .select("*")
      .order("walk_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setWalks(data);
      });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Granny's Walks</h1>
        <div className="topbar-right">
          <span className="muted">{session.user.email}</span>
          <button className="ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error card">Could not load walks: {error}</p>}
      {!walks && !error && <p className="muted card">Loading walks…</p>}

      {walks && (
        <main className="grid">
          <StatsBar walks={walks} />
          <section className="card map-card">
            <h2>Map</h2>
            <WalkMap walks={walks} />
          </section>
          <section className="card">
            <h2>Distance by year</h2>
            <YearChart walks={walks} />
          </section>
          <section className="card walks-card">
            <h2>All walks</h2>
            <WalkList walks={walks} />
          </section>
        </main>
      )}
    </div>
  );
}
