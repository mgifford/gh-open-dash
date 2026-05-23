### Staff commit collection

- A configurable `collectStaffCommits` flag (default: `false`) allows the collector to run weekly, time-bounded commit searches for users in the `staff_allowlist` and record counts of commits to public repositories they authored.
- This mode only runs per-user for staff-allowlisted usernames to limit rate-limit and privacy exposure.
- When enabled the collector writes into a `commits(week_start, author, repo, spdx)` table and the exporter includes `commits` as a metric in `data/metrics.json`.
- The collector still enforces `licenseFilter: "oss"` unless configured otherwise; repo license lookups are cached during a run to limit extra API calls.

# AGENTS.md

This repository builds and publishes a GitHub Pages dashboard for **public, open-source-licensed** contribution metrics in the CivicActions GitHub organization.

## Non-negotiable constraints

1. **Public repos only**
   - Do not fetch or include private repo data.
   - Do not require elevated org permissions.

1a. **Multiple public orgs allowed**
   - You may query a configured allowlist of public GitHub orgs (e.g., `civicactions` plus partners/upstreams) using the same weekly, org-wide searches.
   - Keep requests org-scoped to remain rate-limit safe unless using the staff per-person mode described below.

1b. **Staff per-person mode (public only)**
   - You may run weekly, time-bounded, per-person queries for users in the configured staff allowlist to capture their public activity across all public repos (including personal and other-org repos), still respecting all other constraints below.
   - Per-person queries MUST be limited to the staff allowlist; do not query arbitrary users.
   - Keep weekly windows and counts-only responses to stay rate-limit safe.

2. **No content leakage**
    - The dataset MUST NOT contain any of:
       - Issue/PR titles
       - URLs/links
       - Body text
       - Comments
       - Labels
       - Review text
    - Store and publish counts only. Repo names are allowed.

3. **Rate-limit safe**
   - Default mode: org-wide weekly queries across the allowed org list.
   - Staff mode: per-person weekly queries ONLY for staff allowlist users; no arbitrary users. Keep weekly windows and minimal fields.
   - Keep GraphQL requests bounded by weekly activity.

3a. **Optional all-public mode (careful)**
   - A configurable `collectAllPublic` mode is available for collectors that will run the same weekly queries across *all public repositories* (not limited to the configured org allowlist).
   - This mode is opt-in only and may dramatically increase GraphQL usage and rate-limit pressure. Only enable when you have capacity and monitoring.

4. **Week-by-week, complete weeks only**
   - Bucket weeks starting Monday (UTC).
   - Exclude the current partial week.
   - Default backfill window is configurable (e.g., up to 260 weeks for 5-year history); still process in weekly buckets.

5. **Open source licensed only**
   - By default the collector enforces OSS-only filtering using `scripts/oss_spdx_allowlist.json`.
   - The collector also supports a `licenseFilter` config with values `oss` (default) or `all`.
      - `oss`: require `repository.licenseInfo.spdxId` to be present and in the allowlist.
      - `all`: include repositories regardless of license metadata (use with caution and double-check policies).
   - Treat `null`, `NOASSERTION`, or unknown SPDX ids as **not open source** when `licenseFilter` is `oss`.

## Definitions used by this repo

For phase 1, “contributions” are:
- **PRs opened** in the week (attributed to PR author)
- **PRs merged** in the week (attributed to PR author, not merger)
- **Issues opened** in the week (attributed to issue author)

No commit-based metrics in phase 1.

## Data pipeline rules

### Source of truth
- SQLite cache: `data/participation.sqlite`
- Published aggregate: `data/metrics.json`

### SQLite schema (must stay minimal)
Tables:
- `pr_opened(week_start, author, repo, spdx)`
- `pr_merged(week_start, author, repo, spdx)`
- `pr_closed(week_start, author, repo, spdx)`
- `issue_opened(week_start, author, repo, spdx)`
- `issue_closed(week_start, author, repo, spdx)`
- `meta(key, value)`

Primary keys prevent duplicates:
- `(week_start, author, repo)`

### GraphQL usage
- Org mode: `search` with `type: ISSUE` and qualifiers per allowed org:
   - `org:ORGNAME is:pr created:START..END`
   - `org:ORGNAME is:pr merged:START..END`
   - `org:ORGNAME is:issue created:START..END`
   - Closed events can be collected by using `is:pr closed:START..END` and `is:issue closed:START..END` when you opt to include closed metrics.
- Staff per-person mode: for each staff allowlist user, weekly queries limited to public data, e.g. `author:USERNAME is:pr created:START..END`, `author:USERNAME is:issue created:START..END`, and similar for merged PRs using `involves:` or other bounded qualifiers, while still filtering by OSS license.
- Fetch only:
   - `author.login`
   - `repository.nameWithOwner`
   - `repository.licenseInfo.spdxId`
   - timestamps as needed

### Collector configuration
- `scripts/config.json` exposes:
   - `orgAllowlist`: array of orgs to query (existing)
   - `historyWeeks`: how far to backfill
   - `maxWeeksPerRun`: how many weekly buckets to process per run
   - `collectAllPublic`: boolean; when `true` the collector will run queries across all public repos (opt-in, rate-limit heavy)
   - `licenseFilter`: `oss` (default) or `all`

There is a tiny helper CLI to update `scripts/config.json`:

```
node scripts/set_config.mjs --collectAllPublic=true --licenseFilter=all
```

#### What that command does

   - Runs the small helper `scripts/set_config.mjs` which edits `scripts/config.json`.
   - `--collectAllPublic=true` sets the `collectAllPublic` flag to `true`, telling the collector to run weekly queries across all public repositories (opt-in; may increase GraphQL usage and rate-limit pressure).
   - `--licenseFilter=...` sets `licenseFilter` to either `oss` (default) or `all`. Using `oss` restricts results to repositories whose `repository.licenseInfo.spdxId` is in `scripts/oss_spdx_allowlist.json`.

After changing `scripts/config.json` you have two options to apply the new configuration:

- Run locally (for development):

```
node scripts/update_sqlite.mjs
node scripts/export_metrics.mjs
node scripts/copy_metrics_to_site.mjs
```

   This updates `data/participation.sqlite`, regenerates `data/metrics.json` (including per-repo aggregates), and copies the result into `site/public/data/metrics.json` for local testing.

- Use the automated GitHub Actions workflow `update-metrics.yml` (recommended for production): the workflow runs the collector and exporter on Node 18, builds the site, and deploys the Pages site with the generated metrics included. You can trigger it manually via the Actions UI or wait for the scheduled weekly run.

Note: enabling `collectAllPublic=true` can dramatically increase API usage; only enable it when you have monitoring and adequate rate-limit capacity.

### Incremental processing
- Track last processed week in `meta.processed_through_week`.
- Default initial history window is configurable via env (e.g., `HISTORY_WEEKS`, up to 260 weeks for 5-year history).

### Staff allowlist (segmentation only)
- You may maintain a staff GitHub username allowlist to slice/segment aggregates (e.g., to show staff vs. all contributors) after collection.
- Collection remains org-wide (no per-person queries). Do not change query scope or add per-person API calls.

## Publishing rules

- GitHub Actions updates the source SQLite cache and the exported metrics via the `update-metrics.yml` workflow (or equivalent).
- The repository's Pages deployment is built from the `site` output and the workflow ensures the generated `site/public/data/metrics.json` is included in the deployed site.
- The deployed site must not call GitHub APIs at runtime.

## Adding a “deeper” page later

Allowed:
- Additional aggregated dimensions (by repo, by metric type, by time range)
- Repo-level breakdowns **only as counts**, with no links/titles.

Not allowed:
- Any page that displays issue/PR content or links.
- Any approach that requires per-item fetching beyond org-wide weekly search unless it is strictly bounded and justified.

## Accessibility requirements

This project commits to **WCAG 2.2 AA** for all dashboard UI and documentation. See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for the full policy.

When contributing UI changes, agents must:

- Use semantic HTML and proper ARIA attributes in React components.
- Ensure all interactive controls (buttons, dropdowns, selectors) are keyboard-operable.
- Verify color-contrast ratios meet WCAG 2.2 AA (4.5:1 for normal text, 3:1 for large text).
- Provide accessible alternatives for Chart.js canvas charts (e.g., `aria-label`, descriptive text, or a data table).
- Use inclusive, person-centered language in any user-facing copy.

When an accessibility issue is found:

- Tag the GitHub issue or PR with the `accessibility` label.
- Classify severity using the taxonomy in [ACCESSIBILITY.md §4](./ACCESSIBILITY.md#4-reporting--severity-taxonomy).

## AI disclosure requirement

This project is committed to transparency about how AI is used. AI agents and human contributors alike **must** keep the `README.md` AI Disclosure section accurate and up to date.

- When an AI agent (e.g., GitHub Copilot, Claude, GPT, Gemini) contributes code, documentation, or configuration, it **must** add or update an entry for itself in the **AI Disclosure** section of `README.md`.
- Each entry must state: the AI tool/model name, what it was used for (e.g., writing code, generating documentation, reviewing PRs), and whether it is used at runtime or only during development/build.
- Do **not** list AI tools that were not actually used in this project.
- AI is not used at runtime by the dashboard and no browser-based AI features are enabled; entries should reflect this accurately.
- The AI Disclosure section must distinguish between: (a) AI used to build or maintain the project, (b) AI used during CI/CD or data collection, and (c) AI running in the user's browser.

## Security review requirement

Security review must be treated as a recurring requirement for every meaningful change.

- Review changes for data exposure, dependency risk, and workflow/automation risk before merge.
- Keep `SBOM.md` current with direct software dependencies, resolved versions, and license identifiers.
- Run repository validation commands after updates and address any security-relevant findings before merge.

## Verification checklist before merge

- [ ] `data/metrics.json` contains only weeks/authors/counts (no titles/urls/text).
- [ ] GraphQL queries are org-wide by week (not per-person/per-repo loops).
- [ ] Current partial week is excluded.
- [ ] OSS license filtering is applied consistently via allowlist.
 - [ ] `data/metrics.json` is present in the deployed Pages site (workflow `update-metrics.yml` produces and includes it).
 - [ ] Closed metrics (`pr_closed`, `issue_closed`) are present in `data/metrics.json` after export.
 - [ ] `scripts/config.json` flags `collectAllPublic` and `licenseFilter` are documented and used intentionally.
 - [ ] UI changes meet WCAG 2.2 AA (keyboard access, contrast, ARIA labels, chart alternatives).
 - [ ] If an AI agent contributed to this PR, the `README.md` AI Disclosure section has been updated to reflect that contribution.
 - [ ] Security review was completed and `SBOM.md` is up to date with versions and licenses.

## GitHub Pages consolidation and ensuring `main` is authoritative

- **Goal:** Keep the repository canonical on `main` and avoid a separate long-lived `gh-pages` branch that causes confusion.

- **Quick overview:** There are two common deployment patterns for GitHub Pages used by repositories like this:
   - Serve the built site from the `gh-pages` branch (typical when using actions that push built output to that branch).
   - Serve the built site from the `main` branch (by committing build output into a folder such as `/docs` or `/site/dist`).

- **Consolidate `gh-pages` into `main` (safe steps):**
   1. Fetch the published branch and create a temporary working branch locally:

       ```bash
       git fetch origin gh-pages:tmp-gh-pages
       git checkout main
       git pull origin main
       ```

   2. Copy the content from `tmp-gh-pages` into your chosen location on `main` (example uses `site/dist` — adjust to your build output folder):

       ```bash
       git checkout tmp-gh-pages
       rsync -a --delete ./ ./site/dist/
       git checkout main
       git add site/dist
       git commit -m "Import published site from gh-pages into main/site/dist"
       git push origin main
       ```

   3. Verify the imported files look correct on `main` (via GitHub UI or a local build). When satisfied, delete the temporary branch and (optionally) the remote `gh-pages` branch:

       ```bash
       git branch -D tmp-gh-pages
       git push origin --delete gh-pages
       ```

   4. Reconfigure GitHub Pages to serve from `main` and the folder you chose (e.g., `/site/dist` or `/docs`) in repository Settings → Pages.

- **Prevent future commits to `gh-pages`:**
   - Update your Actions workflows to stop pushing to `gh-pages`. Instead either:
      - Commit build artifacts into `main` (e.g., into `/site/dist` or `/docs`) as part of the workflow, or
      - Use an Action that deploys directly to Pages without creating a long-lived `gh-pages` branch (GitHub Pages can be served from `main`), or
      - If you still use `peaceiris/actions-gh-pages`, change the action to not create or push a permanent `gh-pages` branch (or remove it entirely).

- **Recommended workflow change:**
   - Have CI build the site and commit only the built `data/metrics.json` (and/or the build output into `site/dist`) to `main` (not the full DB). Keep the deployment step targeted at the Pages source you configured in the Settings panel.

- **Permissions & protection:**
   - Add a branch protection rule for `main` if you want to prevent accidental direct pushes, and limit who/what can update the Pages source.
   - Keep deploy tokens or secrets scoped to the CI job that is meant to publish (do not give broad push rights to other jobs).

- **If you want me to apply changes:** say which option you prefer (commit build output into `main/site/dist` or keep `gh-pages` and make `main` authoritative). I can then:
   - Update `.github/workflows/deploy-pages.yml` to stop pushing to `gh-pages` and instead copy into `site/dist` and commit to `main`,
   - Or remove the deploy push entirely and switch Pages settings to read from `main` after you import the files.
