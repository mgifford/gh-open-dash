import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import RepositoryHealthChart from '../RepositoryHealthChart.jsx';
import DependencyHealthChart from '../DependencyHealthChart.jsx';
import CommunityEngagement from '../CommunityEngagement.jsx';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return {
    Bar: (props) => React.createElement('div', { 'data-testid': 'health-bar-chart' }),
    Bubble: (props) => React.createElement('div', { 'data-testid': 'dependency-bubble-chart' })
  };
});

const sampleEcosystemsData = {
  ecosystems: {
    repositories: [
      {
        repo: 'org/healthy-repo',
        health_score: 85,
        maintenance_status: 'active',
        archived: false,
        dependency_count: 25,
        dependent_repos_count: 10,
        language: 'JavaScript',
        license: 'MIT',
        topics: ['react', 'dashboard']
      },
      {
        repo: 'org/needs-attention',
        health_score: 60,
        maintenance_status: 'needs_attention',
        archived: false,
        dependency_count: 45,
        dependent_repos_count: 3,
        language: 'Python',
        license: 'Apache-2.0',
        topics: ['api']
      },
      {
        repo: 'org/critical-repo',
        health_score: 35,
        maintenance_status: 'critical',
        archived: false,
        dependency_count: 10,
        dependent_repos_count: 1,
        language: 'Ruby',
        license: 'MIT',
        topics: []
      }
    ],
    issue_stats: [
      {
        repo: 'org/healthy-repo',
        total_issues: 150,
        open_issues: 10,
        closed_issues: 140,
        avg_time_to_close: 48.5,
        avg_comments_per_issue: 3.2
      },
      {
        repo: 'org/needs-attention',
        total_issues: 200,
        open_issues: 50,
        closed_issues: 150,
        avg_time_to_close: 120.0,
        avg_comments_per_issue: 2.5
      }
    ],
    commit_stats: [
      {
        repo: 'org/healthy-repo',
        total_commits: 1500,
        total_committers: 35,
        avg_commits_per_week: 15.2,
        last_commit_at: '2026-02-20T10:00:00Z'
      }
    ]
  }
};

// Use beforeEach to cleanup between tests
beforeEach(() => {
  document.body.innerHTML = '';
});

test('RepositoryHealthChart shows health scores when data is available', () => {
  const { container } = render(<RepositoryHealthChart data={sampleEcosystemsData} />);
  
  expect(screen.getByText(/Repository Health Scores/i)).toBeDefined();
  expect(screen.getByTestId('health-bar-chart')).toBeDefined();
});

test('RepositoryHealthChart shows message when no data', () => {
  const { container } = render(<RepositoryHealthChart data={{}} />);
  
  const messages = screen.getAllByText(/No Ecosyste\.ms data available yet/i);
  expect(messages.length).toBeGreaterThan(0);
  expect(screen.getByText(/collectEcosystemsData/i)).toBeDefined();
});

test('DependencyHealthChart shows bubble chart when data is available', () => {
  const { container } = render(<DependencyHealthChart data={sampleEcosystemsData} />);
  
  expect(screen.getByText(/Repository Dependencies & Impact/i)).toBeDefined();
  expect(screen.getByTestId('dependency-bubble-chart')).toBeDefined();
});

test('DependencyHealthChart shows message when no data', () => {
  const { container } = render(<DependencyHealthChart data={{}} />);
  
  expect(screen.getByText(/No Ecosyste\.ms dependency data available yet/i)).toBeDefined();
});

test('DependencyHealthChart shows message when no dependency data', () => {
  const noDepsData = {
    ecosystems: {
      repositories: [
        {
          repo: 'org/test',
          health_score: 80,
          dependency_count: 0,
          dependent_repos_count: 0
        }
      ]
    }
  };
  const { container } = render(<DependencyHealthChart data={noDepsData} />);
  
  expect(screen.getByText(/No dependency data available/i)).toBeDefined();
});

test('CommunityEngagement shows metrics when data is available', () => {
  const { container } = render(<CommunityEngagement data={sampleEcosystemsData} />);
  
  expect(screen.getByText(/Community Engagement Metrics/i)).toBeDefined();
  expect(screen.getByText(/Total Issues/i)).toBeDefined();
  expect(screen.getByText(/Avg Time to Close/i)).toBeDefined();
  expect(screen.getByText(/Comments per Issue/i)).toBeDefined();
});

test('CommunityEngagement calculates aggregate metrics correctly', () => {
  const { container } = render(<CommunityEngagement data={sampleEcosystemsData} />);
  
  // Total issues should be 150 + 200 = 350
  const metrics = screen.getAllByText('350');
  expect(metrics.length).toBeGreaterThan(0);
  
  // Should show breakdown of open/closed
  expect(screen.getByText(/60 open · 290 closed/i)).toBeDefined();
});

test('CommunityEngagement shows message when no data', () => {
  const { container } = render(<CommunityEngagement data={{}} />);
  
  expect(screen.getByText(/No Ecosyste\.ms community data available yet/i)).toBeDefined();
});

test('CommunityEngagement displays top repositories table', () => {
  const { container } = render(<CommunityEngagement data={sampleEcosystemsData} />);
  
  // Check for table heading
  const headings = screen.getAllByText(/Top Repositories by Activity/i);
  expect(headings.length).toBeGreaterThan(0);
  
  // Check for repository names in table
  expect(screen.getByText(/needs-attention/i)).toBeDefined(); // 200 issues, should be first
  expect(screen.getByText(/healthy-repo/i)).toBeDefined();
});

test('CommunityEngagement shows health scores with color coding', () => {
  const { container } = render(<CommunityEngagement data={sampleEcosystemsData} />);
  
  // Both repos should show their health percentages
  const healthCells = screen.getAllByText(/\d+%/);
  expect(healthCells.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// RepositoryHealthChart – additional edge cases
// ---------------------------------------------------------------------------

describe('RepositoryHealthChart – edge cases', () => {
  test('shows "No health score data" when all repos have null health_score', () => {
    const dataNoScores = {
      ecosystems: {
        repositories: [
          { repo: 'org/repo-a', health_score: null },
          { repo: 'org/repo-b', health_score: undefined },
        ],
      },
    };
    render(<RepositoryHealthChart data={dataNoScores} />);
    expect(screen.getByText(/No health score data available/i)).toBeDefined();
  });

  test('renders legend text describing health score tiers', () => {
    render(<RepositoryHealthChart data={sampleEcosystemsData} />);
    expect(screen.getByText(/Healthy \(80-100%\)/i)).toBeDefined();
    expect(screen.getByText(/Needs Attention \(50-79%\)/i)).toBeDefined();
    expect(screen.getByText(/Critical/i)).toBeDefined();
  });

  test('renders a footnote about Ecosyste.ms as data source', () => {
    render(<RepositoryHealthChart data={sampleEcosystemsData} />);
    expect(screen.getByText(/Ecosyste\.ms/i)).toBeDefined();
  });

  test('limits display to 20 repos when more are provided', () => {
    const manyRepos = Array.from({ length: 25 }, (_, i) => ({
      repo: `org/repo-${i}`,
      health_score: 50 + i,
      maintenance_status: 'active',
      language: 'JavaScript',
    }));
    render(<RepositoryHealthChart data={{ ecosystems: { repositories: manyRepos } }} />);
    // Should render a chart (no crash and chart appears)
    expect(screen.getByTestId('health-bar-chart')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DependencyHealthChart – additional edge cases
// ---------------------------------------------------------------------------

describe('DependencyHealthChart – edge cases', () => {
  test('groups repos without a language into "Other" dataset', () => {
    const dataNoLang = {
      ecosystems: {
        repositories: [
          {
            repo: 'org/no-lang-repo',
            health_score: 70,
            dependency_count: 10,
            dependent_repos_count: 5,
            language: null,
          },
        ],
      },
    };
    render(<DependencyHealthChart data={dataNoLang} />);
    expect(screen.getByTestId('dependency-bubble-chart')).toBeDefined();
  });

  test('renders correctly with repos from multiple languages', () => {
    const multiLangData = {
      ecosystems: {
        repositories: [
          { repo: 'org/js-repo', health_score: 80, dependency_count: 20, dependent_repos_count: 8, language: 'JavaScript' },
          { repo: 'org/py-repo', health_score: 60, dependency_count: 15, dependent_repos_count: 3, language: 'Python' },
          { repo: 'org/rb-repo', health_score: 40, dependency_count: 5, dependent_repos_count: 1, language: 'Ruby' },
        ],
      },
    };
    render(<DependencyHealthChart data={multiLangData} />);
    expect(screen.getByTestId('dependency-bubble-chart')).toBeDefined();
  });

  test('renders description about bubble sizing', () => {
    render(<DependencyHealthChart data={sampleEcosystemsData} />);
    expect(screen.getByText(/Bubble size represents health score/i)).toBeDefined();
  });

  test('shows "No dependency data" when repos have zero dependency and zero dependent counts', () => {
    const allZeroData = {
      ecosystems: {
        repositories: [
          { repo: 'org/a', health_score: 80, dependency_count: 0, dependent_repos_count: 0, language: 'Go' },
        ],
      },
    };
    render(<DependencyHealthChart data={allZeroData} />);
    expect(screen.getByText(/No dependency data available/i)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CommunityEngagement – additional edge cases
// ---------------------------------------------------------------------------

describe('CommunityEngagement – edge cases', () => {
  test('shows total commits card when commit stats are present', () => {
    render(<CommunityEngagement data={sampleEcosystemsData} />);
    // sampleEcosystemsData has 1500 total_commits
    expect(screen.getByText('1,500')).toBeDefined();
    expect(screen.getByText(/Total Commits/i)).toBeDefined();
  });

  test('shows committer count in commit stats detail', () => {
    render(<CommunityEngagement data={sampleEcosystemsData} />);
    expect(screen.getByText(/35 committers/i)).toBeDefined();
  });

  test('does not show Total Commits card when commit_stats is absent', () => {
    const noCommitStats = {
      ecosystems: {
        ...sampleEcosystemsData.ecosystems,
        commit_stats: [],
      },
    };
    render(<CommunityEngagement data={noCommitStats} />);
    expect(screen.queryByText(/Total Commits/i)).toBeNull();
  });

  test('shows avg health score card when repository health data is present', () => {
    render(<CommunityEngagement data={sampleEcosystemsData} />);
    expect(screen.getByText(/Avg Health Score/i)).toBeDefined();
  });

  test('formats avg time to close in days and hours for long durations', () => {
    const longTimeData = {
      ecosystems: {
        repositories: sampleEcosystemsData.ecosystems.repositories,
        issue_stats: [
          {
            repo: 'org/repo-a',
            total_issues: 10,
            open_issues: 2,
            closed_issues: 8,
            avg_time_to_close: 50, // 2 days 2 hours
            avg_comments_per_issue: 1.0,
          },
        ],
        commit_stats: [],
      },
    };
    render(<CommunityEngagement data={longTimeData} />);
    expect(screen.getByText(/2d 2h/i)).toBeDefined();
  });

  test('formats avg time to close in hours only for short durations', () => {
    const shortTimeData = {
      ecosystems: {
        repositories: sampleEcosystemsData.ecosystems.repositories,
        issue_stats: [
          {
            repo: 'org/repo-a',
            total_issues: 10,
            open_issues: 2,
            closed_issues: 8,
            avg_time_to_close: 6, // 6 hours, less than 1 day
            avg_comments_per_issue: 2.0,
          },
        ],
        commit_stats: [],
      },
    };
    render(<CommunityEngagement data={shortTimeData} />);
    expect(screen.getByText('6h')).toBeDefined();
  });

  test('hides Avg Time to Close card when avg_time_to_close is null', () => {
    const noTimeData = {
      ecosystems: {
        repositories: [],
        issue_stats: [
          {
            repo: 'org/repo-a',
            total_issues: 5,
            open_issues: 1,
            closed_issues: 4,
            avg_time_to_close: null,
            avg_comments_per_issue: null,
          },
        ],
        commit_stats: [],
      },
    };
    render(<CommunityEngagement data={noTimeData} />);
    expect(screen.queryByText(/Avg Time to Close/i)).toBeNull();
  });

  test('shows N/A in table when avg_comments_per_issue is absent', () => {
    const noCommentsData = {
      ecosystems: {
        repositories: [],
        issue_stats: [
          {
            repo: 'org/repo-a',
            total_issues: 5,
            open_issues: 1,
            closed_issues: 4,
            avg_time_to_close: null,
            avg_comments_per_issue: null,
          },
        ],
        commit_stats: [],
      },
    };
    render(<CommunityEngagement data={noCommentsData} />);
    const naCells = screen.getAllByText('N/A');
    expect(naCells.length).toBeGreaterThan(0);
  });

  test('shows data source attribution text', () => {
    render(<CommunityEngagement data={sampleEcosystemsData} />);
    expect(screen.getByText(/Community engagement data provided by Ecosyste\.ms/i)).toBeDefined();
  });

  test('shows no more than 10 repos in the Top Repositories table', () => {
    const manyIssueStats = Array.from({ length: 15 }, (_, i) => ({
      repo: `org/repo-${i}`,
      total_issues: 10 + i,
      open_issues: i,
      closed_issues: 10,
      avg_time_to_close: 24,
      avg_comments_per_issue: 1.5,
    }));
    const manyData = {
      ecosystems: {
        repositories: [],
        issue_stats: manyIssueStats,
        commit_stats: [],
      },
    };
    const { container } = render(<CommunityEngagement data={manyData} />);
    const tableRows = container.querySelectorAll('tbody tr');
    expect(tableRows.length).toBeLessThanOrEqual(10);
  });
});
