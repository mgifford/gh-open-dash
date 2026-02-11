import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join('data', 'participation.sqlite');
const ALLOWLIST_PATH = path.join('scripts', 'oss_spdx_allowlist.json');
const CONFIG_PATH = path.join('scripts', 'config.json');

const fileConfig = loadConfig();
const allowList = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      console.warn('Failed to parse config.json in comments_collector; using defaults', err.message);
    }
  }
  return {};
}

function repoShouldBeExcluded(repoName) {
  const repoExcludePatterns = (fileConfig.repoExcludePatterns && Array.isArray(fileConfig.repoExcludePatterns)) ? fileConfig.repoExcludePatterns.map(p => String(p).trim()).filter(Boolean) : [];
  if (!repoName || repoExcludePatterns.length === 0) return false;
  const lower = repoName.toLowerCase();
  for (const pat of repoExcludePatterns) {
    const p = pat.toLowerCase();
    if (p.includes('/')) {
      if (lower === p || lower.startsWith(p + '/')) return true;
    }
    const owner = lower.split('/')[0];
    if (owner === p) return true;
    if (lower.includes(p)) return true;
  }
  return false;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create a small cache table for org repo lists to reduce repeated listing
db.exec(`
  CREATE TABLE IF NOT EXISTS org_repos_cache (
    org TEXT,
    repo TEXT,
    spdx TEXT,
    updated_at INTEGER,
    PRIMARY KEY (org, repo)
  );
`);

const RATE_LIMIT_BUFFER_MS = 5000;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, attempt = 1) {
  const token = process.env.GITHUB_TOKEN;
  const headers = { authorization: `token ${token}`, ...(options.headers || {}) };
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.ok) return res;

    // Handle rate limit (403) or 429
    if (res.status === 403 || res.status === 429) {
      const text = await res.text();
      let waitMs = RETRY_DELAY_MS * attempt;
      const reset = res.headers.get('x-ratelimit-reset');
      if (reset) {
        const resetAt = Number(reset) * 1000;
        const now = Date.now();
        waitMs = Math.max(resetAt - now + RATE_LIMIT_BUFFER_MS, waitMs);
      }
      if (attempt >= MAX_RETRIES) {
        // re-create a Response-like error
        const err = new Error(`HTTP ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      console.log(`Rate limited on ${url} (status ${res.status}); waiting ${Math.ceil(waitMs/1000)}s until API window resets (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(waitMs);
      return fetchWithRetry(url, options, attempt + 1);
    }

    // other non-ok
    return res;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const delay = RETRY_DELAY_MS * attempt;
    console.warn(`Fetch error for ${url} (attempt ${attempt}): ${err.message}. Retrying in ${delay}ms.`);
    await sleep(delay);
    return fetchWithRetry(url, options, attempt + 1);
  }
}

// Ensure RETRY_DELAY_MS is defined
const RETRY_DELAY_MS = 2000;

async function fetchPaged(url, headers = {}) {
  const token = process.env.GITHUB_TOKEN;
  const out = [];
  let next = url;
  while (next) {
    const res = await fetchWithRetry(next, { headers: { ...(headers || {}) } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      out.push(...data);
    } else if (data.items) {
      out.push(...data.items);
    }
    const link = res.headers.get('link');
    if (link && link.includes('rel="next"')) {
      const m = link.match(/<([^>]+)>; rel="next"/);
      next = m ? m[1] : null;
    } else {
      next = null;
    }
  }
  return out;
}

function nowMs() { return Date.now(); }

function getCachedOrgRepos(org, ttlMs = 1000 * 60 * 60 * 24 * 7) { // default 7 days
  const cutoff = nowMs() - ttlMs;
  const rows = db.prepare(`SELECT repo, spdx, updated_at FROM org_repos_cache WHERE org = ?`).all(org);
  if (!rows || rows.length === 0) return null;
  // if any row is older than cutoff, treat cache as stale
  for (const r of rows) {
    if (!r.updated_at || r.updated_at < cutoff) return null;
  }
  return rows.map(r => ({ repo: r.repo, spdx: r.spdx }));
}

function cacheOrgRepos(org, repos) {
  const now = Math.floor(nowMs() / 1000);
  const insert = db.prepare(`INSERT OR REPLACE INTO org_repos_cache (org, repo, spdx, updated_at) VALUES (?, ?, ?, ?)`);
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(org, r.repo, r.spdx || null, now);
  });
  tx(repos);
}

export async function processCommentsForOrg(weekStart, rangeStartISO, rangeEndISO, org) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN missing; skipping comment collection');
    return;
  }

  const perPage = 100;
  const repoLicenseCache = new Map();
  const counts = new Map(); // key `${author}||${repo}||${kind}` -> number

  // Attempt to use cached org repo list first
  let repoEntries = getCachedOrgRepos(org);
  if (!repoEntries) {
    // fetch and build list of { repo, spdx }
    repoEntries = [];
    let page = 1;
    while (true) {
      const url = `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=${perPage}&page=${page}&type=public`;
      let res;
      try {
        res = await fetchWithRetry(url, {});
      } catch (err) {
        console.warn(`Failed to list repos for ${org}: ${err.status || 'error'} ${err.message}`);
        break;
      }
      const repos = await res.json();
      if (!repos || repos.length === 0) break;

      for (const r of repos) {
        const repoFull = r.full_name || r.fullName || r.name && `${r.owner && r.owner.login}/${r.name}`;
        if (!repoFull) continue;
        if (repoShouldBeExcluded(repoFull)) continue;
        // fetch metadata for SPDX
        let spdx = null;
        try {
          const repoMetaUrl = `https://api.github.com/repos/${repoFull}`;
          const rmeta = await fetchWithRetry(repoMetaUrl, {});
          if (rmeta.ok) {
            const jm = await rmeta.json();
            spdx = jm.license && jm.license.spdx_id ? jm.license.spdx_id : null;
          }
        } catch (err) {
          console.warn('Failed to fetch repo metadata for', repoFull, err.message || err);
        }
        repoEntries.push({ repo: repoFull, spdx });
      }

      const link = res.headers.get('link');
      if (!link || !link.includes('rel="next"')) break;
      page++;
    }

    // store into cache (even empty list) to avoid repeated listing
    try { cacheOrgRepos(org, repoEntries); } catch (e) { console.warn('Failed to cache org repos:', e.message || e); }
  }

  // iterate cached/fetched repo entries and fetch comments
  for (const entry of repoEntries) {
    const repoFull = entry.repo;
    const spdxFromEntry = entry.spdx || null;
    if (!repoFull) continue;
    if (repoShouldBeExcluded(repoFull)) continue;
    // populate repoLicenseCache from entry if present
    if (spdxFromEntry) repoLicenseCache.set(repoFull, spdxFromEntry);

    // license check
    let spdx = repoLicenseCache.has(repoFull) ? repoLicenseCache.get(repoFull) : null;
    if (!spdx) {
      try {
        const repoMetaUrl = `https://api.github.com/repos/${repoFull}`;
        const rmeta = await fetchWithRetry(repoMetaUrl, {});
        if (rmeta.ok) {
          const jm = await rmeta.json();
          spdx = jm.license && jm.license.spdx_id ? jm.license.spdx_id : null;
        }
      } catch (err) {
        console.warn('Failed to fetch repo metadata for', repoFull, err.message || err);
      }
      repoLicenseCache.set(repoFull, spdx);
    }
    if (fileConfig.licenseFilter === 'oss') {
      if (!spdx) continue;
      if (!allowList.includes(spdx)) continue;
    }

    // Fetch issue comments (includes issue & PR issue comments)
    try {
      const issuesUrl = `https://api.github.com/repos/${repoFull}/issues/comments?since=${encodeURIComponent(rangeStartISO)}&per_page=${perPage}`;
      const issueComments = await fetchPaged(issuesUrl, {});
      for (const c of issueComments) {
        const created = c.created_at;
        if (!created) continue;
        if (created < rangeStartISO || created > rangeEndISO) continue;
        const author = c.user && c.user.login;
        if (!author) continue;
        const key = `${author}||${repoFull}||issue_comment`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch (err) {
      console.warn(`Issue comments fetch failed for ${repoFull}:`, err.message || err);
    }

    // Fetch PR review comments
    try {
      const prReviewsUrl = `https://api.github.com/repos/${repoFull}/pulls/comments?since=${encodeURIComponent(rangeStartISO)}&per_page=${perPage}`;
      const prReviewComments = await fetchPaged(prReviewsUrl, {});
      for (const c of prReviewComments) {
        const created = c.created_at;
        if (!created) continue;
        if (created < rangeStartISO || created > rangeEndISO) continue;
        const author = c.user && c.user.login;
        if (!author) continue;
        const key = `${author}||${repoFull}||pr_review_comment`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch (err) {
      console.warn(`PR review comments fetch failed for ${repoFull}:`, err.message || err);
    }

    // Fetch commit comments
    try {
      const commitCommentsUrl = `https://api.github.com/repos/${repoFull}/comments?since=${encodeURIComponent(rangeStartISO)}&per_page=${perPage}`;
      const commitComments = await fetchPaged(commitCommentsUrl, {});
      for (const c of commitComments) {
        const created = c.created_at || c.updated_at;
        if (!created) continue;
        if (created < rangeStartISO || created > rangeEndISO) continue;
        const author = c.user && c.user.login;
        if (!author) continue;
        const key = `${author}||${repoFull}||commit_comment`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch (err) {
      console.warn(`Commit comments fetch failed for ${repoFull}:`, err.message || err);
    }
  }

  if (counts.size === 0) return;

  // Insert aggregated counts into DB
  const insert = db.prepare(`INSERT OR REPLACE INTO comment_counts (week_start, author, repo, spdx, kind, count) VALUES (?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(r.week_start, r.author, r.repo, r.spdx, r.kind, r.count);
  });

  const rows = [];
  for (const [k, v] of counts.entries()) {
    const [author, repoFull, kind] = k.split('||');
    const spdx = repoLicenseCache.get(repoFull) || null;
    rows.push({ week_start: weekStart, author, repo: repoFull, spdx, kind, count: v });
  }
  tx(rows);
  console.log(`  Inserted ${rows.length} comment count rows for org ${org} (${weekStart})`);
}
