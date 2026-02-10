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
- After changing `scripts/config.json` you must re-run the collector and exporter to apply the new configuration:

```
node scripts/update_sqlite.mjs
node scripts/export_metrics.mjs
```

Note: changing to `collectAllPublic=true` can dramatically increase API usage; only enable it when you have monitoring and adequate rate-limit capacity.

When you change collector configuration, re-run `scripts/update_sqlite.mjs` to apply new collection rules and then `scripts/export_metrics.mjs` to refresh `data/metrics.json`.

### Incremental processing
- Track last processed week in `meta.processed_through_week`.
- Default initial history window is configurable via env (e.g., `HISTORY_WEEKS`, up to 260 weeks for 5-year history).

### Staff allowlist (segmentation only)
- You may maintain a staff GitHub username allowlist to slice/segment aggregates (e.g., to show staff vs. all contributors) after collection.
- Collection remains org-wide (no per-person queries). Do not change query scope or add per-person API calls.

## Publishing rules

- GitHub Actions updates:
  - `data/participation.sqlite`
  - `data/metrics.json`
- The Pages build must copy `data/metrics.json` into `site/public/data/metrics.json`.
- The deployed site must not call GitHub APIs at runtime.

## Adding a “deeper” page later

Allowed:
- Additional aggregated dimensions (by repo, by metric type, by time range)
- Repo-level breakdowns **only as counts**, with no links/titles.

Not allowed:
- Any page that displays issue/PR content or links.
- Any approach that requires per-item fetching beyond org-wide weekly search unless it is strictly bounded and justified.

## Verification checklist before merge

- [ ] `data/metrics.json` contains only weeks/authors/counts (no titles/urls/text).
- [ ] GraphQL queries are org-wide by week (not per-person/per-repo loops).
- [ ] Current partial week is excluded.
- [ ] OSS license filtering is applied consistently via allowlist.
- [ ] `deploy-pages.yml` copies `data/metrics.json` into `site/public/data/`.
 - [ ] Closed metrics (`pr_closed`, `issue_closed`) are present in `data/metrics.json` after export.
 - [ ] `scripts/config.json` flags `collectAllPublic` and `licenseFilter` are documented and used intentionally.