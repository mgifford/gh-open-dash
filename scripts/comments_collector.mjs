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

async function fetchPaged(url, headers = {}) {
  const token = process.env.GITHUB_TOKEN;
  const out = [];
  let next = url;
  while (next) {
    const res = await fetch(next, { headers: { authorization: `token ${token}`, ...headers } });
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

export async function processCommentsForOrg(weekStart, rangeStartISO, rangeEndISO, org) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN missing; skipping comment collection');
    return;
  }

  const perPage = 100;
  const repoLicenseCache = new Map();
  const counts = new Map(); // key `${author}||${repo}||${kind}` -> number

  // List public repos for org
  let page = 1;
  while (true) {
    const url = `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=${perPage}&page=${page}&type=public`;
    const res = await fetch(url, { headers: { authorization: `token ${token}` } });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`Failed to list repos for ${org}: ${res.status} ${txt}`);
      break;
    }
    const repos = await res.json();
    if (!repos || repos.length === 0) break;

    for (const r of repos) {
      const repoFull = r.full_name || r.fullName || r.name && `${r.owner && r.owner.login}/${r.name}`;
      if (!repoFull) continue;
      if (repoShouldBeExcluded(repoFull)) continue;
      // license check
      let spdx = null;
      if (repoLicenseCache.has(repoFull)) {
        spdx = repoLicenseCache.get(repoFull);
      } else {
        try {
          const repoMetaUrl = `https://api.github.com/repos/${repoFull}`;
          const rmeta = await fetch(repoMetaUrl, { headers: { authorization: `token ${token}` } });
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

    // pagination for org repos
    const link = res.headers.get('link');
    if (!link || !link.includes('rel="next"')) break;
    page++;
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
