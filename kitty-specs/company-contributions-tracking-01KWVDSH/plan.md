# Implementation Plan: Company & Team Contribution Attribution

**Branch**: `claude/company-contributions-tracking-u22693` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/company-contributions-tracking-01KWVDSH/spec.md`

**Note**: This plan was written after implementation (backfill), describing the
architecture actually used rather than a forward proposal.

## Summary

Add an opt-in data-pipeline stage that attributes each GitHub contributor to a
company/team (maintained roster, falling back to their public GitHub profile
`company` field), export that attribution alongside a new per-repo/per-week/
per-author breakdown, and add three frontend surfaces — a company→project
flow diagram, a company leaderboard (raw count or reach-weighted Impact
Score), and a per-project contribution history — built entirely from that
exported data with no new runtime dependencies.

## Technical Context

**Language/Version**: Node.js (root pipeline: `"engines": {"node": ">=22"}`; site: `>=24`), ES modules (`.mjs`)
**Primary Dependencies**: `better-sqlite3` (data pipeline, existing), GitHub GraphQL API via native `fetch` (existing pattern, reused — no new HTTP client added); frontend: React 18 + Vite (existing) — no new frontend dependency added
**Storage**: SQLite (`data/participation.sqlite`), one new table: `contributor_company(author, company, team, source, updated_at)`
**Testing**: Vitest + @testing-library/react for the frontend (existing suite); no dedicated test harness exists for the `.mjs` collector scripts (consistent with the rest of `scripts/`) — validated instead via a hand-built SQLite fixture run through `export_metrics.mjs` and inspected manually
**Target Platform**: Static site (GitHub Pages) fed by a scheduled GitHub Actions data pipeline — no runtime API calls from the deployed dashboard (existing architecture, unchanged)
**Project Type**: Web (existing split: root `scripts/` data pipeline + `site/` Vite/React frontend)
**Performance Goals**: No new performance targets; must stay within the existing rate-limit-safe collection model (bounded, batched author lookups only)
**Constraints**: No new npm/pip dependency; no per-item (per-PR/per-issue) GitHub API calls; no issue/PR content collection (AGENTS.md "no content leakage" rule); WCAG 2.2 AA (ACCESSIBILITY.md) — every new chart needs a non-visual data-table alternative
**Scale/Scope**: Bounded by the existing tracked-org/staff scope; new API calls bounded to the count of distinct contributing authors observed per collector run (batches of 40 via aliased GraphQL queries), not per contribution

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No project charter exists yet (`spec-kitty charter context` returned `mode: missing`). This is not a blocker per this project's charter workflow; the closest equivalent governance document is `AGENTS.md`, whose relevant constraints are captured directly as Constraints (C-001–C-003) and Non-Functional Requirements (NFR-001–NFR-003) in `spec.md`, and were satisfied as follows:

- Public data / no content leakage → only counts and the public `company` profile field are stored (NFR-003).
- Rate-limit safety → attribution runs once per collector run, bounded to distinct authors, batched (NFR-001).
- No new dependencies → verified against `package.json` / `site/package.json` diffs and `SBOM.md` (NFR-002).

## Project Structure

### Documentation (this mission)

```
kitty-specs/company-contributions-tracking-01KWVDSH/
├── spec.md               # Feature specification (backfilled)
├── plan.md               # This file
├── checklists/
│   └── requirements.md   # Spec quality checklist
└── tasks/                # Work package definitions (see /spec-kitty.tasks)
```

### Source Code (repository root)

```
scripts/                        # Data pipeline (Node.js, existing)
├── company_roster.json         # NEW — maintained username -> {company, team} map
├── company_collector.mjs       # NEW — createCompanyTable(db), collectCompanyData(db, authors, roster, token)
├── update_sqlite.mjs           # MODIFIED — collectCompanyData config flag, table init, once-per-run collection call
├── export_metrics.mjs          # MODIFIED — exports contributor_company; repos[].weekly[] gains byAuthor
└── set_config.mjs              # MODIFIED — --collectCompanyData=true|false flag

site/src/                       # Frontend (React + Vite, existing)
├── companyImpact.js            # NEW — computeRepoStarWeights, computeCompanyImpact (pure functions)
├── CompanyFlow.jsx              # NEW — company -> project flow diagram + accessible table
├── CompanyLeaderboard.jsx       # NEW — company/team leaderboard, raw count or Impact Score sort
├── ProjectHistory.jsx           # NEW — per-project weekly history by company + accessible table
├── Projects.jsx                 # MODIFIED — renders ProjectHistory + company badges in repo detail
├── App.jsx                      # MODIFIED — new "Companies" tab/hash route
└── __tests__/
    ├── CompanyFlow.test.jsx           # NEW
    ├── CompanyLeaderboard.test.jsx    # NEW
    └── ProjectHistory.test.jsx        # NEW
```

**Structure Decision**: Reuses the existing two-part layout (`scripts/` data
pipeline, `site/` frontend) rather than introducing a new package or service.
No "Option 2/3" web/mobile split was needed beyond what already exists.

## Complexity Tracking

*No Charter Check violations to justify — no charter exists, and the design
adds one new table and three new frontend components without introducing new
architectural layers, services, or dependencies.*

## Implementation Concern Map

### IC-01 — Company/team attribution collector

- **Purpose**: Resolve each distinct contributing author to a company/team via roster-first, public-profile-fallback lookup, cached in SQLite.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, NFR-001, NFR-003, C-002
- **Affected surfaces**: `scripts/company_roster.json`, `scripts/company_collector.mjs`, `scripts/update_sqlite.mjs`, `scripts/set_config.mjs`
- **Sequencing/depends-on**: none
- **Risks**: Batched GraphQL alias queries must tolerate a single username failing (renamed/deleted account) without losing the rest of the batch; handled via per-alias error-path fallback to "unknown" rather than aborting the batch.

### IC-02 — Metrics export surface

- **Purpose**: Make company attribution and per-week/per-author repo detail available to the frontend without new runtime API calls.
- **Relevant requirements**: FR-005, FR-006
- **Affected surfaces**: `scripts/export_metrics.mjs`
- **Sequencing/depends-on**: IC-01 (needs `contributor_company` table to exist)
- **Risks**: Expanding `repos[].weekly[]` with a `byAuthor` breakdown increases `metrics.json` size proportionally to active author-repo-week combinations (not combinatorially) — acceptable given existing dataset size, but worth monitoring if history window grows substantially.

### IC-03 — Companies dashboard view (flow diagram + leaderboard + Impact Score)

- **Purpose**: Visualize company-to-project contribution flow and rank companies by volume or reach-weighted impact.
- **Relevant requirements**: FR-007, FR-008, FR-009, FR-010, FR-013, NFR-002, NFR-004, C-001
- **Affected surfaces**: `site/src/CompanyFlow.jsx`, `site/src/CompanyLeaderboard.jsx`, `site/src/companyImpact.js`, `site/src/App.jsx`
- **Sequencing/depends-on**: IC-02
- **Risks**: Log-scaled star weighting is a design choice, not a measured "correct" weighting — documented in spec.md as an accepted constraint (C-001), open to revision.

### IC-04 — Per-project history and contributor company badges

- **Purpose**: Show a project's contribution history broken down by company, and label top contributors with their company.
- **Relevant requirements**: FR-011, FR-012, FR-013, NFR-004
- **Affected surfaces**: `site/src/ProjectHistory.jsx`, `site/src/Projects.jsx`
- **Sequencing/depends-on**: IC-02
- **Risks**: None significant; reuses the same bucketing/accessible-table pattern as IC-03 for consistency.
