import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'out');
const tarifas = JSON.parse(readFileSync(join(dir, 'compact-tarifas.json'), 'utf8'));
const importe = JSON.parse(readFileSync(join(dir, 'compact-importe.json'), 'utf8'));

function sqlLiteralJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
}

function writeChunks(name, rows, perChunk, toSql) {
  const n = Math.ceil(rows.length / perChunk);
  for (let i = 0; i < n; i += 1) {
    const chunk = rows.slice(i * perChunk, (i + 1) * perChunk);
    const sql = toSql(chunk);
    const file = join(dir, `bulk-${name}-${i}.sql`);
    writeFileSync(file, sql);
    console.log(file, chunk.length, Buffer.byteLength(sql));
  }
}

writeChunks('tarifas', tarifas, 90, (chunk) => `INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
)
SELECT x.id, x.peaje_id, x.estacion_id, x.status, x.categoria, x.sentido, false, x.fecha::timestamptz
FROM jsonb_to_recordset(${sqlLiteralJson(chunk)}::jsonb)
  AS x(id uuid, peaje_id uuid, estacion_id uuid, status text, categoria smallint, sentido text, fecha text, current uuid)
ON CONFLICT (id) DO NOTHING;
`);

writeChunks('importe', importe, 80, (chunk) => `INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, importe_base, desvio,
  hora_min, hora_max, hora_media, cases, fecha_aparicion,
  tarifas_normalizadas_id, created_at
)
SELECT
  x.id,
  x.tarifa_id,
  x.importe,
  x.importe_base,
  x.desvio,
  x.hora_min,
  x.hora_max,
  x.hora_media,
  COALESCE(x.cases, 0),
  x.fecha::timestamptz,
  tn.id,
  x.fecha::timestamptz
FROM jsonb_to_recordset(${sqlLiteralJson(chunk)}::jsonb)
  AS x(
    id uuid, tarifa_id uuid, importe numeric, importe_base numeric,
    desvio numeric, hora_min numeric, hora_max numeric, hora_media numeric, cases integer,
    fecha text, tn uuid
  )
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = x.tn
ON CONFLICT (id) DO NOTHING;
`);

writeChunks('pointers', tarifas.filter((row) => row.current), 90, (chunk) => `UPDATE public.tarifas AS t
SET current_tarifa_id = v.current,
    fecha_actualizacion = COALESCE(ti.fecha_aparicion, t.fecha_actualizacion)
FROM jsonb_to_recordset(${sqlLiteralJson(chunk)}::jsonb)
  AS v(id uuid, peaje_id uuid, estacion_id uuid, status text, categoria smallint, sentido text, fecha text, current uuid)
LEFT JOIN public.tarifa_importe ti ON ti.id = v.current
WHERE t.id = v.id;
`);
