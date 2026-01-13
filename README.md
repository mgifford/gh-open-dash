# CivicActions Open Source Participation Dashboard

This project builds and publishes a static dashboard of public open-source contributions by members of the `civicactions` GitHub organization.

## Purpose

To track and visualize engagement in open source projects over time, ensuring we are contributing back to the community.

## Architecture

This system allows us to publish metrics without exposing private data or hitting GitHub API rate limits at runtime.

1.  **Data Pipeline (`scripts/`)**:
    *   Runs weekly via GitHub Actions.
    *   Queries GitHub GraphQL API for PRs and Issues in `civicactions` org.
    *   Filters for repositories with Open Source licenses (SPDX allowlist).
    *   Stores counts in a local SQLite database (`data/participation.sqlite`) incrementally (only fetches new weeks).
    *   Exports aggregated anonymous JSON metrics to `data/metrics.json`.

2.  **Frontend (`site/`)**:
    *   A Vite + React static site.
    *   Deployed to GitHub Pages.
    *   Consumes `data/metrics.json` at runtime.
    *   Displays a leaderboard and weekly trend chart.

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
2.  Copy `data/metrics.json` to `site/public/data/` so Vite can serve it during dev:
    ```bash
    mkdir -p site/public/data
    cp data/metrics.json site/public/data/
    ```
3.  Start Vite:
    ```bash
    cd site
    npm run dev
    ```

## License

MIT
