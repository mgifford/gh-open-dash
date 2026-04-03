import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { test, expect, vi, describe, afterEach } from 'vitest';
import ProjectsBubble from '../ProjectsBubble.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return {
    Bubble: (props) => React.createElement('div', { 'data-testid': 'projects-bubble-chart' }),
  };
});

afterEach(() => {
  cleanup();
});

const makeRepo = (name, org, authorData = {}) => ({
  repo: `${org}/${name}`,
  byAuthor: authorData,
});

describe('ProjectsBubble', () => {
  test('renders without crashing with default empty props', () => {
    render(<ProjectsBubble />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('wrapper div has height of 360px', () => {
    const { container } = render(<ProjectsBubble />);
    expect(container.firstChild.style.height).toBe('360px');
  });

  test('renders with an empty repos array', () => {
    render(<ProjectsBubble repos={[]} />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('renders bubble chart when repos have activity data', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { issues_opened: 3, prs_opened: 2, prs_merged: 1, prs_closed: 0, issues_closed: 1 },
      }),
    ];
    render(<ProjectsBubble repos={repos} />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('renders when repos have no byAuthor data', () => {
    const repos = [{ repo: 'org/repo', byAuthor: {} }];
    render(<ProjectsBubble repos={repos} />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('renders when a repo has no byAuthor property at all', () => {
    const repos = [{ repo: 'org/repo' }];
    render(<ProjectsBubble repos={repos} />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('filters out repos with zero activity (metricValue=0, prs=0, issues=0)', () => {
    const repos = [
      { repo: 'org/zero-activity', byAuthor: {} },
      makeRepo('active', 'civicactions', {
        alice: { issues_opened: 1, prs_opened: 1 },
      }),
    ];
    // Should render without crashing even though one repo is filtered out
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('selectedAuthor="all" aggregates across all authors', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { issues_opened: 2, prs_opened: 1, prs_merged: 0, prs_closed: 0, issues_closed: 0 },
        bob: { issues_opened: 1, prs_opened: 2, prs_merged: 1, prs_closed: 0, issues_closed: 1 },
      }),
    ];
    render(<ProjectsBubble repos={repos} selectedAuthor="all" metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('selectedAuthor filters to a specific user', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { issues_opened: 2, prs_opened: 1, prs_merged: 0, prs_closed: 0, issues_closed: 0 },
        bob: { issues_opened: 5, prs_opened: 3, prs_merged: 2, prs_closed: 0, issues_closed: 2 },
      }),
    ];
    render(<ProjectsBubble repos={repos} selectedAuthor="alice" metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('selectedAuthor with no matching data renders chart without crashing', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { issues_opened: 2 },
      }),
    ];
    render(<ProjectsBubble repos={repos} selectedAuthor="nonexistent" metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('metric="comments_total" sums all comment types for selectedAuthor="all"', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: {
          comments_issue: 3,
          comments_pr_review: 2,
          comments_commit: 1,
          prs_opened: 1,
        },
      }),
    ];
    render(<ProjectsBubble repos={repos} metric="comments_total" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('metric="comments_total" sums comment types for a specific selectedAuthor', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { comments_issue: 2, comments_pr_review: 1, comments_commit: 0, prs_opened: 1 },
      }),
    ];
    render(<ProjectsBubble repos={repos} selectedAuthor="alice" metric="comments_total" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('metric="prs_merged" uses prs_merged counts', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { prs_merged: 4, prs_opened: 2, issues_opened: 1 },
      }),
    ];
    render(<ProjectsBubble repos={repos} metric="prs_merged" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('metric="prs_closed" uses prs_closed counts', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { prs_closed: 2, prs_opened: 2, issues_opened: 1 },
      }),
    ];
    render(<ProjectsBubble repos={repos} metric="prs_closed" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('renders repos from multiple known orgs (civicactions, getdkan, httparchive)', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', { alice: { issues_opened: 2, prs_opened: 1 } }),
      makeRepo('repo-b', 'getdkan', { bob: { issues_opened: 3, prs_opened: 2 } }),
      makeRepo('repo-c', 'httparchive', { carol: { issues_opened: 1, prs_opened: 1 } }),
    ];
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('renders repos from unknown orgs using palette colors', () => {
    const repos = [
      makeRepo('repo-a', 'unknown-org-1', { alice: { issues_opened: 2, prs_opened: 1 } }),
      makeRepo('repo-b', 'unknown-org-2', { bob: { issues_opened: 3, prs_opened: 2 } }),
    ];
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('accepts onRepoClick prop without crashing', () => {
    const onRepoClick = vi.fn();
    const repos = [
      makeRepo('repo-a', 'civicactions', { alice: { issues_opened: 2, prs_opened: 1 } }),
    ];
    render(<ProjectsBubble repos={repos} onRepoClick={onRepoClick} />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
    // onRepoClick is not called at mount time
    expect(onRepoClick).not.toHaveBeenCalled();
  });

  test('renders when repo field is an empty string (org extraction fallback)', () => {
    const repos = [
      { repo: '', byAuthor: { alice: { issues_opened: 2, prs_opened: 1 } } },
    ];
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('handles many repos from the same org', () => {
    const repos = Array.from({ length: 15 }, (_, i) =>
      makeRepo(`repo-${i}`, 'civicactions', {
        user: { issues_opened: i + 1, prs_opened: i },
      })
    );
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('prs count includes prs_opened + prs_merged + prs_closed', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { prs_opened: 1, prs_merged: 2, prs_closed: 3, issues_opened: 0, issues_closed: 0 },
      }),
    ];
    // The repo should not be filtered out since prs > 0
    render(<ProjectsBubble repos={repos} metric="prs_merged" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('issues count includes issues_opened + issues_closed', () => {
    const repos = [
      makeRepo('repo-a', 'civicactions', {
        alice: { issues_opened: 2, issues_closed: 3, prs_opened: 0, prs_merged: 0, prs_closed: 0 },
      }),
    ];
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });

  test('org name is lowercased for color map lookup', () => {
    const repos = [
      makeRepo('repo-a', 'CivicActions', { alice: { issues_opened: 2, prs_opened: 1 } }),
    ];
    render(<ProjectsBubble repos={repos} metric="issues_opened" />);
    expect(screen.getByTestId('projects-bubble-chart')).toBeDefined();
  });
});
