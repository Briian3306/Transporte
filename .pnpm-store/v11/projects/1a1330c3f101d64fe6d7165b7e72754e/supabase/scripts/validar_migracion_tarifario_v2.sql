-- F14-16 Task 4/7: local integrity queries after workbook ETL.
-- Read-only. Empty tables / empty staging report 0 mismatches.
-- Run only against Supabase CLI (local). Do not apply to DESARROLLO.

-- Lineage 1:1, pointer belongs to parent, current importe vs staged PRECIO_LAST,
-- and pasadas shadow-backfill parity counts.

SELECT
  (
    SELECT count(*)::integer
    FROM (
      SELECT tarifas_normalizadas_id
      FROM public.tarifa_importe
      WHERE tarifas_normalizadas_id IS NOT NULL
      GROUP BY tarifas_normalizadas_id
      HAVING count(*) > 1
    ) d
  ) AS lineage_1n_mismatches,
  (
    SELECT count(*)::integer
    FROM public.tarifa_importe
    WHERE tarifas_normalizadas_id IS NOT NULL
      AND id IS DISTINCT FROM tarifas_normalizadas_id
  ) AS lineage_id_mismatches,
  (
    SELECT count(*)::integer
    FROM public.tarifas t
    WHERE t.current_tarifa_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.tarifa_importe ti
        WHERE ti.id = t.current_tarifa_id
          AND ti.tarifa_id = t.id
      )
  ) AS pointer_parent_mismatches,
  (
    SELECT count(*)::integer
    FROM public.tarifas t
    JOIN public.tarifa_importe ti
      ON ti.id = t.current_tarifa_id
     AND ti.tarifa_id = t.id
    JOIN public._stg_precio_last last
      ON last.tarifa_id = t.id
    WHERE ti.importe IS DISTINCT FROM last.precio_last
  ) AS precio_last_current_mismatches,
  (
    SELECT count(*)::integer
    FROM public.pasadas
    WHERE tarifa_normalizada_id IS NOT NULL
  ) AS legacy_links,
  (
    SELECT count(*)::integer
    FROM public.pasadas
    WHERE tarifa_importe_id IS NOT NULL
  ) AS v2_links,
  (
    SELECT count(*)::integer
    FROM public.pasadas
    WHERE tarifa_normalizada_id IS NOT NULL
      AND tarifa_importe_id IS NULL
  ) AS unmapped,
  (
    SELECT count(*)::integer
    FROM public.tarifas
    WHERE current_tarifa_id IS NULL
  ) AS null_current_pointers,
  (
    SELECT count(*)::integer
    FROM public.tarifas t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public._stg_precio_last last
      WHERE last.tarifa_id = t.id
    )
  ) AS tarifas_without_staged_precio_last;
