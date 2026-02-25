# Enhanced Metrics Guide

This guide explains the new metrics and visualizations added to the transparency dashboard.

## New Metrics Collected

### PR Details
The dashboard now tracks detailed information about each pull request:

- **Merge Time**: Time from PR creation to merge (in hours/days)
- **PR Size**: Number of lines added and deleted
- **Merge Status**: Whether the PR was merged or closed without merging

**Data Storage**: `pr_details` table in SQLite
```sql
CREATE TABLE pr_details (
  week_start TEXT,
  author TEXT,
  repo TEXT,
  pr_number INTEGER,
  created_at TEXT,
  merged_at TEXT,
  closed_at TEXT,
  additions INTEGER,
  deletions INTEGER,
  PRIMARY KEY (week_start, repo, pr_number)
);
```

### Issue Labels
Issue labels are collected for categorization and filtering:

- **Labels**: Array of label names for each issue

**Data Storage**: `issue_labels` table in SQLite
```sql
CREATE TABLE issue_labels (
  week_start TEXT,
  author TEXT,
  repo TEXT,
  issue_number INTEGER,
  labels TEXT, -- JSON array
  PRIMARY KEY (week_start, repo, issue_number)
);
```

### Repository Stars
Track GitHub star counts for popularity metrics:

- **Star Count**: Number of stars per repository per week

**Data Storage**: `repo_stars` table in SQLite
```sql
CREATE TABLE repo_stars (
  week_start TEXT,
  repo TEXT,
  stars INTEGER,
  PRIMARY KEY (week_start, repo)
);
```

## New Visualizations

### 1. PR Success Rate Chart
**Type**: Stacked Bar Chart  
**Purpose**: Shows the ratio of PRs that were successfully merged vs closed without merging

**Metrics Displayed**:
- PRs Merged (green)
- PRs Closed Without Merge (red)

**Insights**:
- High merge rate indicates healthy collaboration
- High closed-without-merge rate may indicate issues with PR quality or review process

### 2. Issues vs PRs Ratio Chart
**Type**: Line Chart  
**Purpose**: Compares issue creation to PR creation over time

**Metrics Displayed**:
- Issues Opened (red diamond markers)
- PRs Opened (blue circle markers)

**Insights**:
- High issue-to-PR ratio may indicate planning/discussion culture
- High PR-to-issue ratio may indicate proactive development
- Balanced ratio typically indicates healthy project management

### 3. PR Merge Time & Size Chart
**Type**: Dual-Axis Line Chart  
**Purpose**: Shows trends in PR complexity and review speed

**Metrics Displayed**:
- Average Merge Time in hours (left axis, purple)
- Average PR Size in lines changed (right axis, blue)

**Insights**:
- Increasing merge times may indicate review bottlenecks
- Large PR sizes may correlate with longer merge times
- Helps identify opportunities to improve review velocity

### 4. Repository Stars Chart
**Type**: Horizontal Bar Chart  
**Purpose**: Ranks repositories by GitHub star count

**Metrics Displayed**:
- Top 20 repositories by star count
- Latest star count for each repository

**Insights**:
- Shows which projects have the most community interest
- Helps prioritize maintenance and support efforts
- Useful for understanding project popularity trends

## Updated Metric Cards

Two new metric cards have been added to the dashboard overview:

### PR Success Rate Card
- **Icon**: ✅
- **Value**: Percentage of PRs merged vs closed
- **Calculation**: `(total_merged / total_closed) * 100`

### Average Merge Time Card
- **Icon**: ⏱️
- **Value**: Average time to merge PRs (in hours or days)
- **Calculation**: Average of `merged_at - created_at` for all merged PRs
- **Display**: Shows as hours (h) if < 24h, otherwise as days (d)

## Data Collection Details

### GraphQL Query Updates
The data collector now fetches additional fields from GitHub's GraphQL API:

```graphql
{
  search(query: "...", type: ISSUE) {
    nodes {
      ... on PullRequest {
        number
        createdAt
        mergedAt
        closedAt
        additions
        deletions
        repository {
          stargazerCount
        }
      }
      ... on Issue {
        number
        createdAt
        closedAt
        labels(first: 20) {
          nodes {
            name
          }
        }
        repository {
          stargazerCount
        }
      }
    }
  }
}
```

### Export Format
The new metrics are included in `data/metrics.json`:

```json
{
  "pr_details": [
    {
      "week_start": "2025-02-17",
      "author": "username",
      "repo": "org/repo",
      "pr_number": 123,
      "merge_time_hours": 24.5,
      "additions": 150,
      "deletions": 50,
      "total_changes": 200,
      "was_merged": true,
      "was_closed_without_merge": false
    }
  ],
  "issue_labels": [
    {
      "week_start": "2025-02-17",
      "author": "username",
      "repo": "org/repo",
      "issue_number": 456,
      "labels": ["bug", "enhancement"]
    }
  ],
  "repo_stars": [
    {
      "week_start": "2025-02-17",
      "repo": "org/repo",
      "stars": 1234
    }
  ]
}
```

## Backward Compatibility

All new features are designed to be backward compatible:

- **Graceful Degradation**: Charts show placeholder messages when data is not yet available
- **Optional Display**: Metric cards like "Average Merge Time" only appear if data exists
- **No Breaking Changes**: Existing functionality remains unchanged
- **Incremental Collection**: New data is collected on the next scheduled run

## Running the Updated Collector

To start collecting the new metrics:

1. The collector will automatically include new fields on the next scheduled run
2. Historical data will gradually be populated as new activity occurs
3. No manual intervention is required

To force an immediate collection:

```bash
# Update data
node scripts/update_sqlite.mjs

# Export to JSON
node scripts/export_metrics.mjs

# Copy to site
node scripts/copy_metrics_to_site.mjs

# Build site
cd site && npm run build
```

## Performance Considerations

The enhanced data collection:
- Uses the same rate-limit-safe approach as existing collection
- Fetches additional fields in the same GraphQL queries (no extra API calls)
- Minimal storage overhead (< 10% increase in database size)
- No performance impact on the frontend (static data)

## Future Enhancements

Potential future additions based on the new data:
- Label-based filtering and categorization
- PR size distribution analysis
- Merge time benchmarking
- Star growth tracking over time
- Contributor velocity metrics based on PR merge times
