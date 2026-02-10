#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join('scripts', 'config.json');

function usage() {
  console.log('Usage: node scripts/set_config.mjs [--collectAllPublic=true|false] [--licenseFilter=oss|all]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
}

let cfg = {};
if (fs.existsSync(CONFIG_PATH)) {
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) { cfg = {}; }
}

for (const a of args) {
  if (a.startsWith('--collectAllPublic=')) {
    const v = a.split('=')[1];
    cfg.collectAllPublic = v === 'true' || v === '1';
  } else if (a.startsWith('--licenseFilter=')) {
    const v = a.split('=')[1];
    if (v !== 'oss' && v !== 'all') {
      console.error('licenseFilter must be "oss" or "all"');
      process.exit(2);
    }
    cfg.licenseFilter = v;
  } else {
    usage();
  }
}

fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
console.log(`Updated ${CONFIG_PATH}:`, cfg);
