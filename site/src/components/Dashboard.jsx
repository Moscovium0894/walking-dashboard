import StatCard from "./StatCard.jsx";
import MonthlyChart from "./MonthlyChart.jsx";
import YearChart from "./YearChart.jsx";
import DowChart from "./DowChart.jsx";
import DonutChart from "./DonutChart.jsx";
import ShoeStats from "./ShoeStats.jsx";
import LocationsMap from "./LocationsMap.jsx";
import FunFacts from "./FunFacts.jsx";
import RecentWalks from "./RecentWalks.jsx";

const nf = (n) => n.toLocaleString("en-GB");

export default function Dashboard({ stats, demo }) {
  const t = stats.totals;
  return (
    <div className="page">
      {demo && (
        <div className="demo-banner">
          ✨ This is a <strong>preview with sample data</strong> — it’ll show Granny’s real walks once her spreadsheet is added.
        </div>
      )}

      {/* Hero */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-kicker">🥾 Granny’s Walks</div>
          <h1 className="hero-distance">{nf(t.distanceKm)} <span>km</span></h1>
          <p className="hero-sub">
            walked over <strong>{stats.yearsActive} years</strong> — that’s {nf(t.distanceMi)} miles
            across <strong>{nf(t.walks)}</strong> walks since {stats.firstWalk.slice(0, 4)}.
          </p>
          <div className="hero-pills">
            <span className="pill">🔥 {stats.streak}-day streak</span>
            <span className="pill">📅 {stats.walksPerWeek} walks / week</span>
            <span className="pill">⭐ Best year {stats.bestYear.label}: {nf(stats.bestYear.distance)} km</span>
          </div>
        </div>
      </header>

      {/* Headline stat grid */}
      <section className="stat-grid">
        <StatCard emoji="🚶‍♀️" value={nf(t.walks)} label="Total walks" sub={`${stats.avgDistance} km average`} accent="#2f7d4f" />
        <StatCard emoji="📏" value={nf(t.distanceKm)} unit=" km" label="Total distance" sub={`${nf(t.distanceMi)} miles`} accent="#4d8fd6" />
        <StatCard emoji="⏱️" value={nf(t.durationHours)} unit=" hrs" label="Time on her feet" sub={`~${t.durationDays} days walking`} accent="#9b6bd1" />
        <StatCard emoji="⛰️" value={nf(t.ascentM)} unit=" m" label="Total climb" sub="elevation gained" accent="#b45309" />
        <StatCard emoji="👣" value={nf(t.steps)} label="Steps taken" sub="and counting" accent="#39b3a6" />
        <StatCard emoji="🔥" value={stats.streak} unit=" days" label="Current streak" sub={`best ever: ${stats.bestStreak} days`} accent="#e06666" />
        <StatCard emoji="🏅" value={stats.longest.distanceKm} unit=" km" label="Longest walk" sub={`${stats.longest.name}`} accent="#f4a72c" />
        <StatCard emoji="🐢" value={stats.avgPaceLabel} label="Average pace" sub="steady does it" accent="#5aa06f" />
      </section>

      {/* This week / month / year */}
      <section className="period-row">
        <div className="period-card">
          <div className="period-label">This week</div>
          <div className="period-value">{stats.thisWeek.distanceKm} <span>km</span></div>
          <div className="period-sub">{stats.thisWeek.walks} walks</div>
        </div>
        <div className="period-card">
          <div className="period-label">{stats.thisMonth.label}</div>
          <div className="period-value">{stats.thisMonth.distanceKm} <span>km</span></div>
          <div className="period-sub">{stats.thisMonth.walks} walks</div>
        </div>
        <div className="period-card">
          <div className="period-label">This year</div>
          <div className="period-value">{nf(stats.thisYear.distanceKm)} <span>km</span></div>
          <div className="period-sub">{stats.thisYear.walks} walks</div>
        </div>
      </section>

      {/* Charts */}
      <section className="cards-2">
        <div className="card">
          <h2>Last 12 months</h2>
          <p className="card-note">Distance walked each month (km)</p>
          <MonthlyChart data={stats.monthSeries} />
        </div>
        <div className="card">
          <h2>Every year since {stats.firstWalk.slice(0, 4)}</h2>
          <p className="card-note">⭐ {stats.bestYear.label} was the biggest year</p>
          <YearChart data={stats.yearSeries} bestYear={stats.bestYear} />
        </div>
      </section>

      <section className="cards-3">
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
          <p className="card-note">Rain or shine</p>
          <DonutChart data={stats.weather} />
        </div>
      </section>

      {/* Footwear */}
      <section className="card">
        <h2>👟 The shoe drawer</h2>
        <p className="card-note">Miles walked in each pair over the years</p>
        <ShoeStats shoes={stats.shoes} favourite={stats.favouriteShoe} current={stats.currentShoe} />
      </section>

      {/* Places */}
      <section className="cards-2 places">
        <div className="card">
          <h2>📍 Where she walks</h2>
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
                <span className="place-dist muted">{nf(l.distance)} km</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fun facts */}
      <section>
        <h2 className="section-title">✨ Fun facts</h2>
        <FunFacts facts={stats.funFacts} />
      </section>

      {/* Recent walks */}
      <section className="card">
        <h2>Recent walks</h2>
        <p className="card-note">The latest dozen</p>
        <RecentWalks walks={stats.recent} />
      </section>

      <footer className="foot">
        Made with 💚 for Granny · {nf(t.walks)} walks since {stats.firstWalk.slice(0, 4)}
        {demo && " · sample data"}
      </footer>
    </div>
  );
}
