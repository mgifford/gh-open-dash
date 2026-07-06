import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
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
});
