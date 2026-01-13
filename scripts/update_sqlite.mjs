import Database from 'better-sqlite3';
import { graphql } from '@octokit/graphql';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join('data', 'participation.sqlite');
const ALLOWLIST_PATH = path.join('scripts', 'oss_spdx_allowlist.json');

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

// Load allowlist
const allowList = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

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

  if (!processedThrough) {
    console.log('No history found. Defaulting to 52 weeks ago.');
    startProcessingDate = addDays(lastCompleteWeekStart, -52 * 7);
  } else {
    startProcessingDate = addDays(new Date(processedThrough), 7);
  }

  console.log(`Last complete week start: ${toISODate(lastCompleteWeekStart)}`);
  console.log(`Start processing from: ${toISODate(startProcessingDate)}`);

  let pointer = startProcessingDate;
  while (pointer <= lastCompleteWeekStart) {
    const weekStartStr = toISODate(pointer);
    const weekEnd = addDays(pointer, 7); 
    const rangeStart = pointer.toISOString();
    const rangeEnd = new Date(weekEnd.getTime() - 1).toISOString(); 

    console.log(`Processing week: ${weekStartStr}`);

    await processMetric(graphqlClient, 'pr_opened', weekStartStr, `org:civicactions is:pr created:${rangeStart}..${rangeEnd}`);
    await processMetric(graphqlClient, 'pr_merged', weekStartStr, `org:civicactions is:pr merged:${rangeStart}..${rangeEnd}`);
    await processMetric(graphqlClient, 'issue_opened', weekStartStr, `org:civicactions is:issue created:${rangeStart}..${rangeEnd}`);

    setMeta('processed_through_week', weekStartStr);
    pointer = addDays(pointer, 7);
  }
}

async function processMetric(client, table, weekStart, query) {
  let hasNextPage = true;
  let cursor = null;
  const items = [];

  while (hasNextPage) {
    try {
      const data = await client(`
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
                }
              }
              ... on Issue {
                author { login }
                repository {
                  nameWithOwner
                  licenseInfo { spdxId }
                }
              }
            }
          }
        }
      `, {
        q: query,
        cursor: cursor
      });

      const search = data.search;
      hasNextPage = search.pageInfo.hasNextPage;
      cursor = search.pageInfo.endCursor;

      for (const node of search.nodes) {
        if (!node.repository || !node.repository.licenseInfo || !node.author) continue;
        const spdx = node.repository.licenseInfo.spdxId;
        
        // Check allowlist
        if (!allowList.includes(spdx)) continue;

        items.push({
          author: node.author.login,
          repo: node.repository.nameWithOwner,
          spdx: spdx
        });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
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
    console.log(`  Inserted ${items.length} records for ${table}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
