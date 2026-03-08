import React, { useEffect, useMemo, useState } from "react";
import Leaderboard from "./Leaderboard.jsx";
import WeeklyChart from "./WeeklyChart.jsx";
import PRSuccessChart from "./PRSuccessChart.jsx";
import IssuesPRsRatioChart from "./IssuesPRsRatioChart.jsx";
import PRMetricsChart from "./PRMetricsChart.jsx";
import RepoStarsChart from "./RepoStarsChart.jsx";
import RepositoryHealthChart from "./RepositoryHealthChart.jsx";
import DependencyHealthChart from "./DependencyHealthChart.jsx";
import CommunityEngagement from "./CommunityEngagement.jsx";
import OpenContributions from "./OpenContributions.jsx";
import Projects from "./Projects.jsx";
import Hero from "./Hero.jsx";
import MetricCard from "./MetricCard.jsx";
import WhyOpen from "./WhyOpen.jsx";
import OrgSelector from "./OrgSelector.jsx";
import { getCurrentOrg } from "./orgUtils.js";
import "./styles.css";

async function loadMetrics() {
  const res = await fetch("./data/metrics.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load metrics.json (${res.status})`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse metrics.json: ${err.message}\nResponse body:\n${text.slice(0, 2000)}`);
  }
}

async function loadConfig() {
  try {
    const res = await fetch("./config.json", { cache: "no-store" });
    if (!res.ok) return null; // Config is optional
    return await res.json();
  } catch (err) {
    console.warn('Config not loaded, using defaults:', err.message);
    return null;
  }
}

const METRIC_OPTIONS = [
  { key: "all_metrics", label: "All Metrics" },
  { key: "comments_total", label: "Comments" },
  { key: "prs_opened", label: "PRs Opened" },
  { key: "prs_closed", label: "PRs Closed" },
  { key: "prs_merged", label: "PRs Merged" },
  { key: "issues_opened", label: "Issues Opened" },
  { key: "issues_closed", label: "Issues Closed" }
];

const RANGE_OPTIONS = [
  { key: "12", label: "Last 12 Weeks" },
  { key: "26", label: "Last 26 Weeks" },
  { key: "52", label: "Last 52 Weeks" },
  { key: "all", label: "All Time" }
];

function App() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [metric, setMetric] = useState("all_metrics");
  const [range, setRange] = useState("12");
  const [selectedAuthor, setSelectedAuthor] = useState("all");
  const [displayConfig, setDisplayConfig] = useState({ collectAllPublic: false, licenseFilter: 'oss' });
  const [view, setView] = useState('dashboard');
  
  // Organization override management
  const defaultOrg = config?.organization?.githubOrg || 'civicactions';
  const [currentOrg, setCurrentOrg] = useState(() => getCurrentOrg(defaultOrg));
  
  // Update currentOrg when config loads
  useEffect(() => {
    if (config) {
      const newDefaultOrg = config.organization?.githubOrg || 'civicactions';
      setCurrentOrg(getCurrentOrg(newDefaultOrg));
    }
  }, [config]);
  
  // Handler for org changes - update URL with ?org= and navigate so the change is visible
  const handleOrgChange = (newOrg) => {
    const url = new URL(window.location.href);
    if (newOrg && newOrg !== defaultOrg) {
      url.searchParams.set('org', newOrg);
    } else {
      url.searchParams.delete('org');
    }
    window.location.href = url.toString();
  };

  // Initialize view from URL hash (simple hash routing)
  useEffect(() => {
    const loadFromHash = () => {
      const h = (window.location.hash || '').replace(/^#\/?/, '');
      if (h === 'projects' || h === 'dashboard') setView(h);
    };
    loadFromHash();
    const onHash = () => loadFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Shared metric keys and accessible style map for chart and legend
  const metricKeys = ['prs_opened','prs_closed','prs_merged','issues_opened','issues_closed','commits','comments_total'];
  const styleMap = {
    prs_opened:  { color: '#005a9c', bg: 'rgba(0,90,156,0.15)', dash: [], marker: 'circle' },
    prs_closed:  { color: '#0078d4', bg: 'rgba(0,120,212,0.12)', dash: [6,4], marker: 'rect' },
    prs_merged:  { color: '#107c10', bg: 'rgba(16,124,16,0.12)', dash: [2,4], marker: 'triangle' },
    issues_opened:{ color: '#a80000', bg: 'rgba(168,0,0,0.12)', dash: [1,3], marker: 'diamond' },
    issues_closed:{ color: '#e81123', bg: 'rgba(232,17,35,0.12)', dash: [8,4,2,4], marker: 'cross' },
    commits:     { color: '#444444', bg: 'rgba(68,68,68,0.08)', dash: [4,2], marker: 'line' },
    comments_total: { color: '#6b5cff', bg: 'rgba(107,92,255,0.08)', dash: [2,2], marker: 'circle' }
  };

  useEffect(() => {
    loadMetrics()
      .then(setData)
      .catch((err) => console.error(err));
    loadConfig()
      .then(setConfig)
      .catch((err) => console.error('Config load error:', err));
  }, []);

  useEffect(() => {
    if (data && data.collectAllPublic !== undefined) {
      setDisplayConfig({ collectAllPublic: !!data.collectAllPublic, licenseFilter: data.licenseFilter || 'oss' });
    }
  }, [data]);

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
          if (metric === 'all_metrics') {
          // sum all tracked metric keys for the leaderboard
          const sum = ['prs_opened','prs_closed','prs_merged','issues_opened','issues_closed','commits','comments_issue','comments_pr_review','comments_commit']
            .reduce((s, k) => s + ((byAuthor[author] && byAuthor[author][k]) || 0), 0);
          authorTotals[author] = (authorTotals[author] || 0) + sum;
        } else if (metric === 'comments_total') {
           const sum = ((byAuthor[author]['comments_issue'] || 0) + (byAuthor[author]['comments_pr_review'] || 0) + (byAuthor[author]['comments_commit'] || 0));
           authorTotals[author] = (authorTotals[author] || 0) + sum;
        } else {
          authorTotals[author] = (authorTotals[author] || 0) + (byAuthor[author][metric] || 0);
        }
      }
    });

    const leaderboard = Object.entries(authorTotals)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .filter(item => item.count > 0);

    // 3. Prepare Chart Data
    // labels: weeks
    // points: depends on selectedAuthor and metric
    const chartData = {
      labels: weeks,
      datasets: []
    };

    

    const pushDataset = (key, label) => {
      const points = series.map(s => {
        if (selectedAuthor === 'all') {
          let total = 0;
          for (const auth in s.byAuthor) {
            if (key === 'comments_total') {
              total += ((s.byAuthor[auth]['comments_issue'] || 0) + (s.byAuthor[auth]['comments_pr_review'] || 0) + (s.byAuthor[auth]['comments_commit'] || 0));
            } else {
              total += (s.byAuthor[auth][key] || 0);
            }
          }
          return total;
        }
        if (key === 'comments_total') {
          return ((s.byAuthor[selectedAuthor] && ((s.byAuthor[selectedAuthor]['comments_issue'] || 0) + (s.byAuthor[selectedAuthor]['comments_pr_review'] || 0) + (s.byAuthor[selectedAuthor]['comments_commit'] || 0))) || 0);
        }
        return (s.byAuthor[selectedAuthor] && s.byAuthor[selectedAuthor][key]) || 0;
      });
      const style = styleMap[key] || { color: '#333', bg: 'rgba(0,0,0,0.08)', dash: [], marker: 'circle' };
      chartData.datasets.push({
        label,
        data: points,
        borderColor: style.color,
        backgroundColor: style.bg,
        borderDash: style.dash,
        borderWidth: 2,
        pointStyle: style.marker,
        pointRadius: 3,
        tension: 0.15
      });
    };

    if (metric === 'all_metrics') {
      // show all metrics as separate lines
      pushDataset('prs_opened', 'PRs Opened');
      pushDataset('prs_closed', 'PRs Closed');
      pushDataset('prs_merged', 'PRs Merged');
      pushDataset('issues_opened', 'Issues Opened');
      pushDataset('issues_closed', 'Issues Closed');
    } else {
      // single metric selected
      const opt = METRIC_OPTIONS.find(m => m.key === metric) || { label: metric };
      pushDataset(metric, opt.label || metric);
    }

    return { leaderboard, chartData, authors: data.authors };
  }, [data, metric, range, selectedAuthor]);

  if (!data) return <div className="loading">Loading participation data...</div>;
  if (!processedData) return <div className="loading">Processing...</div>;

  // Calculate overview metrics
  const totalContributions = processedData.leaderboard.reduce((sum, item) => sum + item.count, 0);
  const totalContributors = data.authors.length;
  const totalRepos = data.repos ? data.repos.length : 0;
  const activeContributors = processedData.leaderboard.filter(item => item.count > 0).length;
  
  // Helper function to calculate weekly activity
  const calculateWeeklyActivity = (weekData) => {
    if (!weekData || !weekData.byAuthor) return 0;
    return Object.values(weekData.byAuthor).reduce((sum, metrics) => {
      return sum + Object.values(metrics).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    }, 0);
  };
  
  const thisWeekActivity = data.series && data.series.length > 0 
    ? calculateWeeklyActivity(data.series[data.series.length - 1])
    : 0;

  // Calculate PR merge success rate
  const calculatePRSuccessRate = () => {
    if (!data.series || data.series.length === 0) return 0;
    let totalMerged = 0;
    let totalClosed = 0;
    
    data.series.forEach(week => {
      Object.values(week.byAuthor || {}).forEach(metrics => {
        totalMerged += metrics.prs_merged || 0;
        totalClosed += metrics.prs_closed || 0;
      });
    });
    
    if (totalClosed === 0) return 0;
    return Math.round((totalMerged / totalClosed) * 100);
  };

  // Calculate average PR merge time
  const calculateAvgMergeTime = () => {
    if (!data.pr_details || data.pr_details.length === 0) return null;
    
    const mergeTimes = data.pr_details
      .filter(pr => pr.merge_time_hours !== null && pr.was_merged)
      .map(pr => pr.merge_time_hours);
    
    if (mergeTimes.length === 0) return null;
    
    const avg = mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length;
    
    // Convert to days if > 24 hours
    if (avg >= 24) {
      return `${(avg / 24).toFixed(1)}d`;
    }
    return `${avg.toFixed(1)}h`;
  };

  const prSuccessRate = calculatePRSuccessRate();
  const avgMergeTime = calculateAvgMergeTime();

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="#/dashboard" onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''} aria-current={view === 'dashboard' ? 'page' : undefined}>Dashboard</a>
            <a href="#/projects" onClick={() => setView('projects')} className={view === 'projects' ? 'active' : ''} aria-current={view === 'projects' ? 'page' : undefined}>Projects</a>
          </div>
        </div>
      </header>

      <Hero config={config} />

      {view === 'dashboard' && (
        <>
          <div className="metrics-overview">
            <MetricCard
              title="Total Contributions"
              value={totalContributions.toLocaleString()}
              subtitle={`In the last ${range === 'all' ? 'all time' : range + ' weeks'}`}
              icon="🚀"
            />
            <MetricCard
              title="Active Contributors"
              value={activeContributors}
              subtitle={`Out of ${totalContributors} total contributors`}
              icon="👥"
            />
            <MetricCard
              title="Repositories"
              value={totalRepos}
              subtitle="Open source projects"
              icon="📦"
            />
            <MetricCard
              title="This Week"
              value={thisWeekActivity}
              subtitle="Recent activity"
              icon="⚡"
            />
            <MetricCard
              title="PR Success Rate"
              value={`${prSuccessRate}%`}
              subtitle="PRs merged vs closed"
              icon="✅"
            />
            {avgMergeTime && (
              <MetricCard
                title="Avg Merge Time"
                value={avgMergeTime}
                subtitle="Time to merge PRs"
                icon="⏱️"
              />
            )}
          </div>

          <WhyOpen config={config} />
        </>
      )}

      <div className="meta" style={{ textAlign: 'center', marginBottom: '24px' }}>
        {(() => {
          try {
            const generatedAt = new Date(data.generated_at);
            const local = generatedAt.toLocaleString(undefined, { timeZoneName: 'short' });
            const ageSeconds = Math.floor((Date.now() - generatedAt.getTime()) / 1000);
            let ageText = '';
            if (ageSeconds < 60) ageText = 'just now';
            else if (ageSeconds < 3600) ageText = `${Math.floor(ageSeconds/60)} minute${Math.floor(ageSeconds/60)===1? '':'s'} ago`;
            else if (ageSeconds < 86400) ageText = `${Math.floor(ageSeconds/3600)} hour${Math.floor(ageSeconds/3600)===1? '':'s'} ago`;
            else ageText = `${Math.floor(ageSeconds/86400)} day${Math.floor(ageSeconds/86400)===1? '':'s'} ago`;
            return <>Last updated: {local} ({ageText})</>;
          } catch (e) {
            return <>Last updated: {new Date(data.generated_at).toLocaleString()}</>;
          }
        })()}
      </div>

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
        <label>
          Collection mode:
          <select value={displayConfig.collectAllPublic ? 'all_public' : 'org_only'} onChange={(e) => {
            const v = e.target.value === 'all_public';
            setDisplayConfig(d => ({ ...d, collectAllPublic: v }));
          }}>
            <option value="org_only">Org-only (default)</option>
            <option value="all_public">All public contributions</option>
          </select>
          <div className="meta" style={{ marginTop: 6, fontWeight: 'normal', fontSize: '0.9em', color: '#666' }}>
            Org-only limits queries to {currentOrg}.
          </div>
        </label>

        <label>
          License filter:
          <select value={displayConfig.licenseFilter} onChange={(e) => setDisplayConfig(d => ({ ...d, licenseFilter: e.target.value }))}>
            <option value="oss">Open-source licenses only</option>
            <option value="all">Any</option>
          </select>
        </label>

        {/* collector command moved to footer */}
      </div>

      <div className="dashboard-grid">
        {view === 'dashboard' && (
          <>
            <section className="chart-section">
          <h2>Weekly Trend: {METRIC_OPTIONS.find(m => m.key === metric).label}</h2>
          <WeeklyChart data={processedData.chartData} />
          <div className="legend" aria-hidden>
            {metricKeys.map(k => {
              const s = styleMap[k];
              const label = k === 'prs_opened' ? 'PRs Opened' : k === 'prs_closed' ? 'PRs Closed' : k === 'prs_merged' ? 'PRs Merged' : k === 'issues_opened' ? 'Issues Opened' : k === 'issues_closed' ? 'Issues Closed' : 'Commits';
              const dashAttr = (s.dash && s.dash.length) ? s.dash.join(',') : null;
              return (
                <div key={k} className="legend-item">
                  <svg width="56" height="16" viewBox="0 0 56 16" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label + ' legend'}>
                    <line x1="4" y1="8" x2="52" y2="8" stroke={s.color} strokeWidth="3" strokeDasharray={dashAttr} strokeLinecap="round" />
                    {s.marker === 'circle' && <circle cx="28" cy="8" r="3" fill={s.color} />}
                    {s.marker === 'rect' && <rect x="25" y="5" width="6" height="6" fill={s.color} />}
                    {s.marker === 'triangle' && <polygon points="28,4 24,12 32,12" fill={s.color} />}
                    {s.marker === 'diamond' && <polygon points="28,6 26,8 28,10 30,8" fill={s.color} />}
                    {s.marker === 'cross' && <g stroke={s.color} strokeWidth="2"><line x1="26" y1="6" x2="30" y2="10" /><line x1="30" y1="6" x2="26" y2="10" /></g>}
                    {s.marker === 'line' && <line x1="26" y1="8" x2="30" y2="8" stroke={s.color} strokeWidth="3" />}
                  </svg>
                  {label}
                </div>
              );
            })}
          </div>
            </section>

            <section className="leaderboard-section">
              <h2>Top Contributors ({range === 'all' ? 'All Time' : `Last ${range} Weeks`})</h2>
              <Leaderboard items={processedData.leaderboard} onSelectAuthor={setSelectedAuthor} selectedAuthor={selectedAuthor} />
            </section>

            <section className="chart-section">
              <h2>PR Success Rate</h2>
              <PRSuccessChart data={data} weeks={processedData.chartData.labels} selectedAuthor={selectedAuthor} />
            </section>

            <section className="chart-section">
              <h2>Issues vs PRs Over Time</h2>
              <IssuesPRsRatioChart data={data} weeks={processedData.chartData.labels} selectedAuthor={selectedAuthor} />
            </section>

            <section className="chart-section">
              <h2>PR Merge Time & Size</h2>
              <PRMetricsChart data={data} weeks={processedData.chartData.labels} selectedAuthor={selectedAuthor} />
            </section>

            <section className="chart-section">
              <h2>Repository Stars</h2>
              <RepoStarsChart data={data} />
            </section>

            {/* Ecosyste.ms Enhanced Visualizations */}
            {data.ecosystems && (
              <>
                <section className="chart-section">
                  <h2>Community Engagement</h2>
                  <CommunityEngagement data={data} />
                </section>

                <section className="chart-section">
                  <h2>Repository Health</h2>
                  <RepositoryHealthChart data={data} />
                </section>

                <section className="chart-section">
                  <h2>Dependencies & Impact</h2>
                  <DependencyHealthChart data={data} />
                </section>
              </>
            )}

            {/* Open Contributions Descriptors */}
            {data.open_contributions && (
              <section className="chart-section">
                <h2>Open Contributions Descriptors</h2>
                <OpenContributions data={data} />
              </section>
            )}
          </>
        )}

        {view === 'projects' && (
          <section className="projects-section">
            <h2>Projects & Repositories</h2>
            {/* lazy-load Projects to avoid increasing bundle size too much */}
              <React.Suspense fallback={<div>Loading projects...</div>}>
                <Projects data={data} selectedAuthor={selectedAuthor} metric={metric} />
              </React.Suspense>
          </section>
        )}
      </div>

      <footer style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 12, fontSize: '0.9em', color: '#444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ color: '#666' }}>Org-only limits queries to {currentOrg}.</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8 }}>Apply to collector:</span>
              <code>node scripts/set_config.mjs --collectAllPublic={displayConfig.collectAllPublic ? 'true' : 'false'} --licenseFilter={displayConfig.licenseFilter}</code>
            </div>
            <div>
              <a href="https://github.com/mgifford/gh-open-dash" target="_blank" rel="noopener noreferrer" aria-label="Open gh-open-dash repository on GitHub (opens in new tab)">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012.01-.27c.68 0 1.36.09 2.01.27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
      
      <OrgSelector 
        currentOrg={currentOrg} 
        defaultOrg={defaultOrg}
        onOrgChange={handleOrgChange}
      />
    </div>
  );
}

export default App;
