-- Power BI: dimensión pwbi_tarifas (tarifas_normalizadas) + Estacion_Geocodificacion_Status en pwbi_pasadas.
-- security_invoker=false + GRANT SELECT a anon (Data API / Power BI).
-- DROP+CREATE de pwbi_pasadas: CREATE OR REPLACE no puede insertar columna en el medio.

CREATE OR REPLACE VIEW public.pwbi_tarifas
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
  tn.created_at
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
JOIN public.estaciones e ON e.id = tn.estacion_id;

COMMENT ON VIEW public.pwbi_tarifas IS
  'Power BI / Data API: dimensión tarifas_normalizadas (Status PICO/NO_PICO; Hora_Min/Max/Media). Sin Tipo_Meta. security_invoker=false.';

REVOKE ALL ON public.pwbi_tarifas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_tarifas TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.pwbi_pasadas;

CREATE VIEW public.pwbi_pasadas
WITH (security_invoker = false)
AS
SELECT
  p.id AS "Pasada_ID",
  p.fecha_hora,
  p.pase_id AS "Pase_ID",
  p.patente_id AS "Patente_ID",
  p.estacion_id AS "Estacion_ID",
  p.documento_id AS "Documento_ID",
  e.peaje_id AS "Peaje_ID",
  pj.empresa_id AS "Empresa_ID",
  p.precio,
  p.bonificacion,
  p.quantity,
  p.importe_neto,
  p.categoria AS "Categoria",
  p.tarifa_normalizada_id AS "Tarifa_Normalizada_ID",
  p.tarifa_status AS "Tarifa_Status",
  p.created_at,
  p.user_id,
  p.file_upload_name,
  e.nombre AS "Estacion_Nombre",
  e.estado_geocodificacion AS "Estacion_Geocodificacion_Status",
  e.latitud AS "Estacion_Latitud",
  e.longitud AS "Estacion_Longitud",
  pj.nombre AS "Peaje_Nombre",
  emp.nombre AS "Empresa_Nombre",
  pt.patente AS "Patente",
  pt.categoria AS "Patente_Categoria",
  pa.pase AS "Pase",
  d.factura AS "Documento_Numero",
  d.tipo AS "Documento_Tipo",
  d.cuenta AS "Documento_Cuenta",
  d.fecha_factura,
  d.importe_sin_iva AS "Documento_Importe_Sin_Iva",
  d.importe_total AS "Documento_Importe_Total"
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.documentos d ON d.id = p.documento_id;

COMMENT ON VIEW public.pwbi_pasadas IS
  'Power BI / Data API: hecho pasadas con Categoria / Tarifa_Status / Estacion_Geocodificacion_Status. Patente_Categoria = enum interno. security_invoker=false.';

REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;
