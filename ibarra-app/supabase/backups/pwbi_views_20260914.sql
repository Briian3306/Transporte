-- Backup captured before 20260914183521_peajes_pwbi_tarifas_views.sql.
-- Source: public views in DESARROLLO (Check-list / kfffigvyvtzyczeiadxh).
-- Metadata: security_invoker=false; SELECT granted to anon, authenticated,
-- service_role; no view comments were present at capture time.

CREATE OR REPLACE VIEW public.pwbi_pasadas
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
  CASE
    WHEN p.categoria IS NULL THEN tn.categoria_calculated
    ELSE NULL::smallint
  END AS "Categoria_Calculated",
  p.categoria IS NULL AND tn.categoria_calculated IS NOT NULL
    AS "Categoria_Calculated_Boolean",
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
  pt.tipo_trabajo AS "Patente_Tipo_Trabajo",
  pt.activa AS "Patente_Activa",
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
JOIN public.documentos d ON d.id = p.documento_id
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id;

COMMENT ON VIEW public.pwbi_pasadas IS NULL;
REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.pwbi_tarifas_v2
WITH (security_invoker = false)
AS
SELECT
  t.id AS "Tarifa_ID",
  t.peaje_id AS "Peaje_ID",
  pj.nombre AS "Peaje_Nombre",
  t.estacion_id AS "Estacion_ID",
  e.nombre AS "Estacion_Nombre",
  t.categoria AS "Categoria",
  t.sentido AS "Sentido",
  t.status AS "Status",
  ti.importe AS "Importe",
  t.current_tarifa_id AS "Current_Tarifa_ID"
FROM public.tarifas t
LEFT JOIN public.tarifa_importe ti
  ON ti.id = t.current_tarifa_id
 AND ti.tarifa_id = t.id
JOIN public.peajes pj ON pj.id = t.peaje_id
JOIN public.estaciones e ON e.id = t.estacion_id;

COMMENT ON VIEW public.pwbi_tarifas_v2 IS NULL;
REVOKE ALL ON public.pwbi_tarifas_v2 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_tarifas_v2 TO anon, authenticated, service_role;
