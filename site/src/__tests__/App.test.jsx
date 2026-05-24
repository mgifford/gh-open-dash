import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import App from '../App.jsx';

// Module-level mock ensures ALL imports of orgUtils (including inside App.jsx) use the mock.
// Vitest automatically hoists vi.mock() calls before imports.
vi.mock('../orgUtils.js', async () => {
  const actual = await vi.importActual('../orgUtils.js');
  return {
    ...actual,
    getCurrentOrg: vi.fn().mockReturnValue('civicactions'),
  };
});

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return {
    Line: (props) => React.createElement('div', { 'data-testid': 'chart' }),
    Bubble: (props) => React.createElement('div', { 'data-testid': 'bubble' }),
    Bar: (props) => React.createElement('div', { 'data-testid': 'bar' })
  };
});

const sampleMetrics = {
  generated_at: new Date().toISOString(),
  weeks: ['2025-12-01','2025-12-08'],
  authors: ['alice','bob'],
  staff_allowlist: ['alice'],
  series: [
    { week_start: '2025-12-01', byAuthor: { alice: { prs_opened: 1, prs_closed: 0, prs_merged: 0, issues_opened: 2, issues_closed: 0 }, bob: { prs_opened: 0, prs_closed: 0, prs_merged: 0, issues_opened: 0, issues_closed: 0 } } },
    { week_start: '2025-12-08', byAuthor: { alice: { prs_opened: 0, prs_closed: 1, prs_merged: 1, issues_opened: 0, issues_closed: 1 }, bob: { prs_opened: 1, prs_closed: 0, prs_merged: 0, issues_opened: 1, issues_closed: 0 } } }
  ],
  repos: [
    { repo: 'civicactions/project-a', spdx: 'MIT', totals: { prs_opened: 1, prs_merged: 1, prs_closed: 1, issues_opened: 0, issues_closed: 0, commits: 0 }, byAuthor: {}, weekly: [] }
  ],
  orgs: ['civicactions'],
  collectAllPublic: false,
  licenseFilter: 'oss'
};


const sampleMetricsWithChaoss = {
  ...sampleMetrics,
  repos: [
    ...sampleMetrics.repos,
    { repo: 'chaoss/grimoirelab', spdx: 'GPL-3.0', totals: { prs_opened: 2, prs_merged: 1, prs_closed: 1, issues_opened: 3, issues_closed: 1, commits: 4 }, byAuthor: { bob: { prs_opened: 2, prs_merged: 1, prs_closed: 1, issues_opened: 3, issues_closed: 1, commits: 4 } }, weekly: [] }
  ],
  orgs: ['civicactions', 'chaoss']
};

let mockGetCurrentOrg;

beforeEach(async () => {
  const orgUtils = await import('../orgUtils.js');
  mockGetCurrentOrg = orgUtils.getCurrentOrg;

  global.fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(sampleMetrics)), json: () => Promise.resolve(sampleMetrics) }));
  // Default: return the dataset's primary org so no banner is shown
  mockGetCurrentOrg.mockReturnValue('civicactions');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks(); // resets both call history and mock implementations
  localStorage.clear();
});

test('renders app and shows All Metrics heading by default', async () => {
  render(<App />);

  expect(screen.getByText(/Loading participation data/i)).toBeDefined();

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // heading should reflect selected metric (All Metrics default)
  expect(screen.getByText(/Weekly Trend:/i)).toBeDefined();
  // ensure the Metric select contains All Metrics option
  expect(screen.getByRole('combobox', { name: /Metric:/i })).toBeDefined();
});

test('shows collection mode CLI suggestion', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  // allow for StrictMode double-render by checking the footer command is present
  expect(screen.getAllByText(/Apply to collector:/i).length).toBeGreaterThan(0);
});

test('shows org-mismatch banner when requested org has no data', async () => {
  // Simulate ?org=chaoss — an org not present in the dataset
  mockGetCurrentOrg.mockReturnValue('chaoss');

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // Banner should warn that chaoss was not found (React 18 StrictMode may render twice)
  const alerts = screen.getAllByRole('alert');
  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts[0].textContent).toMatch(/No data found for organization/i);
  expect(alerts[0].textContent).toMatch(/chaoss/i);
});

test('org-mismatch banner includes SCAN issue instructions', async () => {
  mockGetCurrentOrg.mockReturnValue('chaoss');

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const alerts = screen.getAllByRole('alert');
  expect(alerts.length).toBeGreaterThan(0);
  // Banner should mention creating a SCAN issue
  expect(alerts[0].textContent).toMatch(/SCAN:\s*chaoss/i);
  expect(alerts[0].textContent).toMatch(/GitHub issue/i);
});

test('org-mismatch banner shows "Open issue now" link when githubRepo is configured', async () => {
  mockGetCurrentOrg.mockReturnValue('chaoss');

  const configWithRepo = { githubRepo: 'myorg/my-dash', organization: { githubOrg: 'civicactions' } };
  global.fetch = vi.fn((url) => {
    if (url && url.includes('config.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(configWithRepo) });
    }
    return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(sampleMetrics)), json: () => Promise.resolve(sampleMetrics) });
  });

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const alerts = screen.getAllByRole('alert');
  expect(alerts.length).toBeGreaterThan(0);
  // The "Open issue now" link should point to the githubRepo value from config
  const issueLink = alerts[0].querySelector('a[href*="github.com/myorg/my-dash/issues/new"]');
  expect(issueLink).not.toBeNull();
  // Verify the link URL is built from the config.githubRepo value and includes the org in the title
  expect(issueLink.href).toContain('github.com/' + configWithRepo.githubRepo + '/issues/new');
  expect(issueLink.href).toContain('SCAN%3A%20chaoss');
});

test('org-mismatch banner shows "Open workflow" link when githubRepo is configured', async () => {
  mockGetCurrentOrg.mockReturnValue('chaoss');

  const configWithRepo = { githubRepo: 'myorg/my-dash', organization: { githubOrg: 'civicactions' } };
  global.fetch = vi.fn((url) => {
    if (url && url.includes('config.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(configWithRepo) });
    }
    return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(sampleMetrics)), json: () => Promise.resolve(sampleMetrics) });
  });

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const alerts = screen.getAllByRole('alert');
  expect(alerts.length).toBeGreaterThan(0);
  // The "Open workflow" link should point to the Actions workflow URL
  const workflowLink = alerts[0].querySelector('a[href*="github.com/myorg/my-dash/actions/workflows/update-metrics.yml"]');
  expect(workflowLink).not.toBeNull();
  expect(workflowLink.href).toContain('github.com/' + configWithRepo.githubRepo + '/actions/workflows/update-metrics.yml');
});

test('does not show org-mismatch banner when requested org matches dataset', async () => {
  // civicactions has repos in the sample dataset, so no banner expected
  mockGetCurrentOrg.mockReturnValue('civicactions');

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // No banner should appear
  expect(screen.queryByRole('alert')).toBeNull();
});


test('shows requested org after scan results are cached in metrics dataset', async () => {
  mockGetCurrentOrg.mockReturnValue('chaoss');

  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(sampleMetricsWithChaoss)),
    json: () => Promise.resolve(sampleMetricsWithChaoss)
  }));

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // Once metrics include the requested org, the mismatch banner should disappear.
  expect(screen.queryByRole('alert')).toBeNull();
  // The org selector should keep the requested org instead of falling back.
  expect(screen.getByRole('textbox', { name: /Organization name or URL/i }).value).toBe('chaoss');
});

test('does not show org-mismatch banner when no org param is set (default org)', async () => {
  // Default org resolves to civicactions which has repos in the dataset
  mockGetCurrentOrg.mockReturnValue('civicactions');

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  expect(screen.queryByRole('alert')).toBeNull();
});

test('Usage & AI link is not rendered in the nav', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // The "Usage & AI" link should be removed since org-wide agent/action data is not available
  const usageLinks = Array.from(document.querySelectorAll('header a')).filter(a =>
    /Usage.*AI/i.test(a.textContent)
  );
  expect(usageLinks.length).toBe(0);

  const usageSpans = Array.from(document.querySelectorAll('header span')).filter(s =>
    /Usage.*AI/i.test(s.textContent)
  );
  expect(usageSpans.length).toBe(0);
});

test('renders contributor type filter with All Contributors option', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const contributorTypeSelect = screen.getByRole('combobox', { name: /Contributor type:/i });
  expect(contributorTypeSelect).toBeDefined();
  expect(contributorTypeSelect.value).toBe('all');

  const options = Array.from(contributorTypeSelect.querySelectorAll('option')).map(o => o.value);
  expect(options).toContain('all');
  expect(options).toContain('staff');
  expect(options).toContain('community');
});

test('contributor type filter shows only staff when Org Members selected', async () => {
  render(<App />);
  await waitFor(() => screen.getByRole('combobox', { name: /Contributor type:/i }));

  const contributorTypeSelect = screen.getByRole('combobox', { name: /Contributor type:/i });
  fireEvent.change(contributorTypeSelect, { target: { value: 'staff' } });

  // alice is in staff_allowlist, bob is not
  // After filtering to staff, only alice should appear in the Person dropdown
  const personSelect = screen.getByRole('combobox', { name: /Person:/i });
  const personOptions = Array.from(personSelect.querySelectorAll('option')).map(o => o.value);
  expect(personOptions).toContain('alice');
  expect(personOptions).not.toContain('bob');
});

test('contributor type filter shows only community contributors when Community Contributors selected', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const contributorTypeSelect = screen.getByRole('combobox', { name: /Contributor type:/i });
  fireEvent.change(contributorTypeSelect, { target: { value: 'community' } });

  // bob is not in staff_allowlist, alice is
  // After filtering to community, only bob should appear in the Person dropdown
  const personSelect = screen.getByRole('combobox', { name: /Person:/i });
  const personOptions = Array.from(personSelect.querySelectorAll('option')).map(o => o.value);
  expect(personOptions).toContain('bob');
  expect(personOptions).not.toContain('alice');
});

test('leaderboard shows staff badge emoji for org members', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // alice is in staff_allowlist so should have 🏢 badge
  // bob is not so should have 🌍 badge
  const staffBadges = document.querySelectorAll('.contributor-badge--staff');
  const communityBadges = document.querySelectorAll('.contributor-badge--community');
  expect(staffBadges.length).toBeGreaterThan(0);
  expect(communityBadges.length).toBeGreaterThan(0);
});

test('metric dropdown includes Contribution Score and Meeting Attendance options', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const metricSelect = screen.getByRole('combobox', { name: /Metric:/i });
  const options = Array.from(metricSelect.querySelectorAll('option')).map(o => o.value);
  expect(options).toContain('contribution_score');
  expect(options).toContain('meeting_mentions');
});

test('selecting Contribution Score metric shows correct heading', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const metricSelect = screen.getByRole('combobox', { name: /Metric:/i });
  fireEvent.change(metricSelect, { target: { value: 'contribution_score' } });

  await waitFor(() => expect(screen.getByText(/Weekly Trend: Contribution Score/i)).toBeDefined());
});

test('selecting Meeting Attendance metric shows correct heading', async () => {
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const metricSelect = screen.getByRole('combobox', { name: /Metric:/i });
  fireEvent.change(metricSelect, { target: { value: 'meeting_mentions' } });

  await waitFor(() => expect(screen.getByText(/Weekly Trend: Meeting Attendance/i)).toBeDefined());
});

test('contribution score leaderboard ranks author with more weighted contributions higher', async () => {
  const metricsWithScore = {
    ...sampleMetrics,
    series: [
      {
        week_start: '2025-12-01',
        byAuthor: {
          alice: { prs_merged: 2, commits: 1, prs_opened: 0, issues_opened: 0, prs_closed: 0, issues_closed: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0, meeting_mentions: 0 },
          bob:   { prs_merged: 0, commits: 0, prs_opened: 1, issues_opened: 1, prs_closed: 0, issues_closed: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0, meeting_mentions: 3 }
        }
      }
    ]
  };
  // alice score: 2*5 + 1*4 = 14; bob score: 1*3 + 1*2 + 3*2 = 11
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(metricsWithScore)),
    json: () => Promise.resolve(metricsWithScore)
  }));

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const metricSelect = screen.getByRole('combobox', { name: /Metric:/i });
  fireEvent.change(metricSelect, { target: { value: 'contribution_score' } });

  await waitFor(() => {
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    // alice should be ranked first (higher score)
    expect(rows[0].textContent).toContain('alice');
  });
});
