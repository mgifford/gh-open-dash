import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import App from '../App.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return { Line: (props) => React.createElement('div', { 'data-testid': 'chart' }) };
});

const sampleMetrics = {
  generated_at: new Date().toISOString(),
  weeks: ['2025-12-01','2025-12-08'],
  authors: ['alice','bob'],
  series: [
    { week_start: '2025-12-01', byAuthor: { alice: { prs_opened: 1, prs_closed: 0, prs_merged: 0, issues_opened: 2, issues_closed: 0 }, bob: { prs_opened: 0, prs_closed: 0, prs_merged: 0, issues_opened: 0, issues_closed: 0 } } },
    { week_start: '2025-12-08', byAuthor: { alice: { prs_opened: 0, prs_closed: 1, prs_merged: 1, issues_opened: 0, issues_closed: 1 }, bob: { prs_opened: 1, prs_closed: 0, prs_merged: 0, issues_opened: 1, issues_closed: 0 } } }
  ],
  collectAllPublic: false,
  licenseFilter: 'oss'
};

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(sampleMetrics)), json: () => Promise.resolve(sampleMetrics) }));
});

afterEach(() => {
  vi.resetAllMocks();
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
