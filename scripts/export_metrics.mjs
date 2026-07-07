import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join('data', 'participation.sqlite');
const OUT_PATH = path.join('data', 'metrics.json');
const STAFF_ALLOWLIST_PATH = path.join('scripts', 'staff_allowlist.json');
const CONFIG_PATH = path.join('scripts', 'config.json');
const ALLOWLIST_PATH = path.join('scripts', 'oss_spdx_allowlist.json');

const defaultConfig = {
  orgAllowlist: ['civicactions'],
  collectAllPublic: false,
  licenseFilter: 'oss'
};

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      // Backfill defaults
      if (typeof c.collectAllPublic === 'undefined') c.collectAllPublic = defaultConfig.collectAllPublic;
      if (typeof c.licenseFilter === 'undefined') c.licenseFilter = defaultConfig.licenseFilter;
      return c;
    } catch (err) {
      console.warn('Failed to parse config.json in export; using defaults', err.message);
    }
  }
  return { ...defaultConfig };
}

const fileConfig = loadConfig();

function parseAllowlist(input, fallback) {
  const raw = (typeof input === 'undefined' || input === null) ? fallback : input;
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

const ORG_ALLOWLIST = parseAllowlist(process.env.ORG_ALLOWLIST, fileConfig.orgAllowlist || defaultConfig.orgAllowlist);
const SPDX_ALLOWLIST = fs.existsSync(ALLOWLIST_PATH) ? JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')) : [];

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found');
  process.exit(1);
}

const db = new Database(DB_PATH);

// Helper to decide if a repo row should be included in the export based on current config
// (Simulates filtering on the view layer so toggling config changes output immediately)
const shouldIncludeRepo = (repo, spdx) => {
  // 1. Check License Filter
  // If filter is 'oss', we require SPDX to be in allowlist.
  if (fileConfig.licenseFilter === 'oss') {
    if (!spdx || !SPDX_ALLOWLIST.includes(spdx)) return false;
  }
  
  // 2. Check Collection Mode (Org Only vs All Public)
  // If collectAllPublic is FALSE, we only include repos belonging to orgAllowlist.
  if (!fileConfig.collectAllPublic) {
    if (!repo) return false;
    const owner = repo.split('/')[0];
    // Check if owner is in allowlist (case-insensitive check is safer)
    if (!ORG_ALLOWLIST.some(o => o.toLowerCase() === owner.toLowerCase())) {
      return false;
    }
  }

  return true;
};

// Start export logic
// ...

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

// Ensure comment_counts table exists (create schema-only when missing)
if (!tableExists('comment_counts')) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_counts (
      week_start TEXT,
      author TEXT,
      repo TEXT,
      spdx TEXT,
      kind TEXT,
      count INTEGER,
      PRIMARY KEY (week_start, author, repo, kind)
    );
  `);
  console.log('Created missing table: comment_counts (schema-only)');
}

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
// We only want authors who have at least one valid contribution under current filters.
// But simplifying: we can just fetch all and let the counts be 0 if filtered.
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
// REPLACED: Simple SQL aggregation with in-memory filtering to respect config
const getData = (table) => {
  const rows = db.prepare(`SELECT week_start, author, repo, spdx, count(*) as count FROM ${table} GROUP BY week_start, author, repo, spdx`).all();
  // Filter and re-aggregate by (week, author)
  const aggregated = new Map(); // key="week||author" -> count
  
  for (const r of rows) {
    if (shouldIncludeRepo(r.repo, r.spdx)) {
      const key = `${r.week_start}||${r.author}`;
      aggregated.set(key, (aggregated.get(key) || 0) + r.count);
    }
  }
  
  // Transform back to object list
  const out = [];
  for (const [k, count] of aggregated.entries()) {
    const [week_start, author] = k.split('||');
    out.push({ week_start, author, count });
  }
  return out;
};

const prOpenedRaw = getData('pr_opened');
const prMergedRaw = getData('pr_merged');
const prClosedRaw = getData('pr_closed');
const issuesOpenedRaw = getData('issue_opened');
const issuesClosedRaw = getData('issue_closed');

// Commits table (already has repo/spdx columns)
const getCommitsData = () => {
  const rows = db.prepare(`SELECT week_start, author, repo, spdx, count(*) as count FROM commits GROUP BY week_start, author, repo, spdx`).all();
  const aggregated = new Map();
  for (const r of rows) {
    if (shouldIncludeRepo(r.repo, r.spdx)) {
      const key = `${r.week_start}||${r.author}`;
      aggregated.set(key, (aggregated.get(key) || 0) + r.count);
    }
  }
  const out = [];
  for (const [k, count] of aggregated.entries()) {
    const [week_start, author] = k.split('||');
    out.push({ week_start, author, count });
  }
  return out;
};
const commitsRaw = getCommitsData();

// Meeting mentions grouped by week/author
let meetingMentionsRaw = [];
if (tableExists('meeting_mentions')) {
  const rows = db.prepare(`SELECT week_start, author, repo, spdx, count(*) as count FROM meeting_mentions GROUP BY week_start, author, repo, spdx`).all();
  const agg = new Map();
  for (const r of rows) {
    if (shouldIncludeRepo(r.repo, r.spdx)) {
      const key = `${r.week_start}||${r.author}`;
      agg.set(key, (agg.get(key) || 0) + r.count);
    }
  }
  for (const [k, count] of agg.entries()) {
    const [week_start, author] = k.split('||');
    meetingMentionsRaw.push({ week_start, author, count });
  }
  if (meetingMentionsRaw.length > 0) {
    console.log(`Exported ${meetingMentionsRaw.length} meeting mention records`);
  }
}

// comment counts grouped by week/author/kind
let commentCountsRaw = [];
if (tableExists('comment_counts')) {
  // original: db.prepare(`SELECT week_start, author, kind, SUM(count) as count FROM comment_counts GROUP BY week_start, author, kind`).all();
  // New: fetch with repo/spdx to filter
  const rows = db.prepare(`SELECT week_start, author, repo, spdx, kind, count FROM comment_counts`).all();
  const agg = new Map(); // "week||author||kind" -> count
  for (const r of rows) {
    if (shouldIncludeRepo(r.repo, r.spdx)) {
      const key = `${r.week_start}||${r.author}||${r.kind}`;
      agg.set(key, (agg.get(key) || 0) + r.count);
    }
  }
  for (const [k, count] of agg.entries()) {
    const [week_start, author, kind] = k.split('||');
    commentCountsRaw.push({ week_start, author, kind, count });
  }
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
      weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0, meeting_mentions: 0 };
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
fill(meetingMentionsRaw, 'meeting_mentions');

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
    weekEntry.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0, comments_issue: 0, comments_pr_review: 0, comments_commit: 0, meeting_mentions: 0 };
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
      weekly: new Map() // week_start -> { week_start, totals, byAuthor }
    });
  }
  const e = repoMap.get(repo);
  if (!e.spdx && spdx) e.spdx = spdx;
  return e;
};

const ensureRepoWeek = (entry, week) => {
  if (!entry.weekly.has(week)) {
    entry.weekly.set(week, {
      week_start: week,
      totals: { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 },
      byAuthor: {}
    });
  }
  return entry.weekly.get(week);
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
  const w = ensureRepoWeek(entry, row.week_start);
  w.totals[key] = (w.totals[key] || 0) + row.count;
  if (row.author) {
    if (!w.byAuthor[row.author]) {
      w.byAuthor[row.author] = { prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0, commits: 0 };
    }
    w.byAuthor[row.author][key] = (w.byAuthor[row.author][key] || 0) + row.count;
  }
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

// fetch per-repo per-week (per-author) totals so the UI can produce time-windowed
// repo aggregates and a per-project history broken down by contributor/company.
const prOpenedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM pr_opened GROUP BY repo, week_start, author`).all();
const prMergedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM pr_merged GROUP BY repo, week_start, author`).all();
const prClosedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM pr_closed GROUP BY repo, week_start, author`).all();
const issuesOpenedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM issue_opened GROUP BY repo, week_start, author`).all();
const issuesClosedByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM issue_closed GROUP BY repo, week_start, author`).all();
const commitsByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, count(*) as count FROM commits GROUP BY repo, week_start, author`).all();

prOpenedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_opened'));
prMergedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_merged'));
prClosedByRepoWeek.forEach(r => addRepoWeekRow(r, 'prs_closed'));
issuesOpenedByRepoWeek.forEach(r => addRepoWeekRow(r, 'issues_opened'));
issuesClosedByRepoWeek.forEach(r => addRepoWeekRow(r, 'issues_closed'));
commitsByRepoWeek.forEach(r => addRepoWeekRow(r, 'commits'));

// comment counts per-repo per-week per-author, so org-scoped views can
// include comment activity alongside PRs/issues/commits.
const commentsByRepoWeek = db.prepare(`SELECT repo, COALESCE(spdx, '') as spdx, week_start, author, kind, SUM(count) as count FROM comment_counts GROUP BY repo, week_start, author, kind`).all();
commentsByRepoWeek.forEach(r => {
  const kindKeyMap = { issue_comment: 'comments_issue', pr_review_comment: 'comments_pr_review', commit_comment: 'comments_commit' };
  const key = kindKeyMap[r.kind];
  if (key) addRepoWeekRow({ repo: r.repo, spdx: r.spdx, week_start: r.week_start, author: r.author, count: r.count }, key);
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

// Collect PR details for merge time and size analytics
const prDetailsData = [];
if (tableExists('pr_details')) {
  const rows = db.prepare(`
    SELECT week_start, author, repo, pr_number, created_at, merged_at, closed_at, additions, deletions 
    FROM pr_details 
    ORDER BY week_start, repo, pr_number
  `).all();
  
  for (const row of rows) {
    if (shouldIncludeRepo(row.repo, null)) {
      // Calculate merge time in hours if both created_at and merged_at exist
      let mergeTimeHours = null;
      if (row.created_at && row.merged_at) {
        const created = new Date(row.created_at);
        const merged = new Date(row.merged_at);
        mergeTimeHours = (merged - created) / (1000 * 60 * 60);
      }
      
      prDetailsData.push({
        week_start: row.week_start,
        author: row.author,
        repo: row.repo,
        pr_number: row.pr_number,
        merge_time_hours: mergeTimeHours,
        additions: row.additions,
        deletions: row.deletions,
        total_changes: row.additions + row.deletions,
        was_merged: !!row.merged_at,
        was_closed_without_merge: !!row.closed_at && !row.merged_at
      });
    }
  }
}

// Collect issue labels
const issueLabelsData = [];
if (tableExists('issue_labels')) {
  const rows = db.prepare(`
    SELECT week_start, author, repo, issue_number, labels 
    FROM issue_labels 
    ORDER BY week_start, repo, issue_number
  `).all();
  
  for (const row of rows) {
    if (shouldIncludeRepo(row.repo, null)) {
      issueLabelsData.push({
        week_start: row.week_start,
        author: row.author,
        repo: row.repo,
        issue_number: row.issue_number,
        labels: JSON.parse(row.labels || '[]')
      });
    }
  }
}

// Collect repo stars
const repoStarsData = [];
if (tableExists('repo_stars')) {
  const rows = db.prepare(`
    SELECT week_start, repo, stars 
    FROM repo_stars 
    ORDER BY week_start, repo
  `).all();
  
  for (const row of rows) {
    if (shouldIncludeRepo(row.repo, null)) {
      repoStarsData.push({
        week_start: row.week_start,
        repo: row.repo,
        stars: row.stars
      });
    }
  }
}

// Collect workflow run data
const workflowRunsData = [];
if (tableExists('workflow_runs')) {
  const rows = db.prepare(`
    SELECT week_start, repo, workflow_name, run_count
    FROM workflow_runs
    ORDER BY week_start, repo, workflow_name
  `).all();

  for (const row of rows) {
    if (shouldIncludeRepo(row.repo, null)) {
      workflowRunsData.push({
        week_start: row.week_start,
        repo: row.repo,
        workflow_name: row.workflow_name,
        run_count: row.run_count
      });
    }
  }
  if (workflowRunsData.length > 0) {
    console.log(`Exported ${workflowRunsData.length} workflow run records`);
  }
}

const output = {
  generated_at: new Date().toISOString(),
  org: ORG_ALLOWLIST[0] || "",
  orgs: ORG_ALLOWLIST,
  weeks: weeks,
  authors: authors,
  series: series,
  staff_allowlist: staffAllowList,
  staff_authors: staffAuthors,
  staff_series: staffSeries,
  repos: repos,
  pr_details: prDetailsData,
  issue_labels: issueLabelsData,
  repo_stars: repoStarsData,
  workflow_runs: workflowRunsData.length > 0 ? workflowRunsData : undefined
};

// Export Ecosyste.ms data if tables exist
const ecosystemsReposTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ecosystems_repos'`).get();
if (ecosystemsReposTable) {
  try {
    // Get the most recent timestamp for each repo
    const ecosystemsRepos = db.prepare(`
      SELECT repo, health_score, maintenance_status, archived, 
             dependency_count, dependent_repos_count, language, license, topics
      FROM ecosystems_repos
      WHERE timestamp = (
        SELECT MAX(timestamp) FROM ecosystems_repos WHERE repo = ecosystems_repos.repo
      )
    `).all();
    
    const ecosystemsIssueStats = db.prepare(`
      SELECT repo, total_issues, open_issues, closed_issues,
             avg_time_to_close, avg_comments_per_issue
      FROM ecosystems_issue_stats
      WHERE timestamp = (
        SELECT MAX(timestamp) FROM ecosystems_issue_stats WHERE repo = ecosystems_issue_stats.repo
      )
    `).all();
    
    const ecosystemsCommitStats = db.prepare(`
      SELECT repo, total_commits, total_committers, 
             avg_commits_per_week, last_commit_at
      FROM ecosystems_commit_stats
      WHERE timestamp = (
        SELECT MAX(timestamp) FROM ecosystems_commit_stats WHERE repo = ecosystems_commit_stats.repo
      )
    `).all();
    
    // Parse topics JSON
    const ecosystemsReposParsed = ecosystemsRepos.map(r => ({
      ...r,
      topics: r.topics ? JSON.parse(r.topics) : []
    }));
    
    output.ecosystems = {
      repositories: ecosystemsReposParsed,
      issue_stats: ecosystemsIssueStats,
      commit_stats: ecosystemsCommitStats
    };
    
    console.log(`Exported Ecosyste.ms data: ${ecosystemsReposParsed.length} repos`);
  } catch (err) {
    console.warn('Error exporting Ecosyste.ms data:', err.message);
  }
}

// Export open-contributions descriptor data if table exists
const openContribTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='open_contributions'`).get();
if (openContribTable) {
  try {
    const rows = db.prepare(`
      SELECT repo, fetched_at, has_descriptor, descriptor_json
      FROM open_contributions
      ORDER BY repo
    `).all();
    output.open_contributions = rows.map(r => ({
      repo: r.repo,
      fetched_at: r.fetched_at,
      has_descriptor: !!r.has_descriptor,
      descriptor: r.descriptor_json ? JSON.parse(r.descriptor_json) : null
    }));
    const withDescriptor = output.open_contributions.filter(r => r.has_descriptor).length;
    console.log(`Exported open-contributions data: ${rows.length} repos checked, ${withDescriptor} have a descriptor`);
  } catch (err) {
    console.warn('Error exporting open-contributions data:', err.message);
  }
}

// Export contributor company/team attribution (optional; populated only when
// collectCompanyData has been enabled and the collector has run at least once).
if (tableExists('contributor_company')) {
  try {
    const rows = db.prepare(`SELECT author, company, team, source FROM contributor_company`).all();
    const contributorCompany = {};
    for (const row of rows) {
      contributorCompany[row.author] = {
        company: row.company || null,
        team: row.team || null,
        source: row.source || null
      };
    }
    output.contributor_company = contributorCompany;
    const withCompany = Object.values(contributorCompany).filter(c => c.company).length;
    console.log(`Exported contributor_company: ${rows.length} authors, ${withCompany} with a known company`);
  } catch (err) {
    console.warn('Error exporting contributor_company data:', err.message);
  }
}

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
