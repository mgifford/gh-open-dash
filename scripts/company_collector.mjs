/**
 * Company/team attribution collector.
 *
 * Determines which company (and optionally team) each contributor belongs
 * to, so contributions can be sliced by company alongside the existing
 * per-author and per-repo aggregates.
 *
 * Two sources, roster takes priority:
 *   1. `scripts/company_roster.json` — a maintained username -> {company, team}
 *      map (same pattern as staff_allowlist.json).
 *   2. GitHub's public profile `company` field (self-reported, unverified),
 *      fetched via a batched GraphQL query for any author not in the roster.
 *
 * Only the public `company` profile field is read — no issue/PR content,
 * consistent with the "no content leakage" rule in AGENTS.md.
 */

const PROFILE_REFRESH_DAYS = 90;
const BATCH_SIZE = 40;
const RATE_LIMIT_DELAY_MS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function createCompanyTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contributor_company (
      author TEXT PRIMARY KEY,
      company TEXT,
      team TEXT,
      source TEXT,
      updated_at TEXT
    );
  `);
}

function normalizeCompany(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Strip a single leading "@" often used to reference a GitHub org (e.g. "@civicactions")
  return trimmed.replace(/^@/, '').trim() || null;
}

function findRosterEntry(roster, author) {
  if (!roster) return null;
  if (roster[author]) return roster[author];
  const lower = author.toLowerCase();
  const key = Object.keys(roster).find(k => k.toLowerCase() === lower);
  return key ? roster[key] : null;
}

async function fetchProfileCompanies(usernames, token) {
  const aliasToUser = new Map();
  const fields = usernames.map((u, i) => {
    const alias = `u${i}`;
    aliasToUser.set(alias, u);
    const safe = u.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${alias}: user(login: "${safe}") { login company }`;
  }).join('\n');

  const query = `query { ${fields} }`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `token ${token}`,
        'content-type': 'application/json',
        'user-agent': 'gh-open-dash-collector'
      },
      body: JSON.stringify({ query })
    });

    if (res.status === 403 || res.status === 429) {
      const resetAt = Number(res.headers.get('x-ratelimit-reset'));
      const now = Date.now();
      const waitMs = Number.isFinite(resetAt) ? Math.max(resetAt * 1000 - now + 5000, RETRY_DELAY_MS * attempt) : RETRY_DELAY_MS * attempt;
      console.warn(`[company] Rate limited fetching profile companies (attempt ${attempt}/${MAX_RETRIES}); waiting ${Math.ceil(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    const text = await res.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch { payload = null; }

    const result = new Map();
    if (payload && payload.data) {
      for (const [alias, user] of Object.entries(payload.data)) {
        const username = aliasToUser.get(alias);
        if (!username) continue;
        result.set(username, user ? normalizeCompany(user.company) : null);
      }
    }
    // A NOT_FOUND error on one alias (e.g. renamed/deleted account) still leaves
    // the other aliases resolved in `data`; treat the failed alias as unknown.
    if (payload && Array.isArray(payload.errors)) {
      for (const err of payload.errors) {
        const path = err.path;
        if (Array.isArray(path) && path.length) {
          const username = aliasToUser.get(path[0]);
          if (username && !result.has(username)) result.set(username, null);
        }
      }
    }
    return result;
  }

  console.warn('[company] Giving up on profile company batch after repeated rate limiting.');
  return new Map();
}

/**
 * Attribute a list of GitHub usernames to a company/team and store the
 * result in `contributor_company`.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} authors         distinct GitHub usernames observed in this run
 * @param {Record<string, {company:string, team?:string}>} roster
 * @param {string} token             GitHub token (used for profile lookups only)
 * @param {{profileRefreshDays?: number}} options
 */
export async function collectCompanyData(db, authors, roster, token, options = {}) {
  createCompanyTable(db);
  const refreshDays = options.profileRefreshDays || PROFILE_REFRESH_DAYS;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const getExisting = db.prepare('SELECT company, team, source, updated_at FROM contributor_company WHERE author = ?');
  const upsert = db.prepare(`
    INSERT INTO contributor_company (author, company, team, source, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(author) DO UPDATE SET
      company = excluded.company,
      team = excluded.team,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  let rosterCount = 0;
  let freshSkipCount = 0;
  const needsProfileLookup = [];

  for (const author of authors) {
    const rosterEntry = findRosterEntry(roster, author);
    if (rosterEntry) {
      upsert.run(author, normalizeCompany(rosterEntry.company), rosterEntry.team || null, 'roster', nowIso);
      rosterCount++;
      continue;
    }

    if (author.endsWith('[bot]')) {
      upsert.run(author, null, null, 'profile', nowIso);
      continue;
    }

    const existing = getExisting.get(author);
    if (existing && existing.source === 'profile' && existing.updated_at) {
      const ageMs = now - new Date(existing.updated_at).getTime();
      if (ageMs < refreshDays * 24 * 60 * 60 * 1000) {
        freshSkipCount++;
        continue;
      }
    }
    needsProfileLookup.push(author);
  }

  let fetched = 0;
  for (let i = 0; i < needsProfileLookup.length; i += BATCH_SIZE) {
    const batch = needsProfileLookup.slice(i, i + BATCH_SIZE);
    try {
      const companies = await fetchProfileCompanies(batch, token);
      for (const author of batch) {
        const company = companies.has(author) ? companies.get(author) : null;
        upsert.run(author, company, null, 'profile', nowIso);
        fetched++;
      }
    } catch (err) {
      console.warn(`[company] Failed to fetch profile company for batch starting at ${batch[0]}:`, err.message || err);
    }
    if (i + BATCH_SIZE < needsProfileLookup.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  console.log(`[company] ${authors.length} authors: ${rosterCount} from roster, ${freshSkipCount} cached profile lookups skipped, ${fetched} profile lookups fetched.`);
}
