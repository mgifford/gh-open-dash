// Weights company contributions by the reach of the project they were made
// to, so a PR to a widely-used project counts for more than one to a tiny
// repo — the closest GitHub-native analog to how Drupal.org's marketplace
// scales issue credit by how many sites run a module.
//
// GitHub itself has no install-count signal, so star count (collected for
// every tracked repo) is used as a baseline reach proxy. When Ecosyste.ms
// data is available (collectEcosystemsData), its `dependent_repos_count` —
// the number of other repositories that depend on this one as a package —
// is blended in too: it measures real downstream reliance rather than mere
// popularity, much closer to Drupal's actual "sites running this module"
// signal. Each signal is log-scaled independently (so mega-projects don't
// dominate) and summed, so a repo with real dependents but few stars still
// scores well, and the weight degrades gracefully to stars-only when no
// Ecosyste.ms data exists for a repo.
export function computeRepoReachWeights(repoStars = [], ecosystemsRepos = []) {
  const maxStars = new Map();
  for (const row of repoStars) {
    if (!row || !row.repo) continue;
    const stars = typeof row.stars === 'number' ? row.stars : 0;
    if (!maxStars.has(row.repo) || stars > maxStars.get(row.repo)) {
      maxStars.set(row.repo, stars);
    }
  }
  const dependents = new Map();
  for (const row of ecosystemsRepos) {
    if (!row || !row.repo) continue;
    const count = typeof row.dependent_repos_count === 'number' ? row.dependent_repos_count : 0;
    dependents.set(row.repo, count);
  }
  const repos = new Set([...maxStars.keys(), ...dependents.keys()]);
  const weights = new Map();
  for (const repo of repos) {
    const stars = maxStars.get(repo) || 0;
    const dependentCount = dependents.get(repo) || 0;
    weights.set(repo, 1 + Math.log10(1 + Math.max(0, stars)) + Math.log10(1 + Math.max(0, dependentCount)));
  }
  return weights;
}

function sumCounts(counts) {
  return Object.values(counts || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}

// Returns company-level { company, rawCount, impactScore, contributorCount, teams }
// aggregates, combining every repo's all-time byAuthor breakdown with the
// repo's reach weight and each contributor's company/team attribution.
export function computeCompanyImpact(repos = [], contributorCompany = {}, repoStarWeights = new Map()) {
  const companies = new Map();

  for (const repo of repos) {
    const weight = repoStarWeights.get(repo.repo) || 1;
    for (const [author, counts] of Object.entries(repo.byAuthor || {})) {
      const total = sumCounts(counts);
      if (total <= 0) continue;
      const info = contributorCompany[author];
      const company = (info && info.company) || 'Unattributed';
      const team = info && info.team;

      if (!companies.has(company)) {
        companies.set(company, { company, rawCount: 0, impactScore: 0, contributors: new Set(), teams: new Map() });
      }
      const entry = companies.get(company);
      entry.rawCount += total;
      entry.impactScore += total * weight;
      entry.contributors.add(author);
      if (team) {
        entry.teams.set(team, (entry.teams.get(team) || 0) + total);
      }
    }
  }

  return Array.from(companies.values()).map(e => ({
    company: e.company,
    rawCount: e.rawCount,
    impactScore: Math.round(e.impactScore * 10) / 10,
    contributorCount: e.contributors.size,
    teams: Array.from(e.teams.entries())
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count)
  }));
}
