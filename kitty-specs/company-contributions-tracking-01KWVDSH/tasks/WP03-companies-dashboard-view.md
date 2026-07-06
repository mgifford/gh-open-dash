---
work_package_id: WP03
title: Companies dashboard view (flow diagram, leaderboard, Impact Score)
dependencies:
- WP02
requirement_refs:
- C-001
- FR-007
- FR-008
- FR-009
- FR-010
- FR-013
- NFR-002
- NFR-004
tracker_refs: []
planning_base_branch: claude/company-contributions-tracking-u22693
merge_target_branch: claude/company-contributions-tracking-u22693
branch_strategy: Planning artifacts for this mission were generated on claude/company-contributions-tracking-u22693. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/company-contributions-tracking-u22693 unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
- T012
agent: claude
assignee: "claude"
history:
- event: implemented
  note: Core view landed in commit ffb1cc7; Impact Score sort + companyImpact.js added in commit 40ee172, both on claude/company-contributions-tracking-u22693, prior to this WP file being authored (backfill).
agent_profile: frontend-freddy
authoritative_surface: site/src/
create_intent: []
execution_mode: code_change
owned_files:
- site/src/companyImpact.js
- site/src/CompanyFlow.jsx
- site/src/CompanyLeaderboard.jsx
- site/src/App.jsx
- site/src/__tests__/CompanyFlow.test.jsx
- site/src/__tests__/CompanyLeaderboard.test.jsx
role: implementer
status: done
tags: []
---

## ⚡ Do This First: Load Agent Profile

This WP is a **backfilled record of already-completed work**. The profile
above (`frontend-freddy`) documents which persona's skill set the work
matches (React implementation + WCAG accessibility), for retrospective
reporting only.

## Objective

Give maintainers a company-centric view of contribution activity: which
companies contribute to which projects, and a leaderboard that can rank
companies by raw contribution volume or by a reach-weighted "Impact Score"
(the GitHub-native analog to Drupal.org's marketplace credit weighting).

## Context

This is the first user-facing surface built on top of WP02's exported data.
No new charting library was introduced — both visualizations are hand-
written SVG, matching this codebase's existing pattern of Chart.js for
standard charts but custom rendering for anything bespoke (see
`ProjectsBubble.jsx`), and keeping bundle size and dependency surface
unchanged (`SBOM.md` reviewed, no diff).

## Subtasks

### T008 — `site/src/companyImpact.js`

Pure, dependency-free aggregation functions:

- `computeRepoStarWeights(repoStars)`: for each repo, take the max observed
  star count across all weekly snapshots, weight = `1 + log10(1 + stars)`.
  Log scale chosen deliberately so a mega-project (100k+ stars) doesn't
  completely swamp the ranking the way a linear weight would.
- `computeCompanyImpact(repos, contributorCompany, repoStarWeights)`:
  aggregates, per company, `rawCount` (unweighted sum), `impactScore`
  (weighted sum), distinct contributor count, and a team breakdown.

**Files**: `site/src/companyImpact.js` (new)

### T009 — `site/src/CompanyFlow.jsx`

Company → project contribution flow diagram:

- Buckets to the top 8 companies / top 12 projects by volume, with an
  "Other companies" / "Other projects" catch-all so the diagram stays
  readable regardless of dataset size.
- Custom SVG: node rectangles sized proportional to total volume, bezier-
  curve links with stroke width proportional to link weight, `<title>`
  tooltips for hover detail.
- A visible toggle switches to a fully accessible `<table>` listing every
  company/team/contributor/project row — satisfies the WCAG 2.2 AA
  chart-alternative requirement in `ACCESSIBILITY.md` without needing
  `aria-label`-only workarounds on the SVG.
- Empty state (no company-attributed data yet) explains how to enable the
  feature rather than rendering a blank chart.

**Files**: `site/src/CompanyFlow.jsx` (new)

### T010 — `site/src/CompanyLeaderboard.jsx`

Company (and team) leaderboard:

- When only `items` (author-level, range/metric-filtered counts) and
  `contributorCompany` are supplied, groups by company and ranks by raw
  count — this path is unchanged from the original (pre-Impact-Score)
  implementation and keeps existing callers/tests working.
- When `repos` + `repoStars` are also supplied, additionally computes an
  Impact Score column via `companyImpact.js` and exposes a "Sort by:
  Impact Score / Contributions" control, defaulting to Impact Score.
- Team breakdown shown inline under the company name when known.

**Files**: `site/src/CompanyLeaderboard.jsx` (modified twice: initial version
in commit `ffb1cc7`, Impact Score addition in commit `40ee172`)

### T011 — Wire into `site/src/App.jsx`

New "Companies" nav tab, added to the existing hash-based router (`view ===
'companies'`), rendering `CompanyFlow` (fed `processedData.filteredData.repos`
+ `data.contributor_company`) followed by `CompanyLeaderboard` (fed the
existing range/metric-filtered `processedData.leaderboard`, plus `repos` and
`data.repo_stars` for the Impact Score path).

**Files**: `site/src/App.jsx` (modified)

### T012 — Tests

`CompanyFlow.test.jsx` (6 tests: empty state, default SVG render, table
toggle both directions, team info in table, "Unattributed" bucketing) and
`CompanyLeaderboard.test.jsx` (10 tests: empty state, grouping/summing,
contributor counts, team breakdown, "Unattributed" bucketing, sort ordering,
Impact Score column presence/absence, Impact-vs-Contributions sort
switching using a deliberately constructed fixture where the two orderings
disagree).

**Files**: `site/src/__tests__/CompanyFlow.test.jsx`,
`site/src/__tests__/CompanyLeaderboard.test.jsx` (new)

## Definition of Done (verified, retrospectively)

- [x] Companies tab renders a non-empty flow diagram + leaderboard against
      real fixture data (verified via Playwright screenshot).
- [x] Empty states render (not errors) when no company data is available.
- [x] Every chart has a working, populated accessible-table toggle.
- [x] Leaderboard can be sorted by either raw contributions or Impact Score;
      a test fixture demonstrates the two orders actually disagree.
- [x] No new npm dependency introduced (`site/package.json` diff reviewed).
- [x] All 16 tests across the two new test files pass; full suite (249
      tests) passes; production build succeeds.

## Risks / Notes (as encountered)

- The `1 + log10(1 + stars)` weighting is a deliberate design choice
  documented as an accepted constraint (C-001) in spec.md, not a validated-
  optimal formula — flagged for future revision if real company data
  suggests it under- or over-weights reach.
- Test assertions using `getByText` on labels that also appear verbatim
  inside SVG `<title>` elements needed `getAllByText`/scoped queries to
  avoid "multiple elements found" failures — noted here in case future WPs
  hit the same pattern.

## Activity Log

- 2026-07-06T10:07:13Z – user – Backfill: implementation already existed in commit ffb1cc7/40ee172 before mission tracking was set up.
