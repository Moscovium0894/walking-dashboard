import { useState } from "react";
import StatTile from "./StatTile.jsx";
import MetricDetail from "./MetricDetail.jsx";
import MonthlyChart from "./MonthlyChart.jsx";
import YearChart from "./YearChart.jsx";
import DowChart from "./DowChart.jsx";
import DonutChart from "./DonutChart.jsx";
import ShoeStats from "./ShoeStats.jsx";
import LocationsMap from "./LocationsMap.jsx";
import FunFacts from "./FunFacts.jsx";
import RecentWalks from "./RecentWalks.jsx";
import { useInView } from "../hooks/useInView.js";

const nf = (n) => n.toLocaleString("en-GB");

// A full-bleed snap section that reveals itself as it scrolls into view.
function Section({ children, className = "" }) {
  const [ref, inView] = useInView();
  return (
    <section ref={ref} className={`snap-section reveal ${inView ? "in" : ""} ${className}`}>
      <div className="section-inner">{children}</div>
    </section>
  );
}

export default function Dashboard({ stats, demo }) {
  const [metric, setMetric] = useState(null);
  const t = stats.totals;
  const distanceMetric = stats.metrics.find((m) => m.id === "distance");

  return (
    <div className="snap-root">
      {demo && (
        <div className="demo-banner">
          ✨ Preview with <strong>sample data</strong> shaped like Granny’s real spreadsheet — her actual walks slot straight in.
        </div>
      )}

      {/* 1 — HERO */}
      <Section className="hero-section">
        <div className="hero">
          <div className="hero-inner">
            <div className="hero-kicker">🥾 Granny’s Walks</div>
            <h1 className="hero-distance">{nf(Math.round(t.distanceMi / 100) * 100)} <span>miles</span></h1>
            <p className="hero-sub">
              walked over <strong>{stats.yearsActive} years</strong> across <strong>{nf(t.walks)}</strong> walks
              since {stats.firstYear}.
            </p>
            <button className="hero-detail" onClick={() => setMetric(distanceMetric)}>
              View detailed →
            </button>
            <div className="hero-pills">
              <span className="pill">🔥 {stats.streak}-day streak</span>
              <span className="pill">📅 {stats.walksPerWeek} walks / week</span>
              <span className="pill">⭐ Best year {stats.bestYear.label}</span>
            </div>
            <div className="scroll-cue">scroll ↓</div>
          </div>
        </div>
      </Section>

      {/* 2 — HEADLINE STATS (tap any to drill down) */}
      <Section>
        <h2 className="section-title">The numbers <span className="hint">— tap any for detail</span></h2>
        <div className="stat-grid">
          {stats.metrics.map((m) => (
            <StatTile key={m.id} metric={m} onOpen={setMetric} />
          ))}
        </div>
      </Section>

      {/* 3 — RECENT PERIODS */}
      <Section>
        <h2 className="section-title">Lately</h2>
        <div className="period-row">
          <div className="period-card">
            <div className="period-label">This week</div>
            <div className="period-value">{stats.thisWeek.distanceMi} <span>mi</span></div>
            <div className="period-sub">{stats.thisWeek.walks} walks</div>
          </div>
          <div className="period-card">
            <div className="period-label">{stats.thisMonth.label}</div>
            <div className="period-value">{stats.thisMonth.distanceMi} <span>mi</span></div>
            <div className="period-sub">{stats.thisMonth.walks} walks</div>
          </div>
          <div className="period-card">
            <div className="period-label">This year</div>
            <div className="period-value">{nf(stats.thisYear.distanceMi)} <span>mi</span></div>
            <div className="period-sub">{stats.thisYear.walks} walks</div>
          </div>
        </div>
      </Section>

      {/* 4 — CHARTS */}
      <Section>
        <h2 className="section-title">Over time</h2>
        <div className="cards-2">
          <div className="card">
            <h2>Last 12 months</h2>
            <p className="card-note">Miles walked each month</p>
            <MonthlyChart data={stats.monthSeries} />
          </div>
          <div className="card">
            <h2>Every year since {stats.firstYear}</h2>
            <p className="card-note">⭐ {stats.bestYear.label} was the biggest year</p>
            <YearChart data={stats.yearSeries} bestYear={stats.bestYear} />
          </div>
        </div>
      </Section>

      {/* 5 — PATTERNS */}
      <Section>
        <h2 className="section-title">Patterns</h2>
        <div className="cards-3">
          <div className="card">
            <h2>Favourite days</h2>
            <p className="card-note">⭐ {stats.favouriteDay.name}s most of all</p>
            <DowChart data={stats.dow} favourite={stats.favouriteDay} />
          </div>
          <div className="card">
            <h2>Time of day</h2>
            <p className="card-note">When Granny heads out</p>
            <DonutChart data={stats.tod} />
          </div>
          <div className="card">
            <h2>Walking weather</h2>
            <p className="card-note">From her notes</p>
            <DonutChart data={stats.weather} />
          </div>
        </div>
      </Section>

      {/* 6 — FOOTWEAR */}
      <Section>
        <h2 className="section-title">👟 The shoe drawer</h2>
        <div className="card">
          <ShoeStats shoes={stats.shoes} favourite={stats.favouriteShoe} />
        </div>
      </Section>

      {/* 7 — PLACES */}
      <Section>
        <h2 className="section-title">📍 Where she walks</h2>
        <div className="cards-2 places">
          <div className="card">
            <p className="card-note">⭐ {stats.favouritePlace.name} is the firm favourite ({stats.favouritePlace.walks} walks)</p>
            <LocationsMap locations={stats.locations} />
          </div>
          <div className="card">
            <h2>Most-visited spots</h2>
            <ol className="place-list">
              {stats.locations.slice(0, 8).map((l, i) => (
                <li key={l.name}>
                  <span className="place-rank">{i + 1}</span>
                  <span className="place-name">{l.name}</span>
                  <span className="place-count">{l.walks} walks</span>
                  <span className="place-dist muted">{nf(l.distance)} mi</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* 8 — FUN FACTS */}
      <Section>
        <h2 className="section-title">✨ Fun facts</h2>
        <FunFacts facts={stats.funFacts} />
      </Section>

      {/* 9 — RECENT WALKS */}
      <Section>
        <h2 className="section-title">Recent walks</h2>
        <div className="card">
          <RecentWalks walks={stats.recent} />
        </div>
      </Section>

      <footer className="foot">
        Made with 💚 for Granny · {nf(t.walks)} walks since {stats.firstYear}
        {demo && " · sample data"}
      </footer>

      {metric && <MetricDetail metric={metric} onClose={() => setMetric(null)} />}
    </div>
  );
}
