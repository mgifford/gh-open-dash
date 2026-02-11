#!/usr/bin/env node
import { execSync } from 'child_process';

function die(msg) { console.error(msg); process.exit(1); }

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) die('GITHUB_TOKEN or GH_TOKEN environment variable is required');

// determine repo owner/name from git remote
let remote;
try { remote = execSync('git config --get remote.origin.url').toString().trim(); } catch (e) { die('Failed to read git remote origin URL'); }

let ownerRepo = null;
if (remote.startsWith('git@')) {
  // git@github.com:owner/repo.git
  ownerRepo = remote.split(':')[1].replace(/\.git$/, '');
} else if (remote.startsWith('https://') || remote.startsWith('http://')) {
  // https://github.com/owner/repo.git
  const parts = remote.replace(/https?:\/\/[^/]+\//, '');
  ownerRepo = parts.replace(/\.git$/, '');
}
if (!ownerRepo || !ownerRepo.includes('/')) die(`Unable to parse owner/repo from remote: ${remote}`);

const [owner, repo] = ownerRepo.split('/');
const workflowFile = 'update-data.yml';
const ref = 'main';

// parse CLI args: --from=YYYY-MM-DD --weeks=N
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k,v] = a.split('='); return [k.replace(/^--/,'') , v || '']; }));
const today = new Date().toISOString().slice(0,10);
const from = args.from || args['reprocess_from_week'] || today;
const weeks = args.weeks || args['reprocess_weeks'] || '52';

const body = { ref, inputs: { reprocess_from_week: from, reprocess_weeks: weeks } };

async function run() {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'accept': 'application/vnd.github+json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 204) {
    console.log(`Workflow dispatched on ${owner}/${repo}/${workflowFile} with inputs:`, body.inputs);
    console.log('The run will be created shortly. Check the Actions tab for run status.');
    process.exit(0);
  }
  const text = await res.text();
  console.error('Dispatch failed', res.status, text);
  process.exit(2);
}

run().catch(err => { console.error(err); process.exit(3); });
