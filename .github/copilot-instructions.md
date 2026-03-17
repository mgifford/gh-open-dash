# Copilot Instructions

## Primary references

- **[AGENTS.md](../AGENTS.md)** — the authoritative guide for all coding agents working on this repository. Read it first and follow every rule it contains.
- **[ACCESSIBILITY.md](../ACCESSIBILITY.md)** — the full accessibility policy (WCAG 2.2 AA). All UI changes must satisfy the requirements in this file.

---

## Repository at a glance

This repository builds and publishes a **GitHub Pages dashboard** for public, open-source-licensed contribution metrics in the CivicActions GitHub organization (and a configurable list of additional public orgs).

| Layer | Technology |
|---|---|
| Data collection | Node.js scripts (`scripts/`) using GitHub GraphQL API |
| Data store | SQLite (`data/participation.sqlite`) |
| Published aggregate | `data/metrics.json` |
| Dashboard UI | React + Vite (`site/`) with Chart.js visualisations |
| CI / deployment | GitHub Actions (`update-metrics.yml`) → GitHub Pages |

---

## Non-negotiable constraints (summary — see AGENTS.md for full rules)

1. **Public repos only.** Never fetch or expose private repository data.
2. **No content leakage.** Store and publish counts only — no issue/PR titles, URLs, body text, comments, labels, or review text.
3. **Rate-limit safe.** Use org-wide weekly GraphQL searches; per-person queries only for the configured `staff_allowlist`.
4. **Complete weeks only.** Bucket data by week starting Monday (UTC); exclude the current partial week.
5. **OSS-licensed repos only** (default). Enforce via `scripts/oss_spdx_allowlist.json` and the `licenseFilter` config setting.

---

## Key files and directories

```
scripts/
  config.json              # Collector configuration (orgAllowlist, historyWeeks, licenseFilter, …)
  update_sqlite.mjs        # Main data collector (writes to SQLite)
  export_metrics.mjs       # Exports SQLite → data/metrics.json
  copy_metrics_to_site.mjs # Copies metrics.json into site/public/data/
  set_config.mjs           # Helper CLI to edit config.json
  oss_spdx_allowlist.json  # Allowlist of acceptable OSS SPDX identifiers

data/
  participation.sqlite     # Source-of-truth SQLite cache (not committed to git in production)
  metrics.json             # Published aggregate (counts only)

site/
  src/                     # React components and tests
  public/data/             # metrics.json served by the built site
  config.json              # Site-level customisation (org name, tagline, …)

.github/workflows/         # GitHub Actions workflows
```

---

## Development workflow

### Run the full data pipeline locally

```bash
node scripts/update_sqlite.mjs          # Collect data from GitHub API
node scripts/export_metrics.mjs         # Export to data/metrics.json
node scripts/copy_metrics_to_site.mjs   # Copy into site/public/data/
```

### Run the dashboard site locally

```bash
cd site
npm install
npm run dev
```

### Run tests

```bash
cd site
npm test
```

### Lint

```bash
cd site
npm run lint
```

### Update collector configuration

```bash
node scripts/set_config.mjs --collectAllPublic=true --licenseFilter=all
```

---

## Accessibility requirements (summary — see ACCESSIBILITY.md for full policy)

- Target: **WCAG 2.2 AA** for all dashboard UI and documentation.
- Use semantic HTML and proper ARIA attributes in every React component.
- All interactive controls (buttons, dropdowns, selectors) must be keyboard-operable.
- Color-contrast ratios: ≥ 4.5:1 for normal text, ≥ 3:1 for large text.
- Chart.js canvas charts must have an accessible alternative (`aria-label`, data table, or descriptive text).
- Use inclusive, person-centered language in user-facing copy.
- Tag accessibility-related issues/PRs with the `accessibility` label.

---

## Pre-merge checklist (from AGENTS.md)

- [ ] `data/metrics.json` contains only weeks / authors / counts — no titles, URLs, or text.
- [ ] GraphQL queries are org-wide by week, not per-person or per-repo loops.
- [ ] Current partial week is excluded.
- [ ] OSS license filtering is applied consistently via the allowlist.
- [ ] `data/metrics.json` is present in the deployed Pages site.
- [ ] Closed metrics (`pr_closed`, `issue_closed`) are present in `data/metrics.json` after export.
- [ ] `scripts/config.json` flags `collectAllPublic` and `licenseFilter` are used intentionally.
- [ ] UI changes meet WCAG 2.2 AA (keyboard access, contrast, ARIA labels, chart alternatives).

---

## Errors and workarounds

_Document any errors encountered during agent work and how they were resolved here._
