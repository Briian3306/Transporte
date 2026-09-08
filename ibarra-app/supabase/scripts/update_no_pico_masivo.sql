-- =============================================================================
-- Parte 1b — UPDATE transaccional
-- Marca NO_PICO los niveles NO confirmados de peajes SIN esquema de hora pico.
--
-- NO ejecutar hasta validar verificacion_no_pico_masivo.sql.
-- Después correr postvalidacion_no_pico_masivo.sql.
--
-- Excluye: AUBASA, AUTOPISTA DEL OESTE, AUSA, CORREDORES VIALES SA,
--          RUTAS SUR ATLANTICO S.A., AUSOL
-- Preserva: confirmado_manual = true
--
-- confirmado_at es obligatorio (CHECK tarifas_normalizadas_confirmacion_chk).
-- confirmado_manual = true evita que peajes_recalcular_tarifas pise el status.
-- =============================================================================

BEGIN;

WITH objetivo AS (
  SELECT tn.id, tn.estacion_id, tn.categoria, tn.importe
  FROM public.tarifas_normalizadas tn
  JOIN public.peajes pj ON pj.id = tn.peaje_id
  WHERE pj.nombre NOT IN (
    'AUBASA',
    'AUTOPISTA DEL OESTE',
    'AUSA',
    'CORREDORES VIALES SA',
    'RUTAS SUR ATLANTICO S.A.',
    'AUSOL'
  )
    AND tn.confirmado_manual = false
    AND tn.status IS DISTINCT FROM 'NO_PICO'
),
niveles AS (
  UPDATE public.tarifas_normalizadas tn
  SET
    status = 'NO_PICO',
    confirmado_manual = true,
    confirmado_at = now(),
    diagnostico = 'CONFIRMADO',
    updated_at = now()
  FROM objetivo o
  WHERE tn.id = o.id
  RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
),
propagadas AS (
  UPDATE public.pasadas p
  SET
    tarifa_normalizada_id = n.id,
    tarifa_status = 'NO_PICO'
  FROM niveles n
  WHERE p.estacion_id = n.estacion_id
    AND p.categoria IS NOT DISTINCT FROM n.categoria
    AND p.precio = n.importe
    AND (
      p.tarifa_normalizada_id IS DISTINCT FROM n.id
      OR p.tarifa_status IS DISTINCT FROM n.status
    )
  RETURNING p.id
)
SELECT
  (SELECT count(*) FROM niveles) AS niveles_actualizados,
  (SELECT count(*) FROM propagadas) AS pasadas_actualizadas;

-- Si los conteos coinciden con verificacion_no_pico_masivo.sql sección 04/06, COMMIT.
-- Si no, ROLLBACK.
COMMIT;
