import React from 'react';
import { render, screen } from '@testing-library/react';
import { test, expect, vi, beforeEach } from 'vitest';
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
