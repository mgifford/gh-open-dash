# Open Source Transparency Dashboard

An open-source transparency dashboard inspired by cal.com/open and other open startup initiatives. This project builds and publishes a beautiful static dashboard showing public open-source contributions by your GitHub organization.

![Transparency Dashboard](https://github.com/user-attachments/assets/880475a3-d679-4d2b-8888-e0956cf6989b)

## ✨ Features

- 🎯 **Modern Transparency Page**: Hero section, metric cards, and "Why We're Open" section
- 📊 **Real-time Metrics**: Track PRs, issues, commits, and comments across your organization
- 👥 **Contributor Leaderboard**: Celebrate your top contributors
- 📈 **Weekly Trends**: Visualize activity over time with interactive charts
- 🏢 **Multi-Organization Support**: Track multiple GitHub organizations
- 🎨 **Fully Customizable**: Easy configuration for branding and content
- 🔒 **Privacy-First**: Only public data, no private repo access needed
- 🚀 **Static Site**: Deploy to GitHub Pages with zero runtime API calls

## Purpose

To track and visualize engagement in open source projects over time, ensuring we are contributing back to the community with radical transparency.

## Quick Start

### For Organizations Wanting Their Own Dashboard

1. **Fork this repository**

2. **Configure your organization** by editing `site/config.json`:
   ```json
   {
     "organization": {
       "name": "Your Org Name",
       "tagline": "Your tagline here",
       "description": "Why you're transparent...",
       "githubOrg": "your-github-org"
     }
   }
   ```

3. **Update data collection settings** in `scripts/config.json`:
   ```json
   {
     "orgAllowlist": ["your-github-org"],
     "historyWeeks": 52
   }
   ```

4. **Set up GitHub Actions**:
   - Add `GITHUB_TOKEN` secret to your repository
   - Enable GitHub Pages (deploy from GitHub Actions)
   - The workflow will automatically collect and publish metrics weekly

5. **Deploy**: Push to GitHub and the Actions workflow will build and deploy your dashboard!

## Architecture

This system allows you to publish metrics without exposing private data or hitting GitHub API rate limits at runtime.

1.  **Data Pipeline (`scripts/`)**:
    *   Runs on a scheduled GitHub Action (daily/weekly configurable).
    *   Queries GitHub GraphQL API for PRs and Issues in your allowed org list.
    *   Filters for repositories with Open Source licenses (SPDX allowlist).
    *   Stores counts in a local SQLite database (`data/participation.sqlite`) incrementally.
    *   Exports aggregated anonymous JSON metrics to `data/metrics.json`.

2.  **Frontend (`site/`)**:
    *   A Vite + React static site with modern transparency design.
    *   Deployed to GitHub Pages.
    *   Consumes `data/metrics.json` at runtime.
    *   Displays hero section, metric cards, charts, and leaderboards.

## Customization Guide

### Branding & Content (`site/config.json`)

```json
{
  "organization": {
    "name": "CivicActions",
    "tagline": "Building in the open, together",
    "description": "Your transparency statement...",
    "githubOrg": "civicactions",
    "website": "https://civicactions.com"
  },
  "branding": {
    "primaryColor": "#004488",
    "primaryLightColor": "#0066bb",
    "accentColor": "#107c10"
  },
  "transparency": {
    "whyOpen": {
      "enabled": true,
      "items": [
        {
          "icon": "🌍",
          "title": "Your Value",
          "description": "Why this matters to you..."
        }
      ]
    }
  },
  "metrics": {
    "cards": [
      {
        "id": "total_contributions",
        "title": "Total Contributions",
        "icon": "🚀",
        "enabled": true
      }
    ]
  }
}
```

### Data Collection (`scripts/config.json`)

```json
{
  "orgAllowlist": ["your-org", "partner-org"],
  "historyWeeks": 260,
  "maxWeeksPerRun": 10,
  "collectAllPublic": false,
  "licenseFilter": "oss"
}
```

Options:
- `orgAllowlist`: List of GitHub organizations to track
- `historyWeeks`: How far back to collect data (default: 260 weeks / 5 years)
- `collectAllPublic`: Track all public repos (not just org repos) for staff members
- `licenseFilter`: "oss" (only open source) or "all"

## Setup & Local Development

### Prerequisites

*   Node.js 20+
*   A GitHub Personal Access Token (classic) with `read:org` scope (if you want to run the data collection locally).

### Install Dependencies

Root (for scripts):
```bash
npm install
```

Site (for frontend):
```bash
cd site
npm install
```

### Running the Data Pipeline Locally

1.  Create a `.env` file in the root with your GitHub token:
    ```
    GITHUB_TOKEN=ghp_your_token_here
    ```
    (Note: The scripts use `process.env.GITHUB_TOKEN`. If running locally, you might need to load dotenv or export the variable in your shell).

2.  Run the update script:
    ```bash
    export GITHUB_TOKEN=...
    npm run update
    ```
    This will create/update `data/participation.sqlite`.

3.  Export the metrics JSON:
    ```bash
    npm run export
    ```
    This generates `data/metrics.json`.

### Running the Frontend Locally

1.  Make sure `data/metrics.json` exists (see above).
2.  Copy `data/metrics.json` to `site/public/data/` (config.json is automatically copied by Vite):
    ```bash
    mkdir -p site/public/data
    cp data/metrics.json site/public/data/
    ```
3.  Start Vite:
    ```bash
    cd site
    npm run dev
    ```
4.  Open http://localhost:5173 in your browser

> **Note**: The build process automatically copies `site/config.json` to `site/public/config.json`, so you only need to maintain the single source file at `site/config.json`.

### Reprocessing history after allowlist changes

If you change the org allowlist or staff allowlist and need historical data recomputed with the new lists:

1. Update allowlists: set `ORG_ALLOWLIST` repo variable and/or `STAFF_ALLOWLIST_JSON` secret (JSON array of usernames). Keep them public-only per AGENTS.md rules.
2. Trigger **Update participation data** via **Run workflow** and supply one of:
   - `reprocess_from_week` (YYYY-MM-DD Monday) to restart from that week, or
   - `reprocess_weeks` (number) to rebuild that many full weeks back from the last complete week.
   These map to `REPROCESS_FROM_WEEK` / `REPROCESS_WEEKS` envs consumed by `scripts/update_sqlite.mjs`.
3. Let the workflow finish; it will rewrite `data/participation.sqlite` and `data/metrics.json` for the specified window, then the Pages deploy will publish the new aggregates.

## Deployment

The dashboard is automatically deployed to GitHub Pages via GitHub Actions:

1. Workflow runs weekly (or manually triggered)
2. Collects latest metrics from GitHub API
3. Builds the static site
4. Deploys to GitHub Pages

No runtime API calls are needed - everything is pre-generated!

## Inspired By

This project is inspired by the open startup movement and transparency pages like:
- [cal.com/open](https://cal.com/open) - Open startup transparency
- [Buffer's Open page](https://buffer.com/open) - Revenue and metrics transparency  
- [Ghost's Open page](https://ghost.org/open) - Open source product metrics

## Contributing

Contributions are welcome! This project is designed to be:
- Easy to fork and customize for any organization
- Privacy-focused (public data only)
- Performant (static site, no runtime API calls)
- Extensible (add your own metrics and visualizations)

## License

MIT
