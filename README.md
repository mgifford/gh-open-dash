# Open Source Transparency Dashboard

An open-source transparency dashboard inspired by cal.com/open and other open startup initiatives. This project builds and publishes a beautiful static dashboard showing public open-source contributions by your GitHub organization.

![Transparency Dashboard](https://github.com/user-attachments/assets/880475a3-d679-4d2b-8888-e0956cf6989b)

## ✨ Features

- 🎯 **Modern Transparency Page**: Hero section, metric cards, and "Why We're Open" section
- 📊 **Enhanced Analytics**: Track PR success rates, merge times, PR sizes, and repository stars
- 🌐 **Ecosyste.ms Integration**: Repository health scores, dependency analysis, and community engagement metrics
- 📈 **Advanced Visualizations**: 
  - PR success rate (merged vs closed)
  - Issues vs PRs ratio over time
  - PR merge time and size trends
  - Repository stars ranking
  - Repository health scores (via Ecosyste.ms)
  - Dependency and impact analysis
  - Community engagement metrics
- 👥 **Contributor Leaderboard**: Celebrate your top contributors
- 📉 **Weekly Trends**: Visualize activity over time with interactive charts
- 🏢 **Multi-Organization Support**: Track multiple GitHub organizations
- 🔄 **Dynamic Organization Switching**: View any public organization's metrics via URL parameter or UI selector
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
  "licenseFilter": "oss",
  "collectEcosystemsData": false,
  "collectOpenContributions": false
}
```

Options:
- `orgAllowlist`: List of GitHub organizations to track
- `historyWeeks`: How far back to collect data (default: 260 weeks / 5 years)
- `collectAllPublic`: Track all public repos (not just org repos) for staff members
- `licenseFilter`: "oss" (only open source) or "all"
- `collectEcosystemsData`: Enable Ecosyste.ms integration for repository health and community metrics (default: false)
- `collectOpenContributions`: Check tracked repos for `.well-known/open-contributions.json` descriptors and surface them in the dashboard (default: false)

## Setup & Local Development

### Prerequisites

*   Node.js 24+
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

## Viewing Other Organizations

The dashboard supports viewing metrics for any public GitHub organization without forking or reconfiguring:

### URL Parameter Method

Add `?org=<orgname>` to the URL to view any organization's metrics:

```
https://your-dashboard-url.github.io/?org=openplus
https://your-dashboard-url.github.io/?org=civicactions
```

The URL parameter accepts:
- Organization name: `?org=openplus`
- Full GitHub URL: `?org=https://github.com/openplus`
- URL without scheme: `?org=github.com/openplus`

### UI Selector Method

At the bottom of the page, you'll find the "Choose Organization" section where you can:

1. Enter an organization name (e.g., `openplus`) or GitHub URL
2. Click "Apply" to switch organizations
3. Your choice is saved in browser localStorage and persists across page refreshes
4. Click "Reset" to return to the default organization

**Note**: The URL parameter always takes precedence over localStorage settings.

## Ecosyste.ms Integration

The dashboard can optionally integrate with [Ecosyste.ms](https://ecosyste.ms) to provide enhanced repository insights:

- **Repository Health Scores**: Automated health assessments (0-100%) based on activity and maintenance
- **Dependency Analysis**: Track dependencies and reverse dependencies (impact)
- **Community Engagement**: Issue resolution times, comment engagement, and contributor metrics
- **Maintenance Indicators**: Identify projects that need attention

To enable, set `"collectEcosystemsData": true` in `scripts/config.json`. See [ECOSYSTEMS_INTEGRATION.md](./ECOSYSTEMS_INTEGRATION.md) for details.

## Open Contributions Descriptor Integration

The dashboard can optionally discover and display [Open Contributions Descriptors](https://www.foo.be/2026/03/open-contributions-descriptor) published by tracked repositories.

A `.well-known/open-contributions.json` file is a machine-readable descriptor that a repository can publish to describe how it accepts contributions — types of work welcomed, contact points, policies, and more. This project aligns closely with that goal of mapping open-source contribution pathways.

When enabled, the collector:
1. Looks for `.well-known/open-contributions.json` in each tracked repository via the GitHub Contents API.
2. Stores whether a descriptor was found, and its parsed contents if present, in the SQLite cache.
3. Exports this data in `data/metrics.json` so the dashboard can display:
   - Which repos publish a descriptor (📄 badge on repo cards in the Projects view)
   - A dedicated **Open Contributions Descriptors** section with per-repo details

To enable, set `"collectOpenContributions": true` in `scripts/config.json`:

```bash
node scripts/set_config.mjs --collectOpenContributions=true
```

Then re-run the collector:

```bash
node scripts/update_sqlite.mjs
node scripts/export_metrics.mjs
```

## Inspired By

This project is inspired by the open startup movement and transparency pages like:
- [cal.com/open](https://cal.com/open) - Open startup transparency
- [Buffer's Open page](https://buffer.com/open) - Revenue and metrics transparency  
- [Ghost's Open page](https://ghost.org/open) - Open source product metrics

## AI Disclosure

This project is committed to transparency about AI usage. Below is a record of AI tools that have been used in this project and how they were used.

### AI used to build or maintain this project

| AI Tool | Model / Version | How it was used |
|---|---|---|
| [GitHub Copilot](https://github.com/features/copilot) (Coding Agent) | Claude Sonnet (via GitHub Copilot) | Used to write and refactor code, generate documentation, implement new features, and review pull requests throughout the development of this project. |

### AI used during CI/CD or data collection

None. The data collection scripts (`scripts/update_sqlite.mjs`, `scripts/export_metrics.mjs`) query the GitHub GraphQL API directly and do not use any AI or machine-learning services.

### AI running in the user's browser

None. The dashboard is a fully static site. No browser-based AI features are enabled. The deployed site makes no runtime API calls to any AI service.

---

> **Note for contributors and AI agents:** If you use an AI tool to contribute to this project, please add or update your tool's entry in the table above. See `AGENTS.md` for the full disclosure policy.

## Contributing

Contributions are welcome! This project is designed to be:
- Easy to fork and customize for any organization
- Privacy-focused (public data only)
- Performant (static site, no runtime API calls)
- Extensible (add your own metrics and visualizations)

## License

MIT
