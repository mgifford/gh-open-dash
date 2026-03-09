# Accessibility Commitment (ACCESSIBILITY.md)

## 1. Our Commitment

We believe accessibility is a subset of quality. This project commits to **WCAG 2.2 AA** standards for all dashboard UI, documentation, and example code. We track our progress publicly to remain accountable to our users.

## 2. Real-Time Health Metrics

| Metric | Status / Value |
| :--- | :--- |
| **Open A11y Issues** | [View open accessibility issues](https://github.com/mgifford/gh-open-dash/labels/accessibility) |
| **Automated Test Pass Rate** | Monitored via CI (Vitest + axe-core where applicable) |
| **A11y PRs Merged (MTD)** | Tracked in [project insights](https://github.com/mgifford/gh-open-dash/pulse) |
| **Browser Support** | Last 2 major versions of Chrome, Firefox, and Safari |

## 3. Contributor Requirements (The Guardrails)

To contribute to this repo, you must follow these guidelines:

- **React Components:** All dashboard components must use semantic HTML elements and ARIA attributes where appropriate.
- **Charts:** Chart.js visualizations must include accessible alternatives (e.g., `aria-label`, data tables, or descriptive text) so that screen-reader users can access the underlying data.
- **Keyboard Navigation:** All interactive controls (dropdowns, buttons, selectors) must be fully operable via keyboard alone.
- **Color Contrast:** All text and meaningful UI elements must meet WCAG 2.2 AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
- **Inclusive Language:** Use person-centered, respectful language throughout documentation and UI copy.
- **Link Validation:** All documentation links must be valid and point to correct destinations.

## 4. Reporting & Severity Taxonomy

Please use our [issue templates](https://github.com/mgifford/gh-open-dash/issues/new) when reporting accessibility issues. We prioritize based on:

- **Critical:** A barrier that prevents users from completing a core task (e.g., chart data completely inaccessible to screen readers, keyboard trap in a form or selector).
- **High:** Significant accessibility gap or misleading ARIA usage that creates barriers for assistive-technology users.
- **Medium:** Contrast issues, missing labels, or incomplete keyboard support that degrade the experience.
- **Low:** Minor improvements, typos in accessible descriptions, or enhancements to existing accessible patterns.

## 5. Automated Check Coverage

Our CI pipeline and local development workflow include:

- **Vitest** unit tests for React components — see `site/src/__tests__/`
- **axe-core** (via `@axe-core/react` or `jest-axe`) for automated WCAG rule checks on rendered components
- Standard browser developer tools audits (Lighthouse, Axe browser extension) for manual spot-checks

We follow the [Axe Rules Reference](https://dequeuniversity.com/rules/axe/) when triaging automated findings.

## 6. Browser & Assistive Technology Testing

### Browser Support Guarantees

This project supports the **last 2 major versions** of all major browser engines:

- **Chrome/Chromium** (including Edge, Brave, Opera)
- **Firefox**
- **Safari/WebKit** (macOS and iOS)

### Assistive Technology Testing

Contributors are encouraged to test dashboard pages and interactive components with:

- **Screen readers:** JAWS, NVDA, VoiceOver, TalkBack
- **Keyboard navigation:** Tab, arrow keys, and standard shortcuts
- **Magnification tools:** Browser zoom (up to 400%), screen magnifiers
- **Voice control:** Dragon NaturallySpeaking, macOS Voice Control

## 7. Machine-Readable Standards

This project references [wai-yaml-ld](https://github.com/mgifford/wai-yaml-ld) for machine-readable accessibility standards, enabling AI agents to provide standards-grounded guidance.

### Respecting Content Creator Preferences

When AI agents or automated tools reference external accessibility resources, they must check whether the source permits AI scraping or training:

- **`allowed`** (default): Content may be used for AI training and reference.
- **`prohibited`**: Do not scrape, crawl, or use content for AI training. Reference and cite only.
- **`restricted`**: Use only for reference and citation purposes, not for training data.

**For AI agents and automated tools:** Always check an external source's `robots.txt`, terms of service, or public statements about AI scraping before reproducing content. Cite and link rather than reproduce where scraping is prohibited or restricted.

## 8. Known Limitations

- Chart.js canvas charts require additional work to expose tabular data alternatives for screen-reader users; this is tracked as an ongoing improvement.
- The dashboard is a data-aggregation tool; content it displays comes from GitHub's API and may include repo names or other metadata that is not under our direct control.

## 9. Getting Help

- **Questions:** Open a [discussion](https://github.com/mgifford/gh-open-dash/discussions)
- **Bugs or accessibility barriers:** Open an [issue](https://github.com/mgifford/gh-open-dash/issues) with the `accessibility` label
- **Contributions:** See [README.md](./README.md) and [AGENTS.md](./AGENTS.md)
- **Accommodations:** Request via the `accessibility-accommodation` label on a GitHub issue

## 10. Continuous Improvement

We regularly review and update:

- WCAG conformance as standards evolve (targeting WCAG 2.2 AA)
- Chart accessibility patterns as Chart.js and React evolve
- Inclusive language and terminology in the dashboard UI and documentation
- Tool recommendations and automation examples

Last updated: 2026-03-09
