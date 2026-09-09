/**
 * Emit Table Editor CSVs from tarifario-last-cruzado.xlsx.
 * Does not write tarifas_normalizadas. Does not connect to DESARROLLO.
 *
 * Load order in Supabase Table Editor:
 *   1) import-tarifas.csv           (current_tarifa_id empty)
 *   2) import-tarifa-importe.csv
 *   3) import-tarifas-current.csv   (upsert on id, or run the UPDATE SQL)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditedCruzadoRows,
  fillMissingCurrentPointers,
  parseTarifarioV2,
  readTarifarioWorkbook,
  splitSentidoCollisions,
} from './migrate-tarifario-v2.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'out');

function csvCell(value) {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csvTable(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => csvCell(row[key])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function isPresent(value) {
  return value != null && String(value).trim() !== '';
}

function num(value) {
  if (!isPresent(value)) return '';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

const sheets = readTarifarioWorkbook();
const split = splitSentidoCollisions(sheets.tarifas, auditedCruzadoRows(sheets.cruzado));
const parsed = fillMissingCurrentPointers(parseTarifarioV2({
  tarifas: split.tarifas,
  tarifas_importe: sheets.tarifas_importe,
  cruzado: split.cruzado,
}));

const parentById = new Map(parsed.tarifas.map((row) => [row.id, row]));
const seenTnKey = new Set();
const skippedLineage = new Set();
for (const hist of parsed.tarifa_importe) {
  if (!isPresent(hist.tarifas_normalizadas_id)) continue;
  const parent = parentById.get(hist.tarifa_id);
  const tnKey = `${parent.peaje_id}|${parent.estacion_id}|${parent.categoria}|${Number(hist.importe)}`;
  if (seenTnKey.has(tnKey)) {
    skippedLineage.add(hist.tarifas_normalizadas_id);
    continue;
  }
  seenTnKey.add(tnKey);
}

const tarifasRows = parsed.tarifas.map((row) => ({
  id: row.id,
  peaje_id: row.peaje_id,
  estacion_id: row.estacion_id,
  status: row.status,
  categoria: Number(row.categoria),
  sentido: row.sentido,
  requiere_normalizacion_iva: 'false',
  current_tarifa_id: '',
  fecha_actualizacion: row.fecha_actualizacion || '2026-01-01 00:00:00+00',
}));

const importeRows = parsed.tarifa_importe.map((row) => ({
  id: row.id,
  tarifa_id: row.tarifa_id,
  importe: row.importe,
  importe_base: row.importe_base ?? row.importe,
  desvio: num(row.desvio),
  hora_min: num(row.hora_min),
  hora_max: num(row.hora_max),
  hora_media: num(row.hora_media),
  cases: num(row.cases),
  fecha_aparicion: row.fecha_aparicion,
  tarifas_normalizadas_id: skippedLineage.has(row.tarifas_normalizadas_id)
    ? ''
    : (row.tarifas_normalizadas_id || ''),
  created_at: row.fecha_aparicion,
}));

const currentRows = parsed.tarifas.map((row) => ({
  id: row.id,
  current_tarifa_id: row.current_tarifa_id,
}));

const tarifasPath = join(dir, 'import-tarifas.csv');
const importePath = join(dir, 'import-tarifa-importe.csv');
const currentPath = join(dir, 'import-tarifas-current.csv');

writeFileSync(tarifasPath, csvTable([
  'id', 'peaje_id', 'estacion_id', 'status', 'categoria', 'sentido',
  'requiere_normalizacion_iva', 'current_tarifa_id', 'fecha_actualizacion',
], tarifasRows));
writeFileSync(importePath, csvTable([
  'id', 'tarifa_id', 'importe', 'importe_base', 'desvio',
  'hora_min', 'hora_max', 'hora_media', 'cases', 'fecha_aparicion',
  'tarifas_normalizadas_id', 'created_at',
], importeRows));
writeFileSync(currentPath, csvTable(['id', 'current_tarifa_id'], currentRows));

const currentSqlPath = join(dir, 'import-tarifas-current.sql');
const values = currentRows
  .map((row) => `  ('${row.id}'::uuid, '${row.current_tarifa_id}'::uuid)`)
  .join(',\n');
writeFileSync(currentSqlPath, `UPDATE public.tarifas AS t
SET current_tarifa_id = v.current_tarifa_id,
    fecha_actualizacion = COALESCE(ti.fecha_aparicion, t.fecha_actualizacion)
FROM (VALUES
${values}
) AS v(id, current_tarifa_id)
LEFT JOIN public.tarifa_importe ti ON ti.id = v.current_tarifa_id
WHERE t.id = v.id;
`);

console.log(JSON.stringify({
  workbook: sheets.path,
  sheets: {
    tarifas: sheets.tarifas.length,
    tarifas_importe: sheets.tarifas_importe.length,
    cruzado: sheets.cruzado.length,
  },
  csv: {
    tarifas: tarifasRows.length,
    tarifa_importe: importeRows.length,
    current_pointers: currentRows.length,
    skipped_tn_lineage: skippedLineage.size,
    sentido_remaps: split.remapped.length,
  },
  files: { tarifasPath, importePath, currentPath },
}, null, 2));
