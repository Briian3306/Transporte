#!/usr/bin/env node
/**
 * Genera SQL de backfill categoria_calculated desde Excel TARIFAS.
 * Uso: node build-update-sql.mjs [ruta.xlsx]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath =
  process.argv[2] ??
  'C:/Users/FRANCIS/Downloads/TARIFAS (1).xlsx';
const outDir = path.resolve(__dirname, '../../supabase/scripts');

const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

if (!rows.length) {
  console.error('Excel vacío');
  process.exit(1);
}

const patch = rows.map((row) => {
  const id = row.Tarifa_Normalizada_ID;
  const cat = Number(row.Categoria);
  if (!id) throw new Error('Fila sin Tarifa_Normalizada_ID');
  if (!Number.isInteger(cat) || cat < 0 || cat > 10) {
    throw new Error(`Categoria inválida para ${id}: ${row.Categoria}`);
  }
  return { id, categoria_calculated: cat };
});

const valuesLines = patch
  .map(({ id, categoria_calculated }) => `  ('${id}'::uuid, ${categoria_calculated}::smallint)`)
  .join(',\n');

const patchCte = `WITH patch(id, categoria_calculated) AS (
  VALUES
${valuesLines}
)`;

fs.writeFileSync(
  path.join(outDir, 'categorias_olvidadas_patch.json'),
  JSON.stringify(patch, null, 2),
);

const verificacion = `-- Pre-check: ${path.basename(excelPath)} -> categoria_calculated (${patch.length} filas)
${patchCte}
SELECT
  count(*) AS patch_rows,
  count(tn.id) AS matched_in_db,
  count(*) FILTER (WHERE tn.id IS NULL) AS missing_ids,
  count(*) FILTER (WHERE tn.patron IS DISTINCT FROM 'A') AS not_patron_a,
  count(*) FILTER (WHERE tn.categoria IS NOT NULL) AS categoria_should_be_null,
  count(*) FILTER (WHERE tn.categoria_calculated IS NOT DISTINCT FROM p.categoria_calculated) AS already_correct,
  count(*) FILTER (
    WHERE tn.id IS NOT NULL
      AND tn.patron = 'A'
      AND tn.categoria IS NULL
      AND tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated
  ) AS pending_update
FROM patch p
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.id;

${patchCte}
SELECT
  p.id,
  p.categoria_calculated AS excel_categoria,
  tn.categoria_calculated AS db_categoria_calculated,
  tn.patron,
  tn.categoria,
  tn.status,
  tn.importe,
  CASE
    WHEN tn.id IS NULL THEN 'MISSING_ID'
    WHEN tn.patron IS DISTINCT FROM 'A' THEN 'NOT_PATRON_A'
    WHEN tn.categoria IS NOT NULL THEN 'CATEGORIA_NOT_NULL'
    WHEN tn.categoria_calculated IS NOT DISTINCT FROM p.categoria_calculated THEN 'ALREADY_OK'
    ELSE 'PENDING'
  END AS estado
FROM patch p
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.id
WHERE tn.id IS NULL
   OR tn.patron IS DISTINCT FROM 'A'
   OR tn.categoria IS NOT NULL
   OR tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated
ORDER BY estado, p.id;
`;

const update = `-- =============================================================================
-- Backfill categoria_calculated en tarifas_normalizadas (Patron A)
-- Origen: ${path.basename(excelPath)} — ${patch.length} niveles
--
-- Restriccion: patron='A' exige categoria IS NULL
-- (CHECK tarifas_normalizadas_patron_categoria_chk)
-- Se actualiza categoria_calculated, NO categoria.
--
-- Flujo:
--   1) verificacion_categorias_olvidadas.sql
--   2) update_categorias_olvidadas.sql
--   3) postvalidacion_categorias_olvidadas.sql
-- =============================================================================

BEGIN;

${patchCte},
pre_check AS (
  SELECT
    count(*) AS patch_rows,
    count(tn.id) AS matched,
    count(*) FILTER (WHERE tn.id IS NULL) AS missing_ids,
    count(*) FILTER (WHERE tn.patron IS DISTINCT FROM 'A') AS not_patron_a,
    count(*) FILTER (WHERE tn.categoria IS NOT NULL) AS categoria_not_null,
    count(*) FILTER (WHERE tn.categoria_calculated IS NOT DISTINCT FROM p.categoria_calculated) AS already_ok,
    count(*) FILTER (
      WHERE tn.id IS NOT NULL
        AND tn.patron = 'A'
        AND tn.categoria IS NULL
        AND tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated
    ) AS to_update
  FROM patch p
  LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.id
),
updated AS (
  UPDATE public.tarifas_normalizadas tn
  SET
    categoria_calculated = p.categoria_calculated,
    updated_at = now()
  FROM patch p
  WHERE tn.id = p.id
    AND tn.patron = 'A'
    AND tn.categoria IS NULL
    AND tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated
  RETURNING tn.id, tn.categoria_calculated
)
SELECT
  pc.*,
  (SELECT count(*) FROM updated) AS updated_rows
FROM pre_check pc;

-- Esperado: patch_rows=${patch.length}, matched=${patch.length}, missing_ids=0,
--           not_patron_a=0, categoria_not_null=0, updated_rows=${patch.length}
-- Si no cuadra: ROLLBACK; si cuadra: COMMIT;

COMMIT;
`;

const post = `-- Post-check despues de update_categorias_olvidadas.sql
${patchCte}
SELECT
  count(*) FILTER (WHERE tn.categoria_calculated IS NOT DISTINCT FROM p.categoria_calculated) AS ok_rows,
  count(*) FILTER (WHERE tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated) AS mismatch_rows
FROM patch p
JOIN public.tarifas_normalizadas tn ON tn.id = p.id;

${patchCte}
SELECT p.id, p.categoria_calculated AS expected, tn.categoria_calculated AS actual
FROM patch p
JOIN public.tarifas_normalizadas tn ON tn.id = p.id
WHERE tn.categoria_calculated IS DISTINCT FROM p.categoria_calculated;
`;

fs.writeFileSync(path.join(outDir, 'verificacion_categorias_olvidadas.sql'), verificacion);
fs.writeFileSync(path.join(outDir, 'update_categorias_olvidadas.sql'), update);
fs.writeFileSync(path.join(outDir, 'postvalidacion_categorias_olvidadas.sql'), post);

console.log(`OK: ${patch.length} filas -> ${outDir}`);
