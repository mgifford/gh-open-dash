import React from 'react';

function groupByCompany(items, contributorCompany) {
  const map = new Map();
  for (const item of items) {
    const info = contributorCompany ? contributorCompany[item.author] : null;
    const company = (info && info.company) || 'Unattributed';
    const team = info && info.team;
    if (!map.has(company)) {
      map.set(company, { company, count: 0, contributors: new Set(), teams: new Map() });
    }
    const entry = map.get(company);
    entry.count += item.count;
    entry.contributors.add(item.author);
    if (team) {
      entry.teams.set(team, (entry.teams.get(team) || 0) + item.count);
    }
  }

  return Array.from(map.values())
    .map(e => ({
      company: e.company,
      count: e.count,
      contributorCount: e.contributors.size,
      teams: Array.from(e.teams.entries())
        .map(([team, count]) => ({ team, count }))
        .sort((a, b) => b.count - a.count)
    }))
    .sort((a, b) => b.count - a.count);
}

// Ranks companies (and, where known, teams within them) by total contribution
// volume so maintainers can recognize and incentivize the organizations behind
// the work, not just individual contributors.
export default function CompanyLeaderboard({ items = [], contributorCompany = {} }) {
  const grouped = groupByCompany(items, contributorCompany);
  const top = grouped.slice(0, 25);

  return (
    <div className="leaderboard company-leaderboard">
      {top.length === 0 ? (
        <p>No company-attributed activity found in this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Company</th>
              <th className="num">Contributors</th>
              <th className="num">Contributions</th>
            </tr>
          </thead>
          <tbody>
            {top.map((entry, index) => (
              <tr key={entry.company}>
                <td>{index + 1}</td>
                <td>
                  {entry.company}
                  {entry.teams.length > 0 && (
                    <div className="meta" style={{ marginTop: 2 }}>
                      {entry.teams.map(t => `${t.team} (${t.count})`).join(', ')}
                    </div>
                  )}
                </td>
                <td className="num">{entry.contributorCount}</td>
                <td className="num">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {grouped.length > 25 && <p className="more-info">...and {grouped.length - 25} more.</p>}
    </div>
  );
}
