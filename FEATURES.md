# Transparency Dashboard Features

This document lists the key features of the transparency dashboard inspired by cal.com/open.

## Visual Features

### Hero Section
- Large, prominent organization name
- Customizable tagline
- Mission/transparency statement
- Gradient background with brand colors
- Responsive design

### Metric Cards
- Six highlighted metrics with icons:
  - 🚀 Total Contributions
  - 👥 Active Contributors  
  - 📦 Repositories
  - ⚡ This Week's Activity
  - ✅ PR Success Rate (merged vs closed)
  - ⏱️ Average PR Merge Time
- Hover effects
- Clean, modern card design
- Automatically calculated from data

### Enhanced Visualizations
- **PR Success Rate Chart**: Stacked bar chart showing PRs merged vs closed without merge
- **Issues vs PRs Ratio**: Line chart comparing issue creation to PR creation over time
- **PR Merge Time & Size**: Dual-axis chart showing average merge time and PR size trends
- **Repository Stars**: Horizontal bar chart of top repositories by GitHub stars
- **Repository Health Scores** (via Ecosyste.ms): Color-coded health scores for all repositories
- **Dependency & Impact Analysis** (via Ecosyste.ms): Bubble chart showing dependencies vs dependents
- **Community Engagement Metrics** (via Ecosyste.ms): Issue response times, engagement levels, and activity
- All charts support filtering by time range and contributor

### Ecosyste.ms Integration (Optional)
- **Repository Health**: Automated health scores (0-100%) based on maintenance and activity
- **Dependency Tracking**: Number of dependencies and reverse dependencies
- **Issue Analytics**: Average time to close, comments per issue, open/closed ratios
- **Commit Statistics**: Total commits, committers, and activity patterns
- **Community Metrics**: Aggregate engagement and responsiveness indicators
- Can be enabled/disabled via `collectEcosystemsData` config flag

### "Why We're Open" Section
- Customizable transparency philosophy cards
- Default: Community First, Accountability, Inspire Others
- Icons + title + description format
- Responsive grid layout
- Can be enabled/disabled via config

### Existing Features (Preserved)
- Weekly trend charts with multiple metrics
- Contributor leaderboard
- Project/repository breakdown view
- Filtering by metric type, time range, and contributor
- Legend with visual indicators

### Company & Team Attribution (Optional)
- **Companies tab**: a company → project contribution flow diagram plus a company leaderboard, ranking companies (and known teams) by raw contribution volume or by an Impact Score
- **Impact Score**: weights contributions by the reach of the project contributed to — GitHub stars, blended with Ecosyste.ms's dependent-repo count when that integration is enabled — inspired by Drupal.org's marketplace contribution credit weighting
- **Project history**: a per-project panel (under Projects) showing weekly contributions broken down by contributing company
- **Company badges**: shown next to each project's top contributors
- Attribution source: a maintained `scripts/company_roster.json` (priority) with a fallback to each contributor's public GitHub profile `company` field
- Every chart includes an accessible data-table alternative
- Can be enabled/disabled via `collectCompanyData` config flag

## Technical Features

### Enhanced Data Collection
- **PR Details**: Tracks merge times, PR sizes (additions/deletions), and merge status
- **Issue Labels**: Collects and stores issue labels for categorization
- **Repository Stars**: Tracks GitHub star counts for popularity metrics
- All data collected via GitHub GraphQL API with rate-limit safety

### Configuration System
- Single source of truth: `site/config.json`
- Organization branding (name, tagline, colors)
- Customizable transparency messaging
- Metric card configuration
- Automatic config deployment via Vite

### Data Pipeline
- SQLite-based data storage
- Weekly automated data collection
- GitHub GraphQL API integration
- Open source license filtering
- Multi-organization support

### Deployment
- Static site generation (Vite + React)
- GitHub Pages ready
- No runtime API calls
- Automatic weekly updates via GitHub Actions
- Custom domain support

## Generalization Features

### Easy Forking
Any organization can fork and customize by:
1. Editing `site/config.json` (branding & content)
2. Editing `scripts/config.json` (data collection)
3. Pushing to GitHub (auto-deployment)

### Flexibility
- Support for multiple GitHub organizations
- Configurable history window
- Optional "all public repos" mode for staff
- License filtering (OSS-only or all)
- Extensible component architecture

## Privacy & Security

- Public data only (no private repos)
- No content leakage (counts only, no titles/URLs)
- Rate-limit safe queries
- No runtime GitHub API access
- Pre-generated static data

## Documentation

- Comprehensive README.md
- Detailed CUSTOMIZATION.md guide
- Quick start for new organizations
- Troubleshooting section
- Example configurations
