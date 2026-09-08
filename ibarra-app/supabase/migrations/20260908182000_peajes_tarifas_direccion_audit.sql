-- Read-only audit report for legacy directional records. This migration never
-- repairs or rewrites prices; remediation remains a reviewed/manual action.
CREATE OR REPLACE FUNCTION public.peajes_auditar_tarifas_direccion_colisiones()
RETURNS TABLE (
  peaje_id uuid,
  estacion_id uuid,
  categoria smallint,
  status text,
  importe_ida numeric,
  importe_vuelta numeric,
  tarifa_ida uuid,
  tarifa_importe_id_ida uuid,
  tarifa_vuelta uuid,
  tarifa_importe_id_vuelta uuid,
  evidencia text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ida.peaje_id,
    ida.estacion_id,
    ida.categoria,
    ida.status,
    ida_ti.importe,
    vuelta_ti.importe,
    ida.id,
    ida_ti.id,
    vuelta.id,
    vuelta_ti.id,
    'DIRECTIONAL_CURRENT_PRICE_COLLISION'::text
  FROM public.tarifas ida
  JOIN public.tarifas vuelta
    ON vuelta.peaje_id = ida.peaje_id
   AND vuelta.estacion_id = ida.estacion_id
   AND vuelta.categoria = ida.categoria
   AND vuelta.status = ida.status
   AND vuelta.sentido = 'VUELTA'
  JOIN public.tarifa_importe ida_ti ON ida_ti.id = ida.current_tarifa_id
  JOIN public.tarifa_importe vuelta_ti ON vuelta_ti.id = vuelta.current_tarifa_id
  WHERE ida.sentido = 'IDA'
    AND ida_ti.importe IS NOT DISTINCT FROM vuelta_ti.importe;
$$;

REVOKE ALL ON FUNCTION public.peajes_auditar_tarifas_direccion_colisiones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_auditar_tarifas_direccion_colisiones() TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_auditar_tarifas_direccion_colisiones() IS
  'Read-only legacy collision report. It provides evidence for review and never changes tariff history or current pointers.';
