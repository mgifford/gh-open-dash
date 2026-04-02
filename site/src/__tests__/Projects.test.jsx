import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, vi, describe, afterEach } from 'vitest';
import Projects from '../Projects.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return {
    Bubble: (props) => React.createElement('div', { 'data-testid': 'bubble-chart' }),
  };
});

afterEach(() => {
  cleanup();
});

const sampleData = {
  repos: [
    {
      repo: 'civicactions/project-a',
      spdx: 'MIT',
      totals: { prs_opened: 5, prs_merged: 3, issues_opened: 2, commits: 10 },
      byAuthor: {
        alice: { prs_opened: 3, prs_merged: 2, issues_opened: 1, commits: 5 },
        bob: { prs_opened: 2, prs_merged: 1, issues_opened: 1, commits: 5 },
      },
    },
    {
      repo: 'civicactions/project-b',
      spdx: 'Apache-2.0',
      totals: { prs_opened: 2, prs_merged: 1, issues_opened: 4, commits: 3 },
      byAuthor: {
        carol: { prs_opened: 2, prs_merged: 1, issues_opened: 4, commits: 3 },
      },
    },
    {
      repo: 'anotherorgs/project-c',
      spdx: 'MIT',
      totals: { prs_opened: 1, prs_merged: 1, issues_opened: 0, commits: 1 },
      byAuthor: {},
    },
  ],
};

describe('Projects', () => {
  test('shows empty message when data is null', () => {
    render(<Projects data={null} />);
    expect(screen.getByText(/No per-repo data present/i)).toBeDefined();
  });

  test('shows empty message when repos array is empty', () => {
    render(<Projects data={{ repos: [] }} />);
    expect(screen.getByText(/No per-repo data present/i)).toBeDefined();
  });

  test('renders repo cards for all repos', () => {
    render(<Projects data={sampleData} />);
    expect(screen.getAllByText('civicactions/project-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('civicactions/project-b').length).toBeGreaterThan(0);
    expect(screen.getAllByText('anotherorgs/project-c').length).toBeGreaterThan(0);
  });

  test('displays SPDX license for repos', () => {
    render(<Projects data={sampleData} />);
    const mitElements = screen.getAllByText('MIT');
    expect(mitElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Apache-2.0')).toBeDefined();
  });

  test('renders bubble chart', () => {
    render(<Projects data={sampleData} />);
    expect(screen.getByTestId('bubble-chart')).toBeDefined();
  });

  test('renders search input', () => {
    render(<Projects data={sampleData} />);
    expect(screen.getByPlaceholderText('repo name')).toBeDefined();
  });

  test('renders org filter dropdown', () => {
    render(<Projects data={sampleData} />);
    const select = document.querySelector('select');
    expect(select).not.toBeNull();
  });

  test('org dropdown contains all orgs plus "all" option', () => {
    render(<Projects data={sampleData} />);
    const select = document.querySelector('select');
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('all');
    expect(options).toContain('civicactions');
    expect(options).toContain('anotherorgs');
  });

  test('filters repos by search term (case-insensitive)', () => {
    render(<Projects data={sampleData} />);
    const searchInput = screen.getByPlaceholderText('repo name');
    fireEvent.change(searchInput, { target: { value: 'project-a' } });
    expect(screen.getAllByText('civicactions/project-a').length).toBeGreaterThan(0);
    expect(screen.queryByText('civicactions/project-b')).toBeNull();
    expect(screen.queryByText('anotherorgs/project-c')).toBeNull();
  });

  test('search filter is case-insensitive', () => {
    render(<Projects data={sampleData} />);
    const searchInput = screen.getByPlaceholderText('repo name');
    fireEvent.change(searchInput, { target: { value: 'PROJECT-A' } });
    expect(screen.getAllByText('civicactions/project-a').length).toBeGreaterThan(0);
  });

  test('clears search restores all repos', () => {
    render(<Projects data={sampleData} />);
    const searchInput = screen.getByPlaceholderText('repo name');
    fireEvent.change(searchInput, { target: { value: 'project-a' } });
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getAllByText('civicactions/project-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('civicactions/project-b').length).toBeGreaterThan(0);
    expect(screen.getAllByText('anotherorgs/project-c').length).toBeGreaterThan(0);
  });

  test('filters repos by org', () => {
    render(<Projects data={sampleData} />);
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'anotherorgs' } });
    expect(screen.getAllByText('anotherorgs/project-c').length).toBeGreaterThan(0);
    expect(screen.queryByText('civicactions/project-a')).toBeNull();
    expect(screen.queryByText('civicactions/project-b')).toBeNull();
  });

  test('selecting "all" org shows all repos', () => {
    render(<Projects data={sampleData} />);
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'civicactions' } });
    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getAllByText('civicactions/project-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('anotherorgs/project-c').length).toBeGreaterThan(0);
  });

  test('shows repo details section when a repo card is clicked', () => {
    render(<Projects data={sampleData} />);
    const cards = document.querySelectorAll('.projects-grid > div');
    fireEvent.click(cards[0]);
    expect(screen.getByText('Repository details')).toBeDefined();
  });

  test('shows selected repo name in header after clicking card', () => {
    render(<Projects data={sampleData} />);
    const cards = document.querySelectorAll('.projects-grid > div');
    fireEvent.click(cards[0]);
    // The "Selected: <strong>repo-name</strong>" text appears in the controls area
    const selectedLabel = document.querySelector('strong');
    expect(selectedLabel).not.toBeNull();
    expect(selectedLabel.textContent).toBe('civicactions/project-a');
  });

  test('shows repo totals in repo card', () => {
    render(<Projects data={sampleData} />);
    // project-a has prs_opened: 5
    const openedLabels = screen.getAllByText(/PRs opened: 5/i);
    expect(openedLabels.length).toBeGreaterThan(0);
  });

  test('shows top contributors in repo card', () => {
    render(<Projects data={sampleData} />);
    // alice and bob are both contributors to project-a
    const aliceItems = screen.getAllByText(/alice/i);
    expect(aliceItems.length).toBeGreaterThan(0);
  });

  test('shows descriptor indicator for repos that have open-contributions descriptor', () => {
    const dataWithDescriptor = {
      ...sampleData,
      open_contributions: [
        { repo: 'civicactions/project-a', has_descriptor: true },
      ],
    };
    render(<Projects data={dataWithDescriptor} />);
    const descriptorIndicators = document.querySelectorAll('[aria-label="Has open-contributions descriptor"]');
    expect(descriptorIndicators.length).toBeGreaterThan(0);
  });

  test('does not show descriptor indicator for repos without open-contributions descriptor', () => {
    render(<Projects data={sampleData} />);
    // No open_contributions in data, so no indicator
    const descriptorIndicators = document.querySelectorAll('[aria-label="Has open-contributions descriptor"]');
    expect(descriptorIndicators.length).toBe(0);
  });

  test('shows "unknown" SPDX when repo has no spdx value', () => {
    const dataNoSpdx = {
      repos: [
        {
          repo: 'org/no-spdx-repo',
          spdx: null,
          totals: { prs_opened: 1, prs_merged: 0, issues_opened: 0, commits: 0 },
          byAuthor: {},
        },
      ],
    };
    render(<Projects data={dataNoSpdx} />);
    expect(screen.getByText('unknown')).toBeDefined();
  });
});
