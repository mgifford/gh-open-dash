/**
 * Open Contributions Descriptor Collector
 *
 * For each tracked repository, attempts to fetch the
 * `.well-known/open-contributions.json` descriptor file defined by the
 * Open Contributions Descriptor specification
 * (https://www.foo.be/2026/03/open-contributions-descriptor).
 *
 * Results are stored in the `open_contributions` SQLite table so the
 * dashboard can display which projects publish a descriptor and surface
 * the structured contribution metadata they contain.
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RATE_LIMIT_DELAY_MS = 500; // 0.5 s between requests to stay safe

/**
 * Fetch the `.well-known/open-contributions.json` file for a GitHub repo
 * using the GitHub Contents REST API so that the GITHUB_TOKEN is used and
 * we don't hit anonymous rate limits.
 *
 * @param {string} repo  "owner/name"
 * @param {string} token GitHub personal access token
 * @returns {{ hasDescriptor: boolean, descriptor: object|null }}
 */
async function fetchOpenContributions(repo, token) {
  const url = `https://api.github.com/repos/${repo}/contents/.well-known/open-contributions.json`;
  const headers = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'gh-open-dash/1.0',
  };
  if (token) headers.Authorization = `token ${token}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      console.warn(`[open-contributions] Network error for ${repo}: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return { hasDescriptor: false, descriptor: null };
    }

    if (res.status === 404) {
      return { hasDescriptor: false, descriptor: null };
    }

    if (res.status === 429 || res.status === 403) {
      // Rate-limited or forbidden – back off
      const retryAfter = Number(res.headers.get('Retry-After') || 0);
      const wait = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * (attempt + 2);
      console.warn(`[open-contributions] Rate limited for ${repo}; waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      console.warn(`[open-contributions] Unexpected status ${res.status} for ${repo}`);
      return { hasDescriptor: false, descriptor: null };
    }

    const text = await res.text();
    try {
      const descriptor = JSON.parse(text);
      return { hasDescriptor: true, descriptor };
    } catch {
      // File exists but is not valid JSON – still record presence
      return { hasDescriptor: true, descriptor: null };
    }
  }

  return { hasDescriptor: false, descriptor: null };
}

/**
 * Create the `open_contributions` table if it doesn't already exist.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function createOpenContributionsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS open_contributions (
      repo TEXT PRIMARY KEY,
      fetched_at TEXT NOT NULL,
      has_descriptor INTEGER NOT NULL DEFAULT 0,
      descriptor_json TEXT
    );
  `);
}

/**
 * Collect and store open-contributions descriptor data for every listed repo.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} repos  Array of "owner/name" strings
 * @param {string}   token  GitHub personal access token
 */
export async function collectOpenContributions(db, repos, token) {
  createOpenContributionsTable(db);

  const upsert = db.prepare(`
    INSERT INTO open_contributions (repo, fetched_at, has_descriptor, descriptor_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(repo) DO UPDATE SET
      fetched_at = excluded.fetched_at,
      has_descriptor = excluded.has_descriptor,
      descriptor_json = excluded.descriptor_json
  `);

  let found = 0;
  for (const repo of repos) {
    const { hasDescriptor, descriptor } = await fetchOpenContributions(repo, token);
    const fetchedAt = new Date().toISOString();
    upsert.run(
      repo,
      fetchedAt,
      hasDescriptor ? 1 : 0,
      descriptor ? JSON.stringify(descriptor) : null
    );
    if (hasDescriptor) found++;
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  console.log(`[open-contributions] Checked ${repos.length} repos; ${found} have a descriptor.`);
  return found;
}
