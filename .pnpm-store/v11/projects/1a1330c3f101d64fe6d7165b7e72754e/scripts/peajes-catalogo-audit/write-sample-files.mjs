/**
 * Writes tarifas.csv, tarifas_importe.csv and a 2-tab Excel from pwbi_tarifas_rows.csv.
 * Does not write to Supabase. Does not overwrite auditoria-catalogo-20260904.xlsx.
 *
 * Usage (from ibarra-app):
 *   node scripts/peajes-catalogo-audit/write-sample-files.mjs
 *   node scripts/peajes-catalogo-audit/write-sample-files.mjs --csv ../pwbi_tarifas_rows.csv
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCsv } from './parse-csv.mjs';
import {
  IMPORTE_HEADERS,
  MODEL_SHEETS,
  TARIFAS_HEADERS,
  splitPwbiRows,
} from './from-pwbi.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(appRoot, '..');
const FIXTURES_DIR = join(__dirname, 'fixtures');
const OUT_DIR = join(__dirname, 'out');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function samplePaths() {
  return {
    tarifasCsv: join(FIXTURES_DIR, 'tarifas.csv'),
    importeCsv: join(FIXTURES_DIR, 'tarifas_importe.csv'),
    xlsx: join(OUT_DIR, 'tarifas-tarifas-importe.xlsx'),
  };
}

export function defaultCsvPath() {
  return join(repoRoot, 'pwbi_tarifas_rows.csv');
}

export function buildModelWorkbook(model) {
  const wb = XLSX.utils.book_new();
  const sheets = {
    tarifas: model.tarifas,
    tarifas_importe: model.tarifasImporte,
  };
  for (const name of MODEL_SHEETS) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[name]), name);
  }
  return wb;
}

export function writeSampleFiles(options = {}) {
  const csvPath = resolve(options.csvPath || defaultCsvPath());
  if (!existsSync(csvPath)) {
    throw new Error(`No se encontro ${csvPath}`);
  }
  const model = splitPwbiRows(parseCsv(readFileSync(csvPath, 'utf8')));
  const paths = samplePaths();
  mkdirSync(FIXTURES_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(paths.tarifasCsv, toCsv(model.tarifas, TARIFAS_HEADERS));
  writeFileSync(paths.importeCsv, toCsv(model.tarifasImporte, IMPORTE_HEADERS));
  XLSX.writeFile(buildModelWorkbook(model), paths.xlsx);
  return { ...paths, tarifas: model.tarifas.length, tarifasImporte: model.tarifasImporte.length };
}

function main() {
  const paths = writeSampleFiles({ csvPath: argValue('--csv') || defaultCsvPath() });
  console.log(`CSV: ${paths.tarifasCsv} (${paths.tarifas} filas)`);
  console.log(`CSV: ${paths.importeCsv} (${paths.tarifasImporte} filas)`);
  console.log(`Excel: ${paths.xlsx} (hojas: ${MODEL_SHEETS.join(', ')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
