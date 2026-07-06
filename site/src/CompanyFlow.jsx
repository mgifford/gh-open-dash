import React, { useMemo, useState } from 'react';

const PALETTE = ['#005a9c', '#107c10', '#a80000', '#6b5cff', '#c67b00', '#0078d4', '#8b5e3c', '#2e8b8b'];
const MAX_COMPANIES = 8;
const MAX_PROJECTS = 12;

function sumCounts(counts) {
  return Object.values(counts || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}

// Aggregates per-repo contributor counts into company -> project -> {count, contributors}
// links, plus a flat company/team/contributor/project table for the accessible fallback.
function buildFlow(repos, contributorCompany) {
  const links = new Map(); // `${company}||${repo}` -> { company, repo, count, contributors: Set }
  const companyTotals = new Map();
  const projectTotals = new Map();
  const tableRows = [];

  for (const repo of repos || []) {
    for (const [author, counts] of Object.entries(repo.byAuthor || {})) {
      const total = sumCounts(counts);
      if (total <= 0) continue;
      const info = contributorCompany ? contributorCompany[author] : null;
      const company = (info && info.company) || 'Unattributed';
      const team = (info && info.team) || null;

      const key = `${company}||${repo.repo}`;
      if (!links.has(key)) links.set(key, { company, repo: repo.repo, count: 0, contributors: new Set() });
      const link = links.get(key);
      link.count += total;
      link.contributors.add(author);

      companyTotals.set(company, (companyTotals.get(company) || 0) + total);
      projectTotals.set(repo.repo, (projectTotals.get(repo.repo) || 0) + total);

      tableRows.push({ company, team, author, repo: repo.repo, count: total });
    }
  }

  return { links: Array.from(links.values()), companyTotals, projectTotals, tableRows };
}

function topKeysWithOther(totals, maxKeys, otherLabel) {
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, maxKeys);
  const rest = sorted.slice(maxKeys);
  const map = new Map(top.map(([k]) => [k, k]));
  if (rest.length > 0) {
    for (const [k] of rest) map.set(k, otherLabel);
  }
  return map;
}

export default function CompanyFlow({ repos = [], contributorCompany = {} }) {
  const [showTable, setShowTable] = useState(false);

  const { nodes, links, tableRows, totalContributions } = useMemo(() => {
    const { links: rawLinks, companyTotals, projectTotals, tableRows } = buildFlow(repos, contributorCompany);

    const companyBucket = topKeysWithOther(companyTotals, MAX_COMPANIES, 'Other companies');
    const projectBucket = topKeysWithOther(projectTotals, MAX_PROJECTS, 'Other projects');

    const bucketedLinks = new Map();
    for (const link of rawLinks) {
      const company = companyBucket.get(link.company) || link.company;
      const project = projectBucket.get(link.repo) || link.repo;
      const key = `${company}||${project}`;
      if (!bucketedLinks.has(key)) {
        bucketedLinks.set(key, { company, project, count: 0, contributors: new Set() });
      }
      const entry = bucketedLinks.get(key);
      entry.count += link.count;
      for (const c of link.contributors) entry.contributors.add(c);
    }

    const companyNodeTotals = new Map();
    const projectNodeTotals = new Map();
    for (const link of bucketedLinks.values()) {
      companyNodeTotals.set(link.company, (companyNodeTotals.get(link.company) || 0) + link.count);
      projectNodeTotals.set(link.project, (projectNodeTotals.get(link.project) || 0) + link.count);
    }

    const companies = Array.from(companyNodeTotals.entries()).sort((a, b) => b[1] - a[1]);
    const projects = Array.from(projectNodeTotals.entries()).sort((a, b) => b[1] - a[1]);
    const total = Array.from(companyNodeTotals.values()).reduce((s, v) => s + v, 0);

    return {
      nodes: { companies, projects },
      links: Array.from(bucketedLinks.values()),
      tableRows: tableRows.sort((a, b) => b.count - a.count),
      totalContributions: total
    };
  }, [repos, contributorCompany]);

  if (nodes.companies.length === 0) {
    return <div className="projects-empty">No company-attributed contribution data available yet. Enable <code>collectCompanyData</code> in <code>scripts/config.json</code> and re-run the collector.</div>;
  }

  const width = 780;
  const rowHeight = 34;
  const gap = 6;
  const nodeWidth = 150;
  const height = Math.max(280, Math.max(nodes.companies.length, nodes.projects.length) * (rowHeight + gap));
  const leftX = 10;
  const rightX = width - nodeWidth - 10;

  const layout = (list, maxTotal) => {
    let y = 10;
    const positions = new Map();
    for (const [key, total] of list) {
      const h = Math.max(18, (total / maxTotal) * (rowHeight * 1.6));
      positions.set(key, { y, h, total });
      y += h + gap;
    }
    return positions;
  };

  const maxCompanyTotal = nodes.companies[0]?.[1] || 1;
  const maxProjectTotal = nodes.projects[0]?.[1] || 1;
  const companyPos = layout(nodes.companies, maxCompanyTotal);
  const projectPos = layout(nodes.projects, maxProjectTotal);

  const companyColor = new Map(nodes.companies.map(([name], i) => [name, PALETTE[i % PALETTE.length]]));
  const maxLinkCount = links.reduce((m, l) => Math.max(m, l.count), 1);

  const summary = `Flow diagram showing ${totalContributions.toLocaleString()} contributions across ${nodes.companies.length} companies and ${nodes.projects.length} projects.`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" onClick={() => setShowTable(v => !v)} aria-pressed={showTable}>
          {showTable ? 'Show flow diagram' : 'Show data table'}
        </button>
      </div>

      {!showTable && (
        <div style={{ overflowX: 'auto' }}>
          <svg
            role="img"
            aria-label={summary}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {links.map((link, i) => {
              const cPos = companyPos.get(link.company);
              const pPos = projectPos.get(link.project);
              if (!cPos || !pPos) return null;
              const y1 = cPos.y + cPos.h / 2;
              const y2 = pPos.y + pPos.h / 2;
              const x1 = leftX + nodeWidth;
              const x2 = rightX;
              const midX = (x1 + x2) / 2;
              const strokeWidth = Math.max(1, (link.count / maxLinkCount) * 14);
              const color = companyColor.get(link.company) || '#999';
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.35}
                  strokeWidth={strokeWidth}
                >
                  <title>{`${link.company} → ${link.project}: ${link.count} contributions (${link.contributors.size} contributor${link.contributors.size === 1 ? '' : 's'})`}</title>
                </path>
              );
            })}

            {nodes.companies.map(([name, total]) => {
              const pos = companyPos.get(name);
              return (
                <g key={`c-${name}`}>
                  <rect x={leftX} y={pos.y} width={nodeWidth} height={pos.h} fill={companyColor.get(name)} rx={3}>
                    <title>{`${name}: ${total} contributions`}</title>
                  </rect>
                  <text x={leftX + nodeWidth + 6} y={pos.y + pos.h / 2} dy="0.35em" fontSize="12" fill="currentColor">
                    {name} ({total})
                  </text>
                </g>
              );
            })}

            {nodes.projects.map(([name, total]) => {
              const pos = projectPos.get(name);
              return (
                <g key={`p-${name}`}>
                  <rect x={rightX} y={pos.y} width={nodeWidth} height={pos.h} fill="#888" rx={3}>
                    <title>{`${name}: ${total} contributions`}</title>
                  </rect>
                  <text x={rightX - 6} y={pos.y + pos.h / 2} dy="0.35em" fontSize="12" fill="currentColor" textAnchor="end">
                    {name} ({total})
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="meta">Company → project contribution flow. Line thickness reflects contribution volume. Hover a shape for details, or use the data table for an accessible view of every company/team/contributor/project combination.</p>
        </div>
      )}

      {showTable && (
        <div className="leaderboard" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Team</th>
                <th>Contributor</th>
                <th>Project</th>
                <th className="num">Contributions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={`${row.company}-${row.author}-${row.repo}-${i}`}>
                  <td>{row.company}</td>
                  <td>{row.team || '—'}</td>
                  <td>{row.author}</td>
                  <td>{row.repo}</td>
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
