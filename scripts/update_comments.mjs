import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { processCommentsForOrg } from './comments_collector.mjs';
import Database from 'better-sqlite3';

const DB_PATH = path.join('data', 'participation.sqlite');
const CONFIG_PATH = path.join('scripts', 'config.json');

const defaultConfig = { historyWeeks: 52, maxWeeksPerRun: 12, orgAllowlist: ['civicactions'] };

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      console.warn('Failed to parse config.json; using defaults', err.message);
    }
  }
  return { ...defaultConfig };
}

const fileConfig = loadConfig();
const rawOrgAllow = process.env.ORG_ALLOWLIST || fileConfig.orgAllowlist || defaultConfig.orgAllowlist;
const ORG_ALLOWLIST = Array.isArray(rawOrgAllow)
  ? rawOrgAllow.map(s => String(s).trim()).filter(Boolean)
  : String(rawOrgAllow).split(',').map(s => s.trim()).filter(Boolean);

const db = new Database(DB_PATH);

function getMonday(d) {
  d = new Date(d);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  monday.setUTCHours(0,0,0,0);
  return monday;
}
function addDays(d, days) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + days); return r; }
function toISODate(d) { return d.toISOString().split('T')[0]; }

async function run() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const now = new Date();
  const currentWeekStart = getMonday(now);
  const lastCompleteWeekStart = addDays(currentWeekStart, -7);

  // track separate meta key so comment job can run independently
  const processedThrough = db.prepare('SELECT value FROM meta WHERE key = ?').get('processed_through_week_comments');
  let startProcessingDate;

  if (process.env.REPROCESS_FROM_WEEK) {
    const candidate = new Date(process.env.REPROCESS_FROM_WEEK);
    if (!Number.isNaN(candidate.getTime())) startProcessingDate = candidate;
  }

  if (!startProcessingDate && process.env.REPROCESS_WEEKS) {
    const parsed = Number.parseInt(process.env.REPROCESS_WEEKS, 10);
    if (Number.isFinite(parsed) && parsed > 0) startProcessingDate = addDays(lastCompleteWeekStart, -parsed * 7);
  }

  if (!startProcessingDate && !processedThrough) {
    const parsedHistory = Number.parseInt(process.env.HISTORY_WEEKS || fileConfig.historyWeeks || defaultConfig.historyWeeks, 10);
    startProcessingDate = addDays(lastCompleteWeekStart, - (Number.isFinite(parsedHistory) ? parsedHistory : defaultConfig.historyWeeks) * 7);
  } else if (!startProcessingDate) {
    startProcessingDate = addDays(new Date(processedThrough.value), 7);
  }

  const MAX_WEEKS_PER_RUN = Number.parseInt(process.env.MAX_WEEKS_PER_RUN || fileConfig.maxWeeksPerRun || defaultConfig.maxWeeksPerRun, 10);

  console.log(`Comments job: processing from ${toISODate(startProcessingDate)} through ${toISODate(lastCompleteWeekStart)}`);

  let pointer = startProcessingDate;
  let weeksThisRun = 0;
  while (pointer <= lastCompleteWeekStart) {
    if (weeksThisRun >= MAX_WEEKS_PER_RUN) break;
    const weekStartStr = toISODate(pointer);
    const weekEnd = addDays(pointer, 7);
    const rangeStart = pointer.toISOString();
    const rangeEnd = new Date(weekEnd.getTime() - 1).toISOString();

    console.log(`Processing comments for week ${weekStartStr}`);
    for (const org of ORG_ALLOWLIST) {
      try {
        await processCommentsForOrg(weekStartStr, rangeStart, rangeEnd, org);
      } catch (err) {
        console.warn('processCommentsForOrg failed for', org, err.message || err);
      }
    }

    // update meta
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('processed_through_week_comments', weekStartStr);

    pointer = addDays(pointer, 7);
    weeksThisRun++;
  }
  console.log('Comments job complete');
}

run().catch(err => { console.error(err); process.exit(1); });
