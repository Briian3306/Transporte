-- Power BI Data API: allow anon key (PostgREST) to read pwbi_* views.
-- security_invoker=false: view runs as owner so base-table RLS for authenticated
-- does not empty results when the JWT role is anon.
-- Privileges: SELECT only for anon / authenticated / service_role.

DROP VIEW IF EXISTS public.pwbi_pasadas;
DROP VIEW IF EXISTS public.pwbi_estacion;
DROP VIEW IF EXISTS public.pwbi_patentes;

-- -----------------------------------------------------------------------------
-- 1) Dimensión estaciones (+ peaje)
-- -----------------------------------------------------------------------------
CREATE VIEW public.pwbi_estacion
WITH (security_invoker = false)
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
  'Power BI / Data API: dimensión estaciones (anon SELECT; security_invoker=false)';

-- -----------------------------------------------------------------------------
-- 2) Dimensión patentes
-- -----------------------------------------------------------------------------
CREATE VIEW public.pwbi_patentes
WITH (security_invoker = false)
AS
SELECT
  pt.id AS "Patente_ID",
  pt.patente AS "Patente",
  pt.created_at
FROM public.patentes pt;

COMMENT ON VIEW public.pwbi_patentes IS
  'Power BI / Data API: dimensión patentes (anon SELECT; security_invoker=false)';

-- -----------------------------------------------------------------------------
-- 3) Hecho pasadas
-- -----------------------------------------------------------------------------
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
  'Power BI / Data API: hecho pasadas (anon SELECT; security_invoker=false)';

-- -----------------------------------------------------------------------------
-- Privileges: read-only for API roles
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.pwbi_estacion FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.pwbi_patentes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.pwbi_estacion TO anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_patentes TO anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;
