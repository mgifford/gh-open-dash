---
work_package_id: WP02
title: Metrics export surface
dependencies:
- WP01
requirement_refs:
- FR-005
- FR-006
tracker_refs: []
planning_base_branch: claude/company-contributions-tracking-u22693
merge_target_branch: claude/company-contributions-tracking-u22693
branch_strategy: single_branch — implemented directly on the mission's target branch, no lane worktree
subtasks:
- T005
- T006
- T007
agent: claude
history:
- event: implemented
  note: Landed in commit ffb1cc7 on claude/company-contributions-tracking-u22693, prior to this WP file being authored (backfill).
agent_profile: node-norris
authoritative_surface: scripts/export_metrics.mjs
create_intent: []
execution_mode: code_change
owned_files:
- scripts/export_metrics.mjs
role: implementer
status: done
tags: []
---

## ⚡ Do This First: Load Agent Profile

This WP is a **backfilled record of already-completed work**. The profile
above (`node-norris`) documents which persona's skill set the work matches,
for retrospective/reporting purposes only.

## Objective

Make company/team attribution and a finer-grained per-repo contribution
breakdown available in the published `metrics.json`, so the frontend can
build company-level views (flow diagram, leaderboard, per-project history)
without any additional GitHub API calls at build or runtime.

## Context

`metrics.json` already exports `repos[]` with all-time totals and
per-author totals, plus `repos[].weekly[]` with per-week totals (but no
per-author breakdown within a week). This WP (a) surfaces the new
`contributor_company` table, and (b) extends the weekly aggregation so each
week's entry also carries a `byAuthor` breakdown — required to build a
per-project, per-week, per-company history view.

## Subtasks

### T005 — Export `contributor_company`

When the `contributor_company` table exists (i.e. `collectCompanyData` has
been enabled and run at least once), export it as a flat map:
`{ [author]: { company, team, source } }`. Guarded with `tableExists(...)`
so it degrades gracefully (field simply absent) when the feature has never
been enabled — no schema migration required for existing deployments.

**Files**: `scripts/export_metrics.mjs`

### T006 — Extend weekly repo aggregation with `byAuthor`

The existing `addRepoWeekRow` helper only accumulated a `totals` object per
`(repo, week)`. Added a parallel `byAuthor` object on the same `weekly` map
entry, populated from author-inclusive versions of the existing
`*ByRepoWeek` SQL queries (added `author` to the `SELECT`/`GROUP BY` — same
underlying rows, no new table scan pattern). No change to the top-level
`repos[].byAuthor` (all-time) structure.

**Files**: `scripts/export_metrics.mjs`

### T007 — Validate against a fixture database

No automated test harness exists for `.mjs` collector/exporter scripts in
this repo. Validated by hand: built a temporary SQLite database with a small
`pr_opened`/`issue_opened`/`contributor_company` fixture (3 authors, 2 repos,
2 weeks), ran `export_metrics.mjs` against it, and inspected the resulting
JSON to confirm `contributor_company` and `repos[].weekly[].byAuthor`
matched the fixture's expected per-author, per-week counts exactly.

**Files**: none (verification step only; fixture was scratch-only, not
committed)

## Definition of Done (verified, retrospectively)

- [x] `contributor_company` appears in `metrics.json` output when the table
      exists, and is simply absent (not an error) when it doesn't.
- [x] `repos[].weekly[]` entries carry both `totals` and `byAuthor`.
- [x] Verified end-to-end against a hand-built fixture DB — output matched
      expected per-author/per-week counts.
- [x] No change to the shape of pre-existing fields (`repos[].totals`,
      `repos[].byAuthor`) — purely additive.

## Risks / Notes (as encountered)

- `metrics.json` size grows roughly with the number of active
  (repo, week, author) combinations, not combinatorially with history
  length — acceptable at current dataset size (already ~1.8MB before this
  change), but worth monitoring if the configured history window grows
  substantially.
