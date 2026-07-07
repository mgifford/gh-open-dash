import React, { useMemo, useState } from 'react';
import { computeRepoReachWeights, computeCompanyImpact } from './companyImpact.js';

function groupByCompany(items, contributorCompany) {
  const map = new Map();
  for (const item of items) {
    const info = contributorCompany ? contributorCompany[item.author] : null;
    const company = (info && info.company) || 'Unattributed';
    const team = info && info.team;
    if (!map.has(company)) {
      map.set(company, { company, rawCount: 0, contributors: new Set(), teams: new Map() });
    }
    const entry = map.get(company);
    entry.rawCount += item.count;
    entry.contributors.add(item.author);
    if (team) {
      entry.teams.set(team, (entry.teams.get(team) || 0) + item.count);
    }
  }

  return Array.from(map.values()).map(e => ({
    company: e.company,
    rawCount: e.rawCount,
    impactScore: null,
    contributorCount: e.contributors.size,
    teams: Array.from(e.teams.entries())
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count)
  }));
}

// Ranks companies (and, where known, teams within them) so maintainers can
// recognize and incentivize the organizations behind the work, not just
// individual contributors. When `repos` + `repoStars` are supplied, also
// computes an all-time Impact Score that weights each contribution by the
// reach of the project it went to — the GitHub-native analog of how
// Drupal.org's marketplace scales credit by how many sites run a module.
// Reach blends GitHub stars with Ecosyste.ms's dependent-repo count when
// `ecosystemsRepos` is supplied (see companyImpact.js for why).
export default function CompanyLeaderboard({ items = [], contributorCompany = {}, repos, repoStars, ecosystemsRepos }) {
  const hasImpactData = Array.isArray(repos) && repos.length > 0;
  const [sortBy, setSortBy] = useState(hasImpactData ? 'impact' : 'contributions');

  const grouped = useMemo(() => {
    if (hasImpactData) {
      const weights = computeRepoReachWeights(repoStars || [], ecosystemsRepos || []);
      return computeCompanyImpact(repos, contributorCompany, weights);
    }
    return groupByCompany(items, contributorCompany);
  }, [items, contributorCompany, repos, repoStars, ecosystemsRepos, hasImpactData]);

  const sorted = useMemo(() => {
    const key = sortBy === 'impact' && hasImpactData ? 'impactScore' : 'rawCount';
    return [...grouped].sort((a, b) => b[key] - a[key]);
  }, [grouped, sortBy, hasImpactData]);

  const top = sorted.slice(0, 25);

  return (
    <div className="leaderboard company-leaderboard">
      {hasImpactData && top.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
          <label>
            Sort by:{' '}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="impact">Impact Score</option>
              <option value="contributions">Contributions</option>
            </select>
          </label>
        </div>
      )}
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
              {hasImpactData && <th className="num">Impact Score</th>}
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
                <td className="num">{entry.rawCount}</td>
                {hasImpactData && <td className="num">{entry.impactScore}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasImpactData && top.length > 0 && (
        <p className="meta">
          Impact Score weights each contribution by the reach of the project it went to — GitHub stars
          {Array.isArray(ecosystemsRepos) && ecosystemsRepos.length > 0
            ? ', blended with Ecosyste.ms dependent-repo counts when available,'
            : ''}{' '}
          so contributions to widely-used projects count for more. All-time; not affected by the
          Range/Metric filters above.
        </p>
      )}
      {sorted.length > 25 && <p className="more-info">...and {sorted.length - 25} more.</p>}
    </div>
  );
}
