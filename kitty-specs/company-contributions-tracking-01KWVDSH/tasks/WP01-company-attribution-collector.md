---
work_package_id: WP01
title: Company/team attribution collector
dependencies: []
requirement_refs:
- C-002
- FR-001
- FR-002
- FR-003
- FR-004
- NFR-001
- NFR-003
tracker_refs: []
planning_base_branch: claude/company-contributions-tracking-u22693
merge_target_branch: claude/company-contributions-tracking-u22693
branch_strategy: Planning artifacts for this mission were generated on claude/company-contributions-tracking-u22693. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/company-contributions-tracking-u22693 unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
agent: claude
assignee: "claude"
history:
- event: implemented
  note: Landed in commit ffb1cc7 on claude/company-contributions-tracking-u22693, prior to this WP file being authored (backfill).
agent_profile: node-norris
authoritative_surface: scripts/
create_intent: []
execution_mode: code_change
owned_files:
- scripts/company_roster.json
- scripts/company_collector.mjs
- scripts/update_sqlite.mjs
- scripts/set_config.mjs
role: implementer
status: done
tags: []
---

## ⚡ Do This First: Load Agent Profile

This WP is a **backfilled record of already-completed work** — implementation
already happened before this file was written. No agent needs to load a
profile to execute it. The profile above (`node-norris`) documents which
persona's skill set the work matches, for retrospective/reporting purposes.

## Objective

Attribute every distinct contributing GitHub author to a company and,
optionally, a team — a maintained roster as the priority source, falling
back to each contributor's public GitHub profile `company` field for anyone
not in the roster — gated behind an opt-in config flag so it never runs
unless explicitly enabled.

## Context

`gh-open-dash` tracks per-author, per-repo contribution counts but has no
concept of which company/team a contributor represents. This WP adds that
attribution as a new, opt-in collector stage, following the same patterns
already used by the Ecosyste.ms and open-contributions-descriptor collectors
in this codebase (a `create*Table(db)` + `collect*(...)` pair, invoked once
per collector run rather than per week).

## Subtasks

### T001 — Create `scripts/company_roster.json`

Seed a `username -> {company, team}` map from the existing
`scripts/staff_allowlist.json` usernames, all mapped to `"CivicActions"` with
`team: null` (team assignment left to future manual curation). Follows the
same "plain committed JSON, hand-maintained" convention as
`staff_allowlist.json`.

**Files**: `scripts/company_roster.json` (new)

### T002 — Implement `scripts/company_collector.mjs`

- `createCompanyTable(db)`: creates `contributor_company(author TEXT PRIMARY
  KEY, company TEXT, team TEXT, source TEXT, updated_at TEXT)`.
- `collectCompanyData(db, authors, roster, token, options)`:
  - Roster match (case-insensitive) wins immediately, no API call, `source
    = 'roster'`.
  - Bot accounts (`username.endsWith('[bot]')`) get `company = null`
    immediately, no API call.
  - Everyone else: profile-sourced entries newer than `profileRefreshDays`
    (default 90) are skipped (cached); otherwise the author is queued for a
    batched GraphQL lookup.
  - Batched lookup: up to 40 usernames per query, each aliased (`u0:
    user(login: "...") { login company }`) so one renamed/deleted account
    (partial GraphQL error) doesn't fail the whole batch — the affected
    alias is treated as unknown and the rest of the batch still resolves.
  - Handles GraphQL rate limiting (403/429) with reset-aware backoff,
    mirroring the retry pattern already used in `update_sqlite.mjs`.

**Files**: `scripts/company_collector.mjs` (new)

### T003 — Wire into `scripts/update_sqlite.mjs`

- New config flag `collectCompanyData` (default `false`), backward-compatible
  default-fill alongside the other opt-in flags.
- `createCompanyTable(db)` called at startup alongside the other table
  creations.
- After the weekly collection loop (same point as the existing Ecosyste.ms
  and open-contributions steps — once per run, not per week): gather
  `SELECT DISTINCT author` across `pr_opened`, `pr_merged`, `issue_opened`,
  `commits`, load the roster (file or `COMPANY_ROSTER_JSON` env override,
  mirroring the `staff_allowlist.json` / `STAFF_ALLOWLIST_JSON` pattern), and
  call `collectCompanyData`.
- Wrapped in try/catch so a failure here does not fail the whole collector
  run, consistent with the other optional steps.

**Files**: `scripts/update_sqlite.mjs` (modified)

### T004 — Add CLI flag to `scripts/set_config.mjs`

`--collectCompanyData=true|false` alongside the existing
`--collectOpenContributions` / `--collectMeetingMentions` flags, same
parsing convention.

**Files**: `scripts/set_config.mjs` (modified)

## Definition of Done (verified, retrospectively)

- [x] `contributor_company` table created idempotently on collector startup.
- [x] Roster entries never trigger an API call.
- [x] Non-roster, non-bot authors are looked up via batched GraphQL, capped
      at 40 per request.
- [x] Profile-sourced rows are not re-fetched within the 90-day refresh
      window.
- [x] `collectCompanyData` defaults to `false`; nothing runs unless
      explicitly enabled.
- [x] Only the public `company` field is read — no issue/PR content.
- [x] Verified against a hand-built SQLite fixture (see WP02) rather than a
      dedicated unit-test harness, consistent with the rest of `scripts/`.

## Risks / Notes (as encountered)

- GraphQL alias queries needed to tolerate one bad username in a batch
  without losing the rest — resolved by mapping failed aliases to `null`
  instead of throwing.
- No dedicated test harness exists for `.mjs` collector scripts in this
  repo; validation was manual (fixture DB + `node --check` syntax
  validation), matching the existing convention for `scripts/*.mjs`.

## Activity Log

- 2026-07-06T10:07:02Z – user – Backfill: implementation already existed in commit ffb1cc7/40ee172 before mission tracking was set up.
