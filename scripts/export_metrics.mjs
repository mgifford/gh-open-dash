import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join('data', 'participation.sqlite');
const OUT_PATH = path.join('data', 'metrics.json');
const STAFF_ALLOWLIST_PATH = path.join('scripts', 'staff_allowlist.json');
const ORG_ALLOWLIST = (process.env.ORG_ALLOWLIST || 'civicactions')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found');
  process.exit(1);
}

const db = new Database(DB_PATH);

// Load staff allowlist for segmentation (post-processing only)
let staffAllowList = [];
if (fs.existsSync(STAFF_ALLOWLIST_PATH)) {
  staffAllowList = JSON.parse(fs.readFileSync(STAFF_ALLOWLIST_PATH, 'utf8'));
}

// Fetch all weeks
const tableExists = (name) => {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name);
  return !!row;
};

const weeksQueryParts = [
  "SELECT DISTINCT week_start FROM pr_opened",
  "SELECT DISTINCT week_start FROM pr_merged",
  "SELECT DISTINCT week_start FROM issue_opened"
];
if (tableExists('comment_counts')) {
  weeksQueryParts.push("SELECT DISTINCT week_start FROM comment_counts");
}
const weeks = db.prepare(`${weeksQueryParts.join('\nUNION\n')}\nORDER BY week_start`).all().map(r => r.week_start);

// Fetch all authors
const authorQueryParts = [
  "SELECT DISTINCT author FROM pr_opened",
  "SELECT DISTINCT author FROM pr_merged",
  "SELECT DISTINCT author FROM issue_opened"
];
if (tableExists('comment_counts')) {
  authorQueryParts.push("SELECT DISTINCT author FROM comment_counts");
}
const authors = db.prepare(`${authorQueryParts.join('\nUNION\n')}\nORDER BY author COLLATE NOCASE`).all().map(r => r.author);

const staffAuthors = authors.filter(a => staffAllowList.includes(a));

// Aggregate data
// We need to query each table and aggregate counts per (week, author)
// To do this efficiently, we can fetch all rows and process in JS, or use SQL group by.
// Given SQLite is local and fast, fetching grouped data is good.

const getData = (table) => {
  return db.prepare(`
    SELECT week_start, author, count(*) as count
    FROM ${table}
    GROUP BY week_start, author
  `).all();
};

const prOpenedRaw = getData('pr_opened');
const prMergedRaw = getData('pr_merged');
const prClosedRaw = getData('pr_closed');
const issuesOpenedRaw = getData('issue_opened');
const issuesClosedRaw = getData('issue_closed');
const commitsRaw = db.prepare(`SELECT week_start, author, count(*) as count FROM commits GROUP BY week_start, author`).all();
// comment counts grouped by week/author/kind
let commentCountsRaw = [];
if (tableExists('comment_counts')) {
  commentCountsRaw = db.prepare(`SELECT week_start, author, kind, SUM(count) as count FROM comment_counts GROUP BY week_start, author, kind`).all();
}

// Build structure
const seriesMap = new Map(); // week_start -> { byAuthor: {} }

weeks.forEach(week => {
  seriesMap.set(week, {
    week_start: week,
    byAuthor: {}
  });
});

// Helper to fill data
const fill = (data, key) => {
  data.forEach(row => {
    const weekEntry = seriesMap.get(row.week_start);
    if (!weekEntry) return; // Should not happen given weeks list derivation
    
    if (!weekEntry.byAuthor[row.author]) {
      weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0 };
    }
    weekEntry.byAuthor[row.author][key] = row.count;
  });
};

fill(prOpenedRaw, 'prs_opened');
fill(prMergedRaw, 'prs_merged');
fill(prClosedRaw, 'prs_closed');
fill(issuesOpenedRaw, 'issues_opened');
fill(issuesClosedRaw, 'issues_closed');
fill(commitsRaw, 'commits');

const series = Array.from(seriesMap.values());

// apply comment counts into series
const kindToKey = {
  issue_comment: 'comments_issue',
  pr_review_comment: 'comments_pr_review',
  commit_comment: 'comments_commit'
};
commentCountsRaw.forEach(row => {
  const weekEntry = seriesMap.get(row.week_start);
  if (!weekEntry) return;
  if (!weekEntry.byAuthor[row.author]) {
    weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0 };
  }
  const k = kindToKey[row.kind] || null;
  if (k) weekEntry.byAuthor[row.author][k] = row.count;
});

// Aggregate per-repo totals (across all time), per-author per-repo counts,
// and weekly per-repo aggregates so the UI can filter bubbles by time range.
const repoMap = new Map();

const ensureRepo = (repo, spdx) => {
  if (!repoMap.has(repo)) {
    repoMap.set(repo, {
      repo,
      spdx: spdx || null,
      totals: { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 },
      byAuthor: {},
      weekly: new Map() // week_start -> totals
    });
  }
  const e = repoMap.get(repo);
  if (!e.spdx && spdx) e.spdx = spdx;
  return e;
};

const addRepoRow = (row, key) => {
  if (!row || !row.repo) return;
  const repo = row.repo;
  const spdx = row.spdx || null;
  const entry = ensureRepo(repo, spdx);
  if (!entry.byAuthor[row.author]) entry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 };
  entry.byAuthor[row.author][key] = (entry.byAuthor[row.author][key] || 0) + row.count;
  entry.totals[key] = (entry.totals[key] || 0) + row.count;
};

const addRepoWeekRow = (row, key) => {
  if (!row || !row.repo || !row.week_start) return;
  const repo = row.repo;
  const spdx = row.spdx || null;
  const entry = ensureRepo(repo, spdx);
  const week = row.week_start;
  if (!entry.weekly.has(week)) {
    entry.weekly.set(week, { week_start: week, totals: { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 } });
  }
  const w = entry.weekly.get(week);
  w.totals[key] = (w.totals[key] || 0) + row.count;
};

// fetch per-repo per-author counts for each table (all-time)
const prOpenedByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM pr_opened GROUP BY repo, author`).all();
const prMergedByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM pr_merged GROUP BY repo, author`).all();
const prClosedByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM pr_closed GROUP BY repo, author`).all();
const issuesOpenedByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM issue_opened GROUP BY repo, author`).all();
const issuesClosedByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM issue_closed GROUP BY repo, author`).all();
const commitsByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, count(*) as count FROM commits GROUP BY repo, author`).all();

prOpenedByRepo.forEach(r => addRepoRow(r, 'prs_opened'));
prMergedByRepo.forEach(r => addRepoRow(r, 'prs_merged'));
prClosedByRepo.forEach(r => addRepoRow(r, 'prs_closed'));
issuesOpenedByRepo.forEach(r => addRepoRow(r, 'issues_opened'));
issuesClosedByRepo.forEach(r => addRepoRow(r, 'issues_closed'));
commitsByRepo.forEach(r => addRepoRow(r, 'commits'));

// comment counts per-repo per-author (all-time)
const commentsByRepo = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, author, kind, SUM(count) as count FROM comment_counts GROUP BY repo, author, kind`).all();
commentsByRepo.forEach(r => {
  const kindKeyMap = { issue_comment: 'comments_issue', pr_review_comment: 'comments_pr_review', commit_comment: 'comments_commit' };
  const key = kindKeyMap[r.kind];
  if (key) addRepoRow({ repo: r.repo, spdx: r.spdx, author: r.author, count: r.count }, key);
});

// fetch per-repo per-week totals so the UI can produce time-windowed repo aggregates
const prOpenedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM pr_opened GROUP BY repo, week_start`).all();
const prMergedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM pr_merged GROUP BY repo, week_start`).all();
const prClosedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM pr_closed GROUP BY repo, week_start`).all();
const issuesOpenedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM issue_opened GROUP BY repo, week_start`).all();
const issuesClosedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM issue_closed GROUP BY repo, week_start`).all();
const commitsByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, count(*) as count FROM commits GROUP BY repo, week_start`).all();

prOpenedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_opened'));
prMergedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_merged'));
prClosedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_closed'));
issuesOpenedByRepoWeek.forEach(r => addRepoWeekRow(r, 'issues_opened'));
issuesClosedByRepoWeek.forEach(r => addRepoWeekRow(r, 'issues_closed'));
commitsByRepoWeek.forEach(r => addRepoWeekRow(r, 'commits'));

// comment counts per-repo per-week
const commentsByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, kind, SUM(count) as count FROM comment_counts GROUP BY repo, week_start, kind`).all();
commentsByRepoWeek.forEach(r => {
  const kindKeyMap = { issue_comment: 'comments_issue', pr_review_comment: 'comments_pr_review', commit_comment: 'comments_commit' };
  const key = kindKeyMap[r.kind];
  if (key) addRepoWeekRow({ repo: r.repo, spdx: r.spdx, week_start: r.week_start, count: r.count }, key);
});

// finalize repos array, converting weekly Maps to arrays sorted by week_start
const repos = Array.from(repoMap.values()).map(e => {
  const weekly = Array.from(e.weekly.values()).sort((a,b) => a.week_start.localeCompare(b.week_start));
  return { repo: e.repo, spdx: e.spdx, totals: e.totals, byAuthor: e.byAuthor, weekly };
});

// Apply repo exclusion patterns from config (optional)
let repoExcludePatterns = [];
try {
  const CONFIG_PATH = path.join('scripts', 'config.json');
  if (fs.existsSync(CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    repoExcludePatterns = cfg.repoExcludePatterns || [];
  }
} catch (err) {
  repoExcludePatterns = [];
}

if (repoExcludePatterns && repoExcludePatterns.length > 0) {
  const patterns = repoExcludePatterns.map(p => p.trim()).filter(Boolean);
  const shouldExclude = (repoName) => {
    if (!repoName) return false;
    for (const pat of patterns) {
      if (pat.includes('/')) {
        // full owner/repo or prefix match
        if (repoName.toLowerCase() === pat.toLowerCase() || repoName.toLowerCase().startsWith(pat.toLowerCase()+"/")) return true;
      }
      // owner-only match or substring
      const owner = repoName.split('/')[0];
      if (owner.toLowerCase() === pat.toLowerCase()) return true;
      if (repoName.toLowerCase().includes(pat.toLowerCase())) return true;
    }
    return false;
  };

  const before = repos.length;
  const filtered = repos.filter(r => !shouldExclude(r.repo));
  console.log(`Filtered ${before - filtered.length} repos via repoExcludePatterns`);
  // replace repos with filtered list
  repos.length = 0;
  filtered.forEach(x => repos.push(x));
}

// Staff-only filtered series to enable staff segmentation without per-person queries
const staffSeries = series.map(week => {
  const filtered = {};
  for (const [author, metrics] of Object.entries(week.byAuthor)) {
    if (staffAllowList.includes(author)) {
      filtered[author] = metrics;
    }
  }
  return { week_start: week.week_start, byAuthor: filtered };
});

const output = {
  generated_at: new Date().toISOString(),
  org: ORG_ALLOWLIST[0] || "",
  orgs: ORG_ALLOWLIST,
  weeks: weeks,
  authors: authors,
  series: series,
  staff_allowlist: staffAllowList,
  staff_authors: staffAuthors,
  staff_series: staffSeries
  ,repos: repos
};

// Include config flags for frontend visibility
try {
  const CONFIG_PATH = path.join('scripts', 'config.json');
  if (fs.existsSync(CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    output.collectAllPublic = cfg.collectAllPublic || false;
    output.licenseFilter = cfg.licenseFilter || 'oss';
  } else {
    output.collectAllPublic = false;
    output.licenseFilter = 'oss';
  }
} catch (err) {
  output.collectAllPublic = false;
  output.licenseFilter = 'oss';
}

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`Exported metrics to ${OUT_PATH}`);
