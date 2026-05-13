# Definition of Done

This report is done when it satisfies the concrete project requirements below and is ready to publish as a public snapshot of open-source contribution activity.

## Report baseline for this repository

The current implementation and data pipeline already define much of the report scope:

- **Primary source of truth:** `/home/runner/work/gh-open-dash/gh-open-dash/data/metrics.json`
- **Published site copy:** `/home/runner/work/gh-open-dash/gh-open-dash/site/public/data/metrics.json`
- **Collector configuration:** `/home/runner/work/gh-open-dash/gh-open-dash/scripts/config.json`
- **Current configured org allowlist:** `civicactions`
- **Current history window:** `52` weeks
- **Current max processing window per run:** `4` weeks
- **Current collection flags:** `collectAllPublic=true`, `licenseFilter=all`, `collectStaffCommits=true`, `collectEcosystemsData=true`, `collectOpenContributions=false`
- **Current exported primary org:** `civicactions`
- **Current exported week range in `data/metrics.json`:** `2025-03-03` through `2026-05-04`

## Definition of done

### 1. The report states what it is reporting

- The report clearly says it is a **public GitHub contribution transparency report** for this dashboard project.
- The report names the organization or organizations represented in the exported data.
- The report states the reporting window using the actual first and last complete weeks present in the published metrics.
- The report makes clear that the data is aggregated by week and author.

### 2. The report matches the current data model

- The report is based on the generated JSON artifacts, not on manual counts.
- The report reflects the metrics currently produced by the export, which may include:
  - PRs opened
  - PRs merged
  - PRs closed
  - issues opened
  - issues closed
  - commits
  - comment-related activity when present in the export
  - ecosystem or repository metadata when enabled
- The report does not claim metrics that are not present in the generated data.
- `/home/runner/work/gh-open-dash/gh-open-dash/data/metrics.json` and `/home/runner/work/gh-open-dash/gh-open-dash/site/public/data/metrics.json` are intentionally aligned for the release, or any difference is explicitly explained before publication.

### 3. Time boundaries are correct

- Weeks are bucketed starting on **Monday (UTC)**.
- The current partial week is excluded from the published report.
- The date range shown in the report matches the actual exported weeks rather than a guessed or hard-coded range.

### 4. Privacy and policy constraints are satisfied

- The report uses **public data only**.
- The report publishes **counts and aggregates**, not issue titles, PR titles, links, body text, comments, labels, or review text.
- Any repository-level information shown stays within the repository policy: counts and allowed repo metadata only.
- The report reflects the configured license policy honestly. Right now that means the configuration is set to `licenseFilter=all`, so the report should not claim OSS-only filtering unless that setting is changed and the data is regenerated.
- If `collectAllPublic=true` remains enabled, the report should not imply collection is limited only to the configured org's repositories.

### 5. Known current configuration is accurately represented

- If staff commit collection is discussed, the report notes that `collectStaffCommits=true` is currently enabled.
- If ecosystem insights are discussed, the report notes that `collectEcosystemsData=true` is currently enabled.
- If open contributions descriptors are discussed, the report notes that `collectOpenContributions=false` is currently disabled unless the config changes.
- Any exclusions driven by `repoExcludePatterns` are acknowledged if they materially affect the report narrative.

### 6. The report is understandable to a public audience

- Headings and summary text use clear, inclusive language.
- A reviewer can understand what the report means without reading the source code or SQLite database.
- Charts or visual summaries have accessible supporting context consistent with `/home/runner/work/gh-open-dash/gh-open-dash/ACCESSIBILITY.md`.
- Any caveats, anomalies, or obvious gaps in the exported data are called out in plain language.

### 7. Supporting documentation is up to date

- Documentation reflects any new metrics, collection flags, or limitations introduced by the report.
- The report does not contradict `README.md`, `AGENTS.md`, or `ACCESSIBILITY.md`.
- The `README.md` AI Disclosure section records AI assistance used to create or revise this documentation.

### 8. Validation has been completed

- Relevant existing project validation has been run for the affected area.
- For this repository, that currently means using the existing site checks:
  - `cd /home/runner/work/gh-open-dash/gh-open-dash/site && npm test -- --run`
  - `cd /home/runner/work/gh-open-dash/gh-open-dash/site && npm run build`
- Any validation blockers that prevent those commands from running are documented before calling the work done.

### 9. The report is ready to publish

- The content is specific enough that a reviewer is not being handed a blank form to finish manually.
- The final document reflects the actual state of the repository at the time it is prepared.
- The report is ready to be included in the GitHub Pages publication workflow without requiring unpublished context or private follow-up notes.
