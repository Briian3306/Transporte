-- Power BI read-only views (pwbi_*): dimensiones estación/patente + hecho pasadas.
-- security_invoker = true para respetar RLS de tablas base.
-- Aliases entrecomillados (PascalCase) para nombres exactos en Power BI.

-- -----------------------------------------------------------------------------
-- 1) Dimensión estaciones (+ peaje)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pwbi_estacion
WITH (security_invoker = true)
AS
SELECT
  e.id AS "Estacion_ID",
  e.nombre AS "Estacion_Nombre",
  e.peaje_id AS "Peaje_ID",
  pj.nombre AS "Peaje_Nombre",
  e.ubicacion AS "Ubicacion",
  e.estado_geocodificacion AS "Status",
  e.created_at
FROM public.estaciones e
JOIN public.peajes pj ON pj.id = e.peaje_id;

COMMENT ON VIEW public.pwbi_estacion IS
  'Power BI: dimensión estaciones con peaje (Status = estado_geocodificacion)';

GRANT SELECT ON public.pwbi_estacion TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Dimensión patentes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pwbi_patentes
WITH (security_invoker = true)
AS
SELECT
  pt.id AS "Patente_ID",
  pt.patente AS "Patente",
  pt.created_at
FROM public.patentes pt;

COMMENT ON VIEW public.pwbi_patentes IS
  'Power BI: dimensión patentes (un registro por patente)';

GRANT SELECT ON public.pwbi_patentes TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Hecho pasadas (joins como pasadas_gestion, aliases Power BI)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pwbi_pasadas
WITH (security_invoker = true)
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
  p.created_at,
  p.user_id,
  p.file_upload_name,
  e.nombre AS "Estacion_Nombre",
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
  'Power BI: hecho pasadas denormalizado (estilo pasadas_gestion) con FKs Estacion_ID / Patente_ID / Pase_ID';

GRANT SELECT ON public.pwbi_pasadas TO authenticated, service_role;
