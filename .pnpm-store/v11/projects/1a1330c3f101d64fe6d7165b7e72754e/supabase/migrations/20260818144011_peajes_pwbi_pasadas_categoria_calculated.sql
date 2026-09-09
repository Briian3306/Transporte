-- Power BI: pwbi_pasadas.Categoria_Calculated (desde tarifas_normalizadas si Categoria es NULL)
-- + Categoria_Calculated_Boolean. LEFT JOIN al nivel; no pisa Categoria cruda (RN-15).

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
  CASE
    WHEN p.categoria IS NULL THEN tn.categoria_calculated
    ELSE NULL
  END AS "Categoria_Calculated",
  (p.categoria IS NULL AND tn.categoria_calculated IS NOT NULL) AS "Categoria_Calculated_Boolean",
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
JOIN public.documentos d ON d.id = p.documento_id
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id;

COMMENT ON VIEW public.pwbi_pasadas IS
  'Power BI / Data API: hecho pasadas. Categoria = texto proveedor (RN-15). Categoria_Calculated = clase 0–10 solo si Categoria es NULL. Categoria_Calculated_Boolean = TRUE si se usó esa clase. security_invoker=false.';

REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;
