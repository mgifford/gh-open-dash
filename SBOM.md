# SBOM

Software Bill of Materials for direct dependencies used by this repository.

- Last reviewed: 2026-05-23 (UTC)
- Scope: direct dependencies from `/package.json` and `/site/package.json`
- Source of truth: installed package metadata in `node_modules/*/package.json`

## Root project (`/package.json`)

| Package | Dependency type | Version spec | Resolved version | License |
|---|---|---|---|---|
| `@octokit/graphql` | dependency | `^8.0.0` | `8.2.2` | `MIT` |
| `better-sqlite3` | dependency | `^12.0.0` | `12.8.0` | `MIT` |
| `dotenv` | dependency | `^16.0.0` | `16.6.1` | `BSD-2-Clause` |

## Site project (`/site/package.json`)

| Package | Dependency type | Version spec | Resolved version | License |
|---|---|---|---|---|
| `chart.js` | dependency | `^4.4.1` | `4.5.1` | `MIT` |
| `react` | dependency | `^18.3.1` | `18.3.1` | `MIT` |
| `react-chartjs-2` | dependency | `^5.2.0` | `5.3.1` | `MIT` |
| `react-dom` | dependency | `^18.3.1` | `18.3.1` | `MIT` |
| `@testing-library/jest-dom` | devDependency | `^6.0.0` | `6.9.1` | `MIT` |
| `@testing-library/react` | devDependency | `^14.0.0` | `14.3.1` | `MIT` |
| `@vitejs/plugin-react` | devDependency | `^4.2.1` | `4.7.0` | `MIT` |
| `jsdom` | devDependency | `^28.1.0` | `28.1.0` | `MIT` |
| `vite` | devDependency | `^7.3.2` | `7.3.2` | `MIT` |
| `vitest` | devDependency | `^4.0.18` | `4.0.18` | `MIT` |

## Update process

1. Install dependencies in both projects (`npm install` and `cd site && npm install`).
2. Refresh versions and licenses from installed package metadata.
3. Update this file whenever dependencies change or as part of regular security review.
