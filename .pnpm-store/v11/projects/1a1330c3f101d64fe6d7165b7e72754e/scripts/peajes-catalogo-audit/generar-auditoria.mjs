/**
 * Generates auditoria-catalogo-YYYYMMDD.xlsx from pwbi_tarifas_rows.csv.
 *
 * Usage (from ibarra-app):
 *   node --test scripts/peajes-catalogo-audit/classifier.test.mjs
 *   node scripts/peajes-catalogo-audit/generar-auditoria.mjs
 *   node scripts/peajes-catalogo-audit/generar-auditoria.mjs --csv ../pwbi_tarifas_rows.csv
 *
 * Read-only: does not write to Supabase or tarifas_normalizadas.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './parse-csv.mjs';
import { classifyCatalogue } from './classifier.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(appRoot, '..');
const OUT_DIR = join(__dirname, 'out');

const CATALOGUE_COLUMNS = [
  'PEAJE_ID',
  'PEAJE_NOMBRE',
  'STATION_ID',
  'STATION_NOMBRE',
  'STATUS',
  'CATEGORY',
  'CLUSTER',
  'CATEGORIES_DETECTED',
  'EXPECTED_CATEGORIES',
  'CATEGORIES_MISSING',
  'STATUSES_DETECTED',
  'EXPECTED_STATUSES',
  'STATUSES_MISSING',
  'IMPORTE',
  'FECHA_APARICION',
  'N_IMPORTES',
  'HISTORIAL',
  'MISSING_CATEGORY',
  'MISSING_PRICE',
  'MISSING_STATUS',
  'REVIEW_REQUIRED',
  'DIAGNOSTIC',
  'REFERENCE_PATTERN',
  'ROW_TYPE',
  'PATRON',
  'CONFIRMADO_MANUAL',
  'TARIFA_NORMALIZADA_ID',
  'ACTION',
];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function pickColumns(rows, columns) {
  return rows.map((row) => {
    const out = {};
    for (const col of columns) out[col] = row[col] ?? '';
    return out;
  });
}

function controlRows(result) {
  const { control } = result;
  const rows = [
    { Seccion: 'Conteo', Clave: 'source_rows', Valor: control.source_rows },
    { Seccion: 'Conteo', Clave: 'catalogue_rows', Valor: control.catalogue_rows },
    { Seccion: 'Conteo', Clave: 'existing', Valor: control.existing },
    { Seccion: 'Conteo', Clave: 'suspected_gaps', Valor: control.suspected_gaps },
    { Seccion: 'Conteo', Clave: 'missing_category', Valor: control.missing_category },
    { Seccion: 'Conteo', Clave: 'missing_status', Valor: control.missing_status },
    { Seccion: 'Conteo', Clave: 'missing_price', Valor: control.missing_price },
    { Seccion: 'Conteo', Clave: 'review_required', Valor: control.review_required },
    { Seccion: 'Uso', Clave: 'ACTION', Valor: 'KEEP / ADD / IGNORE. Gaps with ADD become source rows for tarifas later.' },
    { Seccion: 'Uso', Clave: 'DIAGNOSTIC', Valor: 'Blank unless MISSING_CATEGORY, MISSING_STATUS, MISSING_PRICE or REVIEW_REQUIRED is TRUE.' },
    { Seccion: 'Regla', Clave: 'Corredores flat', Valor: 'EXPECTED_CATEGORIES=1-5, EXPECTED_STATUSES=NO_PICO. No PICO pair.' },
    { Seccion: 'Regla', Clave: 'Dual-status with cat 1', Valor: 'EXPECTED_CATEGORIES=1-6 or 1-7 (cluster max). Both PICO and NO_PICO.' },
    { Seccion: 'Regla', Clave: 'AUSA / AUBASA cores', Valor: 'Peer-majority set, never a forced 1-7.' },
    { Seccion: 'Regla', Clave: 'Sparse stations', Valor: 'Show CATEGORIES_MISSING but REVIEW_REQUIRED only; no auto gap rows for every integer.' },
    { Seccion: 'Regla', Clave: 'Known flat', Valor: 'PASEO DEL BAJO / MAIPU: no invented PICO rows.' },
    { Seccion: 'Alcance', Clave: 'Supabase', Valor: 'Este Excel es de solo lectura. No modifica tarifas_normalizadas.' },
  ];
  return rows;
}

export function buildWorkbook(result) {
  const wb = XLSX.utils.book_new();
  const catalogue = pickColumns(result.catalogue, CATALOGUE_COLUMNS);
  const missingCat = pickColumns(
    result.catalogue.filter((r) => r.MISSING_CATEGORY === 'TRUE'),
    CATALOGUE_COLUMNS,
  );
  const missingPrice = pickColumns(
    result.catalogue.filter((r) => r.MISSING_PRICE === 'TRUE'),
    CATALOGUE_COLUMNS,
  );
  const missingStatus = pickColumns(
    result.catalogue.filter((r) => r.MISSING_STATUS === 'TRUE'),
    CATALOGUE_COLUMNS,
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalogue), 'Catalogue');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingCat), 'Missing Categories');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingPrice), 'Missing Prices');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingStatus), 'Missing Status');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.summary), 'Catalogue Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.history), 'History');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.patterns), 'Patterns');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(controlRows(result)), 'Control');
  return wb;
}

function defaultCsvPath() {
  return join(repoRoot, 'pwbi_tarifas_rows.csv');
}

function main() {
  const csvPath = resolve(argValue('--csv') || defaultCsvPath());
  if (!existsSync(csvPath)) {
    console.error(`No se encontro ${csvPath}. Pasa --csv con la ruta a pwbi_tarifas_rows.csv.`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (!rows.length) {
    console.error(`CSV vacio: ${csvPath}`);
    process.exit(1);
  }

  const result = classifyCatalogue(rows);
  const wb = buildWorkbook(result);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = argValue('--out') || join(OUT_DIR, `auditoria-catalogo-${stamp}.xlsx`);
  XLSX.writeFile(wb, outPath);

  console.log(`Excel: ${outPath}`);
  console.log(`Filas origen: ${result.control.source_rows}`);
  console.log(`Catalogue: ${result.control.catalogue_rows} (existing ${result.control.existing}, gaps ${result.control.suspected_gaps})`);
  console.log(`MISSING_CATEGORY: ${result.control.missing_category}`);
  console.log(`MISSING_STATUS: ${result.control.missing_status}`);
  console.log(`MISSING_PRICE: ${result.control.missing_price}`);
  console.log(`REVIEW_REQUIRED: ${result.control.review_required}`);
}

main();
