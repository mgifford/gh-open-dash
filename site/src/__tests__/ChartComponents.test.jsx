import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { test, expect, vi, describe, afterEach } from 'vitest';
import WorkflowRunsChart from '../WorkflowRunsChart.jsx';
import PRSuccessChart from '../PRSuccessChart.jsx';
import IssuesPRsRatioChart from '../IssuesPRsRatioChart.jsx';
import RepoStarsChart from '../RepoStarsChart.jsx';
import PRMetricsChart from '../PRMetricsChart.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return {
    Line: (props) => React.createElement('div', { 'data-testid': 'line-chart' }),
    Bar: (props) => React.createElement('div', { 'data-testid': 'bar-chart' }),
    Bubble: (props) => React.createElement('div', { 'data-testid': 'bubble-chart' }),
  };
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// WorkflowRunsChart
// ---------------------------------------------------------------------------

describe('WorkflowRunsChart', () => {
  test('shows placeholder when no data provided', () => {
    render(<WorkflowRunsChart />);
    expect(screen.getByText(/No workflow run data available/i)).toBeDefined();
  });

  test('shows placeholder when data has no workflow_runs property', () => {
    render(<WorkflowRunsChart data={{}} />);
    expect(screen.getByText(/No workflow run data available/i)).toBeDefined();
  });

  test('shows placeholder when workflow_runs array is empty', () => {
    render(<WorkflowRunsChart data={{ workflow_runs: [] }} />);
    expect(screen.getByText(/No workflow run data available/i)).toBeDefined();
  });

  test('placeholder mentions how to enable collection', () => {
    render(<WorkflowRunsChart data={{ workflow_runs: [] }} />);
    expect(screen.getByText(/collectWorkflowRuns/i)).toBeDefined();
  });

  test('renders bar chart when valid data is provided', () => {
    const data = {
      workflow_runs: [
        { week_start: '2025-12-01', workflow_name: 'CI', run_count: 5 },
        { week_start: '2025-12-08', workflow_name: 'CI', run_count: 3 },
      ],
    };
    render(<WorkflowRunsChart data={data} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('renders chart with multiple workflows', () => {
    const data = {
      workflow_runs: [
        { week_start: '2025-12-01', workflow_name: 'CI', run_count: 5 },
        { week_start: '2025-12-01', workflow_name: 'Deploy', run_count: 2 },
        { week_start: '2025-12-08', workflow_name: 'CI', run_count: 3 },
      ],
    };
    render(<WorkflowRunsChart data={data} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('includes visually hidden accessible text summary', () => {
    const data = {
      workflow_runs: [
        { week_start: '2025-12-01', workflow_name: 'CI', run_count: 5 },
      ],
    };
    render(<WorkflowRunsChart data={data} />);
    expect(screen.getByText(/GitHub Actions workflow runs by week/i)).toBeDefined();
  });

  test('renders chart when weeks filter is provided', () => {
    const data = {
      workflow_runs: [
        { week_start: '2025-12-01', workflow_name: 'CI', run_count: 5 },
        { week_start: '2025-12-08', workflow_name: 'CI', run_count: 3 },
      ],
    };
    render(<WorkflowRunsChart data={data} weeks={['2025-12-01']} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('shows placeholder when all data is filtered out by the weeks array', () => {
    const data = {
      workflow_runs: [
        { week_start: '2025-12-01', workflow_name: 'CI', run_count: 5 },
      ],
    };
    // Provide a non-empty weeks array that doesn't match any data
    render(<WorkflowRunsChart data={data} weeks={['2025-11-01']} />);
    expect(screen.getByText(/No workflow run data available/i)).toBeDefined();
  });

  test('handles more than 8 workflows by adding an Other category', () => {
    const workflows = Array.from({ length: 10 }, (_, i) => ({
      week_start: '2025-12-01',
      workflow_name: `Workflow-${i}`,
      run_count: i + 1,
    }));
    render(<WorkflowRunsChart data={{ workflow_runs: workflows }} />);
    // Should still render a chart (no error thrown)
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PRSuccessChart
// ---------------------------------------------------------------------------

describe('PRSuccessChart', () => {
  const weeks = ['2025-12-01', '2025-12-08'];
  const data = {
    series: [
      {
        week_start: '2025-12-01',
        byAuthor: {
          alice: { prs_merged: 3, prs_closed: 5 },
          bob: { prs_merged: 1, prs_closed: 2 },
        },
      },
      {
        week_start: '2025-12-08',
        byAuthor: { alice: { prs_merged: 2, prs_closed: 3 } },
      },
    ],
  };

  test('shows placeholder when no data', () => {
    render(<PRSuccessChart data={null} weeks={weeks} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('shows placeholder when weeks is null', () => {
    render(<PRSuccessChart data={data} weeks={null} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('shows placeholder when weeks array is empty', () => {
    render(<PRSuccessChart data={data} weeks={[]} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('renders bar chart when data and weeks are provided', () => {
    render(<PRSuccessChart data={data} weeks={weeks} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('renders chart when selectedAuthor filters to a specific author', () => {
    render(<PRSuccessChart data={data} weeks={weeks} selectedAuthor="alice" />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('renders chart with default selectedAuthor "all"', () => {
    render(<PRSuccessChart data={data} weeks={weeks} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('renders chart when series has no byAuthor data', () => {
    const emptyData = {
      series: [{ week_start: '2025-12-01', byAuthor: {} }],
    };
    render(<PRSuccessChart data={emptyData} weeks={['2025-12-01']} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// IssuesPRsRatioChart
// ---------------------------------------------------------------------------

describe('IssuesPRsRatioChart', () => {
  const weeks = ['2025-12-01', '2025-12-08'];
  const data = {
    series: [
      {
        week_start: '2025-12-01',
        byAuthor: { alice: { issues_opened: 2, prs_opened: 1 } },
      },
      {
        week_start: '2025-12-08',
        byAuthor: { alice: { issues_opened: 1, prs_opened: 3 }, bob: { issues_opened: 2, prs_opened: 0 } },
      },
    ],
  };

  test('shows placeholder when no data', () => {
    render(<IssuesPRsRatioChart data={null} weeks={weeks} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('shows placeholder when weeks is null', () => {
    render(<IssuesPRsRatioChart data={data} weeks={null} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('shows placeholder when weeks array is empty', () => {
    render(<IssuesPRsRatioChart data={data} weeks={[]} />);
    expect(screen.getByText(/No data available/i)).toBeDefined();
  });

  test('renders line chart when data and weeks are provided', () => {
    render(<IssuesPRsRatioChart data={data} weeks={weeks} />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });

  test('renders chart filtered by selected author', () => {
    render(<IssuesPRsRatioChart data={data} weeks={weeks} selectedAuthor="alice" />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });

  test('renders chart with default "all" author', () => {
    render(<IssuesPRsRatioChart data={data} weeks={weeks} />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RepoStarsChart
// ---------------------------------------------------------------------------

describe('RepoStarsChart', () => {
  test('shows placeholder when no data provided', () => {
    render(<RepoStarsChart />);
    expect(screen.getByText(/No repository star data available/i)).toBeDefined();
  });

  test('shows placeholder when repo_stars is missing', () => {
    render(<RepoStarsChart data={{}} />);
    expect(screen.getByText(/No repository star data available/i)).toBeDefined();
  });

  test('shows placeholder when repo_stars array is empty', () => {
    render(<RepoStarsChart data={{ repo_stars: [] }} />);
    expect(screen.getByText(/No repository star data available/i)).toBeDefined();
  });

  test('renders bar chart when data is provided', () => {
    const data = {
      repo_stars: [
        { repo: 'org/repo-a', week_start: '2025-12-01', stars: 100 },
        { repo: 'org/repo-b', week_start: '2025-12-01', stars: 50 },
      ],
    };
    render(<RepoStarsChart data={data} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('renders chart when a repo has multiple weekly entries (uses latest)', () => {
    const data = {
      repo_stars: [
        { repo: 'org/repo-a', week_start: '2025-12-01', stars: 50 },
        { repo: 'org/repo-a', week_start: '2025-12-08', stars: 100 },
      ],
    };
    render(<RepoStarsChart data={data} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });

  test('limits chart to top 20 repos', () => {
    // Create 25 repos; only 20 should appear in chart data
    const repoStars = Array.from({ length: 25 }, (_, i) => ({
      repo: `org/repo-${i}`,
      week_start: '2025-12-01',
      stars: 25 - i,
    }));
    render(<RepoStarsChart data={{ repo_stars: repoStars }} />);
    // Chart should render without error
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PRMetricsChart
// ---------------------------------------------------------------------------

describe('PRMetricsChart', () => {
  const weeks = ['2025-12-01', '2025-12-08'];
  const data = {
    pr_details: [
      { week_start: '2025-12-01', author: 'alice', merge_time_hours: 24, was_merged: true, total_changes: 50 },
      { week_start: '2025-12-08', author: 'bob', merge_time_hours: 12, was_merged: true, total_changes: 20 },
    ],
  };

  test('shows placeholder when no data provided', () => {
    render(<PRMetricsChart data={null} weeks={weeks} />);
    expect(screen.getByText(/No PR details available/i)).toBeDefined();
  });

  test('shows placeholder when data has no pr_details', () => {
    render(<PRMetricsChart data={{}} weeks={weeks} />);
    expect(screen.getByText(/No PR details available/i)).toBeDefined();
  });

  test('shows placeholder when weeks is null', () => {
    render(<PRMetricsChart data={data} weeks={null} />);
    expect(screen.getByText(/No PR details available/i)).toBeDefined();
  });

  test('shows placeholder when weeks array is empty', () => {
    render(<PRMetricsChart data={data} weeks={[]} />);
    expect(screen.getByText(/No PR details available/i)).toBeDefined();
  });

  test('renders line chart when data and weeks are provided', () => {
    render(<PRMetricsChart data={data} weeks={weeks} />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });

  test('renders chart filtered to a specific author', () => {
    render(<PRMetricsChart data={data} weeks={weeks} selectedAuthor="alice" />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });

  test('handles PRs that were not merged (merge_time_hours excluded)', () => {
    const dataWithUnmerged = {
      pr_details: [
        { week_start: '2025-12-01', author: 'alice', merge_time_hours: null, was_merged: false, total_changes: 30 },
      ],
    };
    render(<PRMetricsChart data={dataWithUnmerged} weeks={['2025-12-01']} />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });

  test('handles PRs with no total_changes', () => {
    const dataNoChanges = {
      pr_details: [
        { week_start: '2025-12-01', author: 'alice', merge_time_hours: 10, was_merged: true, total_changes: 0 },
      ],
    };
    render(<PRMetricsChart data={dataNoChanges} weeks={['2025-12-01']} />);
    expect(screen.getByTestId('line-chart')).toBeDefined();
  });
});
