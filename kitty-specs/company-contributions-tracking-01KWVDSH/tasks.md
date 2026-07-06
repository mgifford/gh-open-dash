# Tasks: Company & Team Contribution Attribution

**Input**: [plan.md](./plan.md), [spec.md](./spec.md)
**Status**: Backfilled — every task below was already implemented, tested, and
committed on `claude/company-contributions-tracking-u22693` (commits `ffb1cc7`
and `40ee172`) before these work packages were authored. Checkboxes are
checked to reflect actual completed status, not planned status.

## Subtask Index

| ID | Description | WP | Parallel |
|---|---|---|---|
| T001 | Create `scripts/company_roster.json` seeded from `staff_allowlist.json` | WP01 | |
| T002 | Implement `scripts/company_collector.mjs`: `createCompanyTable`, roster lookup, batched GraphQL profile fallback, caching/refresh window | WP01 | |
| T003 | Wire `collectCompanyData` config flag + table init + once-per-run collection call into `scripts/update_sqlite.mjs` | WP01 | |
| T004 | Add `--collectCompanyData` flag to `scripts/set_config.mjs` | WP01 | |
| T005 | Export `contributor_company` map in `scripts/export_metrics.mjs` | WP02 | [P] |
| T006 | Extend per-repo-per-week aggregation with `byAuthor` breakdown in `scripts/export_metrics.mjs` | WP02 | [P] |
| T007 | Validate export pipeline against a hand-built SQLite fixture (manual smoke test, no automated harness exists for `.mjs` collectors) | WP02 | |
| T008 | Build `site/src/companyImpact.js` (repo star weighting + company impact aggregation) | WP03 | |
| T009 | Build `site/src/CompanyFlow.jsx` (flow diagram + accessible table) | WP03 | [P] |
| T010 | Build `site/src/CompanyLeaderboard.jsx` (raw count / Impact Score sort toggle) | WP03 | [P] |
| T011 | Wire new "Companies" tab into `site/src/App.jsx` | WP03 | |
| T012 | Write CompanyFlow.test.jsx, CompanyLeaderboard.test.jsx (incl. impact-score ranking) | WP03 | |
| T013 | Build `site/src/ProjectHistory.jsx` (per-project weekly history by company + accessible table) | WP04 | [P] |
| T014 | Add company badges to top-contributors list and embed ProjectHistory in `site/src/Projects.jsx` repo detail | WP04 | |
| T015 | Write ProjectHistory.test.jsx | WP04 | |
| T016 | Update README.md, AGENTS.md, FEATURES.md, SBOM.md, and README AI-disclosure table | WP04 | |
| T017 | Full regression pass: `npm run test -- --run` (249/249 passing) and `npm run build`; manual Playwright screenshot verification of Companies tab, data-table toggle, and per-project history panel | WP04 | |

## Work Packages

### WP01 — Company/team attribution collector (data pipeline)

- **Goal**: Attribute every distinct contributing GitHub author to a company/team, roster-first with a bounded public-profile fallback, gated behind an opt-in config flag.
- **Priority**: P1 (foundation — everything else depends on this data existing)
- **Independent test**: Run the collector against a fixture DB with a roster hit, a profile-fallback hit, and a bot account; confirm `contributor_company` rows match expectations (roster wins, profile fetched only for non-roster/non-bot authors, bot gets null company with no API call).
- **Requirements covered**: FR-001, FR-002, FR-003, FR-004, NFR-001, NFR-003, C-002
- **Subtasks**: [x] T001 [x] T002 [x] T003 [x] T004
- **Status**: Done (implemented in commit `ffb1cc7`)
- **Dependencies**: none
- **Risks (as encountered)**: batched GraphQL alias queries needed per-alias error tolerance for renamed/deleted accounts — resolved by mapping failed aliases to `null` rather than aborting the batch.

### WP02 — Metrics export surface

- **Goal**: Make company attribution and per-week/per-author repo detail available in `metrics.json` without new runtime API calls.
- **Priority**: P1
- **Independent test**: Export against the same fixture DB and confirm `metrics.json` contains a `contributor_company` map and `repos[].weekly[].byAuthor` entries with correct per-author counts.
- **Requirements covered**: FR-005, FR-006
- **Subtasks**: [x] T005 [x] T006 [x] T007
- **Status**: Done (implemented in commit `ffb1cc7`; verified manually against a hand-built fixture DB — see plan.md Testing note)
- **Dependencies**: WP01 (needs `contributor_company` table to exist)
- **Risks (as encountered)**: none blocking; noted `metrics.json` size grows with active author-repo-week combinations, acceptable at current scale.

### WP03 — Companies dashboard view (flow diagram + leaderboard + Impact Score)

- **Goal**: Visualize company-to-project contribution flow and rank companies by raw volume or reach-weighted Impact Score.
- **Priority**: P1
- **Independent test**: Render `CompanyFlow`/`CompanyLeaderboard` against fixture repos/contributorCompany/repoStars data; confirm empty states, accessible table toggle, and impact-vs-raw sort ordering.
- **Requirements covered**: FR-007, FR-008, FR-009, FR-010, FR-013, NFR-002, NFR-004, C-001
- **Subtasks**: [x] T008 [x] T009 [x] T010 [x] T011 [x] T012
- **Status**: Done (implemented in commits `ffb1cc7` and `40ee172`; 12 tests passing across CompanyFlow.test.jsx and CompanyLeaderboard.test.jsx)
- **Dependencies**: WP02
- **Risks (as encountered)**: log-scaled star weighting is a design choice (documented as accepted constraint C-001), not a validated-optimal formula.

### WP04 — Per-project history, contributor badges, docs, and verification

- **Goal**: Show a project's contribution history broken down by company, label top contributors with their company, and bring documentation/tests/verification in line with the shipped feature.
- **Priority**: P2
- **Independent test**: Render `ProjectHistory` against fixture weekly/byAuthor data; confirm chart + table toggle. Full suite run confirms no regressions.
- **Requirements covered**: FR-011, FR-012, FR-013, NFR-004, NFR-005
- **Subtasks**: [x] T013 [x] T014 [x] T015 [x] T016 [x] T017
- **Status**: Done (implemented in commit `ffb1cc7`; docs/tests verified — 249/249 vitest tests passing, production build succeeds, manual Playwright screenshots confirm rendering)
- **Dependencies**: WP02
- **Risks (as encountered)**: none blocking.

## Parallel Opportunities

WP03 and WP04 both depend only on WP02 (not on each other) and touch disjoint
file sets (`CompanyFlow.jsx`/`CompanyLeaderboard.jsx`/`companyImpact.js`/`App.jsx`
vs. `ProjectHistory.jsx`/`Projects.jsx`/docs) — they could have been executed
in parallel lanes. In practice they were implemented sequentially in a single
session, which is why both landed in the same first commit.

## MVP Scope

WP01 + WP02 constitute the minimum viable slice (data pipeline + export); WP03
is the first user-visible surface and would be the natural "ship it" cut point
if this had been staged incrementally.
