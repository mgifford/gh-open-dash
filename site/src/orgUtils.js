/**
 * Utility functions for parsing and managing organization overrides
 */

/**
 * Parse various org input formats and extract the org login
 * Accepts:
 * - Plain org name: "openplus"
 * - Full URL: "https://github.com/openplus"
 * - URL without scheme: "github.com/openplus"
 * - URLs with trailing slashes
 * 
 * @param {string} input - User input for organization
 * @returns {string|null} - Normalized org login or null if invalid
 */
export function parseOrgInput(input) {
  if (!input || typeof input !== 'string') return null;
  
  // Trim whitespace
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Remove trailing slashes
  const normalized = trimmed.replace(/\/+$/, '');
  
  // Check if it's a URL (with or without scheme)
  const urlPatterns = [
    /^https?:\/\/github\.com\/([^\/\s]+)/i,  // https://github.com/org
    /^github\.com\/([^\/\s]+)/i,              // github.com/org
  ];
  
  for (const pattern of urlPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  
  // If not a URL, validate as plain org name (alphanumeric, hyphens, underscores)
  if (/^[a-z0-9_-]+$/i.test(normalized)) {
    return normalized.toLowerCase();
  }
  
  return null;
}

/**
 * Get the current organization from URL query param, localStorage, or default
 * Priority: URL param > localStorage > default
 * 
 * @param {string} defaultOrg - Default organization if no override is set
 * @returns {string} - Organization to use
 */
export function getCurrentOrg(defaultOrg = 'civicactions') {
  // Check URL query parameter first
  const params = new URLSearchParams(window.location.search);
  const urlOrg = params.get('org');
  if (urlOrg) {
    const parsed = parseOrgInput(urlOrg);
    if (parsed) return parsed;
  }
  
  // Check localStorage next
  try {
    const stored = localStorage.getItem('gh-open-dash-org');
    if (stored) {
      const parsed = parseOrgInput(stored);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
  }
  
  // Fall back to default
  return defaultOrg;
}

/**
 * Save organization override to localStorage
 * 
 * @param {string} org - Organization to save
 * @returns {boolean} - Success status
 */
export function saveOrgOverride(org) {
  try {
    if (!org) {
      localStorage.removeItem('gh-open-dash-org');
      return true;
    }
    const parsed = parseOrgInput(org);
    if (parsed) {
      localStorage.setItem('gh-open-dash-org', parsed);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
    return false;
  }
}

/**
 * Clear organization override from localStorage
 */
export function clearOrgOverride() {
  try {
    localStorage.removeItem('gh-open-dash-org');
  } catch (e) {
    console.warn('Failed to clear localStorage:', e);
  }
}

/**
 * Filter an array of repo objects to only those belonging to the given org.
 * Each repo object must have a `repo` field of the form "owner/name".
 *
 * @param {Array} repos - Array of objects with a `repo` property
 * @param {string} org - Organization login to filter by
 * @returns {Array} - Filtered array
 */
export function filterReposByOrg(repos, org) {
  if (!Array.isArray(repos) || !org) return repos || [];
  const orgLower = org.toLowerCase();
  return repos.filter(r => {
    const owner = r && r.repo && r.repo.split('/')[0];
    return owner && owner.toLowerCase() === orgLower;
  });
}

const EMPTY_AUTHOR_METRICS = () => ({
  prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0,
  commits: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0, meeting_mentions: 0
});

/**
 * Build a weekly per-author activity series (the same shape as the
 * top-level `metrics.json#series`) scoped to only the given repos, by
 * aggregating each repo's `weekly[].byAuthor` breakdown across repos for
 * every week.
 *
 * This is what makes org filtering apply to the dashboard's leaderboard,
 * weekly trend chart, and metric cards — not just the repo-shaped views
 * (Projects, Ecosyste.ms charts) — since those repo-level weekly breakdowns
 * carry a repo/org dimension that the flat, all-repos `series` never had.
 *
 * Note: `meeting_mentions` has no per-repo breakdown in the export, so it
 * is always 0 in the returned series regardless of org scope.
 *
 * @param {Array} repos - repo objects (already filtered to the desired org),
 *   each with a `weekly` array of `{ week_start, byAuthor }`.
 * @param {Array<string>} allWeeks - the full ordered list of week_start
 *   strings to index the returned series by (so positions line up with
 *   any downstream range-slicing of the caller's `weeks` array).
 * @returns {Array<{week_start: string, byAuthor: Object}>}
 */
export function buildSeriesFromRepos(repos, allWeeks) {
  const weekMap = new Map();
  for (const week of (allWeeks || [])) {
    weekMap.set(week, {});
  }

  for (const repo of (repos || [])) {
    for (const w of (repo.weekly || [])) {
      let byAuthor = weekMap.get(w.week_start);
      if (!byAuthor) {
        byAuthor = {};
        weekMap.set(w.week_start, byAuthor);
      }
      for (const [author, counts] of Object.entries(w.byAuthor || {})) {
        if (!byAuthor[author]) byAuthor[author] = EMPTY_AUTHOR_METRICS();
        for (const [key, value] of Object.entries(counts)) {
          byAuthor[author][key] = (byAuthor[author][key] || 0) + (value || 0);
        }
      }
    }
  }

  return (allWeeks || Array.from(weekMap.keys()).sort())
    .map(week_start => ({ week_start, byAuthor: weekMap.get(week_start) || {} }));
}

/**
 * Filter an array of pr_details-style rows (which carry a `repo` field) to
 * only those belonging to the given set of repo names.
 *
 * @param {Array} rows - objects with a `repo` property
 * @param {Array} repos - repo objects (already filtered to the desired org)
 * @returns {Array}
 */
export function filterRowsByRepoSet(rows, repos) {
  if (!Array.isArray(rows)) return [];
  const repoNames = new Set((repos || []).map(r => r.repo));
  return rows.filter(row => row && repoNames.has(row.repo));
}
