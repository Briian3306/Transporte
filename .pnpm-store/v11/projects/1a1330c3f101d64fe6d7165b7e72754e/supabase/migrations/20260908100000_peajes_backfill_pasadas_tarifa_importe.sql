-- F14-16 Task 7: unique-lineage backfill of pasadas.tarifa_importe_id
-- plus local ETL staging for Cruzado PRECIO_LAST. Additive. Does not
-- alter peajes_normalizar_tarifas, peajes_recalcular_tarifas,
-- peajes_confirmar_status_tarifa, or tarifas_normalizadas.

-- -----------------------------------------------------------------------------
-- 1) Local-only PRECIO_LAST staging (empty after reset → 0 mismatches)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._stg_precio_last (
  tarifa_id uuid PRIMARY KEY,
  precio_last numeric(14,2) NOT NULL,
  source_timestamp text NULL,
  CONSTRAINT stg_precio_last_importe_chk CHECK (precio_last > 0)
);

COMMENT ON TABLE public._stg_precio_last IS
  'F14-16 · Staging local de Cruzado.PRECIO_LAST para validar_migracion_tarifario_v2. No es tabla de producto.';

ALTER TABLE public._stg_precio_last ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public._stg_precio_last FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public._stg_precio_last TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 2) peajes_backfill_pasadas_tarifa_importe
-- Unique pasadas.tarifa_normalizada_id = tarifa_importe.tarifas_normalizadas_id
-- → tarifa_importe_id = that history id. Unmatched / non-unique left null.
-- Does not join coincidental tarifa_importe.id. Does not invent history.
-- Does not rewrite tarifa_normalizada_id, current pointers, or TN rows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_backfill_pasadas_tarifa_importe()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pasadas AS p
  SET tarifa_importe_id = u.tarifa_importe_id
  FROM (
    SELECT
      ti.tarifas_normalizadas_id AS tn_id,
      (array_agg(ti.id))[1] AS tarifa_importe_id
    FROM public.tarifa_importe AS ti
    WHERE ti.tarifas_normalizadas_id IS NOT NULL
    GROUP BY ti.tarifas_normalizadas_id
    HAVING count(*) = 1
  ) AS u
  WHERE p.tarifa_normalizada_id IS NOT NULL
    AND p.tarifa_normalizada_id = u.tn_id;
END;
$$;

COMMENT ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe() IS
  'F14-16 · Backfill no destructivo de pasadas.tarifa_importe_id por linaje 1:1. No toca tarifa_normalizada_id ni tarifas_normalizadas.';

REVOKE ALL ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe()
  TO authenticated, service_role;
