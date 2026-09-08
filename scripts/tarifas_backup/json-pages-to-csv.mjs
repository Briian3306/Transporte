/**
 * Convert MCP/JSON page files (array of row objects) into one CSV.
 * Usage: node json-pages-to-csv.mjs <table> <pagesDir> <outCsv>
 * table: pasadas | tarifas_normalizadas | tarifas_status_catalogo
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PASADAS_COLUMNS,
  TARIFAS_NORMALIZADAS_COLUMNS,
  TARIFAS_STATUS_CATALOGO_COLUMNS,
} from './columns.mjs';

const COLUMNS = {
  pasadas: PASADAS_COLUMNS,
  tarifas_normalizadas: TARIFAS_NORMALIZADAS_COLUMNS,
  tarifas_status_catalogo: TARIFAS_STATUS_CATALOGO_COLUMNS,
};

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'boolean' ? String(value) : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowToCsv(row, columns) {
  return columns.map((col) => csvEscape(row[col])).join(',');
}

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.result)) return parsed.result;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error(`Unexpected JSON shape in ${filePath}`);
}

function main() {
  const [, , table, pagesDir, outCsv] = process.argv;
  const columns = COLUMNS[table];
  if (!columns || !pagesDir || !outCsv) {
    console.error(
      'Usage: node json-pages-to-csv.mjs <pasadas|tarifas_normalizadas|tarifas_status_catalogo> <pagesDir> <outCsv>'
    );
    process.exit(1);
  }

  const files = fs
    .readdirSync(pagesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  const outDir = path.dirname(outCsv);
  fs.mkdirSync(outDir, { recursive: true });

  const fd = fs.openSync(outCsv, 'w');
  fs.writeSync(fd, `${columns.join(',')}\n`);
  let rows = 0;
  const seen = new Set();

  for (const name of files) {
    const chunk = parseJsonFile(path.join(pagesDir, name));
    for (const row of chunk) {
      const id = row.id;
      if (id == null) throw new Error(`Row without id in ${name}`);
      if (seen.has(id)) continue;
      seen.add(id);
      fs.writeSync(fd, `${rowToCsv(row, columns)}\n`);
      rows += 1;
    }
  }

  fs.closeSync(fd);
  console.log(JSON.stringify({ table, files: files.length, rows, outCsv }));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
