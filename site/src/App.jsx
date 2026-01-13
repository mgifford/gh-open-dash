import React, { useEffect, useMemo, useState } from "react";
import Leaderboard from "./Leaderboard.jsx";
import WeeklyChart from "./WeeklyChart.jsx";
import "./styles.css";

async function loadMetrics() {
  const res = await fetch("./data/metrics.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load metrics.json (${res.status})`);
  return res.json();
}

const METRIC_OPTIONS = [
  { key: "prs_opened", label: "PRs Opened" },
  { key: "prs_merged", label: "PRs Merged" },
  { key: "issues_opened", label: "Issues Opened" }
];

const RANGE_OPTIONS = [
  { key: "12", label: "Last 12 Weeks" },
  { key: "26", label: "Last 26 Weeks" },
  { key: "52", label: "Last 52 Weeks" },
  { key: "all", label: "All Time" }
];

function App() {
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState("prs_opened");
  const [range, setRange] = useState("12");
  const [selectedAuthor, setSelectedAuthor] = useState("all");

  useEffect(() => {
    loadMetrics()
      .then(setData)
      .catch((err) => console.error(err));
  }, []);

  const processedData = useMemo(() => {
    if (!data) return null;

    // 1. Filter weeks based on range
    let weeks = data.weeks;
    let series = data.series;
    
    if (range !== "all") {
      const count = parseInt(range, 10);
      weeks = weeks.slice(-count);
      series = series.slice(-count); // Assumes series matches weeks order
    }

    // 2. Aggregate for Leaderboard
    // Sum selected metric for each author over the visible range
    const authorTotals = {};
    data.authors.forEach(a => authorTotals[a] = 0);

    series.forEach(week => {
      const byAuthor = week.byAuthor;
      for (const author in byAuthor) {
        authorTotals[author] = (authorTotals[author] || 0) + (byAuthor[author][metric] || 0);
      }
    });

    const leaderboard = Object.entries(authorTotals)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .filter(item => item.count > 0);

    // 3. Prepare Chart Data
    // labels: weeks
    // points: depends on selectedAuthor
    const chartData = {
      labels: weeks,
      datasets: []
    };

    if (selectedAuthor === "all") {
      // Show total org activity for this metric
      const points = series.map(s => {
        let total = 0;
        for (const auth in s.byAuthor) {
          total += (s.byAuthor[auth][metric] || 0);
        }
        return total;
      });
      chartData.datasets.push({
        label: "All Contributors",
        data: points,
        borderColor: "#005a9c",
        backgroundColor: "rgba(0, 90, 156, 0.5)",
      });
    } else {
      const points = series.map(s => {
        return (s.byAuthor[selectedAuthor] && s.byAuthor[selectedAuthor][metric]) || 0;
      });
      chartData.datasets.push({
        label: selectedAuthor,
        data: points,
        borderColor: "#e52f00",
        backgroundColor: "rgba(229, 47, 0, 0.5)",
      });
    }

    return { leaderboard, chartData, authors: data.authors };
  }, [data, metric, range, selectedAuthor]);

  if (!data) return <div className="loading">Loading participation data...</div>;
  if (!processedData) return <div className="loading">Processing...</div>;

  return (
    <div className="container">
      <header>
        <h1>CivicActions Open Source Participation</h1>
        <p>
          Aggregation of public contributions to Civicactions organization repositories
          (Open Source licenses only).
        </p>
        <div className="meta">
          Last updated: {new Date(data.generated_at).toLocaleString()}
        </div>
      </header>

      <div className="controls">
        <label>
          Metric:
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRIC_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>

        <label>
          Range:
          <select value={range} onChange={(e) => setRange(e.target.value)}>
             {RANGE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>

        <label>
          Person:
          <select value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)}>
            <option value="all">All Contributors</option>
            {data.authors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <div className="dashboard-grid">
        <section className="chart-section">
          <h2>Weekly Trend: {METRIC_OPTIONS.find(m => m.key === metric).label}</h2>
          <WeeklyChart data={processedData.chartData} />
        </section>

        <section className="leaderboard-section">
          <h2>Top Contributors ({range === 'all' ? 'All Time' : `Last ${range} Weeks`})</h2>
          <Leaderboard items={processedData.leaderboard} onSelectAuthor={setSelectedAuthor} selectedAuthor={selectedAuthor} />
        </section>
      </div>
    </div>
  );
}

export default App;
