/**
 * Fail-closed workbook ETL for F14-16 tarifas v2.
 * Parses in-memory sheet rows; local CLI load is opt-in (`--load-local`).
 * Does not write to DESARROLLO or overwrite audit xlsx.
 *
 * Usage (from ibarra-app):
 *   import { parseTarifarioV2 } from './scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs'
 *   node scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs --load-local
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArs } from './parse-ars.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENTIDOS = new Set(['IDA', 'VUELTA', 'AMBAS']);
const DEFAULT_LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const DESARROLLO_MARKERS = ['kfffigvyvtzyczeiadxh', 'supabase.co'];
const AUDIT_XLSX_NAME = 'auditoria-catalogo-20260904.xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKBOOK = join(__dirname, 'out', 'tarifario-last-cruzado.xlsx');
const DEFAULT_PARITY = join(__dirname, '..', '..', '..', '.superpowers', 'sdd', 'task-7-parity-report.md');

function fail(message) {
  throw new Error(message);
}

function assertUuid(value, label) {
  if (!UUID_RE.test(String(value ?? ''))) fail(`invalid UUID (${label}): ${value}`);
}

function configKey(row) {
  return `${row.peaje_id}|${row.estacion_id}|${row.status}|${Number(row.categoria)}|${row.sentido}`;
}

function moneyEqual(a, b) {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

function isPresent(value) {
  return value != null && String(value).trim() !== '';
}

function freshId(used) {
  let id = randomUUIDSafe();
  while (used.has(id)) id = randomUUIDSafe();
  used.add(id);
  return id;
}

function randomUUIDSafe() {
  return randomUUID();
}

function parseImporte(value, label) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseArs(value);
  if (n == null) fail(`unparseable ${label}: ${value}`);
  return n;
}

export function parseTarifarioV2({ tarifas: tarifasIn = [], tarifas_importe: importeIn = [], cruzado: cruzadoIn = [] } = {}) {
  const parentIds = new Set();
  const configByKey = new Map();
  const tarifas = [];

  for (const src of tarifasIn) {
    assertUuid(src.id, 'tarifas.id');
    if (parentIds.has(src.id)) fail(`duplicate parent ID ${src.id}`);
    parentIds.add(src.id);
    if (!SENTIDOS.has(src.sentido)) fail(`unknown sentido: ${src.sentido}`);
    const key = configKey(src);
    const existing = configByKey.get(key);
    if (existing && existing !== src.id) fail(`colliding configuration key ${key}`);
    configByKey.set(key, src.id);
    tarifas.push({ ...src });
  }

  const historyIds = new Set();
  const lineageIds = new Set();
  const tarifa_importe = [];

  for (const src of importeIn) {
    assertUuid(src.id, 'tarifa_importe.id');
    if (historyIds.has(src.id)) fail(`history id maps to multiple parents: ${src.id}`);
    historyIds.add(src.id);
    assertUuid(src.tarifa_id, 'tarifa_importe.tarifa_id');
    if (!parentIds.has(src.tarifa_id)) fail(`unknown tarifa_id ${src.tarifa_id}`);
    const importe = parseImporte(src.importe, 'tarifa_importe.importe');
    if (!(importe > 0)) fail(`importe must be > 0 (${src.id})`);
    const importe_base = isPresent(src.importe_base)
      ? parseImporte(src.importe_base, 'tarifa_importe.importe_base')
      : importe;
    let lineage = src.tarifas_normalizadas_id;
    if (isPresent(lineage)) {
      assertUuid(lineage, 'tarifas_normalizadas_id');
      if (lineageIds.has(lineage)) {
        fail(`legacy id maps to two amount rows: ${lineage}`);
      }
      lineageIds.add(lineage);
      if (src.id !== lineage) {
        fail(`lineage id mismatch: ${src.id} !== ${lineage}`);
      }
    } else {
      lineage = null;
    }
    tarifa_importe.push({
      ...src,
      importe,
      importe_base,
      tarifas_normalizadas_id: lineage,
    });
  }

  const byParent = new Map();
  for (const row of tarifa_importe) {
    if (!byParent.has(row.tarifa_id)) byParent.set(row.tarifa_id, []);
    byParent.get(row.tarifa_id).push(row);
  }

  const usedIds = new Set([...parentIds, ...historyIds]);
  const seenCross = new Set();
  const report = [];
  const parentById = new Map(tarifas.map((row) => [row.id, row]));

  for (const cross of cruzadoIn) {
    const tarifaId = cross.TARIFA_ID;
    if (!isPresent(tarifaId)) continue;
    assertUuid(tarifaId, 'Cruzado TARIFA_ID');
    if (!parentIds.has(tarifaId)) fail(`missing Cross TARIFA_ID parent ${tarifaId}`);
    if (seenCross.has(tarifaId)) fail(`duplicate Cross TARIFA_ID ${tarifaId}`);
    seenCross.add(tarifaId);

    const audited = parseArs(cross.PRECIO_LAST);
    if (audited == null) fail(`unparseable PRECIO_LAST for ${tarifaId}`);

    const hist = byParent.get(tarifaId) || [];
    let chosen = hist.find((row) => moneyEqual(row.importe, audited));
    if (!chosen) {
      chosen = {
        id: freshId(usedIds),
        tarifa_id: tarifaId,
        importe: audited,
        importe_base: audited,
        fecha_aparicion: cross.LAST_UPDATED,
        tarifas_normalizadas_id: null,
      };
      tarifa_importe.push(chosen);
      hist.push(chosen);
      byParent.set(tarifaId, hist);
    }

    const parent = parentById.get(tarifaId);
    parent.current_tarifa_id = chosen.id;
    const lineageRow = hist.find((row) => isPresent(row.tarifas_normalizadas_id));
    report.push({
      parent_id: tarifaId,
      historical_id: chosen.id,
      legacy_id: isPresent(chosen.tarifas_normalizadas_id)
        ? chosen.tarifas_normalizadas_id
        : (lineageRow?.tarifas_normalizadas_id ?? null),
      audited_amount: audited,
      chosen_pointer: chosen.id,
      source_timestamp: cross.LAST_UPDATED,
    });
  }

  return { tarifas, tarifa_importe, report };
}

export function assertLocalDbUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) fail('local DB URL is empty');
  const lower = raw.toLowerCase();
  for (const marker of DESARROLLO_MARKERS) {
    if (lower.includes(marker)) fail(`refusing non-local DB URL (DESARROLLO marker): ${marker}`);
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid DB URL: ${url}`);
  }
  const host = (parsed.hostname || '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    fail(`refusing non-local DB host: ${parsed.hostname}`);
  }
  return raw;
}

export function resolveLocalDbUrl(env = process.env) {
  const api = String(env.SUPABASE_URL || env.API_URL || '').trim();
  if (api) {
    let parsed;
    try {
      parsed = new URL(api);
    } catch {
      fail(`invalid SUPABASE_URL: ${api}`);
    }
    const host = (parsed.hostname || '').toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      fail(`refusing non-local API host: ${parsed.hostname}`);
    }
  }
  const url = env.SUPABASE_DB_URL || env.DATABASE_URL || DEFAULT_LOCAL_DB;
  return assertLocalDbUrl(url);
}

export function deterministicUuid(seed) {
  const hex = createHash('sha1').update(String(seed)).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Wave 0 parent IDs omit sentido, so IDA+VUELTA share one UUID.
 * Load path splits VUELTA (or the later row) onto a deterministic new id.
 * History stays on the original id. Cruzado TARIFA_ID is duplicated for the new parent.
 */
export function splitSentidoCollisions(tarifasIn = [], cruzadoIn = []) {
  const seen = new Map();
  const tarifas = [];
  const remapped = [];
  const used = new Set(tarifasIn.map((row) => row.id).filter(Boolean));

  for (const src of tarifasIn) {
    const existing = seen.get(src.id);
    if (!existing) {
      seen.set(src.id, src);
      tarifas.push({ ...src });
      continue;
    }
    if (existing.sentido === src.sentido) fail(`duplicate parent ID ${src.id}`);
    let newId = deterministicUuid(`${src.id}|${src.sentido}`);
    if (used.has(newId) || newId === src.id) {
      newId = deterministicUuid(`${src.id}|${src.sentido}|split`);
    }
    if (used.has(newId)) fail(`could not mint unique id for sentido split ${src.id}`);
    used.add(newId);
    remapped.push({ from: src.id, to: newId, sentido: src.sentido });
    tarifas.push({ ...src, id: newId });
  }

  const cruzado = cruzadoIn.map((row) => ({ ...row }));
  for (const { from, to } of remapped) {
    const srcRows = cruzadoIn.filter((row) => row.TARIFA_ID === from);
    for (const row of srcRows) cruzado.push({ ...row, TARIFA_ID: to });
  }

  return { tarifas, cruzado, remapped };
}

export function readTarifarioWorkbook(workbookPath) {
  const srcPath = resolve(workbookPath || DEFAULT_WORKBOOK);
  if (!existsSync(srcPath)) fail(`No se encontro ${srcPath}`);
  if (srcPath.replace(/\\/g, '/').endsWith(AUDIT_XLSX_NAME)) {
    fail(`refusing to read/overwrite ${AUDIT_XLSX_NAME}`);
  }
  const wb = XLSX.readFile(srcPath);
  if (!wb.Sheets.tarifas || !wb.Sheets.tarifas_importe) {
    fail(`workbook missing tarifas / tarifas_importe sheets: ${srcPath}`);
  }
  const tarifas = XLSX.utils.sheet_to_json(wb.Sheets.tarifas, { defval: '', raw: false }).map((row) => ({
    ...row,
    sentido: isPresent(row.sentido) ? row.sentido : 'AMBAS',
    categoria: Number(row.categoria),
  }));
  const tarifas_importe = XLSX.utils.sheet_to_json(wb.Sheets.tarifas_importe, { defval: '', raw: false });
  const cruzado = wb.Sheets.Cruzado
    ? XLSX.utils.sheet_to_json(wb.Sheets.Cruzado, { defval: '', raw: false })
    : [];
  return { path: srcPath, tarifas, tarifas_importe, cruzado };
}

export function auditedCruzadoRows(cruzadoIn = []) {
  return cruzadoIn.filter((row) => isPresent(row.TARIFA_ID) && parseArs(row.PRECIO_LAST) != null);
}

export function fillMissingCurrentPointers(parsed) {
  const byParent = new Map();
  for (const row of parsed.tarifa_importe) {
    if (!byParent.has(row.tarifa_id)) byParent.set(row.tarifa_id, []);
    byParent.get(row.tarifa_id).push(row);
  }
  for (const parent of parsed.tarifas) {
    if (isPresent(parent.current_tarifa_id)) continue;
    const hist = [...(byParent.get(parent.id) || [])].sort((a, b) => (
      String(a.fecha_aparicion).localeCompare(String(b.fecha_aparicion))
      || String(a.id).localeCompare(String(b.id))
    ));
    if (!hist.length) fail(`null current pointer after import: ${parent.id}`);
    parent.current_tarifa_id = hist[hist.length - 1].id;
  }
  return parsed;
}

function sqlLiteral(value) {
  if (value == null || value === '') return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  if (!isPresent(value)) return 'NULL';
  assertUuid(value, 'sql uuid');
  return `'${value}'::uuid`;
}

function sqlNumeric(value) {
  if (value == null || value === '') return 'NULL';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 'NULL';
  return String(n);
}

function sqlTimestamptz(value) {
  if (!isPresent(value)) return 'NULL';
  return `${sqlLiteral(value)}::timestamptz`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function nullableNum(value) {
  if (!isPresent(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildLocalLoadSql(parsed, { remapped = [] } = {}) {
  const lines = [];
  lines.push('\\set ON_ERROR_STOP on');
  lines.push('BEGIN;');
  lines.push("SELECT pg_catalog.set_config('search_path', 'public', true);");

  const peajes = new Map();
  const estaciones = new Map();
  for (const row of parsed.tarifas) {
    if (!peajes.has(row.peaje_id)) {
      peajes.set(row.peaje_id, row.peaje_nombre || row.peaje_id);
    }
    if (!estaciones.has(row.estacion_id)) {
      estaciones.set(row.estacion_id, {
        id: row.estacion_id,
        peaje_id: row.peaje_id,
        nombre: row.estacion_nombre || row.estacion_id,
      });
    }
  }

  for (const group of chunk([...peajes.entries()], 50)) {
    const values = group.map(([id, nombre]) => `(${sqlUuid(id)}, ${sqlLiteral(nombre)})`).join(',\n  ');
    lines.push(`INSERT INTO public.peajes (id, nombre)\nVALUES\n  ${values}\nON CONFLICT (id) DO NOTHING;`);
  }

  for (const group of chunk([...estaciones.values()], 50)) {
    const values = group.map((e) => `(${sqlUuid(e.id)}, ${sqlUuid(e.peaje_id)}, ${sqlLiteral(e.nombre)})`).join(',\n  ');
    lines.push(`INSERT INTO public.estaciones (id, peaje_id, nombre)\nVALUES\n  ${values}\nON CONFLICT (id) DO NOTHING;`);
  }

  const parentById = new Map(parsed.tarifas.map((row) => [row.id, row]));
  const tnStubs = [];
  const seenTnKey = new Set();
  const skippedLineage = new Set();
  for (const hist of parsed.tarifa_importe) {
    if (!isPresent(hist.tarifas_normalizadas_id)) continue;
    const parent = parentById.get(hist.tarifa_id);
    if (!parent) fail(`lineage history missing parent ${hist.tarifa_id}`);
    const tnKey = `${parent.peaje_id}|${parent.estacion_id}|${parent.categoria}|${Number(hist.importe)}`;
    if (seenTnKey.has(tnKey)) {
      skippedLineage.add(hist.tarifas_normalizadas_id);
      continue;
    }
    seenTnKey.add(tnKey);
    tnStubs.push({
      id: hist.tarifas_normalizadas_id,
      peaje_id: parent.peaje_id,
      estacion_id: parent.estacion_id,
      categoria: String(parent.categoria),
      importe: hist.importe,
      importe_base: hist.importe_base ?? hist.importe,
      cases: Number.isFinite(Number(hist.cases)) ? Number(hist.cases) : 0,
    });
  }

  for (const group of chunk(tnStubs, 40)) {
    const values = group.map((t) => `(
      ${sqlUuid(t.id)},
      ${sqlUuid(t.peaje_id)},
      ${sqlUuid(t.estacion_id)},
      ${sqlLiteral(t.categoria)},
      ${sqlNumeric(t.importe)},
      ${sqlNumeric(t.importe_base)},
      ${sqlNumeric(t.cases)},
      'B',
      'REVISAR',
      'PENDIENTE'
    )`).join(',\n  ');
    lines.push(`INSERT INTO public.tarifas_normalizadas (
      id, peaje_id, estacion_id, categoria, importe, importe_base,
      cases, patron, diagnostico, status
    )
    VALUES
      ${values}
    ON CONFLICT (id) DO NOTHING;`);
  }

  for (const group of chunk(parsed.tarifas, 40)) {
    const values = group.map((t) => `(
      ${sqlUuid(t.id)},
      ${sqlUuid(t.peaje_id)},
      ${sqlUuid(t.estacion_id)},
      ${sqlLiteral(t.status)},
      ${sqlNumeric(Number(t.categoria))},
      ${sqlLiteral(t.sentido)},
      FALSE,
      ${sqlTimestamptz(t.fecha_actualizacion || '2026-01-01 00:00:00+00')}
    )`).join(',\n  ');
    lines.push(`INSERT INTO public.tarifas (
      id, peaje_id, estacion_id, status, categoria, sentido,
      requiere_normalizacion_iva, fecha_actualizacion
    )
    VALUES
      ${values}
    ON CONFLICT (id) DO NOTHING;`);
  }

  for (const group of chunk(parsed.tarifa_importe, 40)) {
    const values = group.map((h) => `(
      ${sqlUuid(h.id)},
      ${sqlUuid(h.tarifa_id)},
      ${sqlNumeric(h.importe)},
      ${sqlNumeric(h.importe_base)},
      ${sqlNumeric(nullableNum(h.desvio))},
      ${sqlNumeric(nullableNum(h.hora_min))},
      ${sqlNumeric(nullableNum(h.hora_max))},
      ${sqlNumeric(nullableNum(h.hora_media))},
      ${sqlTimestamptz(h.fecha_aparicion)},
      ${skippedLineage.has(h.tarifas_normalizadas_id) ? 'NULL' : sqlUuid(h.tarifas_normalizadas_id)},
      ${sqlTimestamptz(h.fecha_aparicion)}
    )`).join(',\n  ');
    lines.push(`INSERT INTO public.tarifa_importe (
      id, tarifa_id, importe, importe_base, desvio,
      hora_min, hora_max, hora_media, fecha_aparicion,
      tarifas_normalizadas_id, created_at
    )
    VALUES
      ${values}
    ON CONFLICT (id) DO NOTHING;`);
  }

  for (const group of chunk(parsed.tarifas.filter((t) => isPresent(t.current_tarifa_id)), 40)) {
    const values = group.map((t) => `(${sqlUuid(t.id)}, ${sqlUuid(t.current_tarifa_id)})`).join(',\n  ');
    lines.push(`UPDATE public.tarifas AS t
SET current_tarifa_id = v.current_tarifa_id,
    fecha_actualizacion = COALESCE(
      (SELECT ti.fecha_aparicion FROM public.tarifa_importe ti WHERE ti.id = v.current_tarifa_id),
      t.fecha_actualizacion
    )
FROM (VALUES
  ${values}
) AS v(id, current_tarifa_id)
WHERE t.id = v.id;`);
  }

  lines.push('TRUNCATE public._stg_precio_last;');
  if (parsed.report.length) {
    for (const group of chunk(parsed.report, 50)) {
      const values = group.map((r) => `(
        ${sqlUuid(r.parent_id)},
        ${sqlNumeric(r.audited_amount)},
        ${sqlLiteral(r.source_timestamp ?? '')}
      )`).join(',\n  ');
      lines.push(`INSERT INTO public._stg_precio_last (tarifa_id, precio_last, source_timestamp)
VALUES
  ${values}
ON CONFLICT (tarifa_id) DO UPDATE
SET precio_last = EXCLUDED.precio_last,
    source_timestamp = EXCLUDED.source_timestamp;`);
    }
  }

  lines.push(`SELECT ${sqlNumeric(remapped.length)} AS sentido_id_collisions_remapped, ${sqlNumeric(skippedLineage.size)} AS tn_unique_key_lineage_skipped;`);
  lines.push('COMMIT;');
  return { sql: `${lines.join('\n')}\n`, skippedLineageCount: skippedLineage.size };
}

function appRoot() {
  return resolve(__dirname, '..', '..');
}

export function runLocalSql(sql, { cwd = appRoot(), tuplesOnly = false } = {}) {
  const container = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_ibarra-app';
  const psqlArgs = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres'];
  if (tuplesOnly) psqlArgs.push('-tA');
  try {
    return execFileSync('docker', psqlArgs, {
      cwd,
      encoding: 'utf8',
      input: sql,
    });
  } catch (err) {
    fail(`local SQL failed (docker ${container} / 127.0.0.1): ${err?.stderr || err?.message}`);
  }
}

function formatParityMarkdown(counts, extra = {}) {
  const unexplained = extra.unexplained || [];
  const lines = [
    '# Task 7 local parity report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Metric | Count |',
    '|---|---|',
    `| legacy_links | ${counts.legacy_links} |`,
    `| v2_links | ${counts.v2_links} |`,
    `| unmapped | ${counts.unmapped} |`,
    `| current_pointer_mismatches | ${counts.current_pointer_mismatches} |`,
    `| price_comparison_mismatches | ${counts.price_comparison_mismatches} |`,
    `| null_current_pointers | ${counts.null_current_pointers} |`,
    `| lineage_1n_mismatches | ${counts.lineage_1n_mismatches} |`,
    `| lineage_id_mismatches | ${counts.lineage_id_mismatches} |`,
    `| pointer_parent_mismatches | ${counts.pointer_parent_mismatches} |`,
    `| tarifas_without_staged_precio_last | ${counts.tarifas_without_staged_precio_last} |`,
    `| sentido_id_collisions_remapped | ${counts.sentido_id_collisions_remapped} |`,
    `| tn_unique_key_lineage_skipped | ${counts.tn_unique_key_lineage_skipped} |`,
    '',
    extra.notes ? `## Notes\n\n${extra.notes}\n` : '',
    '## Unexplained mismatches (cutover blockers)',
    '',
  ];
  if (!unexplained.length) {
    lines.push('None.');
  } else {
    for (const item of unexplained) lines.push(`- ${item}`);
  }
  lines.push('');
  return lines.join('\n');
}

function parseCountRow(stdout) {
  const text = String(stdout || '');
  const keys = [
    'legacy_links',
    'v2_links',
    'unmapped',
    'current_pointer_mismatches',
    'price_comparison_mismatches',
    'null_current_pointers',
    'lineage_1n_mismatches',
    'lineage_id_mismatches',
    'pointer_parent_mismatches',
    'tarifas_without_staged_precio_last',
    'precio_last_current_mismatches',
  ];
  const counts = {};
  for (const key of keys) {
    const re = new RegExp(`${key}[^0-9]*([0-9]+)`, 'i');
    const m = text.match(re);
    if (m) counts[key] = Number(m[1]);
  }
  return counts;
}

export function parseParityQueryOutput(stdout) {
  return parseCountRow(stdout);
}

export function loadTarifarioV2Local(options = {}) {
  resolveLocalDbUrl(options.env || process.env);
  const workbookPath = options.workbook || DEFAULT_WORKBOOK;
  const sheets = readTarifarioWorkbook(workbookPath);
  const split = splitSentidoCollisions(sheets.tarifas, auditedCruzadoRows(sheets.cruzado));
  const parsed = fillMissingCurrentPointers(parseTarifarioV2({
    tarifas: split.tarifas,
    tarifas_importe: sheets.tarifas_importe,
    cruzado: split.cruzado,
  }));
  const built = buildLocalLoadSql(parsed, { remapped: split.remapped });
  const loadOut = runLocalSql(built.sql, { cwd: options.cwd || appRoot() });

  let backfillOut = '';
  if (options.backfill !== false) {
    backfillOut = runLocalSql(
      'SELECT public.peajes_backfill_pasadas_tarifa_importe();\n',
      { cwd: options.cwd || appRoot() },
    );
  }

  const validatorPath = resolve(appRoot(), 'supabase/scripts/validar_migracion_tarifario_v2.sql');
  const validatorOut = runLocalSql(
    existsSync(validatorPath)
      ? readFileSync(validatorPath, 'utf8')
      : 'SELECT 1;',
    { cwd: options.cwd || appRoot() },
  );

  const parityJsonSql = `
SELECT json_build_object(
  'legacy_links', (SELECT count(*)::int FROM public.pasadas WHERE tarifa_normalizada_id IS NOT NULL),
  'v2_links', (SELECT count(*)::int FROM public.pasadas WHERE tarifa_importe_id IS NOT NULL),
  'unmapped', (SELECT count(*)::int FROM public.pasadas WHERE tarifa_normalizada_id IS NOT NULL AND tarifa_importe_id IS NULL),
  'lineage_1n_mismatches', (
    SELECT count(*)::int FROM (
      SELECT tarifas_normalizadas_id FROM public.tarifa_importe
      WHERE tarifas_normalizadas_id IS NOT NULL
      GROUP BY tarifas_normalizadas_id HAVING count(*) > 1
    ) d
  ),
  'lineage_id_mismatches', (
    SELECT count(*)::int FROM public.tarifa_importe
    WHERE tarifas_normalizadas_id IS NOT NULL AND id IS DISTINCT FROM tarifas_normalizadas_id
  ),
  'pointer_parent_mismatches', (
    SELECT count(*)::int FROM public.tarifas t
    WHERE t.current_tarifa_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tarifa_importe ti
        WHERE ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
      )
  ),
  'precio_last_current_mismatches', (
    SELECT count(*)::int FROM public.tarifas t
    JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
    JOIN public._stg_precio_last last ON last.tarifa_id = t.id
    WHERE ti.importe IS DISTINCT FROM last.precio_last
  ),
  'null_current_pointers', (SELECT count(*)::int FROM public.tarifas WHERE current_tarifa_id IS NULL),
  'tarifas_without_staged_precio_last', (
    SELECT count(*)::int FROM public.tarifas t
    WHERE NOT EXISTS (SELECT 1 FROM public._stg_precio_last last WHERE last.tarifa_id = t.id)
  )
);
`;
  const parityJsonOut = runLocalSql(parityJsonSql, { cwd: options.cwd || appRoot(), tuplesOnly: true });
  let queried = {};
  try {
    queried = JSON.parse(String(parityJsonOut).trim());
  } catch {
    queried = parseCountRow(validatorOut);
  }

  const counts = {
    legacy_links: 0,
    v2_links: 0,
    unmapped: 0,
    current_pointer_mismatches: 0,
    price_comparison_mismatches: 0,
    null_current_pointers: 0,
    lineage_1n_mismatches: 0,
    lineage_id_mismatches: 0,
    pointer_parent_mismatches: 0,
    tarifas_without_staged_precio_last: 0,
    sentido_id_collisions_remapped: split.remapped.length,
    tn_unique_key_lineage_skipped: built.skippedLineageCount,
    ...queried,
  };
  if (counts.precio_last_current_mismatches != null) {
    counts.price_comparison_mismatches = counts.precio_last_current_mismatches;
  }
  counts.current_pointer_mismatches = (counts.pointer_parent_mismatches || 0) + (counts.null_current_pointers || 0);

  const unexplained = [];
  if (counts.lineage_1n_mismatches) unexplained.push(`lineage_1n_mismatches=${counts.lineage_1n_mismatches}`);
  if (counts.lineage_id_mismatches) unexplained.push(`lineage_id_mismatches=${counts.lineage_id_mismatches}`);
  if (counts.pointer_parent_mismatches) unexplained.push(`pointer_parent_mismatches=${counts.pointer_parent_mismatches}`);
  if (counts.price_comparison_mismatches) unexplained.push(`price_comparison_mismatches=${counts.price_comparison_mismatches}`);
  if (counts.null_current_pointers) unexplained.push(`null_current_pointers=${counts.null_current_pointers}`);

  const notes = [
    `Workbook: ${sheets.path}`,
    `tarifas loaded: ${parsed.tarifas.length}; tarifa_importe loaded: ${parsed.tarifa_importe.length}; staged PRECIO_LAST: ${parsed.report.length}.`,
    `sentido ID collisions remapped (Wave 0 id omits sentido): ${split.remapped.length} (explained; VUELTA gets a new parent id, history stays on original).`,
    `TN unique-key lineage stubs skipped: ${built.skippedLineageCount} (explained; tarifas_normalizadas unique is peaje+estacion+categoria+importe and does not include PICO/NO_PICO).`,
    'pasadas counts reflect the local CLI database after db reset --no-seed plus this catalog load (empty pasadas unless separately seeded).',
    'Did not overwrite auditoria-catalogo-20260904.xlsx.',
  ].join('\n\n');

  const markdown = formatParityMarkdown(counts, { unexplained, notes });
  const parityPath = resolve(options.parityOut || DEFAULT_PARITY);
  mkdirSync(dirname(parityPath), { recursive: true });
  writeFileSync(parityPath, markdown, 'utf8');
  const jsonPath = parityPath.replace(/\.md$/i, '.json');
  writeFileSync(jsonPath, `${JSON.stringify({ counts, unexplained, remapped: split.remapped.length }, null, 2)}\n`, 'utf8');

  return {
    parsed,
    remapped: split.remapped,
    counts,
    unexplained,
    loadOut,
    backfillOut,
    validatorOut,
    parityPath,
    jsonPath,
  };
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  if (!process.argv.includes('--load-local')) {
    console.log('Parse-only module. Pass --load-local to load into Supabase CLI (127.0.0.1).');
    return;
  }
  const result = loadTarifarioV2Local({
    workbook: argValue('--workbook') || DEFAULT_WORKBOOK,
    parityOut: argValue('--parity-out') || DEFAULT_PARITY,
    backfill: !process.argv.includes('--no-backfill'),
  });
  console.log(`Parity: ${result.parityPath}`);
  console.log(JSON.stringify(result.counts));
  if (result.unexplained.length) {
    console.error(`CUTOVER BLOCKER: ${result.unexplained.join('; ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
