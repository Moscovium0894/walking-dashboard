import StatTile from "../components/StatTile.jsx";
import MonthlyChart from "../components/MonthlyChart.jsx";
import YearChart from "../components/YearChart.jsx";
import DowChart from "../components/DowChart.jsx";
import DonutChart from "../components/DonutChart.jsx";
import FootwearSection from "../components/FootwearSection.jsx";
import LocationsMap from "../components/LocationsMap.jsx";
import FunFacts from "../components/FunFacts.jsx";
import RecentWalks from "../components/RecentWalks.jsx";
import { useInView } from "../hooks/useInView.js";
import { useUnits } from "../settings/SettingsContext.jsx";

const nf = (n) => n.toLocaleString("en-GB");

function Section({ children, className = "" }) {
  const [ref, inView] = useInView();
  return (
    <section ref={ref} className={`snap-section reveal ${inView ? "in" : ""} ${className}`}>
      <div className="section-inner">{children}</div>
    </section>
  );
}

const fmtDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function DashboardPage({ stats, demo, openMetric, navigate }) {
  const u = useUnits();
  const t = stats.totals;
  const distanceMetric = stats.metrics.find((m) => m.id === "distance");

  const monthData = stats.monthSeries.map((m) => ({ ...m, distance: u.d(m.distance) }));
  const yearData = stats.yearSeries.map((y) => ({ ...y, distance: u.d(y.distance) }));
  const dowData = stats.dow.map((d) => ({ ...d, distance: u.d(d.distance) }));
  const heroDist = u.d(t.distanceMi);
  const heroRounded = Math.round(heroDist / 100) * 100;

  return (
    <div className="snap-root page-scroll">
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
            <h1 className="hero-distance">{nf(heroRounded)} <span>{u.unit}</span></h1>
            <p className="hero-sub">
              walked over <strong>{stats.yearsActive} years</strong> across <strong>{nf(t.walks)}</strong> walks since {stats.firstYear}.
            </p>
            <button className="hero-detail" onClick={() => openMetric(distanceMetric)}>View detailed →</button>
            <div className="hero-pills">
              <span className="pill">🔥 {stats.streak}-day streak</span>
              <span className="pill">📅 {stats.walksPerWeek} walks / week</span>
              <span className="pill">⭐ Best year {stats.bestYear.label}</span>
            </div>
            {stats.onThisDay.length > 0 && (
              <div className="on-this-day">
                📆 <strong>On this day</strong>, {fmtDay(stats.onThisDay[0].walk_date)}: a {u.fmtDist(stats.onThisDay[0].distance)} walk from {stats.onThisDay[0].place || stats.onThisDay[0].name}.
              </div>
            )}
            <div className="scroll-cue">scroll ↓</div>
          </div>
        </div>
      </Section>

      {/* 2 — HEADLINE STATS */}
      <Section>
        <h2 className="section-title">The numbers <span className="hint">— tap any for detail</span></h2>
        <div className="stat-grid">
          {stats.metrics.map((m) => <StatTile key={m.id} metric={m} onOpen={openMetric} />)}
        </div>
      </Section>

      {/* 3 — LATELY */}
      <Section>
        <h2 className="section-title">Lately</h2>
        <div className="period-row">
          <div className="period-card">
            <div className="period-label">This week</div>
            <div className="period-value">{u.d(stats.thisWeek.distanceMi)} <span>{u.unit}</span></div>
            <div className="period-sub">{stats.thisWeek.walks} walks</div>
          </div>
          <div className="period-card">
            <div className="period-label">{stats.thisMonth.label}</div>
            <div className="period-value">{u.d(stats.thisMonth.distanceMi)} <span>{u.unit}</span></div>
            <div className="period-sub">{stats.thisMonth.walks} walks</div>
          </div>
          <div className="period-card">
            <div className="period-label">This year</div>
            <div className="period-value">{nf(u.d(stats.thisYear.distanceMi))} <span>{u.unit}</span></div>
            <div className="period-sub">{stats.thisYear.walks} walks</div>
          </div>
        </div>
      </Section>

      {/* 4 — OVER TIME */}
      <Section>
        <h2 className="section-title">Over time</h2>
        <div className="cards-2">
          <div className="card">
            <h2>Last 12 months</h2>
            <p className="card-note">Distance walked each month</p>
            <MonthlyChart data={monthData} unit={u.unit} />
          </div>
          <div className="card">
            <h2>Every year since {stats.firstYear}</h2>
            <p className="card-note">⭐ {stats.bestYear.label} was the biggest year</p>
            <YearChart data={yearData} bestYear={stats.bestYear} unit={u.unit} />
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
            <DowChart data={dowData} favourite={stats.favouriteDay} unit={u.unit} />
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
        <h2 className="section-title">Footwear</h2>
        <FootwearSection footwear={stats.footwear} />
      </Section>

      {/* 7 — PLACES */}
      <Section>
        <h2 className="section-title">📍 Where she walks</h2>
        <div className="cards-2 places">
          <div className="card">
            <p className="card-note">⭐ {stats.favouritePlace.name} is the firm favourite ({stats.favouritePlace.walks} walks)</p>
            <LocationsMap locations={stats.locations} u={u} />
          </div>
          <div className="card">
            <h2>Most-visited spots</h2>
            <ol className="place-list">
              {stats.locations.slice(0, 8).map((l, i) => (
                <li key={l.name}>
                  <span className="place-rank">{i + 1}</span>
                  <span className="place-name">{l.name}</span>
                  <span className="place-count">{l.walks} walks</span>
                  <span className="place-dist muted">{u.fmtDist(l.distance)}</span>
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
          <RecentWalks walks={stats.recent} u={u} />
          <button className="link-btn" onClick={() => navigate("search")}>See the full walk log →</button>
        </div>
      </Section>

      <footer className="foot">Made with 💚 for Granny · {nf(t.walks)} walks since {stats.firstYear}{demo && " · sample data"}</footer>
    </div>
  );
}
