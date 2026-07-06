# Feature Specification: Company & Team Contribution Attribution

**Mission**: company-contributions-tracking-01KWVDSH
**Mission type**: software-dev
**Target branch**: claude/company-contributions-tracking-u22693
**Status**: Implemented — this specification was written after the fact to
document already-shipped, already-tested, already-committed work (a
"backfill"), not to plan future work. See Backfill Note at the end.

## Problem Statement

CivicActions' transparency dashboard (gh-open-dash) tracks open-source
contributions per individual contributor and per repository, but has no way
to answer "which companies (and teams within them) are behind this work?" As
a result, the dashboard cannot:

- Show a combined view of companies, the people who represent them, and the
  projects they contribute to.
- Rank or recognize companies by how much they give back, the way
  [Drupal.org's marketplace contribution-credit system](https://www.drupal.org/drupalorg/docs/marketplace/contribution-credit-weight-and-impact-on-ranking)
  does for Drupal.
- Show a project's contributor history over time broken down by the
  companies involved, to help address the ["maker-taker problem"](https://dri.es/solving-the-maker-taker-problem)
  by recognizing and incentivizing the organizations that contribute back.

## Goals

- Attribute individual contributors to a company and, where known, a team.
- Provide a company-centric view: which companies contribute to which
  projects, and how much.
- Provide a company leaderboard that can rank by raw contribution volume or
  by a reach-weighted "Impact Score" inspired by Drupal's credit weighting.
- Provide a per-project history view showing contribution volume over time,
  broken down by company.
- Do all of the above using only data this project is already allowed to
  collect (public data, counts only, no issue/PR content — see AGENTS.md).

## Non-Goals

- Verifying company affiliation. The public GitHub profile `company` field
  is self-reported and unverified; this feature does not attempt to confirm
  it.
- Cross-company "taker detection" (identifying companies that depend on a
  project but do not contribute to it). Deferred — see Deferred Work below.
- Non-code contribution credit (financial sponsorship, event sponsorship,
  mentorship) and persistent role-based credit (e.g. standing maintainer
  status that doesn't decay). Deferred — see Deferred Work below.
- Supporting more than one canonical company roster format or a hosted
  admin UI for editing the roster; it is a maintained JSON file, edited like
  the existing `scripts/staff_allowlist.json`.

## User Scenarios & Testing

### Primary scenario: maintainer reviews company contributions

A dashboard maintainer (or a member of the public viewing the published
dashboard) opens the **Companies** tab. They see a flow diagram of companies
contributing to projects, and a leaderboard of companies ranked by
contribution volume or Impact Score, with team breakdowns where known. They
can toggle to a full accessible data table to see the underlying
company/team/contributor/project rows.

**Acceptance**: Given `collectCompanyData` is enabled and the collector has
run at least once, the Companies tab renders a non-empty flow diagram and
leaderboard reflecting the current `metrics.json`.

### Secondary scenario: maintainer inspects one project's history

From the **Projects** tab, the maintainer selects a repository and sees a
per-week history of contributions to that project broken down by
contributing company, alongside company badges next to the project's top
contributors.

**Acceptance**: Given a repo has `weekly[].byAuthor` data and contributor
company data exists, the project detail panel renders a company-coded weekly
chart and an equivalent data table.

### Exception path: no company data collected yet

If `collectCompanyData` is disabled or the collector has not populated
`contributor_company`, the Companies tab shows an explanatory empty state
instead of an empty chart, and per-project/leaderboard views fall back to
"Unattributed" rather than erroring.

**Acceptance**: Rendering any of the new components with empty
`contributor_company` / `repos` data does not throw and shows a clear empty
state or an "Unattributed" bucket.

### Edge cases

- A contributor with no roster entry and a blank/missing public `company`
  profile field is bucketed as "Unattributed" rather than omitted.
- A contributor whose GitHub account is renamed or deleted between the
  roster lookup and the profile-fallback GraphQL call does not stop the
  batch; that one alias resolves to "unknown" and the rest of the batch
  still resolves.
- Bot accounts (usernames ending in `[bot]`) are recorded with a null
  company without spending an API call.
- Companies/projects beyond the top 8/top 12 by volume are grouped into an
  "Other companies" / "Other projects" bucket in the flow diagram so the
  diagram stays readable; the full breakdown remains available in the data
  table.

## Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | The system MUST attribute each contributor to a company using a maintained roster (`scripts/company_roster.json`, username → company/team) as the priority source. | Implemented |
| FR-002 | For contributors absent from the roster, the system MUST fall back to the contributor's public GitHub profile `company` field, fetched via a batched GraphQL query. | Implemented |
| FR-003 | Company/team attribution MUST be gated behind an opt-in configuration flag (`collectCompanyData`, default `false`) so it does not run unless explicitly enabled. | Implemented |
| FR-004 | Company attribution results MUST be cached (`contributor_company` table) and profile-sourced entries MUST be refreshed on a rolling window (default 90 days) rather than re-fetched every collector run. | Implemented |
| FR-005 | The exported `metrics.json` MUST include a `contributor_company` map (author → {company, team, source}) whenever the underlying table exists. | Implemented |
| FR-006 | The exported `metrics.json` MUST include a per-repo, per-week, per-author contribution breakdown (`repos[].weekly[].byAuthor`) so the frontend can build company-level project history without additional per-item API calls. | Implemented |
| FR-007 | The dashboard MUST provide a "Companies" view showing a company → project contribution flow, bucketing long tails into "Other" so the diagram stays readable. | Implemented |
| FR-008 | The "Companies" view MUST provide an accessible data-table alternative listing every company/team/contributor/project combination, toggleable from the flow diagram. | Implemented |
| FR-009 | The dashboard MUST provide a company leaderboard ranking companies (and, where known, teams) by total contribution count. | Implemented |
| FR-010 | The company leaderboard MUST also be able to rank companies by an "Impact Score" that weights each contribution by the reach (GitHub star count, log-scaled) of the project it went to, with a UI control to switch between the two sort orders. | Implemented |
| FR-011 | Each project's detail panel MUST show a per-week contribution history broken down by contributing company, with an accessible data-table alternative. | Implemented |
| FR-012 | Each project's top-contributors list MUST show the contributor's known company alongside their name, when known. | Implemented |
| FR-013 | Contributors and projects without known company/reach data MUST degrade to a clearly labeled "Unattributed" bucket rather than being silently dropped or causing an error. | Implemented |

## Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-001 | Company attribution MUST NOT introduce per-item (per-PR/per-issue) GitHub API calls; profile lookups MUST be bounded to the set of distinct authors observed in a run and batched (40 usernames per GraphQL query). | Implemented |
| NFR-002 | The feature MUST NOT introduce any new npm or other package dependency (frontend charts use hand-written SVG, not a new charting library). | Implemented |
| NFR-003 | The feature MUST NOT collect or publish issue/PR titles, bodies, comments, labels, or links — only counts and the public profile `company` field, consistent with AGENTS.md's "no content leakage" rule. | Implemented |
| NFR-004 | New UI components MUST meet the project's WCAG 2.2 AA commitment: every chart/diagram must have an accessible non-visual alternative (a data table) per ACCESSIBILITY.md. | Implemented |
| NFR-005 | Existing automated test suite MUST continue to pass, and new components MUST have test coverage for their empty state, primary rendering path, and (where applicable) sort/toggle interaction. | Implemented — 249/249 vitest tests passing |

## Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | GitHub exposes no install-count or dependent-count signal comparable to Drupal's site-usage data; GitHub star count is used as the best available reach proxy for Impact Score. | Accepted |
| C-002 | The public `company` GitHub profile field is self-reported and unverified; it is documented as a fallback source, not a source of truth. | Accepted |
| C-003 | This feature must operate within the existing rate-limit-safe, org/week-bounded collection model described in AGENTS.md; it must not switch the collector to per-item or unbounded querying. | Accepted |

## Key Entities

- **Contributor** — a GitHub username; may map to zero or one company/team via the roster or public-profile fallback.
- **Company** — a free-text organization name (roster-controlled or self-reported); "Unattributed" is used when unknown.
- **Team** — an optional free-text sub-group within a company, roster-only (no public-profile source for teams).
- **Project (repo)** — an `owner/name` GitHub repository already tracked by the existing collector.
- **Impact Score** — a derived, all-time, per-company number: sum over that company's contributions of `count × (1 + log10(1 + repo_stars))`.

## Success Criteria

- SC-001: A maintainer can identify, within the Companies tab, which companies contribute the most to tracked projects — without reading source code or the SQLite database.
- SC-002: A maintainer can identify, for any tracked project, which companies have been contributing to it over time, from the project's own detail panel.
- SC-003: Company/team attribution adds zero additional per-item GitHub API calls beyond the existing org/week-bounded model (verified: only bounded, batched per-unique-author lookups were added).
- SC-004: Enabling `collectCompanyData` requires only a config flag change and re-running the existing collector/exporter commands — no new setup steps.

## Assumptions

- A single company (CivicActions) is the primary subject of this dashboard, contributing to many external projects; "team" represents optional sub-groups within it. The same roster/fallback mechanism incidentally also surfaces other companies' contributors on shared tracked projects, which is treated as a bonus, not the primary design target for this iteration.
- Maintainers are willing to hand-maintain `scripts/company_roster.json` the same way they already maintain `scripts/staff_allowlist.json`.
- GitHub star count is an acceptable, if imperfect, reach proxy in the absence of an install-count signal.

## Deferred Work (explicitly out of scope for this mission)

- **Taker-detection view**: cross-referencing a project's downstream
  dependents (e.g. via Ecosyste.ms) against known contributor companies to
  surface "depends on this project but has no recorded contributions to it."
  Deferred because it requires new data plumbing (dependents → company
  mapping) and is more sensitive to publish publicly than the recognition-
  oriented features built in this mission.
- **Non-code contribution credit**: financial sponsorship, event
  sponsorship, mentorship — would be roster/schema additions, not GitHub API
  changes.
- **Persistent role-based credit**: standing roles (maintainer, security
  team) that contribute to Impact Score without decaying week to week.

## Backfill Note

This specification, along with its companion `plan.md` and `tasks/`
work packages, was authored **after** implementation, testing, and two
commits landing on `claude/company-contributions-tracking-u22693`, at the
user's request to retroactively apply this repository's spec-driven-
development process to already-shipped work. Functional/non-functional
requirements above are marked "Implemented" (rather than "Planned") because
they describe existing, verified behavior, not a forward plan. Key product
decisions (company-attribution source, single-company scope, full-iteration
build scope) were made through an interactive clarification exchange with
the user before implementation began, not through this backfilled
specification process.
