import { describe, test, expect } from 'vitest';
import { computeRepoReachWeights, computeCompanyImpact } from '../companyImpact.js';

describe('computeRepoReachWeights', () => {
  test('weights a repo by stars alone when no ecosystems data is given', () => {
    const weights = computeRepoReachWeights([{ week_start: '2026-01-01', repo: 'org/a', stars: 99 }], []);
    expect(weights.get('org/a')).toBeCloseTo(1 + Math.log10(100), 5);
  });

  test('takes the max star count across multiple weekly snapshots for the same repo', () => {
    const repoStars = [
      { week_start: '2026-01-01', repo: 'org/a', stars: 10 },
      { week_start: '2026-01-08', repo: 'org/a', stars: 50 },
    ];
    const weights = computeRepoReachWeights(repoStars, []);
    expect(weights.get('org/a')).toBeCloseTo(1 + Math.log10(51), 5);
  });

  test('blends in Ecosyste.ms dependent_repos_count when available', () => {
    const repoStars = [{ week_start: '2026-01-01', repo: 'org/a', stars: 10 }];
    const ecosystemsRepos = [{ repo: 'org/a', dependent_repos_count: 500 }];
    const weights = computeRepoReachWeights(repoStars, ecosystemsRepos);
    expect(weights.get('org/a')).toBeCloseTo(1 + Math.log10(11) + Math.log10(501), 5);
  });

  test('a repo with many dependents but zero stars still scores well', () => {
    const repoStars = [];
    const ecosystemsRepos = [{ repo: 'org/a', dependent_repos_count: 900 }];
    const weights = computeRepoReachWeights(repoStars, ecosystemsRepos);
    expect(weights.get('org/a')).toBeCloseTo(1 + Math.log10(901), 5);
  });

  test('degrades gracefully to stars-only for a repo absent from ecosystems data', () => {
    const repoStars = [{ week_start: '2026-01-01', repo: 'org/a', stars: 40 }];
    const ecosystemsRepos = [{ repo: 'org/other-repo', dependent_repos_count: 999 }];
    const weights = computeRepoReachWeights(repoStars, ecosystemsRepos);
    expect(weights.get('org/a')).toBeCloseTo(1 + Math.log10(41), 5);
  });

  test('returns an empty map for empty input', () => {
    expect(computeRepoReachWeights([], []).size).toBe(0);
  });

  test('ignores malformed rows without throwing', () => {
    const weights = computeRepoReachWeights([null, { repo: 'org/a' }], [null, { dependent_repos_count: 5 }]);
    expect(weights.get('org/a')).toBeCloseTo(1, 5);
  });
});

describe('computeCompanyImpact', () => {
  test('a company with fewer contributions but to a higher-reach repo can out-score a higher-volume company', () => {
    const repos = [
      { repo: 'org/popular', byAuthor: { alice: { prs_opened: 1 } } },
      { repo: 'org/tiny', byAuthor: { carol: { prs_opened: 5 } } },
    ];
    const contributorCompany = {
      alice: { company: 'CivicActions', team: null },
      carol: { company: 'Acme Corp', team: null },
    };
    const weights = new Map([['org/popular', 6], ['org/tiny', 1]]);
    const impact = computeCompanyImpact(repos, contributorCompany, weights);

    const civicActions = impact.find(c => c.company === 'CivicActions');
    const acme = impact.find(c => c.company === 'Acme Corp');
    expect(civicActions.rawCount).toBe(1);
    expect(civicActions.impactScore).toBe(6);
    expect(acme.rawCount).toBe(5);
    expect(acme.impactScore).toBe(5);
    expect(civicActions.impactScore).toBeGreaterThan(acme.impactScore);
  });

  test('defaults to a weight of 1 for a repo missing from the weights map', () => {
    const repos = [{ repo: 'org/unweighted', byAuthor: { alice: { prs_opened: 3 } } }];
    const impact = computeCompanyImpact(repos, { alice: { company: 'CivicActions' } }, new Map());
    expect(impact[0].impactScore).toBe(3);
  });
});
