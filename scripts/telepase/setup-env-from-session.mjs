/**
 * One-shot helper: write .env if TELEPASE_USER/PASS are already in the process env.
 * Does not print secret values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TELEPASE_DIR } from './paths.mjs';

const user = process.env.TELEPASE_USER;
const pass = process.env.TELEPASE_PASS;
const envPath = path.join(TELEPASE_DIR, '.env');

if (!user || !pass) {
  console.error('TELEPASE_USER / TELEPASE_PASS not set in process env');
  process.exit(1);
}

fs.writeFileSync(
  envPath,
  `TELEPASE_USER=${user}\nTELEPASE_PASS=${pass}\n`,
  'utf8'
);
console.log(`Wrote ${envPath} (credentials not printed)`);
