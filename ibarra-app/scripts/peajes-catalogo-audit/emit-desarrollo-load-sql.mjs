/**
 * Emit DESARROLLO load SQL from tarifario-last-cruzado.xlsx.
 * Does not INSERT/UPDATE tarifas_normalizadas. Does not run against DESARROLLO.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditedCruzadoRows,
  buildLocalLoadSql,
  fillMissingCurrentPointers,
  parseTarifarioV2,
  readTarifarioWorkbook,
  splitSentidoCollisions,
} from './migrate-tarifario-v2.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sheets = readTarifarioWorkbook();
const split = splitSentidoCollisions(sheets.tarifas, auditedCruzadoRows(sheets.cruzado));
const parsed = fillMissingCurrentPointers(parseTarifarioV2({
  tarifas: split.tarifas,
  tarifas_importe: sheets.tarifas_importe,
  cruzado: split.cruzado,
}));
const built = buildLocalLoadSql(parsed, { remapped: split.remapped });

const statements = built.sql
  .split('\n')
  .filter((line) => !line.startsWith('\\'))
  .join('\n')
  .split(/;\s*\n/)
  .map((s) => `${s.trim()}`)
  .filter(Boolean)
  .filter((s) => !/^INSERT INTO public\.tarifas_normalizadas\b/i.test(s))
  .map((s) => (s.endsWith(';') ? s : `${s};`));

const out = join(__dirname, 'out', 'desarrollo-load-statements.json');
writeFileSync(out, `${JSON.stringify({
  parsed_tarifas: parsed.tarifas.length,
  parsed_importe: parsed.tarifa_importe.length,
  case_snapshots: parsed.tarifa_importe.reduce((total, row) => total + row.cases, 0),
  remapped: split.remapped.length,
  skipped_tn: built.skippedLineageCount,
  statement_count: statements.length,
  statements,
}, null, 2)}\n`);
console.log(JSON.stringify({
  out,
  parsed_tarifas: parsed.tarifas.length,
  parsed_importe: parsed.tarifa_importe.length,
  case_snapshots: parsed.tarifa_importe.reduce((total, row) => total + row.cases, 0),
  remapped: split.remapped.length,
  skipped_tn: built.skippedLineageCount,
  statement_count: statements.length,
  kinds: statements.map((s) => s.slice(0, 80)),
}, null, 2));
