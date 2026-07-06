import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, describe, afterEach } from 'vitest';
import CompanyFlow from '../CompanyFlow.jsx';

afterEach(() => {
  cleanup();
});

const sampleRepos = [
  { repo: 'org/repo-a', byAuthor: { alice: { prs_opened: 2 }, bob: { prs_opened: 1, issues_opened: 1 } } },
  { repo: 'org/repo-b', byAuthor: { carol: { prs_opened: 1 } } },
];

const sampleCompanies = {
  alice: { company: 'CivicActions', team: null },
  bob: { company: 'CivicActions', team: 'Engineering' },
  carol: { company: 'Acme Corp', team: null },
};

describe('CompanyFlow', () => {
  test('shows an empty state when there is no company-attributed data', () => {
    render(<CompanyFlow repos={[]} contributorCompany={{}} />);
    expect(screen.getByText(/No company-attributed contribution data/i)).toBeDefined();
  });

  test('renders an svg flow diagram by default', () => {
    const { container } = render(<CompanyFlow repos={sampleRepos} contributorCompany={sampleCompanies} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getAllByText(/CivicActions/).length).toBeGreaterThan(0);
  });

  test('toggles to an accessible data table', () => {
    const { container } = render(<CompanyFlow repos={sampleRepos} contributorCompany={sampleCompanies} />);
    fireEvent.click(screen.getByText('Show data table'));
    expect(container.querySelector('table')).not.toBeNull();
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getAllByText('org/repo-a').length).toBeGreaterThan(0);
  });

  test('table view includes team information when known', () => {
    render(<CompanyFlow repos={sampleRepos} contributorCompany={sampleCompanies} />);
    fireEvent.click(screen.getByText('Show data table'));
    expect(screen.getByText('Engineering')).toBeDefined();
  });

  test('toggle button switches label back to "Show data table"', () => {
    render(<CompanyFlow repos={sampleRepos} contributorCompany={sampleCompanies} />);
    const button = screen.getByText('Show data table');
    fireEvent.click(button);
    expect(screen.getByText('Show flow diagram')).toBeDefined();
    fireEvent.click(screen.getByText('Show flow diagram'));
    expect(screen.getByText('Show data table')).toBeDefined();
  });

  test('buckets contributors without a known company as "Unattributed"', () => {
    const repos = [{ repo: 'org/repo-c', byAuthor: { dave: { prs_opened: 1 } } }];
    render(<CompanyFlow repos={repos} contributorCompany={{}} />);
    expect(screen.getAllByText(/Unattributed/).length).toBeGreaterThan(0);
  });
});
