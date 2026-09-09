-- F14-10b: pwbi_tarifas.fecha_aparicion en snake_case (como created_at / fecha_hora).
-- CREATE OR REPLACE no puede renombrar la columna PascalCase "Fecha_Aparicion".
-- DROP+CREATE + NOTIFY pgrst para refrescar el schema cache de la Data API.

DROP VIEW IF EXISTS public.pwbi_tarifas;

CREATE VIEW public.pwbi_tarifas
WITH (security_invoker = false)
AS
SELECT
  tn.id AS "Tarifa_Normalizada_ID",
  tn.peaje_id AS "Peaje_ID",
  pj.nombre AS "Peaje_Nombre",
  tn.estacion_id AS "Estacion_ID",
  e.nombre AS "Estacion_Nombre",
  tn.categoria AS "Categoria",
  tn.categoria_calculated AS "Categoria_Calculated",
  tn.importe AS "Importe",
  tn.importe_base AS "Importe_Base",
  tn.cases AS "Cases",
  tn.multiplicador AS "Multiplicador",
  tn.desvio AS "Desvio",
  tn.hora_min AS "Hora_Min",
  tn.hora_max AS "Hora_Max",
  tn.hora_media AS "Hora_Media",
  tn.patron AS "Patron",
  tn.diagnostico AS "Diagnostico",
  tn.status AS "Status",
  tn.muestra_confiable AS "Muestra_Confiable",
  tn.confirmado_manual AS "Confirmado_Manual",
  tn.created_at,
  tn.fecha_aparicion
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
JOIN public.estaciones e ON e.id = tn.estacion_id;

COMMENT ON VIEW public.pwbi_tarifas IS
  'Power BI / Data API: dimensión tarifas_normalizadas (Status PICO/NO_PICO; Hora_Min/Max/Media; fecha_aparicion). Sin Tipo_Meta. security_invoker=false.';

GRANT SELECT ON public.pwbi_tarifas TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
