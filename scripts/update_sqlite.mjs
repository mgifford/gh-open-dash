import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { 
  createEcosystemsTables, 
  collectEcosystemsData, 
  storeEcosystemsData 
} from './ecosystems_collector.mjs';
import {
  createOpenContributionsTable,
  collectOpenContributions
} from './open_contributions_collector.mjs';
import {
  createCompanyTable,
  collectCompanyData
} from './company_collector.mjs';

const DB_PATH = path.join('data', 'participation.sqlite');
const ALLOWLIST_PATH = path.join('scripts', 'oss_spdx_allowlist.json');
const STAFF_ALLOWLIST_PATH = path.join('scripts', 'staff_allowlist.json');
const COMPANY_ROSTER_PATH = path.join('scripts', 'company_roster.json');
const CONFIG_PATH = path.join('scripts', 'config.json');

const defaultConfig = {
  orgAllowlist: ['civicactions'],
  historyWeeks: 52,
  maxWeeksPerRun: 2
};

const SUPPORTED_FLAGS = new Set(['--status', '--dry-run']);
const cliArgs = process.argv.slice(2);
for (const arg of cliArgs) {
  if (!SUPPORTED_FLAGS.has(arg)) {
    console.error(`Unsupported argument: ${arg}`);
    process.exit(2);
  }
}
const STATUS_ONLY = cliArgs.includes('--status') || cliArgs.includes('--dry-run');

const fileConfig = loadConfig();

// Backwards compatible defaults for new features
if (typeof fileConfig.collectAllPublic === 'undefined') fileConfig.collectAllPublic = false;
if (typeof fileConfig.licenseFilter === 'undefined') fileConfig.licenseFilter = 'oss';
if (typeof fileConfig.collectEcosystemsData === 'undefined') fileConfig.collectEcosystemsData = false;
if (typeof fileConfig.collectOpenContributions === 'undefined') fileConfig.collectOpenContributions = false;
if (typeof fileConfig.collectWorkflowRuns === 'undefined') fileConfig.collectWorkflowRuns = false;
if (typeof fileConfig.collectMeetingMentions === 'undefined') fileConfig.collectMeetingMentions = false;
if (typeof fileConfig.collectCompanyData === 'undefined') fileConfig.collectCompanyData = false;

function parseAllowlist(input, fallback) {
  const raw = (typeof input === 'undefined' || input === null) ? fallback : input;
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

const ORG_ALLOWLIST = parseAllowlist(process.env.ORG_ALLOWLIST, fileConfig.orgAllowlist || defaultConfig.orgAllowlist);

const parsedHistoryWeeks = Number.parseInt(process.env.HISTORY_WEEKS || fileConfig.historyWeeks || defaultConfig.historyWeeks, 10);
const HISTORY_WEEKS = Number.isFinite(parsedHistoryWeeks) ? parsedHistoryWeeks : defaultConfig.historyWeeks;

const parsedMaxWeeksPerRun = Number.parseInt(process.env.MAX_WEEKS_PER_RUN || fileConfig.maxWeeksPerRun || defaultConfig.maxWeeksPerRun, 10);
const MAX_WEEKS_PER_RUN = Number.isFinite(parsedMaxWeeksPerRun) ? parsedMaxWeeksPerRun : defaultConfig.maxWeeksPerRun;

const reprocessFromWeekEnv = process.env.REPROCESS_FROM_WEEK;
const parsedReprocessWeeks = Number.parseInt(process.env.REPROCESS_WEEKS || '0', 10);
const RATE_LIMIT_BUFFER_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const GRAPHQL_RATE_LIMIT_MIN_REMAINING = 50;

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

// Load allowlist
const allowList = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const staffAllowList = loadStaffAllowList();
const companyRoster = loadCompanyRoster();
// Load repo exclude patterns from config (owner or owner/repo or substring)
const repoExcludePatterns = (fileConfig.repoExcludePatterns && Array.isArray(fileConfig.repoExcludePatterns)) ? fileConfig.repoExcludePatterns.map(p => String(p).trim()).filter(Boolean) : [];

function repoShouldBeExcluded(repoName) {
  if (!repoName || repoExcludePatterns.length === 0) return false;
  const lower = repoName.toLowerCase();
  for (const pat of repoExcludePatterns) {
    const p = pat.toLowerCase();
    if (p.includes('/')) {
      // full owner/repo or prefix
      if (lower === p || lower.startsWith(p + '/')) return true;
    }
    const owner = lower.split('/')[0];
    if (owner === p) return true;
    if (lower.includes(p)) return true;
  }
  return false;
}

// Initialize DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pr_opened (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS pr_merged (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS pr_closed (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS commits (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS comment_counts (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    kind TEXT,
    count INTEGER,
    PRIMARY KEY (week_start, author, repo, kind)
  );
  CREATE TABLE IF NOT EXISTS issue_opened (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS issue_closed (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS pr_details (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    pr_number INTEGER,
    created_at TEXT,
    merged_at TEXT,
    closed_at TEXT,
    additions INTEGER,
    deletions INTEGER,
    PRIMARY KEY (week_start, repo, pr_number)
  );
  CREATE TABLE IF NOT EXISTS issue_labels (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    issue_number INTEGER,
    labels TEXT,
    PRIMARY KEY (week_start, repo, issue_number)
  );
  CREATE TABLE IF NOT EXISTS repo_stars (
    week_start TEXT,
    repo TEXT,
    stars INTEGER,
    PRIMARY KEY (week_start, repo)
  );
  CREATE TABLE IF NOT EXISTS workflow_runs (
    week_start TEXT,
    repo TEXT,
    workflow_name TEXT,
    run_count INTEGER DEFAULT 0,
    PRIMARY KEY (week_start, repo, workflow_name)
  );
  CREATE TABLE IF NOT EXISTS meeting_mentions (
    week_start TEXT,
    author TEXT,
    repo TEXT,
    spdx TEXT,
    PRIMARY KEY (week_start, author, repo)
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS weeks_collected (
    week_start TEXT PRIMARY KEY,
    collected_at TEXT
  );
  CREATE TABLE IF NOT EXISTS weeks_metrics_collected (
    week_start TEXT,
    metric_key TEXT,
    collected_at TEXT,
    PRIMARY KEY (week_start, metric_key)
  );
`);

// Create Ecosyste.ms tables
createEcosystemsTables(db);
// Create open-contributions descriptor table
createOpenContributionsTable(db);
// Create contributor company/team attribution table
createCompanyTable(db);

const getMeta = (key) => {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setMeta = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
};

const isWeekCollected = (weekStart) => {
  const row = db.prepare('SELECT 1 FROM weeks_collected WHERE week_start = ?').get(weekStart);
  return !!row;
};

const markWeekCollected = (weekStart) => {
  db.prepare('INSERT OR REPLACE INTO weeks_collected (week_start, collected_at) VALUES (?, ?)')
    .run(weekStart, new Date().toISOString());
};

const clearWeekCollected = (weekStart) => {
  db.prepare('DELETE FROM weeks_collected WHERE week_start = ?').run(weekStart);
};

const isWeekMetricCollected = (weekStart, metricKey) => {
  const row = db.prepare('SELECT 1 FROM weeks_metrics_collected WHERE week_start = ? AND metric_key = ?').get(weekStart, metricKey);
  return !!row;
};

const markWeekMetricCollected = (weekStart, metricKey) => {
  db.prepare('INSERT OR REPLACE INTO weeks_metrics_collected (week_start, metric_key, collected_at) VALUES (?, ?, ?)')
    .run(weekStart, metricKey, new Date().toISOString());
};

const clearWeekMetricsCollected = (weekStart) => {
  db.prepare('DELETE FROM weeks_metrics_collected WHERE week_start = ?').run(weekStart);
};

const countWeekMetricsCollected = (weekStart, metricKeys) => {
  if (metricKeys.length === 0) return 0;
  const placeholders = metricKeys.map(() => '?').join(', ');
  const row = db.prepare(`
    SELECT COUNT(*) AS c
    FROM weeks_metrics_collected
    WHERE week_start = ?
      AND metric_key IN (${placeholders})
  `).get(weekStart, ...metricKeys);
  return row ? row.c : 0;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Date helpers
function getMonday(d) {
  d = new Date(d);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function addDays(d, days) {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function loadStaffAllowList() {
  if (process.env.STAFF_ALLOWLIST_JSON) {
    try {
      return JSON.parse(process.env.STAFF_ALLOWLIST_JSON);
    } catch (err) {
      console.warn('Failed to parse STAFF_ALLOWLIST_JSON env; falling back to file if present:', err.message);
    }
  }
  if (fs.existsSync(STAFF_ALLOWLIST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STAFF_ALLOWLIST_PATH, 'utf8'));
    } catch (err) {
      console.warn('Failed to parse staff_allowlist.json; defaulting to empty list:', err.message);
      return [];
    }
  }
  return [];
}

function loadCompanyRoster() {
  if (process.env.COMPANY_ROSTER_JSON) {
    try {
      return JSON.parse(process.env.COMPANY_ROSTER_JSON);
    } catch (err) {
      console.warn('Failed to parse COMPANY_ROSTER_JSON env; falling back to file if present:', err.message);
    }
  }
  if (fs.existsSync(COMPANY_ROSTER_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(COMPANY_ROSTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('Failed to parse company_roster.json; defaulting to empty roster:', err.message);
      return {};
    }
  }
  return {};
}

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      console.warn('Failed to parse config.json; defaulting to built-in defaults:', err.message);
    }
  }
  return { ...defaultConfig };
}

function buildWeeklyMetricKeys() {
  const keys = [];

  for (const org of ORG_ALLOWLIST) {
    keys.push(`pr_opened:org:${org}`);
    keys.push(`pr_merged:org:${org}`);
    keys.push(`pr_closed:org:${org}`);
    keys.push(`issue_opened:org:${org}`);
    keys.push(`issue_closed:org:${org}`);

    if (fileConfig.collectWorkflowRuns) {
      keys.push(`workflow_runs:org:${org}`);
    }

    if (fileConfig.collectMeetingMentions) {
      keys.push(`meeting_mentions:org:${org}`);
    }
  }

  for (const user of staffAllowList) {
    if (fileConfig.collectAllPublic) {
      keys.push(`pr_opened:staff:${user}`);
      keys.push(`pr_merged:staff:${user}`);
      keys.push(`pr_closed:staff:${user}`);
      keys.push(`issue_opened:staff:${user}`);
      keys.push(`issue_closed:staff:${user}`);
    }

    if (fileConfig.collectStaffCommits) {
      keys.push(`commits:${user}`);
    }
  }

  return keys;
}

function getWindowWeeks(historyStart, lastCompleteWeekStart) {
  const weeks = [];
  let p = new Date(lastCompleteWeekStart);
  while (p.getTime() >= historyStart.getTime()) {
    weeks.push(toISODate(p));
    p = addDays(p, -7);
  }
  return weeks;
}

function printCollectionStatus({ historyStart, lastCompleteWeekStart, weeksPending, weeklyMetricKeys }) {
  const windowWeeks = getWindowWeeks(historyStart, lastCompleteWeekStart);
  const partialWeeks = [];
  for (const weekStart of windowWeeks) {
    if (isWeekCollected(weekStart)) continue;
    const collectedMetrics = countWeekMetricsCollected(weekStart, weeklyMetricKeys);
    if (collectedMetrics > 0) {
      partialWeeks.push({
        weekStart,
        collectedMetrics
      });
    }
  }

  const totalWeeks = windowWeeks.length;
  const collectedWeeks = totalWeeks - weeksPending.length;

  console.log('Collector cache status');
  console.log(`Last complete week start: ${toISODate(lastCompleteWeekStart)}`);
  console.log(`History start: ${toISODate(historyStart)} (${HISTORY_WEEKS} weeks)`);
  console.log(`Weeks in window: ${totalWeeks}`);
  console.log(`Weeks fully collected: ${collectedWeeks}`);
  console.log(`Weeks partially collected: ${partialWeeks.length}`);
  console.log(`Weeks pending: ${weeksPending.length}`);
  console.log(`Checkpointed metrics per week: ${weeklyMetricKeys.length}`);

  if (partialWeeks.length > 0) {
    console.log('Partial weeks:');
    for (const partial of partialWeeks.slice(0, 10)) {
      console.log(`  ${partial.weekStart}: ${partial.collectedMetrics}/${weeklyMetricKeys.length} metrics cached`);
    }
    if (partialWeeks.length > 10) {
      console.log(`  …and ${partialWeeks.length - 10} more partial week(s)`);
    }
  }
}

async function waitForGraphqlRateLimit(headers, contextLabel) {
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const resetAt = Number(headers.get('x-ratelimit-reset'));
  if (!Number.isFinite(remaining) || !Number.isFinite(resetAt)) return;
  if (remaining > GRAPHQL_RATE_LIMIT_MIN_REMAINING) return;

  const now = Date.now();
  const waitMs = Math.max(resetAt * 1000 - now + RATE_LIMIT_BUFFER_MS, 0);
  if (waitMs <= 0) return;

  const waitSeconds = Math.ceil(waitMs / 1000);
  console.log(`[${contextLabel}] GraphQL remaining budget is ${remaining}; waiting ${waitSeconds}s for reset.`);
  await sleep(waitMs);
}

function isGraphqlRateLimitedError(err) {
  if (err?.status === 403 || err?.status === 429) return true;
  return Array.isArray(err?.errors) && err.errors.some(e => e.type === 'RATE_LIMIT' || e.type === 'RATE_LIMITED');
}

function getGraphqlRateLimitWaitMs(err, attempt) {
  const resetAt = Number(err?.headers?.['x-ratelimit-reset']) || null;
  const now = Date.now();
  return resetAt
    ? Math.max(resetAt * 1000 - now + RATE_LIMIT_BUFFER_MS, RETRY_DELAY_MS * attempt)
    : RETRY_DELAY_MS * attempt;
}

function createGraphqlClient(token) {
  return async (query, variables, contextLabel = 'graphql') => {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `token ${token}`,
        'content-type': 'application/json',
        'user-agent': 'gh-open-dash-collector'
      },
      body: JSON.stringify({ query, variables })
    });

    const rawBody = await res.text();
    let payload = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        payload = null;
      }
    }

    if (!res.ok || payload?.errors?.length) {
      const error = new Error(
        payload?.errors?.map(e => e.message).join('; ')
        || rawBody
        || `HTTP ${res.status}`
      );
      error.status = res.status;
      error.errors = payload?.errors || [];
      error.headers = {
        'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
        'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining')
      };
      throw error;
    }

    await waitForGraphqlRateLimit(res.headers, contextLabel);
    return payload.data;
  };
}

async function runCheckpointedMetric(weekStart, metricKey, action) {
  if (isWeekMetricCollected(weekStart, metricKey)) {
    console.log(`  Skipping cached metric ${metricKey} (${weekStart})`);
    return false;
  }

  await action();
  markWeekMetricCollected(weekStart, metricKey);
  return true;
}

// Main logic
async function run() {
  const now = new Date();
  
  const currentWeekStart = getMonday(now);
  const lastCompleteWeekStart = addDays(currentWeekStart, -7);

  // The earliest week we ever want to collect (configurable history window).
  const historyStart = getMonday(addDays(lastCompleteWeekStart, -HISTORY_WEEKS * 7));

  // -----------------------------------------------------------------------
  // Migrate old linear watermark → per-week tracking (runs once on upgrade)
  // -----------------------------------------------------------------------
  const processedThrough = getMeta('processed_through_week');
  const collectedCount = db.prepare('SELECT COUNT(*) as c FROM weeks_collected').get().c;
  if (processedThrough && collectedCount === 0) {
    console.log(`Migrating watermark ${processedThrough} → weeks_collected table…`);
    const watermarkDate = new Date(processedThrough);
    const insertMig = db.prepare('INSERT OR IGNORE INTO weeks_collected (week_start, collected_at) VALUES (?, ?)');
    const migNow = new Date().toISOString();
    const doMigrate = db.transaction(() => {
      let p = getMonday(historyStart);
      while (p.getTime() <= watermarkDate.getTime()) {
        insertMig.run(toISODate(p), migNow);
        p = addDays(p, 7);
      }
    });
    doMigrate();
    console.log(`Migration complete.`);
  }

  // -----------------------------------------------------------------------
  // Handle reprocess overrides: clear weeks_collected for the target range
  // so they will be re-fetched from the API.
  // -----------------------------------------------------------------------
  let reprocessStart = null;
  const reprocessEnd = lastCompleteWeekStart;

  if (reprocessFromWeekEnv) {
    const candidate = getMonday(new Date(reprocessFromWeekEnv));
    if (Number.isNaN(candidate.getTime())) {
      console.warn(`REPROCESS_FROM_WEEK is invalid (${reprocessFromWeekEnv}); ignoring.`);
    } else {
      reprocessStart = candidate;
      console.log(`Reprocessing from week override: ${toISODate(reprocessStart)}`);
    }
  }

  if (!reprocessStart && parsedReprocessWeeks > 0) {
    reprocessStart = addDays(lastCompleteWeekStart, -parsedReprocessWeeks * 7);
    console.log(`Reprocessing last ${parsedReprocessWeeks} weeks.`);
  }

  if (reprocessStart) {
    // Clear per-week tracking for the affected range so they are re-collected
    const clearRange = db.transaction(() => {
      let p = getMonday(reprocessStart);
      while (p.getTime() <= reprocessEnd.getTime()) {
        const weekStart = toISODate(p);
        clearWeekCollected(weekStart);
        clearWeekMetricsCollected(weekStart);
        p = addDays(p, 7);
      }
    });
    clearRange();
    console.log(`Cleared weeks_collected and weeks_metrics_collected for range ${toISODate(reprocessStart)}..${toISODate(reprocessEnd)}.`);
  }

  // -----------------------------------------------------------------------
  // Build the ordered list of weeks to process (newest-first), skipping any
  // week that has already been fully collected.
  // -----------------------------------------------------------------------
  const weeksPending = [];
  {
    let p = lastCompleteWeekStart;
    while (p.getTime() >= historyStart.getTime()) {
      const ws = toISODate(p);
      if (!isWeekCollected(ws)) {
        weeksPending.push(ws);
      }
      p = addDays(p, -7);
    }
  }

  const weeklyMetricKeys = buildWeeklyMetricKeys();

  if (STATUS_ONLY) {
    printCollectionStatus({
      historyStart,
      lastCompleteWeekStart,
      weeksPending,
      weeklyMetricKeys
    });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const graphqlClient = createGraphqlClient(token);

  console.log(`Last complete week start: ${toISODate(lastCompleteWeekStart)}`);
  console.log(`History start: ${toISODate(historyStart)} (${HISTORY_WEEKS} weeks)`);
  console.log(`Org allowlist: ${ORG_ALLOWLIST.join(', ')}`);
  console.log(`Staff allowlist size: ${staffAllowList.length}`);
  const totalInWindow = db.prepare('SELECT COUNT(*) as c FROM weeks_collected WHERE week_start >= ? AND week_start <= ?')
    .get(toISODate(historyStart), toISODate(lastCompleteWeekStart)).c;
  console.log(`Weeks already collected in window: ${totalInWindow}`);
  console.log(`Weeks pending in window: ${weeksPending.length}`);
  console.log(`Max weeks this run: ${MAX_WEEKS_PER_RUN}`);

  if (weeksPending.length === 0) {
    console.log('All weeks in the history window are up to date. Nothing to do.');
  }

  let weeksThisRun = 0;
  for (const weekStartStr of weeksPending) {
    if (weeksThisRun >= MAX_WEEKS_PER_RUN) {
      console.log(`Reached MAX_WEEKS_PER_RUN=${MAX_WEEKS_PER_RUN}; stop here and resume next run.`);
      break;
    }

    const pointer = new Date(weekStartStr);
    const weekEnd = addDays(pointer, 7); 
    const rangeStart = pointer.toISOString();
    const rangeEnd = new Date(weekEnd.getTime() - 1).toISOString(); 

    console.log(`Processing week: ${weekStartStr}`);

    for (const org of ORG_ALLOWLIST) {
      const baseQualifier = `org:${org} is:public`;
      await runCheckpointedMetric(weekStartStr, `pr_opened:org:${org}`, () =>
        processMetric(graphqlClient, 'pr_opened', weekStartStr, `${baseQualifier} is:pr`, 'created', rangeStart, rangeEnd, org)
      );
      await runCheckpointedMetric(weekStartStr, `pr_merged:org:${org}`, () =>
        processMetric(graphqlClient, 'pr_merged', weekStartStr, `${baseQualifier} is:pr`, 'merged', rangeStart, rangeEnd, org)
      );
      await runCheckpointedMetric(weekStartStr, `pr_closed:org:${org}`, () =>
        processMetric(graphqlClient, 'pr_closed', weekStartStr, `${baseQualifier} is:pr`, 'closed', rangeStart, rangeEnd, org)
      );
      await runCheckpointedMetric(weekStartStr, `issue_opened:org:${org}`, () =>
        processMetric(graphqlClient, 'issue_opened', weekStartStr, `${baseQualifier} is:issue`, 'created', rangeStart, rangeEnd, org)
      );
      await runCheckpointedMetric(weekStartStr, `issue_closed:org:${org}`, () =>
        processMetric(graphqlClient, 'issue_closed', weekStartStr, `${baseQualifier} is:issue`, 'closed', rangeStart, rangeEnd, org)
      );
    }

    for (const user of staffAllowList) {
      const label = `staff:${user}`;

      // Only run per-person global public search if collectAllPublic is true.
      // If false, we rely on the org-based collection above.
      if (fileConfig.collectAllPublic) {
        const baseQualifier = `author:${user} is:public`;
        await runCheckpointedMetric(weekStartStr, `pr_opened:staff:${user}`, () =>
          processMetric(graphqlClient, 'pr_opened', weekStartStr, `${baseQualifier} is:pr`, 'created', rangeStart, rangeEnd, label)
        );
        await runCheckpointedMetric(weekStartStr, `pr_merged:staff:${user}`, () =>
          processMetric(graphqlClient, 'pr_merged', weekStartStr, `${baseQualifier} is:pr`, 'merged', rangeStart, rangeEnd, label)
        );
        await runCheckpointedMetric(weekStartStr, `pr_closed:staff:${user}`, () =>
          processMetric(graphqlClient, 'pr_closed', weekStartStr, `${baseQualifier} is:pr`, 'closed', rangeStart, rangeEnd, label)
        );
        await runCheckpointedMetric(weekStartStr, `issue_opened:staff:${user}`, () =>
          processMetric(graphqlClient, 'issue_opened', weekStartStr, `${baseQualifier} is:issue`, 'created', rangeStart, rangeEnd, label)
        );
        await runCheckpointedMetric(weekStartStr, `issue_closed:staff:${user}`, () =>
          processMetric(graphqlClient, 'issue_closed', weekStartStr, `${baseQualifier} is:issue`, 'closed', rangeStart, rangeEnd, label)
        );
      }
      
      if (fileConfig.collectStaffCommits) {
        await runCheckpointedMetric(weekStartStr, `commits:${user}`, () =>
          processStaffCommits(weekStartStr, rangeStart, rangeEnd, user)
        );
      }
    }

    if (fileConfig.collectWorkflowRuns) {
      for (const org of ORG_ALLOWLIST) {
        await runCheckpointedMetric(weekStartStr, `workflow_runs:org:${org}`, () =>
          processWorkflowRuns(weekStartStr, rangeStart, rangeEnd, org)
        );
      }
    }

    if (fileConfig.collectMeetingMentions) {
      for (const org of ORG_ALLOWLIST) {
        await runCheckpointedMetric(weekStartStr, `meeting_mentions:org:${org}`, () =>
          processMeetingMentions(graphqlClient, weekStartStr, rangeStart, rangeEnd, org)
        );
      }
    }

    markWeekCollected(weekStartStr);
    // Keep the legacy watermark updated to the most recently processed week for
    // backward compatibility with any tooling that reads it.
    setMeta('processed_through_week', weekStartStr);
    weeksThisRun++;
  }

  // Collect Ecosyste.ms data if enabled (once per run, not per week)
  if (fileConfig.collectEcosystemsData) {
    try {
      console.log('\n=== Collecting Ecosyste.ms data ===');
      
      // Get list of unique repositories from the database
      const repoRows = db.prepare(`
        SELECT DISTINCT repo FROM (
          SELECT DISTINCT repo FROM pr_opened
          UNION
          SELECT DISTINCT repo FROM issue_opened
          UNION
          SELECT DISTINCT repo FROM commits
        )
      `).all();
      
      const repositories = repoRows.map(r => r.repo).filter(Boolean);
      
      if (repositories.length > 0) {
        console.log(`Found ${repositories.length} unique repositories to enrich with Ecosyste.ms data`);
        
        const ecosystemsData = await collectEcosystemsData(repositories, false);
        const timestamp = new Date().toISOString();
        storeEcosystemsData(db, ecosystemsData, timestamp);
        
        console.log('Ecosyste.ms data collection complete');
      } else {
        console.log('No repositories found to collect Ecosyste.ms data for');
      }
    } catch (err) {
      console.error('Error collecting Ecosyste.ms data:', err);
      // Don't fail the entire update if Ecosyste.ms collection fails
    }
  }

  // Collect open-contributions descriptors if enabled (once per run)
  if (fileConfig.collectOpenContributions) {
    try {
      console.log('\n=== Collecting open-contributions descriptors ===');
      const repoRows = db.prepare(`
        SELECT DISTINCT repo FROM (
          SELECT DISTINCT repo FROM pr_opened
          UNION
          SELECT DISTINCT repo FROM issue_opened
        )
      `).all();
      const repositories = repoRows.map(r => r.repo).filter(Boolean);
      if (repositories.length > 0) {
        await collectOpenContributions(db, repositories, token);
      } else {
        console.log('No repositories found for open-contributions collection');
      }
    } catch (err) {
      console.error('Error collecting open-contributions descriptors:', err);
      // Don't fail the entire update if this optional step fails
    }
  }

  // Collect contributor company/team attribution if enabled (once per run)
  if (fileConfig.collectCompanyData) {
    try {
      console.log('\n=== Collecting contributor company/team attribution ===');
      const authorRows = db.prepare(`
        SELECT DISTINCT author FROM (
          SELECT DISTINCT author FROM pr_opened
          UNION
          SELECT DISTINCT author FROM pr_merged
          UNION
          SELECT DISTINCT author FROM issue_opened
          UNION
          SELECT DISTINCT author FROM commits
        )
      `).all();
      const distinctAuthors = authorRows.map(r => r.author).filter(Boolean);
      if (distinctAuthors.length > 0) {
        await collectCompanyData(db, distinctAuthors, companyRoster, token);
      } else {
        console.log('No authors found for company attribution collection');
      }
    } catch (err) {
      console.error('Error collecting company attribution data:', err);
      // Don't fail the entire update if this optional step fails
    }
  }
}

// MIN_SPLIT_RANGE_MS: never split a time window smaller than 1 hour to avoid infinite recursion
const MIN_SPLIT_RANGE_MS = 60 * 60 * 1000;

// processMetric collects one metric type for a given query base and date range.
// If the API reports more than 1000 matching results (the GitHub search pagination ceiling),
// the range is automatically split in half and each half is processed recursively, ensuring
// no data is silently truncated for large active organisations.
//
// queryBase  – query string WITHOUT the date qualifier (e.g. "org:civicactions is:public is:pr")
// dateQualifier – 'created' | 'merged' | 'closed'
// rangeStart / rangeEnd – ISO datetime strings for the search window
async function processMetric(client, table, weekStart, queryBase, dateQualifier, rangeStart, rangeEnd, contextLabel) {
  const query = `${queryBase} ${dateQualifier}:${rangeStart}..${rangeEnd}`;
  let hasNextPage = true;
  let cursor = null;
  const items = [];
  const prDetails = [];
  const issueLabels = [];
  const repoStars = new Map();
  let skippedMissingRepo = 0;
  let skippedMissingLicense = 0;
  let skippedDisallowedLicense = 0;
  let skippedMissingAuthor = 0;
  let skippedPrivateRepo = 0;
  let firstPage = true;

  while (hasNextPage) {
    const data = await fetchSearchPage(client, query, cursor, `${table}:${contextLabel}`);

    const search = data.search;

    // On the first page, check whether the total result count exceeds the GitHub
    // search pagination ceiling of 1000.  When it does, split the time window in
    // half and recurse rather than silently discarding the overflow items.
    if (firstPage) {
      firstPage = false;
      const issueCount = search.issueCount;
      if (issueCount > 1000) {
        const startMs = new Date(rangeStart).getTime();
        const endMs = new Date(rangeEnd).getTime();
        if ((endMs - startMs) > MIN_SPLIT_RANGE_MS) {
          console.warn(`  [${contextLabel}] ${table}: ${issueCount} results exceed 1000-item API limit for ${rangeStart}..${rangeEnd}. Splitting range.`);
          const midMs = Math.floor((startMs + endMs) / 2);
          const midISO = new Date(midMs).toISOString();
          // Start the second half 1 ms after the midpoint so the two ranges
          // are non-overlapping (GitHub uses inclusive bounds on both ends).
          // GitHub timestamps have millisecond resolution, so there is no gap.
          // Note: one API call is "spent" here to discover the count before
          // splitting; this is an acceptable trade-off to avoid silent data loss.
          const mid1ISO = new Date(midMs + 1).toISOString();
          await processMetric(client, table, weekStart, queryBase, dateQualifier, rangeStart, midISO, contextLabel);
          await processMetric(client, table, weekStart, queryBase, dateQualifier, mid1ISO, rangeEnd, contextLabel);
          return; // sub-ranges handle all insertions; discard partial first-page results
        } else {
          console.warn(`  [${contextLabel}] ${table}: ${issueCount} results exceed API limit but range too small to split further (${rangeStart}..${rangeEnd}); collecting first 1000.`);
        }
      }
    }

    hasNextPage = search.pageInfo.hasNextPage;
    cursor = search.pageInfo.endCursor;

    for (const node of search.nodes) {
      if (!node.repository) { skippedMissingRepo++; continue; }
      if (node.repository.isPrivate) { skippedPrivateRepo++; continue; }
      // licenseInfo may be null; when licenseFilter is 'oss' we require a known spdx in allowList
      const spdx = node.repository.licenseInfo ? node.repository.licenseInfo.spdxId : null;
      if (fileConfig.licenseFilter === 'oss') {
        if (!spdx) { skippedMissingLicense++; continue; }
        if (!allowList.includes(spdx)) { skippedDisallowedLicense++; continue; }
      }
      if (!node.author || !node.author.login) { skippedMissingAuthor++; continue; }
      // repo exclusion patterns
      const repoFull = node.repository.nameWithOwner;
      if (repoShouldBeExcluded(repoFull)) {
        skippedPrivateRepo++; // count as skipped
        continue;
      }

      items.push({
        author: node.author.login,
        repo: node.repository.nameWithOwner,
        spdx: spdx
      });

      // Collect PR details if this is a PR
      if (node.number && (table === 'pr_opened' || table === 'pr_merged' || table === 'pr_closed')) {
        prDetails.push({
          author: node.author.login,
          repo: node.repository.nameWithOwner,
          pr_number: node.number,
          created_at: node.createdAt || null,
          merged_at: node.mergedAt || null,
          closed_at: node.closedAt || null,
          additions: node.additions || 0,
          deletions: node.deletions || 0
        });
      }

      // Collect issue labels if this is an issue
      if (node.number && node.labels && (table === 'issue_opened' || table === 'issue_closed')) {
        const labelNames = node.labels.nodes ? node.labels.nodes.map(l => l.name).filter(Boolean) : [];
        if (labelNames.length > 0) {
          issueLabels.push({
            author: node.author.login,
            repo: node.repository.nameWithOwner,
            issue_number: node.number,
            labels: JSON.stringify(labelNames)
          });
        }
      }

      // Collect repo stars (deduplicate by repo)
      if (node.repository.stargazerCount !== undefined && !repoStars.has(repoFull)) {
        repoStars.set(repoFull, node.repository.stargazerCount);
      }
    }
  }
  
  // Batch insert main items
  const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (week_start, author, repo, spdx) VALUES (?, ?, ?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run(weekStart, row.author, row.repo, row.spdx);
    }
  });

  if (items.length > 0) {
    insertMany(items);
    console.log(`  Inserted ${items.length} records for ${table} (${contextLabel})`);
  }

  // Insert PR details
  if (prDetails.length > 0) {
    const stmtPR = db.prepare(`
      INSERT OR REPLACE INTO pr_details 
      (week_start, author, repo, pr_number, created_at, merged_at, closed_at, additions, deletions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPRs = db.transaction((rows) => {
      for (const row of rows) {
        stmtPR.run(weekStart, row.author, row.repo, row.pr_number, row.created_at, row.merged_at, row.closed_at, row.additions, row.deletions);
      }
    });
    insertPRs(prDetails);
    console.log(`  Inserted ${prDetails.length} PR detail records (${contextLabel})`);
  }

  // Insert issue labels
  if (issueLabels.length > 0) {
    const stmtLabels = db.prepare(`
      INSERT OR REPLACE INTO issue_labels 
      (week_start, author, repo, issue_number, labels) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertLabels = db.transaction((rows) => {
      for (const row of rows) {
        stmtLabels.run(weekStart, row.author, row.repo, row.issue_number, row.labels);
      }
    });
    insertLabels(issueLabels);
    console.log(`  Inserted ${issueLabels.length} issue label records (${contextLabel})`);
  }

  // Insert repo stars
  if (repoStars.size > 0) {
    const stmtStars = db.prepare(`
      INSERT OR REPLACE INTO repo_stars 
      (week_start, repo, stars) 
      VALUES (?, ?, ?)
    `);
    const insertStars = db.transaction(() => {
      for (const [repo, stars] of repoStars.entries()) {
        stmtStars.run(weekStart, repo, stars);
      }
    });
    insertStars();
    console.log(`  Inserted ${repoStars.size} repo star records (${contextLabel})`);
  }

  const skippedTotal = skippedMissingRepo + skippedMissingLicense + skippedDisallowedLicense + skippedMissingAuthor + skippedPrivateRepo;
  if (skippedTotal > 0) {
    console.log(`  Skipped ${skippedTotal} records for ${table} (${contextLabel}) (missing repo: ${skippedMissingRepo}, private repo: ${skippedPrivateRepo}, missing license: ${skippedMissingLicense}, disallowed license: ${skippedDisallowedLicense}, missing author: ${skippedMissingAuthor})`);
  }
}

async function processStaffCommits(weekStart, rangeStartISO, rangeEndISO, user) {
  // Use REST commit search: GET /search/commits?q=author:USER+committer-date:START..END
  // Requires Accept: application/vnd.github.cloak-preview
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN missing; skipping commit collection');
    return;
  }

  const perPage = 100;
  let page = 1;
  const items = [];
  const repoLicenseCache = new Map();

  while (true) {
    const q = `author:${user} committer-date:${rangeStartISO}..${rangeEndISO}`;
    const url = `https://api.github.com/search/commits?q=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`;

    let res;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      attempt++;
      res = await fetch(url, {
        headers: {
          authorization: `token ${token}`,
          accept: 'application/vnd.github.cloak-preview'
        }
      });
      if (res.ok) break;

      const isRateLimit = res.status === 403 || res.status === 429;
      const text = await res.text();
      if (isRateLimit && attempt < MAX_RETRIES) {
        const resetAt = Number(res.headers.get('x-ratelimit-reset')) || null;
        const now = Date.now();
        const waitMs = resetAt
          ? Math.max(resetAt * 1000 - now + RATE_LIMIT_BUFFER_MS, RETRY_DELAY_MS * attempt)
          : RETRY_DELAY_MS * attempt;
        const waitSeconds = Math.ceil(waitMs / 1000);
        console.warn(`Commit search rate limited (attempt ${attempt}/${MAX_RETRIES}) for ${user}; waiting ${waitSeconds}s`);
        await sleep(waitMs);
        // Don't advance attempt on rate-limit so we keep retrying after reset
        attempt--;
        continue;
      }
      console.warn(`Failed commit search page ${page} for ${user}: ${res.status} ${text}`);
      res = null;
      break;
    }
    if (!res || !res.ok) break;

    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const node of data.items) {
      // node.repository should be present in commit search preview
      const repoFull = node.repository && (node.repository.full_name || node.repository.fullName || node.repository.name);
      const authorLogin = node.author && node.author.login;
      if (!repoFull || !authorLogin) continue;
      if (repoShouldBeExcluded(repoFull)) continue;

      // license check: when licenseFilter === 'oss', require allowList membership
      let spdx = null;
      if (repoLicenseCache.has(repoFull)) {
        spdx = repoLicenseCache.get(repoFull);
      } else {
        // fetch repo metadata
        const repoUrl = `https://api.github.com/repos/${repoFull}`;
        try {
          const r2 = await fetch(repoUrl, { headers: { authorization: `token ${token}` } });
          if (r2.ok) {
            const meta = await r2.json();
            spdx = meta.license && meta.license.spdx_id ? meta.license.spdx_id : null;
          }
        } catch (err) {
          console.warn('Failed repo metadata fetch for', repoFull, err.message || err);
        }
        repoLicenseCache.set(repoFull, spdx);
      }

      if (fileConfig.licenseFilter === 'oss') {
        if (!spdx) continue;
        if (!allowList.includes(spdx)) continue;
      }

      items.push({ author: authorLogin, repo: repoFull, spdx });
    }

    // pagination
    const link = res.headers.get('link');
    if (!link || !link.includes('rel="next"')) break;
    page++;
  }

  if (items.length === 0) return;

  const stmt = db.prepare(`INSERT OR IGNORE INTO commits (week_start, author, repo, spdx) VALUES (?, ?, ?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run(weekStart, row.author, row.repo, row.spdx);
    }
  });
  insertMany(items);
  console.log(`  Inserted ${items.length} commit records for staff:${user} (${weekStart})`);
}

async function processWorkflowRuns(weekStart, rangeStartISO, rangeEndISO, org) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN missing; skipping workflow run collection');
    return;
  }

  // Build date range string for GitHub API (YYYY-MM-DD..YYYY-MM-DD)
  const dateFrom = rangeStartISO.split('T')[0];
  const dateTo = rangeEndISO.split('T')[0];
  const dateRange = `${dateFrom}..${dateTo}`;

  // Collect all public repos for the org
  const orgRepos = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/orgs/${org}/repos?type=public&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { authorization: `token ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Failed to list repos for org ${org}: ${res.status} ${text.slice(0, 200)}`);
      break;
    }
    const repos = await res.json();
    if (!Array.isArray(repos) || repos.length === 0) break;
    for (const r of repos) {
      if (r.full_name && !r.private) orgRepos.push(r.full_name);
    }
    if (repos.length < 100) break;
    page++;
    await sleep(300);
  }

  console.log(`  Found ${orgRepos.length} public repos in org ${org} for workflow run collection (${weekStart})`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO workflow_runs (week_start, repo, workflow_name, run_count)
    VALUES (?, ?, ?, ?)
  `);

  for (const repoFull of orgRepos) {
    if (repoShouldBeExcluded(repoFull)) continue;

    // Aggregate run counts by workflow name
    const runCounts = {};
    let runsPage = 1;
    while (true) {
      const url = `https://api.github.com/repos/${repoFull}/actions/runs?created=${encodeURIComponent(dateRange)}&per_page=100&page=${runsPage}`;
      const res = await fetch(url, {
        headers: { authorization: `token ${token}` }
      });
      if (!res.ok) {
        // 404 means Actions not enabled for this repo — not an error
        if (res.status !== 404) {
          console.warn(`Failed to get workflow runs for ${repoFull}: ${res.status}`);
        }
        break;
      }
      const data = await res.json();
      if (!data.workflow_runs || data.workflow_runs.length === 0) break;
      for (const run of data.workflow_runs) {
        const name = run.name || '(unnamed workflow)';
        runCounts[name] = (runCounts[name] || 0) + 1;
      }
      if (data.workflow_runs.length < 100) break;
      runsPage++;
      await sleep(200);
    }

    if (Object.keys(runCounts).length > 0) {
      const insertAll = db.transaction((counts) => {
        for (const [name, count] of Object.entries(counts)) {
          insertStmt.run(weekStart, repoFull, name, count);
        }
      });
      insertAll(runCounts);
      const total = Object.values(runCounts).reduce((a, b) => a + b, 0);
      console.log(`  Recorded ${total} workflow run(s) in ${Object.keys(runCounts).length} workflow(s) for ${repoFull} (${weekStart})`);
    }

    await sleep(300);
  }
}

// comment collection logic moved to scripts/comments_collector.mjs

async function processMeetingMentions(graphqlClient, weekStart, rangeStart, rangeEnd, org) {
  // Matches GitHub @mentions: 1–39 characters, alphanumeric or internal hyphens, not starting/ending with a hyphen.
  const mentionRegex = /\B@([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})\b/g;

  const repoLicenseCache = new Map();

  const query = `org:${org} is:public is:issue in:title MEETING: created:${rangeStart}..${rangeEnd}`;
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    let data;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        data = await graphqlClient(`
          query($q: String!, $cursor: String) {
            search(query: $q, type: ISSUE, first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                ... on Issue {
                  title
                  body
                  repository {
                    nameWithOwner
                    licenseInfo { spdxId }
                    isPrivate
                  }
                }
              }
            }
          }
        `, { q: query, cursor }, `meeting_mentions:${org}`);
        break;
      } catch (err) {
        const rateLimited = isGraphqlRateLimitedError(err);
        if (rateLimited) {
          const waitMs = getGraphqlRateLimitWaitMs(err, attempt);
          const waitSeconds = Math.ceil(waitMs / 1000);
          console.log(`[meeting_mentions:${org}] Hit rate limit; waiting ${waitSeconds}s until API window resets before retry.`);
          await sleep(waitMs);
          attempt--;
          continue;
        }
        if (attempt === MAX_RETRIES) throw err;
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    if (!data) break;
    const search = data.search;
    hasNextPage = search.pageInfo.hasNextPage;
    cursor = search.pageInfo.endCursor;

    const insertStmt = db.prepare(`INSERT OR IGNORE INTO meeting_mentions (week_start, author, repo, spdx) VALUES (?, ?, ?, ?)`);
    const insertBatch = db.transaction((rows) => {
      for (const r of rows) insertStmt.run(r.week_start, r.author, r.repo, r.spdx);
    });

    for (const node of search.nodes) {
      if (!node || !node.repository) continue;
      if (node.repository.isPrivate) continue;
      const repoFull = node.repository.nameWithOwner;
      if (!repoFull) continue;
      if (repoShouldBeExcluded(repoFull)) continue;

      // Only MEETING: issues (title must start with MEETING:, case-insensitive)
      if (!node.title || !node.title.match(/^MEETING:/i)) continue;

      const spdx = node.repository.licenseInfo ? node.repository.licenseInfo.spdxId : null;
      if (fileConfig.licenseFilter === 'oss') {
        if (!spdx || !allowList.includes(spdx)) continue;
      }

      // Extract @mentions from issue body — store only the usernames, not the body
      const body = node.body || '';
      const mentions = new Set();
      let m;
      mentionRegex.lastIndex = 0;
      while ((m = mentionRegex.exec(body)) !== null) {
        if (m[1]) mentions.add(m[1]);
      }

      if (mentions.size === 0) continue;

      const rows = Array.from(mentions).map(username => ({
        week_start: weekStart,
        author: username,
        repo: repoFull,
        spdx: spdx
      }));
      insertBatch(rows);
      console.log(`  Recorded ${rows.length} meeting mention(s) from MEETING issue in ${repoFull} (${weekStart})`);
    }

    await sleep(300);
  }
}

async function fetchSearchPage(client, query, cursor, contextLabel) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client(`
        query($q: String!, $cursor: String) {
          search(query: $q, type: ISSUE, first: 100, after: $cursor) {
            issueCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on PullRequest {
                number
                author { login }
                createdAt
                mergedAt
                closedAt
                additions
                deletions
                repository {
                  nameWithOwner
                  licenseInfo { spdxId }
                  isPrivate
                  stargazerCount
                }
              }
              ... on Issue {
                number
                author { login }
                createdAt
                closedAt
                labels(first: 20) {
                  nodes {
                    name
                  }
                }
                repository {
                  nameWithOwner
                  licenseInfo { spdxId }
                  isPrivate
                  stargazerCount
                }
              }
            }
          }
        }
      `, {
        q: query,
        cursor: cursor
      }, contextLabel);
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const rateLimited = isGraphqlRateLimitedError(err);
      const status = err.status || 'unknown';
      const message = err.message || 'Unknown GraphQL error';
      const waitMsFromReset = getGraphqlRateLimitWaitMs(err, attempt);

      console.warn(`[${contextLabel}] GraphQL fetch failed (attempt ${attempt}/${MAX_RETRIES}, status ${status}, rateLimited=${rateLimited}): ${message}`);

      if (isLastAttempt && !rateLimited) {
        throw err;
      }

      if (rateLimited) {
        const waitSeconds = Math.ceil(waitMsFromReset / 1000);
        console.log(`[${contextLabel}] Hit rate limit; waiting ${waitSeconds}s until API window resets before retry.`);
        await sleep(waitMsFromReset);
        // Do not advance attempt counter on rate-limit waits so we keep retrying after reset.
        attempt--;
        continue;
      }

      const delay = RETRY_DELAY_MS * attempt;
      await sleep(delay);
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
