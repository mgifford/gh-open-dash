# AGENTS.md

This repository builds and publishes a GitHub Pages dashboard for **public, open-source-licensed** contribution metrics in the `civicactions` GitHub organization.

## Non-negotiable constraints

1. **Public repos only**
   - Do not fetch or include private repo data.
   - Do not require elevated org permissions.

1a. **Multiple public orgs allowed**
   - You may query a configured allowlist of public GitHub orgs (e.g., `civicactions` plus partners/upstreams) using the same weekly, org-wide searches.
   - Keep requests org-scoped (no per-repo/per-person queries) to remain rate-limit safe.

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
   - Do not query per-person or per-repo.
   - Use org-wide weekly queries across the allowed org list and aggregate locally.
   - Keep GraphQL requests bounded by weekly activity.

4. **Week-by-week, complete weeks only**
   - Bucket weeks starting Monday (UTC).
   - Exclude the current partial week.
   - Default backfill window is configurable (e.g., up to 260 weeks for 5-year history); still process in weekly buckets.

5. **Open source licensed only**
   - A repo counts only if `repository.licenseInfo.spdxId` is present and in `scripts/oss_spdx_allowlist.json`.
   - Treat `null`, `NOASSERTION`, or unknown SPDX ids as **not open source**.

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
- `issue_opened(week_start, author, repo, spdx)`
- `meta(key, value)`

Primary keys prevent duplicates:
- `(week_start, author, repo)`

### GraphQL usage
- Use `search` with `type: ISSUE` and qualifiers per allowed org:
   - `org:ORGNAME is:pr created:START..END`
   - `org:ORGNAME is:pr merged:START..END`
   - `org:ORGNAME is:issue created:START..END`
- Fetch only:
   - `author.login`
   - `repository.nameWithOwner`
   - `repository.licenseInfo.spdxId`
   - timestamps as needed

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