import React, { useMemo, useState } from 'react';

const PALETTE = ['#005a9c', '#107c10', '#a80000', '#6b5cff', '#c67b00', '#0078d4', '#8b5e3c', '#2e8b8b'];
const MAX_COMPANIES = 6;
const OTHER_LABEL = 'Other';

function sumCounts(counts) {
  return Object.values(counts || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}

// Renders a project's weekly contribution history broken down by the
// contributing company (roster or public-profile attributed), so maintainers
// can see who has been active on a project over time and which companies
// they represent — always paired with an accessible data-table view.
export default function ProjectHistory({ repo, contributorCompany = {} }) {
  const [showTable, setShowTable] = useState(false);

  const { weeklyBuckets, companies, tableRows } = useMemo(() => {
    const weekly = repo?.weekly || [];
    const companyTotals = new Map();
    const perWeekRaw = weekly.map(w => {
      const byCompany = new Map();
      for (const [author, counts] of Object.entries(w.byAuthor || {})) {
        const total = sumCounts(counts);
        if (total <= 0) continue;
        const info = contributorCompany[author];
        const company = (info && info.company) || 'Unattributed';
        byCompany.set(company, (byCompany.get(company) || 0) + total);
        companyTotals.set(company, (companyTotals.get(company) || 0) + total);
      }
      return { week_start: w.week_start, byCompany };
    });

    const sortedCompanies = Array.from(companyTotals.entries()).sort((a, b) => b[1] - a[1]);
    const topCompanies = sortedCompanies.slice(0, MAX_COMPANIES).map(([name]) => name);
    const hasOther = sortedCompanies.length > MAX_COMPANIES;
    const companies = hasOther ? [...topCompanies, OTHER_LABEL] : topCompanies;

    const weeklyBuckets = perWeekRaw.map(w => {
      const totals = new Map();
      for (const [company, count] of w.byCompany.entries()) {
        const bucket = topCompanies.includes(company) ? company : OTHER_LABEL;
        totals.set(bucket, (totals.get(bucket) || 0) + count);
      }
      return { week_start: w.week_start, totals };
    });

    const tableRows = [];
    weeklyBuckets.forEach(w => {
      for (const [company, count] of w.totals.entries()) {
        if (count > 0) tableRows.push({ week_start: w.week_start, company, count });
      }
    });
    tableRows.sort((a, b) => a.week_start.localeCompare(b.week_start) || b.count - a.count);

    return { weeklyBuckets, companies, tableRows };
  }, [repo, contributorCompany]);

  if (!repo || weeklyBuckets.length === 0) {
    return <div className="meta">No weekly history available for this project yet.</div>;
  }

  const maxWeekTotal = weeklyBuckets.reduce(
    (m, w) => Math.max(m, Array.from(w.totals.values()).reduce((s, v) => s + v, 0)),
    1
  );
  const companyColor = new Map(companies.map((c, i) => [c, PALETTE[i % PALETTE.length]]));

  const barWidth = 18;
  const barGap = 10;
  const chartWidth = Math.max(360, weeklyBuckets.length * (barWidth + barGap));
  const chartHeight = 160;

  return (
    <div className="project-history">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Contribution history by company</strong>
        <button type="button" onClick={() => setShowTable(v => !v)} aria-pressed={showTable}>
          {showTable ? 'Show chart' : 'Show data table'}
        </button>
      </div>

      {!showTable && (
        <div style={{ overflowX: 'auto' }}>
          <svg
            role="img"
            aria-label={`Weekly contributions to ${repo.repo} broken down by company`}
            width={chartWidth}
            height={chartHeight + 20}
            viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {weeklyBuckets.map((w, i) => {
              let yOffset = chartHeight;
              const x = i * (barWidth + barGap) + 5;
              return (
                <g key={w.week_start}>
                  {companies.map(company => {
                    const count = w.totals.get(company) || 0;
                    if (count <= 0) return null;
                    const h = (count / maxWeekTotal) * chartHeight;
                    yOffset -= h;
                    return (
                      <rect key={company} x={x} y={yOffset} width={barWidth} height={h} fill={companyColor.get(company)}>
                        <title>{`${w.week_start} — ${company}: ${count}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
          </svg>
          <div className="legend" aria-hidden>
            {companies.map(c => (
              <div key={c} className="legend-item">
                <span className="legend-swatch" style={{ background: companyColor.get(c) }} />
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {showTable && (
        <div className="leaderboard" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Company</th>
                <th className="num">Contributions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={`${row.week_start}-${row.company}-${i}`}>
                  <td>{row.week_start}</td>
                  <td>{row.company}</td>
                  <td className="num">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
