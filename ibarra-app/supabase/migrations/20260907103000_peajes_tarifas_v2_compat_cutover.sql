-- F14-16 Task 8: parallel Power BI reader pwbi_tarifas_v2.
-- Additive. Does not rewrite pwbi_tarifas, DROP tarifas_normalizadas,
-- or change peajes_normalizar_tarifas / peajes_recalcular_tarifas /
-- peajes_confirmar_status_tarifa.

CREATE VIEW public.pwbi_tarifas_v2
WITH (security_invoker = false)
AS
SELECT
  t.id AS "Tarifa_ID",
  t.peaje_id AS "Peaje_ID",
  t.estacion_id AS "Estacion_ID",
  t.categoria AS "Categoria",
  t.sentido AS "Sentido",
  t.status AS "Status",
  ti.importe AS "Importe",
  t.current_tarifa_id AS "Current_Tarifa_ID"
FROM public.tarifas t
LEFT JOIN public.tarifa_importe ti
  ON ti.id = t.current_tarifa_id
 AND ti.tarifa_id = t.id;

COMMENT ON VIEW public.pwbi_tarifas_v2 IS
  'Power BI / Data API: dimensión tarifas v2 (configuración vigente + importe actual via current_tarifa_id). Paralela a pwbi_tarifas. security_invoker=false.';

GRANT SELECT ON public.pwbi_tarifas_v2 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
