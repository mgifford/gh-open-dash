---
work_package_id: WP04
title: Per-project history, contributor badges, docs and verification
dependencies:
- WP02
requirement_refs:
- FR-011
- FR-012
- FR-013
- NFR-004
- NFR-005
tracker_refs: []
planning_base_branch: claude/company-contributions-tracking-u22693
merge_target_branch: claude/company-contributions-tracking-u22693
branch_strategy: Planning artifacts for this mission were generated on claude/company-contributions-tracking-u22693. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/company-contributions-tracking-u22693 unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
- T017
agent: "claude"
assignee: "claude"
history:
- event: implemented
  note: Landed in commit ffb1cc7 on claude/company-contributions-tracking-u22693, prior to this WP file being authored (backfill).
agent_profile: frontend-freddy
authoritative_surface: site/src/ProjectHistory.jsx
create_intent: []
execution_mode: code_change
owned_files:
- site/src/ProjectHistory.jsx
- site/src/Projects.jsx
- site/src/__tests__/ProjectHistory.test.jsx
- README.md
- AGENTS.md
- FEATURES.md
- SBOM.md
role: implementer
status: done
tags: []
---

## ⚡ Do This First: Load Agent Profile

This WP is a **backfilled record of already-completed work**. The profile
above (`frontend-freddy`) documents which persona's skill set the work
matches, for retrospective reporting only.

## Objective

Show a project's contribution history broken down by contributing company,
label top contributors with their known company, and bring project
documentation and the automated test suite in line with the shipped
feature.

## Context

This WP builds the second user-facing surface on WP02's exported data: a
per-project (rather than cross-project) view, embedded into the existing
repo-detail drill-down in `Projects.jsx` rather than as a separate page —
consistent with how that component already handles repo selection.

## Subtasks

### T013 — `site/src/ProjectHistory.jsx`

Given a single repo object (with `weekly[].byAuthor`) and the
`contributorCompany` map: aggregates each week's `byAuthor` counts into
per-company totals, buckets to the top 6 companies + an "Other" bucket,
and renders a stacked-bar SVG chart (one bar per week, segmented by
company color) with the same accessible-table-toggle pattern used in
`CompanyFlow.jsx` for consistency. Handles missing repo / empty history
with a clear message instead of an empty chart.

**Files**: `site/src/ProjectHistory.jsx` (new)

### T014 — Company badges + embed in `Projects.jsx`

- `RepoCard`'s top-contributors list now shows `(company)` next to each
  contributor's name when `contributorCompany[author].company` is known.
- The repo-detail panel (shown when a repo is selected from the bubble
  chart or grid) now renders `<ProjectHistory>` below the existing
  `<RepoCard>`.
- `contributorCompany` threaded through as a new prop from `App.jsx` →
  `Projects.jsx` → `RepoCard`/`ProjectHistory`.

**Files**: `site/src/Projects.jsx` (modified)

### T015 — Tests

`ProjectHistory.test.jsx` (5 tests: empty weekly history, missing repo,
default chart render with legend, table-toggle with week/company/count
columns, "Unattributed" bucketing).

**Files**: `site/src/__tests__/ProjectHistory.test.jsx` (new)

### T016 — Documentation

- `README.md`: feature bullet, a dedicated "Company & Team Attribution"
  section (roster + fallback explanation, `collectCompanyData` config,
  what the Companies tab and project history show, Impact Score
  explanation with a link to the Drupal.org marketplace docs that inspired
  it), and a new AI-disclosure table row for this work.
- `AGENTS.md`: `contributor_company` added to the documented SQLite schema,
  a new "Company/team attribution (optional)" subsection explaining the
  roster-priority/profile-fallback design and its privacy posture, and a
  new verification-checklist line.
- `FEATURES.md`: a "Company & Team Attribution (Optional)" feature-list
  section, including the Impact Score explanation.
- `SBOM.md`: reviewed and the "last reviewed" line updated to record that
  no new dependency was introduced by this feature.

**Files**: `README.md`, `AGENTS.md`, `FEATURES.md`, `SBOM.md` (all modified)

### T017 — Full verification pass

- `npm run test -- --run` in `site/`: 249/249 tests passing (up from 228
  before this mission).
- `npm run build` in `site/`: production build succeeds, no new warnings.
- Manual Playwright screenshot verification (against a hand-built fixture
  `metrics.json`) of: the Companies tab flow diagram, its accessible-table
  toggle, and the per-project history panel with company badges — confirms
  all three render correctly end-to-end, not just in unit tests.

**Files**: none (verification step only)

## Definition of Done (verified, retrospectively)

- [x] Per-project history renders for any repo with weekly data, with a
      working accessible-table toggle.
- [x] Top-contributor company badges appear wherever a company is known.
- [x] `README.md`, `AGENTS.md`, `FEATURES.md`, `SBOM.md` all updated and
      internally consistent with the shipped feature.
- [x] Full vitest suite passes (249/249); production build succeeds.
- [x] Manual Playwright screenshots confirm real-browser rendering of all
      three new UI surfaces (not just jsdom unit tests).

## Risks / Notes (as encountered)

- None blocking. The same bucketing/accessible-table pattern from WP03 was
  reused deliberately here for UI consistency rather than inventing a
  second interaction pattern.

## Activity Log

- 2026-07-06T10:07:18Z – user – Backfill: implementation already existed in commit ffb1cc7/40ee172 before mission tracking was set up.
- 2026-07-06T10:08:50Z – claude – Backfill: implementation, tests, and docs already existed and were verified before mission tracking was set up.
