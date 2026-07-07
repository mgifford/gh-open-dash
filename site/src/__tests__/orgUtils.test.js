import { describe, it, expect, beforeEach } from 'vitest';
import { parseOrgInput, getCurrentOrg, saveOrgOverride, clearOrgOverride, filterReposByOrg, buildSeriesFromRepos, filterRowsByRepoSet } from '../orgUtils.js';

describe('parseOrgInput', () => {
  it('should parse plain org names', () => {
    expect(parseOrgInput('openplus')).toBe('openplus');
    expect(parseOrgInput('civicactions')).toBe('civicactions');
    expect(parseOrgInput('my-org')).toBe('my-org');
    expect(parseOrgInput('org_name')).toBe('org_name');
  });

  it('should parse full GitHub URLs', () => {
    expect(parseOrgInput('https://github.com/openplus')).toBe('openplus');
    expect(parseOrgInput('http://github.com/civicactions')).toBe('civicactions');
    expect(parseOrgInput('https://github.com/my-org')).toBe('my-org');
  });

  it('should parse URLs without scheme', () => {
    expect(parseOrgInput('github.com/openplus')).toBe('openplus');
    expect(parseOrgInput('github.com/civicactions')).toBe('civicactions');
  });

  it('should handle trailing slashes', () => {
    expect(parseOrgInput('openplus/')).toBe('openplus');
    expect(parseOrgInput('https://github.com/openplus/')).toBe('openplus');
    expect(parseOrgInput('github.com/openplus///')).toBe('openplus');
  });

  it('should trim whitespace', () => {
    expect(parseOrgInput('  openplus  ')).toBe('openplus');
    expect(parseOrgInput('  https://github.com/openplus  ')).toBe('openplus');
  });

  it('should return null for invalid inputs', () => {
    expect(parseOrgInput('')).toBe(null);
    expect(parseOrgInput('   ')).toBe(null);
    expect(parseOrgInput(null)).toBe(null);
    expect(parseOrgInput(undefined)).toBe(null);
    expect(parseOrgInput('invalid org name!')).toBe(null);
    expect(parseOrgInput('org with spaces')).toBe(null);
  });

  it('should normalize to lowercase', () => {
    expect(parseOrgInput('OpenPlus')).toBe('openplus');
    expect(parseOrgInput('CIVICACTIONS')).toBe('civicactions');
    expect(parseOrgInput('https://github.com/MyOrg')).toBe('myorg');
  });
});

describe('getCurrentOrg', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear URL search params by resetting location search
    window.history.replaceState({}, '', window.location.pathname);
  });

  it('should return default org when no override is set', () => {
    expect(getCurrentOrg('civicactions')).toBe('civicactions');
    expect(getCurrentOrg('testorg')).toBe('testorg');
  });

  it('should return org from localStorage when set', () => {
    localStorage.setItem('gh-open-dash-org', 'openplus');
    expect(getCurrentOrg('civicactions')).toBe('openplus');
  });

  it('should prioritize URL param over localStorage', () => {
    localStorage.setItem('gh-open-dash-org', 'openplus');
    window.history.replaceState({}, '', '?org=anotherorg');
    expect(getCurrentOrg('civicactions')).toBe('anotherorg');
  });

  it('should fall back to default when invalid org in localStorage', () => {
    localStorage.setItem('gh-open-dash-org', 'invalid org!');
    expect(getCurrentOrg('civicactions')).toBe('civicactions');
  });

  it('should fall back to localStorage when URL param is invalid', () => {
    localStorage.setItem('gh-open-dash-org', 'openplus');
    window.history.replaceState({}, '', '?org=invalid org!');
    expect(getCurrentOrg('civicactions')).toBe('openplus');
  });
});

describe('saveOrgOverride', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save valid org to localStorage', () => {
    expect(saveOrgOverride('openplus')).toBe(true);
    expect(localStorage.getItem('gh-open-dash-org')).toBe('openplus');
  });

  it('should parse and save URLs', () => {
    expect(saveOrgOverride('https://github.com/openplus')).toBe(true);
    expect(localStorage.getItem('gh-open-dash-org')).toBe('openplus');
  });

  it('should remove item when org is empty', () => {
    localStorage.setItem('gh-open-dash-org', 'openplus');
    expect(saveOrgOverride('')).toBe(true);
    expect(localStorage.getItem('gh-open-dash-org')).toBe(null);
  });

  it('should return false for invalid org', () => {
    expect(saveOrgOverride('invalid org!')).toBe(false);
    expect(localStorage.getItem('gh-open-dash-org')).toBe(null);
  });
});

describe('clearOrgOverride', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should remove org from localStorage', () => {
    localStorage.setItem('gh-open-dash-org', 'openplus');
    clearOrgOverride();
    expect(localStorage.getItem('gh-open-dash-org')).toBe(null);
  });

  it('should not throw when nothing is stored', () => {
    expect(() => clearOrgOverride()).not.toThrow();
  });
});

describe('filterReposByOrg', () => {
  const repos = [
    { repo: 'civicactions/accessibility', spdx: 'MIT' },
    { repo: 'civicactions/ckanext-datajson', spdx: 'AGPL-3.0' },
    { repo: 'chaoss/grimoirelab', spdx: 'GPL-3.0' },
    { repo: 'chaoss/augur', spdx: 'MIT' },
  ];

  it('should return only repos belonging to the given org', () => {
    expect(filterReposByOrg(repos, 'civicactions')).toEqual([
      { repo: 'civicactions/accessibility', spdx: 'MIT' },
      { repo: 'civicactions/ckanext-datajson', spdx: 'AGPL-3.0' },
    ]);
    expect(filterReposByOrg(repos, 'chaoss')).toEqual([
      { repo: 'chaoss/grimoirelab', spdx: 'GPL-3.0' },
      { repo: 'chaoss/augur', spdx: 'MIT' },
    ]);
  });

  it('should be case-insensitive', () => {
    expect(filterReposByOrg(repos, 'CIVICACTIONS')).toHaveLength(2);
    expect(filterReposByOrg(repos, 'CivicActions')).toHaveLength(2);
  });

  it('should return empty array when no repos match', () => {
    expect(filterReposByOrg(repos, 'unknown-org')).toEqual([]);
  });

  it('should return original array when org is falsy', () => {
    expect(filterReposByOrg(repos, '')).toBe(repos);
    expect(filterReposByOrg(repos, null)).toBe(repos);
  });

  it('should return empty array when repos is null or undefined', () => {
    expect(filterReposByOrg(null, 'civicactions')).toEqual([]);
    expect(filterReposByOrg(undefined, 'civicactions')).toEqual([]);
  });

  it('should handle repos with missing repo field', () => {
    const mixed = [{ repo: 'civicactions/a' }, { spdx: 'MIT' }, null];
    expect(filterReposByOrg(mixed, 'civicactions')).toEqual([{ repo: 'civicactions/a' }]);
  });
});

describe('buildSeriesFromRepos', () => {
  const allWeeks = ['2026-01-05', '2026-01-12', '2026-01-19'];

  it('aggregates weekly byAuthor data across the given repos only', () => {
    const repos = [
      {
        repo: 'org-a/repo-1',
        weekly: [
          { week_start: '2026-01-05', byAuthor: { alice: { prs_opened: 2 } } },
          { week_start: '2026-01-12', byAuthor: { alice: { prs_opened: 1 }, bob: { issues_opened: 3 } } },
        ],
      },
      {
        repo: 'org-b/repo-2',
        weekly: [
          { week_start: '2026-01-05', byAuthor: { carol: { prs_merged: 1 } } },
        ],
      },
    ];

    // Scoping to only org-a/repo-1 must exclude carol's org-b activity entirely.
    const series = buildSeriesFromRepos([repos[0]], allWeeks);
    expect(series.map(w => w.week_start)).toEqual(allWeeks);
    expect(series[0].byAuthor.alice.prs_opened).toBe(2);
    expect(series[0].byAuthor.carol).toBeUndefined();
    expect(series[1].byAuthor.bob.issues_opened).toBe(3);
    expect(series[2].byAuthor).toEqual({});
  });

  it('sums the same metric key across multiple repos in the same org/week', () => {
    const repos = [
      { repo: 'org-a/repo-1', weekly: [{ week_start: '2026-01-05', byAuthor: { alice: { prs_opened: 2 } } }] },
      { repo: 'org-a/repo-2', weekly: [{ week_start: '2026-01-05', byAuthor: { alice: { prs_opened: 3 } } }] },
    ];
    const series = buildSeriesFromRepos(repos, ['2026-01-05']);
    expect(series[0].byAuthor.alice.prs_opened).toBe(5);
  });

  it('returns an empty-but-shaped series when given no repos', () => {
    const series = buildSeriesFromRepos([], allWeeks);
    expect(series).toEqual(allWeeks.map(week_start => ({ week_start, byAuthor: {} })));
  });

  it('defaults untouched metric keys to 0 rather than leaving them undefined', () => {
    const repos = [{ repo: 'org-a/repo-1', weekly: [{ week_start: '2026-01-05', byAuthor: { alice: { prs_opened: 1 } } }] }];
    const series = buildSeriesFromRepos(repos, ['2026-01-05']);
    expect(series[0].byAuthor.alice.prs_merged).toBe(0);
    expect(series[0].byAuthor.alice.comments_issue).toBe(0);
  });
});

describe('filterRowsByRepoSet', () => {
  const rows = [
    { repo: 'org-a/repo-1', week_start: '2026-01-05', author: 'alice' },
    { repo: 'org-b/repo-2', week_start: '2026-01-05', author: 'carol' },
  ];

  it('keeps only rows whose repo is in the given repo set', () => {
    const repos = [{ repo: 'org-a/repo-1' }];
    expect(filterRowsByRepoSet(rows, repos)).toEqual([rows[0]]);
  });

  it('returns an empty array for non-array input', () => {
    expect(filterRowsByRepoSet(null, [{ repo: 'org-a/repo-1' }])).toEqual([]);
    expect(filterRowsByRepoSet(undefined, [{ repo: 'org-a/repo-1' }])).toEqual([]);
  });

  it('returns an empty array when repos is empty', () => {
    expect(filterRowsByRepoSet(rows, [])).toEqual([]);
  });
});
