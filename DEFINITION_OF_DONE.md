# Definition of Done

This report is done when all of the following are true.

## 1. Scope and purpose are clear

- The report clearly states which organization(s), time period, and metrics are included.
- The report matches the project's purpose: public, open-source contribution transparency.
- Any exclusions, assumptions, or known limitations are documented.

## 2. Data is correct and complete

- The metrics are generated from the approved pipeline in `scripts/`.
- Data is grouped into complete Monday-starting UTC weeks only.
- The current partial week is excluded.
- The report includes the intended metric set for the release, including closed metrics where expected.
- `data/metrics.json` and `site/public/data/metrics.json` are in sync.

## 3. Privacy and policy rules are met

- Only public repository data is used.
- Repository filtering follows the configured license policy.
- Published output contains counts only and does not expose titles, URLs, body text, comments, labels, or review content.
- Query patterns stay within the repository's rate-limit and collection rules.

## 4. The report is understandable and accessible

- Labels, headings, and supporting copy use clear, inclusive language.
- Charts or visual summaries have accessible alternatives or descriptive context that meets the repository accessibility policy.
- The report can be understood without needing access to source code or raw database records.

## 5. Documentation and configuration are updated

- Any configuration changes needed to produce the report are documented.
- Supporting documentation reflects any new metrics, filters, or limitations introduced by the report.
- The `README.md` AI Disclosure section reflects any AI assistance used to create or update the report documentation.

## 6. Validation is complete

- Relevant existing tests and build steps pass for the affected parts of the project.
- A reviewer can reproduce the report using the documented workflow.
- The final diff is limited to intentional report-related changes.

## 7. Publication is ready

- The generated report assets are ready for the GitHub Pages build and deployment flow.
- Reviewers have enough context to approve the report without needing hidden or unpublished information.
- The report is ready to share publicly as an accurate snapshot of open-source contribution activity.
