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
const weeks = db.prepare(`
  SELECT DISTINCT week_start FROM pr_opened
  UNION
  SELECT DISTINCT week_start FROM pr_merged
  UNION
  SELECT DISTINCT week_start FROM issue_opened
  ORDER BY week_start
`).all().map(r => r.week_start);

// Fetch all authors
const authors = db.prepare(`
  SELECT DISTINCT author FROM pr_opened
  UNION
  SELECT DISTINCT author FROM pr_merged
  UNION
  SELECT DISTINCT author FROM issue_opened
  ORDER BY author COLLATE NOCASE
`).all().map(r => r.author);

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
      weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 };
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

// Aggregate per-repo totals (across all time) and per-author per-repo counts
const repoMap = new Map();

const addRepoRow = (row, key) => {
  if (!row || !row.repo) return;
  const repo = row.repo;
  const spdx = row.spdx || null;
  if (!repoMap.has(repo)) {
    repoMap.set(repo, { repo, spdx, totals: { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 }, byAuthor: {} });
  }
  const entry = repoMap.get(repo);
  if (!entry.byAuthor[row.author]) entry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 };
  entry.byAuthor[row.author][key] = (entry.byAuthor[row.author][key] || 0) + row.count;
  entry.totals[key] = (entry.totals[key] || 0) + row.count;
  if (!entry.spdx && row.spdx) entry.spdx = row.spdx;
};

// fetch per-repo per-author counts for each table
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

const repos = Array.from(repoMap.values());

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
