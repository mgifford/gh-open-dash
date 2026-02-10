import fs from 'fs';
import path from 'path';

const SRC = path.join('data', 'metrics.json');
const DEST_DIR = path.join('site', 'public', 'data');
const DEST = path.join(DEST_DIR, 'metrics.json');

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log(`Copied ${SRC} -> ${DEST}`);
