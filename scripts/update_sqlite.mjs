import 'dotenv/config';
import Database from 'better-sqlite3';
import { graphql } from '@octokit/graphql';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join('data', 'participation.sqlite');
const ALLOWLIST_PATH = path.join('scripts', 'oss_spdx_allowlist.json');
const STAFF_ALLOWLIST_PATH = path.join('scripts', 'staff_allowlist.json');
const CONFIG_PATH = path.join('scripts', 'config.json');

const defaultConfig = {
  orgAllowlist: ['civicactions'],
  historyWeeks: 260,
  maxWeeksPerRun: 12
};

const fileConfig = loadConfig();

const ORG_ALLOWLIST = (process.env.ORG_ALLOWLIST || fileConfig.orgAllowlist || defaultConfig.orgAllowlist)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const parsedHistoryWeeks = Number.parseInt(process.env.HISTORY_WEEKS || fileConfig.historyWeeks || defaultConfig.historyWeeks, 10);
const HISTORY_WEEKS = Number.isFinite(parsedHistoryWeeks) ? parsedHistoryWeeks : defaultConfig.historyWeeks;

const parsedMaxWeeksPerRun = Number.parseInt(process.env.MAX_WEEKS_PER_RUN || fileConfig.maxWeeksPerRun || defaultConfig.maxWeeksPerRun, 10);
const MAX_WEEKS_PER_RUN = Number.isFinite(parsedMaxWeeksPerRun) ? parsedMaxWeeksPerRun : defaultConfig.maxWeeksPerRun;

const reprocessFromWeekEnv = process.env.REPROCESS_FROM_WEEK;
const parsedReprocessWeeks = Number.parseInt(process.env.REPROCESS_WEEKS || '0', 10);
const RATE_LIMIT_BUFFER_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

// Load allowlist
const allowList = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const staffAllowList = loadStaffAllowList();

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
  CREATE TABLE IF NOT EXISTS issue_opened (
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
`);

const getMeta = (key) => {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setMeta = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
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

// Main logic
async function run() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const graphqlClient = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  const now = new Date();
  
  const currentWeekStart = getMonday(now);
  const lastCompleteWeekStart = addDays(currentWeekStart, -7);

  let processedThrough = getMeta('processed_through_week');
  let startProcessingDate;

  if (reprocessFromWeekEnv) {
    const candidate = new Date(reprocessFromWeekEnv);
    if (Number.isNaN(candidate.getTime())) {
      console.warn(`REPROCESS_FROM_WEEK is invalid (${reprocessFromWeekEnv}); falling back to history/meta.`);
    } else {
      startProcessingDate = candidate;
      console.log(`Reprocessing from week override: ${toISODate(startProcessingDate)}`);
    }
  }

  if (!startProcessingDate && parsedReprocessWeeks > 0) {
    startProcessingDate = addDays(lastCompleteWeekStart, -parsedReprocessWeeks * 7);
    console.log(`Reprocessing last ${parsedReprocessWeeks} weeks.`);
  }

  if (!startProcessingDate && !processedThrough) {
    console.log(`No history found. Defaulting to ${HISTORY_WEEKS} weeks ago.`);
    startProcessingDate = addDays(lastCompleteWeekStart, -HISTORY_WEEKS * 7);
  } else if (!startProcessingDate) {
    startProcessingDate = addDays(new Date(processedThrough), 7);
  }

  console.log(`Last complete week start: ${toISODate(lastCompleteWeekStart)}`);
  console.log(`Start processing from: ${toISODate(startProcessingDate)}`);
  console.log(`Org allowlist: ${ORG_ALLOWLIST.join(', ')}`);
  console.log(`Staff allowlist size: ${staffAllowList.length}`);
  console.log(`Max weeks this run: ${MAX_WEEKS_PER_RUN}`);

  let pointer = startProcessingDate;
  let weeksThisRun = 0;
  while (pointer <= lastCompleteWeekStart) {
    if (weeksThisRun >= MAX_WEEKS_PER_RUN) {
      console.log(`Reached MAX_WEEKS_PER_RUN=${MAX_WEEKS_PER_RUN}; stop here and resume next run.`);
      break;
    }

    const weekStartStr = toISODate(pointer);
    const weekEnd = addDays(pointer, 7); 
    const rangeStart = pointer.toISOString();
    const rangeEnd = new Date(weekEnd.getTime() - 1).toISOString(); 

    console.log(`Processing week: ${weekStartStr}`);

    for (const org of ORG_ALLOWLIST) {
      await processMetric(graphqlClient, 'pr_opened', weekStartStr, `org:${org} is:public is:pr created:${rangeStart}..${rangeEnd}`, org);
      await processMetric(graphqlClient, 'pr_merged', weekStartStr, `org:${org} is:public is:pr merged:${rangeStart}..${rangeEnd}`, org);
      await processMetric(graphqlClient, 'issue_opened', weekStartStr, `org:${org} is:public is:issue created:${rangeStart}..${rangeEnd}`, org);
    }

    for (const user of staffAllowList) {
      const label = `staff:${user}`;
      await processMetric(graphqlClient, 'pr_opened', weekStartStr, `author:${user} is:public is:pr created:${rangeStart}..${rangeEnd}`, label);
      await processMetric(graphqlClient, 'pr_merged', weekStartStr, `author:${user} is:public is:pr merged:${rangeStart}..${rangeEnd}`, label);
      await processMetric(graphqlClient, 'issue_opened', weekStartStr, `author:${user} is:public is:issue created:${rangeStart}..${rangeEnd}`, label);
    }

    setMeta('processed_through_week', weekStartStr);
    pointer = addDays(pointer, 7);
    weeksThisRun++;
  }
}

async function processMetric(client, table, weekStart, query, contextLabel) {
  let hasNextPage = true;
  let cursor = null;
  const items = [];
  let skippedMissingRepo = 0;
  let skippedMissingLicense = 0;
  let skippedDisallowedLicense = 0;
  let skippedMissingAuthor = 0;
  let skippedPrivateRepo = 0;

  while (hasNextPage) {
    const data = await fetchSearchPage(client, query, cursor, `${table}:${contextLabel}`);

    const search = data.search;
    hasNextPage = search.pageInfo.hasNextPage;
    cursor = search.pageInfo.endCursor;

    for (const node of search.nodes) {
      if (!node.repository) { skippedMissingRepo++; continue; }
      if (node.repository.isPrivate) { skippedPrivateRepo++; continue; }
      if (!node.repository.licenseInfo) { skippedMissingLicense++; continue; }
      if (!node.author || !node.author.login) { skippedMissingAuthor++; continue; }

      const spdx = node.repository.licenseInfo.spdxId;

      // Check allowlist
      if (!allowList.includes(spdx)) { skippedDisallowedLicense++; continue; }

      items.push({
        author: node.author.login,
        repo: node.repository.nameWithOwner,
        spdx: spdx
      });
    }
  }
  
  // Batch insert
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

  const skippedTotal = skippedMissingRepo + skippedMissingLicense + skippedDisallowedLicense + skippedMissingAuthor + skippedPrivateRepo;
  if (skippedTotal > 0) {
    console.log(`  Skipped ${skippedTotal} records for ${table} (${contextLabel}) (missing repo: ${skippedMissingRepo}, private repo: ${skippedPrivateRepo}, missing license: ${skippedMissingLicense}, disallowed license: ${skippedDisallowedLicense}, missing author: ${skippedMissingAuthor})`);
  }
}

async function fetchSearchPage(client, query, cursor, contextLabel) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client(`
        query($q: String!, $cursor: String) {
          search(query: $q, type: ISSUE, first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on PullRequest {
                author { login }
                repository {
                  nameWithOwner
                  licenseInfo { spdxId }
                  isPrivate
                }
              }
              ... on Issue {
                author { login }
                repository {
                  nameWithOwner
                  licenseInfo { spdxId }
                  isPrivate
                }
              }
            }
          }
        }
      `, {
        q: query,
        cursor: cursor
      });
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const rateLimited = Array.isArray(err.errors) && err.errors.some(e => e.type === 'RATE_LIMIT' || e.type === 'RATE_LIMITED');
      const status = err.status || 'unknown';
      const message = err.message || 'Unknown GraphQL error';
      const resetAt = Number(err.headers?.['x-ratelimit-reset']) || null;
      const now = Date.now();
      const waitMsFromReset = resetAt ? Math.max(resetAt * 1000 - now + RATE_LIMIT_BUFFER_MS, RETRY_DELAY_MS * attempt) : RETRY_DELAY_MS * attempt;

      console.warn(`[${contextLabel}] GraphQL fetch failed (attempt ${attempt}/${MAX_RETRIES}, status ${status}, rateLimited=${rateLimited}): ${message}`);

      if (isLastAttempt && !rateLimited) {
        throw err;
      }

      if (rateLimited) {
        const waitSeconds = Math.ceil(waitMsFromReset / 1000);
        console.log(`[${contextLabel}] Hit rate limit; waiting ${waitSeconds}s before retry.`);
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
