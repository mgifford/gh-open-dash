import fs from 'fs';
import path from 'path';

const candidates = [
  path.resolve(process.cwd(), 'data', 'metrics.json'),
  path.resolve(process.cwd(), '..', 'data', 'metrics.json'),
  path.resolve(process.cwd(), 'site', 'data', 'metrics.json')
];

const FOUND = candidates.find(p => fs.existsSync(p));
if (!FOUND) {
  console.error('metrics.json not found in any expected locations. Checked:');
  for (const c of candidates) console.error(`  - ${c}`);
  console.error('Ensure `node scripts/export_metrics.mjs` ran successfully and produced data/metrics.json in the repository root.');
  process.exit(1);
}

const SRC = FOUND;
const DEST_DIR = path.join('site', 'public', 'data');
const DEST = path.join(DEST_DIR, 'metrics.json');

if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log(`Copied ${SRC} -> ${DEST}`);
