import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, describe, afterEach } from 'vitest';
import ProjectHistory from '../ProjectHistory.jsx';

afterEach(() => {
  cleanup();
});

const sampleRepo = {
  repo: 'org/repo-a',
  weekly: [
    { week_start: '2026-06-01', byAuthor: { alice: { prs_opened: 1 }, bob: { prs_opened: 1, issues_opened: 1 } } },
    { week_start: '2026-06-08', byAuthor: { alice: { prs_opened: 1 } } },
  ],
};

const sampleCompanies = {
  alice: { company: 'CivicActions', team: null },
  bob: { company: 'CivicActions', team: 'Engineering' },
};

describe('ProjectHistory', () => {
  test('shows a message when there is no weekly history', () => {
    render(<ProjectHistory repo={{ repo: 'org/empty', weekly: [] }} contributorCompany={{}} />);
    expect(screen.getByText(/No weekly history available/i)).toBeDefined();
  });

  test('handles a missing repo gracefully', () => {
    render(<ProjectHistory repo={null} contributorCompany={{}} />);
    expect(screen.getByText(/No weekly history available/i)).toBeDefined();
  });

  test('renders a bar chart by default with a company legend', () => {
    const { container } = render(<ProjectHistory repo={sampleRepo} contributorCompany={sampleCompanies} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('CivicActions')).toBeDefined();
  });

  test('toggles to an accessible data table with week/company/count columns', () => {
    const { container } = render(<ProjectHistory repo={sampleRepo} contributorCompany={sampleCompanies} />);
    fireEvent.click(screen.getByText('Show data table'));
    expect(container.querySelector('table')).not.toBeNull();
    expect(screen.getByText('2026-06-01')).toBeDefined();
    expect(screen.getByText('2026-06-08')).toBeDefined();
  });

  test('buckets contributors without a known company as "Unattributed"', () => {
    render(<ProjectHistory repo={sampleRepo} contributorCompany={{}} />);
    expect(screen.getByText('Unattributed')).toBeDefined();
  });
});
