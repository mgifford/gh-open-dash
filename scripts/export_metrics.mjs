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
const issuesOpenedRaw = getData('issue_opened');

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
      weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, issues_opened: 0 };
    }
    weekEntry.byAuthor[row.author][key] = row.count;
  });
};

fill(prOpenedRaw, 'prs_opened');
fill(prMergedRaw, 'prs_merged');
fill(issuesOpenedRaw, 'issues_opened');

const series = Array.from(seriesMap.values());

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
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`Exported metrics to ${OUT_PATH}`);
