/**
 * Builds catalog INSERT fragments from MCP execute_sql dump files
 * (untrusted-data JSON wrapper). Run from ibarra-app:
 *   node supabase/scripts/build-seed-peajes-desarrollo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SEED = path.join(ROOT, 'seed_peajes_desarrollo.sql');
const AGENT_TOOLS = path.resolve(
  process.env.USERPROFILE || process.env.HOME,
  '.cursor/projects/c-Users-FRANCIS-Documents-progamacion-Transporte/agent-tools',
);

function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (Array.isArray(v)) {
    const inner = v.map((x) => sqlLit(String(x))).join(', ');
    return `ARRAY[${inner}]::text[]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function extractJsonAgg(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const block = text.match(/<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-/);
  const payload = block ? block[1] : text;
  const parsed = JSON.parse(payload);
  const v = Array.isArray(parsed) ? parsed[0]?.json_agg : parsed.json_agg;
  if (v == null) return [];
  return typeof v === 'string' ? JSON.parse(v) : v;
}

function chunk(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function insert(table, cols, rows, conflict = 'id') {
  if (!rows.length) return `-- ${table}: 0 rows\n`;
  const parts = chunk(rows, 80).map((group) => {
    const values = group
      .map((row) => `  (${cols.map((c) => sqlLit(row[c])).join(', ')})`)
      .join(',\n');
    return `INSERT INTO public.${table} (${cols.join(', ')}) VALUES\n${values}\nON CONFLICT (${conflict}) DO NOTHING;`;
  });
  return `-- ${table}: ${rows.length} rows\n${parts.join('\n\n')}\n`;
}

const dumps = {
  estaciones: path.join(AGENT_TOOLS, '8bec7c08-1a9c-4725-9994-d8a0e8488bdf.txt'),
  aliases: path.join(AGENT_TOOLS, '13711f6f-e7b4-4a62-acad-5c3501318c31.txt'),
  tarifas: path.join(AGENT_TOOLS, '02a0b639-5c4d-4949-978c-1060324977f3.txt'),
};

for (const [k, p] of Object.entries(dumps)) {
  if (!fs.existsSync(p)) throw new Error(`Missing dump ${k}: ${p}`);
}

const estaciones = extractJsonAgg(dumps.estaciones);
const aliases = extractJsonAgg(dumps.aliases);
const tarifas = extractJsonAgg(dumps.tarifas);

const header = fs.readFileSync(SEED, 'utf8');
const cut = header.indexOf('\nINSERT INTO public.estaciones');
const base = cut === -1 ? header.trimEnd() + '\n' : header.slice(0, cut).trimEnd() + '\n';

const extra = [
  '',
  '-- Estaciones / aliases / tarifas DESARROLLO (MCP dump 2026-08-21).',
  '-- Pasadas (8326) omitted: db dump --linked 403; F14 fixture covers auditoría tarifas.',
  insert('estaciones', [
    'id', 'peaje_id', 'nombre', 'ubicacion', 'descripcion', 'codigos_proveedor',
    'created_at', 'latitud', 'longitud', 'camino', 'estado_geocodificacion',
  ], estaciones),
  insert('estaciones_alias_proveedor', [
    'id', 'empresa_id', 'estacion_id', 'valor_proveedor', 'valor_normalizado', 'origen', 'created_at',
  ], aliases),
  insert('tarifas_normalizadas', [
    'id', 'peaje_id', 'estacion_id', 'categoria', 'importe', 'importe_base', 'cases',
    'multiplicador', 'desvio', 'hora_min', 'hora_max', 'hora_media', 'patron',
    'diagnostico', 'status', 'muestra_confiable', 'confirmado_manual', 'confirmado_por',
    'confirmado_at', 'created_at', 'updated_at', 'categoria_calculated',
  ], tarifas),
].join('\n');

fs.writeFileSync(SEED, base + extra);
console.log({
  estaciones: estaciones.length,
  aliases: aliases.length,
  tarifas: tarifas.length,
  bytes: fs.statSync(SEED).size,
});
