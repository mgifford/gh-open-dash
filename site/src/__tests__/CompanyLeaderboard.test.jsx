import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, describe, afterEach } from 'vitest';
import CompanyLeaderboard from '../CompanyLeaderboard.jsx';

afterEach(() => {
  cleanup();
});

const sampleItems = [
  { author: 'alice', count: 10 },
  { author: 'bob', count: 5 },
  { author: 'carol', count: 3 },
];

const sampleCompanies = {
  alice: { company: 'CivicActions', team: null, source: 'roster' },
  bob: { company: 'CivicActions', team: 'Engineering', source: 'roster' },
  carol: { company: 'Acme Corp', team: null, source: 'profile' },
};

describe('CompanyLeaderboard', () => {
  test('shows no activity message when items list is empty', () => {
    render(<CompanyLeaderboard items={[]} contributorCompany={{}} />);
    expect(screen.getByText(/No company-attributed activity found/i)).toBeDefined();
  });

  test('groups contributors by company and sums their counts', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} />);
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    expect(rows.length).toBe(2);
    // CivicActions = alice(10) + bob(5) = 15, Acme Corp = carol(3) = 3
    expect(rows[0].textContent).toContain('CivicActions');
    expect(rows[0].textContent).toContain('15');
    expect(rows[1].textContent).toContain('Acme Corp');
    expect(rows[1].textContent).toContain('3');
  });

  test('counts distinct contributors per company', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} />);
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    const civicActionsRow = Array.from(rows).find(r => r.textContent.includes('CivicActions'));
    // 2 contributors: alice + bob
    expect(civicActionsRow.cells[2].textContent).toBe('2');
  });

  test('shows team breakdown when team is known', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} />);
    expect(screen.getByText(/Engineering \(5\)/)).toBeDefined();
  });

  test('buckets unattributed authors under "Unattributed"', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={{}} />);
    expect(screen.getByText('Unattributed')).toBeDefined();
  });

  test('sorts companies by total contributions descending', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} />);
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    expect(rows[0].cells[1].textContent).toContain('CivicActions');
  });

  test('does not show an Impact Score column when repos/repoStars are not provided', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} />);
    expect(screen.queryByText('Impact Score')).toBeNull();
  });
});

describe('CompanyLeaderboard impact score', () => {
  // alice has fewer raw contributions but to a far more widely-used project,
  // so Impact Score and raw Contributions should disagree on the ranking.
  const repos = [
    { repo: 'org/popular', byAuthor: { alice: { prs_opened: 1 } } },
    { repo: 'org/tiny', byAuthor: { carol: { prs_opened: 5 } } },
  ];
  const repoStars = [
    { week_start: '2026-06-01', repo: 'org/popular', stars: 100000 },
    { week_start: '2026-06-01', repo: 'org/tiny', stars: 0 },
  ];

  test('shows an Impact Score column when repos and repoStars are provided', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} repos={repos} repoStars={repoStars} />);
    const headerRow = document.querySelector('.company-leaderboard thead tr');
    expect(headerRow.textContent).toContain('Impact Score');
  });

  test('ranks by Impact Score by default, weighting contributions to popular repos higher', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} repos={repos} repoStars={repoStars} />);
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    // alice's single contribution to a 100k-star repo outranks carol's 5
    // contributions to a 0-star repo once reach is weighted in.
    expect(rows[0].textContent).toContain('CivicActions');
  });

  test('switching sort to Contributions re-ranks by raw count', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} repos={repos} repoStars={repoStars} />);
    fireEvent.change(screen.getByLabelText('Sort by:'), { target: { value: 'contributions' } });
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    // Acme Corp (carol, 5 contributions) now outranks CivicActions (alice, 1 contribution).
    expect(rows[0].textContent).toContain('Acme Corp');
  });

  test('blends in Ecosyste.ms dependent-repo counts when provided, mentioning it in the footnote', () => {
    // org/tiny has no stars but a large number of dependents, so carol's
    // contributions there should now outrank alice's single contribution to
    // the (merely popular) starred repo.
    const ecosystemsRepos = [
      { repo: 'org/popular', dependent_repos_count: 0 },
      { repo: 'org/tiny', dependent_repos_count: 5000 },
    ];
    render(
      <CompanyLeaderboard
        items={sampleItems}
        contributorCompany={sampleCompanies}
        repos={repos}
        repoStars={repoStars}
        ecosystemsRepos={ecosystemsRepos}
      />
    );
    const rows = document.querySelectorAll('.company-leaderboard tbody tr');
    expect(rows[0].textContent).toContain('Acme Corp');
    expect(screen.getByText(/blended with Ecosyste\.ms dependent-repo counts/i)).toBeDefined();
  });

  test('does not mention Ecosyste.ms blending in the footnote when no ecosystems data is provided', () => {
    render(<CompanyLeaderboard items={sampleItems} contributorCompany={sampleCompanies} repos={repos} repoStars={repoStars} />);
    expect(screen.queryByText(/blended with Ecosyste\.ms/i)).toBeNull();
  });
});
