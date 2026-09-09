-- F14-1/F14-2: recrear vistas dependientes de pasadas para exponer
-- categoria, tarifa_normalizada_id, tarifa_status.
-- pwbi_estacion / pwbi_patentes / pwbi_documentos no tocan columnas de pasadas → sin cambios.
--
-- Dependencias: peajes_listar_pasadas / peajes_listar_estaciones_pendientes leen
-- pasadas_gestion; DROP CASCADE las recrearía rotas → recreamos vistas y
-- reaplicamos grants. Las funciones SECURITY INVOKER que referencian la vista
-- siguen válidas tras REPLACE/CREATE.

DROP VIEW IF EXISTS public.pwbi_pasadas CASCADE;
DROP VIEW IF EXISTS public.pasadas_gestion CASCADE;
DROP VIEW IF EXISTS public.pasadas_con_peaje CASCADE;

CREATE VIEW public.pasadas_con_peaje
WITH (security_invoker = true)
AS
SELECT
  p.*,
  e.peaje_id,
  e.nombre AS estacion_nombre,
  pj.nombre AS peaje_nombre
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id;

COMMENT ON VIEW public.pasadas_con_peaje IS
  'Pasadas con peaje derivado vía estación (incluye categoria / tarifa_* F14)';
GRANT SELECT ON public.pasadas_con_peaje TO authenticated, service_role;

CREATE VIEW public.pasadas_gestion
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.fecha_hora,
  p.pase_id,
  p.patente_id,
  p.estacion_id,
  p.documento_id,
  p.precio,
  p.bonificacion,
  p.quantity,
  p.importe_neto,
  p.created_at,
  p.user_id,
  p.file_upload_name,
  p.categoria,
  p.tarifa_normalizada_id,
  p.tarifa_status,
  e.nombre AS estacion_nombre,
  e.latitud AS estacion_latitud,
  e.longitud AS estacion_longitud,
  e.peaje_id,
  pj.nombre AS peaje_nombre,
  pj.empresa_id,
  emp.nombre AS empresa_nombre,
  pt.patente AS patente_codigo,
  pt.categoria AS patente_categoria,
  pa.pase AS pase_codigo,
  d.factura AS documento_numero,
  d.factura AS factura_numero,
  d.cuenta AS documento_cuenta,
  d.cuenta AS factura_cuenta,
  d.tipo AS documento_tipo,
  d.fecha_factura,
  d.importe_sin_iva AS documento_importe_sin_iva,
  d.importe_sin_iva AS factura_importe_sin_iva,
  d.importe_total AS documento_importe_total,
  d.importe_total AS factura_importe_total
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.documentos d ON d.id = p.documento_id;

COMMENT ON VIEW public.pasadas_gestion IS
  'Vista de gestión de pasadas; categoria = texto crudo proveedor (RN-15), patente_categoria = enum interno. documento_* preferido, factura_* alias.';
GRANT SELECT ON public.pasadas_gestion TO authenticated, service_role;

-- security_invoker=false: coherente con 20260811114646 (Data API anon).
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
  'Power BI / Data API: hecho pasadas con Categoria / Tarifa_Status (F14). Patente_Categoria = enum interno. security_invoker=false.';
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;
