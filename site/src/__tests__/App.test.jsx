import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

test('does not show org-mismatch banner when requested org matches dataset', async () => {
  // civicactions has repos in the sample dataset, so no banner expected
  mockGetCurrentOrg.mockReturnValue('civicactions');

  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // No banner should appear
  expect(screen.queryByRole('alert')).toBeNull();
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
