# Ecosyste.ms Integration Guide

This dashboard integrates with the [Ecosyste.ms](https://ecosyste.ms) API to provide enhanced repository insights, health metrics, and community engagement data.

## What is Ecosyste.ms?

Ecosyste.ms is an open-source project that provides various APIs for understanding open-source projects across GitHub and other platforms. It offers:

- **Repository Health Scores**: Automated health assessments based on activity, maintenance, and community indicators
- **Dependency Analysis**: Track direct dependencies and reverse dependencies (repos that depend on yours)
- **Issue & PR Analytics**: Detailed statistics on issue resolution times, comment engagement, and more
- **Commit Activity**: Cross-repository commit patterns and contributor analytics
- **Package Ecosystem Data**: Integration with npm, PyPI, and other package registries

## Features Added

### 1. Repository Health Visualization

**Component**: `RepositoryHealthChart`

Shows health scores (0-100%) for all tracked repositories with color-coding:
- 🟢 Green (80-100%): Healthy repositories
- 🟡 Yellow (50-79%): Repositories needing attention
- 🔴 Red (<50%): Critical repositories requiring immediate attention

Health scores are calculated by Ecosyste.ms based on:
- Recent commit activity
- Issue response times
- PR merge rates
- Documentation quality
- Community engagement

### 2. Dependency & Impact Analysis

**Component**: `DependencyHealthChart`

Bubble chart visualization showing:
- **X-axis**: Number of dependencies the repository uses
- **Y-axis**: Number of other repositories that depend on this one
- **Bubble size**: Health score
- **Bubble color**: Programming language

This helps identify:
- High-impact repositories (many dependents)
- Dependency-heavy repositories (potential maintenance burden)
- Healthy vs. struggling critical dependencies

### 3. Community Engagement Metrics

**Component**: `CommunityEngagement`

Displays aggregate community health metrics:
- Total issues (open/closed)
- Average time to close issues
- Average comments per issue (engagement level)
- Total commits and committers
- Average repository health score
- Top repositories by activity

Includes a detailed table showing the most active repositories with their engagement metrics.

## Configuration

### Enabling Ecosyste.ms Collection

Edit `scripts/config.json`:

```json
{
  "orgAllowlist": ["your-org"],
  "historyWeeks": 52,
  "collectEcosystemsData": true
}
```

Set `collectEcosystemsData` to `true` to enable data collection from Ecosyste.ms APIs.

### Data Collection

When enabled, the collector will:
1. Run after the main GitHub data collection completes
2. Fetch data for all repositories that had activity in the tracked period
3. Collect from three Ecosyste.ms APIs:
   - **Repos API**: Health scores, dependencies, language, license
   - **Issues API**: Issue statistics and response times
   - **Commits API**: Commit activity and contributor counts

### Rate Limiting

The collector includes built-in rate limiting:
- 1 second delay between API requests
- Automatic retry logic with exponential backoff
- Graceful handling of 404 (not found) and 429 (rate limit) responses

Typical collection time: ~30 seconds for 20 repositories

## Data Storage

Ecosyste.ms data is stored in SQLite tables:

```sql
-- Repository health and metadata
CREATE TABLE ecosystems_repos (
  timestamp TEXT,
  repo TEXT,
  health_score INTEGER,
  maintenance_status TEXT,
  archived INTEGER,
  dependency_count INTEGER,
  dependent_repos_count INTEGER,
  language TEXT,
  license TEXT,
  topics TEXT,
  PRIMARY KEY (timestamp, repo)
);

-- Issue statistics
CREATE TABLE ecosystems_issue_stats (
  timestamp TEXT,
  repo TEXT,
  total_issues INTEGER,
  open_issues INTEGER,
  closed_issues INTEGER,
  avg_time_to_close REAL,
  avg_comments_per_issue REAL,
  PRIMARY KEY (timestamp, repo)
);

-- Commit statistics
CREATE TABLE ecosystems_commit_stats (
  timestamp TEXT,
  repo TEXT,
  total_commits INTEGER,
  total_committers INTEGER,
  avg_commits_per_week REAL,
  last_commit_at TEXT,
  PRIMARY KEY (timestamp, repo)
);
```

## Export Format

The enhanced `data/metrics.json` includes:

```json
{
  "weeks": [...],
  "series": [...],
  "ecosystems": {
    "repositories": [
      {
        "repo": "org/repo-name",
        "health_score": 85,
        "maintenance_status": "active",
        "archived": false,
        "dependency_count": 45,
        "dependent_repos_count": 12,
        "language": "JavaScript",
        "license": "MIT",
        "topics": ["react", "dashboard", "opensource"]
      }
    ],
    "issue_stats": [
      {
        "repo": "org/repo-name",
        "total_issues": 234,
        "open_issues": 12,
        "closed_issues": 222,
        "avg_time_to_close": 72.5,
        "avg_comments_per_issue": 3.2
      }
    ],
    "commit_stats": [
      {
        "repo": "org/repo-name",
        "total_commits": 1523,
        "total_committers": 45,
        "avg_commits_per_week": 12.3,
        "last_commit_at": "2026-02-20T10:30:00Z"
      }
    ]
  }
}
```

## Frontend Display

The dashboard automatically detects Ecosyste.ms data and displays the new visualizations when available. If `data.ecosystems` is not present in the metrics, the components show helpful messages explaining how to enable the feature.

### Conditional Rendering

```jsx
{data.ecosystems && (
  <>
    <CommunityEngagement data={data} />
    <RepositoryHealthChart data={data} />
    <DependencyHealthChart data={data} />
  </>
)}
```

## Benefits

### For Repository Maintainers
- **Early Warning System**: Identify repositories with declining health before they become critical
- **Prioritization**: Focus maintenance efforts on high-impact dependencies
- **Community Insights**: Understand engagement patterns and response times

### For Contributors
- **Project Health**: See which projects are well-maintained
- **Community Activity**: Understand how responsive maintainers are
- **Impact Visualization**: See how repositories depend on each other

### For Organizations
- **Portfolio Health**: Get a birds-eye view of all repository health scores
- **Resource Allocation**: Identify which projects need more support
- **Transparency**: Show commitment to maintaining healthy open-source projects

## Troubleshooting

### No Ecosyste.ms data showing

1. Check `scripts/config.json` has `"collectEcosystemsData": true`
2. Run the collector manually:
   ```bash
   node scripts/update_sqlite.mjs
   node scripts/export_metrics.mjs
   ```
3. Check console output for errors
4. Verify repositories have entries in the Ecosyste.ms database

### Some repositories missing

Not all repositories may have data in Ecosyste.ms:
- New repositories may not be indexed yet
- Private repositories are not tracked
- Some repositories may not have enough activity for health scores

### API Rate Limiting

If you hit rate limits:
- The collector automatically retries with backoff
- Consider running less frequently
- Contact Ecosyste.ms team for higher rate limits if needed

## Privacy & Data Usage

- **Public Data Only**: Ecosyste.ms only indexes public repositories
- **No Authentication Required**: APIs are publicly accessible
- **Cached Data**: Ecosyste.ms provides cached/aggregated data, not real-time
- **Attribution**: Data provided by ecosyste.ms under their terms of use

## Future Enhancements

Potential future additions:
- Historical health score trends
- Dependency security alerts
- Package download statistics
- Contributor diversity metrics
- Cross-repository contributor analysis
- Language-specific ecosystem insights

## Links

- [Ecosyste.ms Website](https://ecosyste.ms)
- [Ecosyste.ms Issues API Docs](https://issues.ecosyste.ms/docs)
- [Ecosyste.ms Repos API Docs](https://repos.ecosyste.ms/docs)
- [Ecosyste.ms Commits API Docs](https://commits.ecosyste.ms/docs)
- [Ecosyste.ms GitHub](https://github.com/ecosyste-ms)
