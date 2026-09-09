/**
 * Builds supabase/seed_peajes_pasadas_fks.sql from DESARROLLO pwbi_* views
 * (anon Data API) so pasadas_rows.sql can satisfy FKs on CLI.
 * Reads .env.development — never prints keys.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.development')),
};
const url = (env.NG_APP_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.NG_APP_SUPABASE_KEY || '';
if (!url || !key) {
  console.error('Missing NG_APP_SUPABASE_URL / NG_APP_SUPABASE_KEY in .env.development');
  process.exit(1);
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function chunk(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: `${from}-${from + page - 1}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${table} ${res.status}: ${body.slice(0, 400)}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
    from += page;
  }
  return rows;
}

function insertBatches(table, columns, rows, mapRow, conflict) {
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;
  const parts = [];
  for (const group of chunk(rows, 400)) {
    const values = group.map((row) => `  (${mapRow(row).join(', ')})`).join(',\n');
    parts.push(
      `INSERT INTO public.${table} (${columns})\nVALUES\n${values}\n${conflict};\n`
    );
  }
  return parts.join('\n');
}

const [estaciones, patentes, documentos, tarifas, pasadasFact] = await Promise.all([
  fetchAll('pwbi_estacion'),
  fetchAll('pwbi_patentes'),
  fetchAll('pwbi_documentos'),
  fetchAll('pwbi_tarifas'),
  fetchAll('pwbi_pasadas'),
]);

const pasesById = new Map();
const patenteExtra = new Map();
const estacionGeo = new Map();
for (const row of pasadasFact) {
  if (row.Pase_ID && !pasesById.has(row.Pase_ID)) {
    pasesById.set(row.Pase_ID, {
      id: row.Pase_ID,
      pase: row.Pase,
      patente_id: row.Patente_ID,
    });
  }
  if (row.Patente_ID && row.Patente_Categoria) {
    patenteExtra.set(row.Patente_ID, {
      categoria: row.Patente_Categoria,
      patente: row.Patente,
    });
  }
  if (row.Estacion_ID && !estacionGeo.has(row.Estacion_ID)) {
    estacionGeo.set(row.Estacion_ID, {
      latitud: row.Estacion_Latitud,
      longitud: row.Estacion_Longitud,
      estado: row.Estacion_Geocodificacion_Status,
    });
  }
}

const categoriaMap = {
  TRANSPORTE: 'FLOTA CAMIONES',
  'FLOTA CAMIONES': 'FLOTA CAMIONES',
  'FLOTA UTILITARIA': 'FLOTA UTILITARIA',
  REMIS: 'REMIS',
  OBRA: 'OBRA',
  AUTO: 'AUTO',
};

function patenteCategoria(row) {
  const extra = patenteExtra.get(row.Patente_ID);
  const raw = row.Patente_Categoria || extra?.categoria || 'FLOTA CAMIONES';
  return categoriaMap[raw] || raw;
}

const header = `-- Parent rows for pasadas_rows.sql (DESARROLLO via pwbi_* Data API).
-- CLI only. Replaces Acceso Oeste generated patente/pase UUIDs so FKs match.
-- Batch INSERTs (~400 rows) per supabase-postgres-best-practices data-batch-inserts.
SET search_path = public, extensions, pg_catalog;

DELETE FROM public.pasadas;
DELETE FROM public.pases
WHERE id::text NOT LIKE 'a0f14000-%';
DELETE FROM public.patentes
WHERE id::text NOT LIKE 'a0f14000-%';

`;

const sql = [
  header,
  insertBatches(
    'patentes',
    'id, patente, categoria, created_at, tipo_trabajo, activa',
    patentes,
    (row) => [
      sqlLiteral(row.Patente_ID),
      sqlLiteral(row.Patente),
      sqlLiteral(patenteCategoria(row)),
      sqlLiteral(row.created_at),
      sqlLiteral(row.Patente_Tipo_Trabajo ?? null),
      row.Patente_Activa === false ? 'false' : 'true',
    ],
    'ON CONFLICT (id) DO NOTHING'
  ),
  insertBatches(
    'pases',
    'id, pase, patente_id',
    [...pasesById.values()],
    (row) => [sqlLiteral(row.id), sqlLiteral(row.pase), sqlLiteral(row.patente_id)],
    'ON CONFLICT (id) DO NOTHING'
  ),
  insertBatches(
    'estaciones',
    'id, peaje_id, nombre, ubicacion, latitud, longitud, estado_geocodificacion',
    estaciones,
    (row) => {
      const geo = estacionGeo.get(row.Estacion_ID) || {};
      return [
        sqlLiteral(row.Estacion_ID),
        sqlLiteral(row.Peaje_ID),
        sqlLiteral(row.Estacion_Nombre),
        sqlLiteral(row.Ubicacion),
        sqlLiteral(geo.latitud ?? null),
        sqlLiteral(geo.longitud ?? null),
        sqlLiteral(geo.estado ?? row.Status ?? null),
      ];
    },
    'ON CONFLICT (id) DO NOTHING'
  ),
  insertBatches(
    'documentos',
    'id, factura, cuenta, empresa_id, fecha_factura, tipo, importe_sin_iva, percepciones, iva, importe_total, bonificacion, created_at',
    documentos,
    (row) => [
      sqlLiteral(row.Documento_ID),
      sqlLiteral(row.Documento_Numero),
      sqlLiteral(row.Documento_Cuenta),
      sqlLiteral(row.Empresa_ID),
      sqlLiteral(row.fecha_factura),
      sqlLiteral(row.Documento_Tipo),
      sqlLiteral(row.Documento_Importe_Sin_Iva),
      sqlLiteral(row.Documento_Percepciones ?? 0),
      sqlLiteral(row.Documento_Iva ?? 0),
      sqlLiteral(row.Documento_Importe_Total),
      sqlLiteral(row.Documento_Bonificacion ?? 0),
      sqlLiteral(row.created_at),
    ],
    'ON CONFLICT (id) DO NOTHING'
  ),
  insertBatches(
    'tarifas_normalizadas',
    'id, peaje_id, estacion_id, categoria, importe, importe_base, cases, multiplicador, desvio, hora_min, hora_max, hora_media, patron, diagnostico, status, muestra_confiable, confirmado_manual, confirmado_por, confirmado_at, categoria_calculated, created_at',
    tarifas,
    (row) => {
      const manual = Boolean(row.Confirmado_Manual);
      return [
      sqlLiteral(row.Tarifa_Normalizada_ID),
      sqlLiteral(row.Peaje_ID),
      sqlLiteral(row.Estacion_ID),
      sqlLiteral(row.Categoria),
      sqlLiteral(row.Importe),
      sqlLiteral(row.Importe_Base),
      sqlLiteral(row.Cases ?? 0),
      sqlLiteral(row.Multiplicador ?? 1),
      sqlLiteral(row.Desvio),
      sqlLiteral(row.Hora_Min),
      sqlLiteral(row.Hora_Max),
      sqlLiteral(row.Hora_Media),
      sqlLiteral(row.Patron),
      sqlLiteral(row.Diagnostico),
      sqlLiteral(row.Status),
      row.Muestra_Confiable ? 'true' : 'false',
      manual ? 'true' : 'false',
      manual ? sqlLiteral('2103d8df-a4f7-46fd-9984-74e3ddf1d993') : 'NULL',
      manual ? sqlLiteral(row.created_at) : 'NULL',
      sqlLiteral(row.Categoria_Calculated),
      sqlLiteral(row.created_at),
    ];
    },
    'ON CONFLICT (id) DO NOTHING'
  ),
].join('\n');

const out = join(root, 'supabase', 'seed_peajes_pasadas_fks.sql');
writeFileSync(out, sql, 'utf8');
console.log(
  `Wrote seed_peajes_pasadas_fks.sql patentes=${patentes.length} pases=${pasesById.size} estaciones=${estaciones.length} documentos=${documentos.length} tarifas=${tarifas.length} pasadas_ref=${pasadasFact.length}`
);
