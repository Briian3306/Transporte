-- Power BI: repoint tariff status to the v2 tarifas/tarifa_importe model and
-- expose current tariff-history metadata. View-only change; no table, data,
-- trigger, constraint, or RPC modifications.

CREATE OR REPLACE VIEW public.pwbi_pasadas
WITH (security_invoker = false)
AS
WITH pasada_context AS (
  SELECT
    p.id AS pasada_id,
    p.fecha_hora,
    p.pase_id,
    p.patente_id,
    p.estacion_id,
    p.documento_id,
    e.peaje_id,
    pj.empresa_id,
    p.precio,
    p.bonificacion,
    p.quantity,
    p.importe_neto,
    p.categoria,
    CASE
      WHEN btrim(p.categoria) ~ '^[0-9]+$'
        THEN btrim(p.categoria)::smallint
      ELSE tn.categoria_calculated
    END AS categoria_efectiva,
    p.tarifa_normalizada_id,
    p.sentido,
    p.tarifa_importe_id,
    p.created_at,
    p.user_id,
    p.file_upload_name,
    e.nombre AS estacion_nombre,
    e.estado_geocodificacion AS estacion_geocodificacion_status,
    e.latitud AS estacion_latitud,
    e.longitud AS estacion_longitud,
    pj.nombre AS peaje_nombre,
    emp.nombre AS empresa_nombre,
    pt.patente,
    pt.categoria AS patente_categoria,
    pt.tipo_trabajo AS patente_tipo_trabajo,
    pt.activa AS patente_activa,
    pa.pase,
    d.factura AS documento_numero,
    d.tipo AS documento_tipo,
    d.cuenta AS documento_cuenta,
    d.fecha_factura,
    d.importe_sin_iva AS documento_importe_sin_iva,
    d.importe_total AS documento_importe_total,
    CASE
      WHEN p.categoria IS NULL THEN tn.categoria_calculated
      ELSE NULL::smallint
    END AS categoria_calculated,
    (p.categoria IS NULL AND tn.categoria_calculated IS NOT NULL)
      AS categoria_calculated_boolean
  FROM public.pasadas p
  JOIN public.estaciones e ON e.id = p.estacion_id
  JOIN public.peajes pj ON pj.id = e.peaje_id
  LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
  JOIN public.patentes pt ON pt.id = p.patente_id
  JOIN public.pases pa ON pa.id = p.pase_id
  JOIN public.documentos d ON d.id = p.documento_id
  LEFT JOIN public.tarifas_normalizadas tn
    ON tn.id = p.tarifa_normalizada_id
), resolved AS (
  SELECT
    c.*,
    linked.status AS linked_status,
    dimensional.only_status AS dimensional_status,
    dimensional.status_count
  FROM pasada_context c
  LEFT JOIN public.tarifa_importe linked_importe
    ON linked_importe.id = c.tarifa_importe_id
  LEFT JOIN public.tarifas linked
    ON linked.id = linked_importe.tarifa_id
  LEFT JOIN LATERAL (
    SELECT
      min(t.status) AS only_status,
      count(DISTINCT t.status)::integer AS status_count
    FROM public.tarifas t
    WHERE t.peaje_id = c.peaje_id
      AND t.estacion_id = c.estacion_id
      AND t.categoria = c.categoria_efectiva
      AND (
        (c.sentido = 'AMBAS' AND t.sentido = 'AMBAS')
        OR (
          c.sentido IN ('IDA', 'VUELTA')
          AND t.sentido IN (c.sentido, 'AMBAS')
        )
      )
  ) dimensional ON true
)
SELECT
  r.pasada_id AS "Pasada_ID",
  r.fecha_hora,
  r.pase_id AS "Pase_ID",
  r.patente_id AS "Patente_ID",
  r.estacion_id AS "Estacion_ID",
  r.documento_id AS "Documento_ID",
  r.peaje_id AS "Peaje_ID",
  r.empresa_id AS "Empresa_ID",
  r.precio,
  r.bonificacion,
  r.quantity,
  r.importe_neto,
  r.categoria AS "Categoria",
  r.categoria_calculated AS "Categoria_Calculated",
  r.categoria_calculated_boolean AS "Categoria_Calculated_Boolean",
  r.tarifa_normalizada_id AS "Tarifa_Normalizada_ID",
  COALESCE(
    r.linked_status,
    CASE
      WHEN r.status_count = 1 THEN r.dimensional_status
      ELSE NULL
    END
  ) AS "Tarifa_Status",
  r.created_at,
  r.user_id,
  r.file_upload_name,
  r.estacion_nombre AS "Estacion_Nombre",
  r.estacion_geocodificacion_status AS "Estacion_Geocodificacion_Status",
  r.estacion_latitud AS "Estacion_Latitud",
  r.estacion_longitud AS "Estacion_Longitud",
  r.peaje_nombre AS "Peaje_Nombre",
  r.empresa_nombre AS "Empresa_Nombre",
  r.patente AS "Patente",
  r.patente_categoria AS "Patente_Categoria",
  r.patente_tipo_trabajo AS "Patente_Tipo_Trabajo",
  r.patente_activa AS "Patente_Activa",
  r.pase AS "Pase",
  r.documento_numero AS "Documento_Numero",
  r.documento_tipo AS "Documento_Tipo",
  r.documento_cuenta AS "Documento_Cuenta",
  r.fecha_factura,
  r.documento_importe_sin_iva AS "Documento_Importe_Sin_Iva",
  r.documento_importe_total AS "Documento_Importe_Total"
FROM resolved r;

COMMENT ON VIEW public.pwbi_pasadas IS
  'Power BI / Data API: hecho pasadas. Tarifa_Status proviene de tarifas mediante tarifa_importe; la coincidencia dimensional ambigua queda NULL. security_invoker=false.';

REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;

-- The checked-in predecessor has 8 columns while DESARROLLO already has 10
-- (Peaje_Nombre and Estacion_Nombre). A non-cascading view replacement is
-- required to converge both shapes without touching dependent tables.
DROP VIEW IF EXISTS public.pwbi_tarifas_v2;

CREATE VIEW public.pwbi_tarifas_v2
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
  t.current_tarifa_id AS "Current_Tarifa_ID",
  ti.fecha_vigencia_inicio,
  ti.fecha_vigencia_fin,
  ti.no_coincide_con_tarifario,
  CASE
    WHEN t.id IS NOT NULL THEN true
    ELSE false
  END AS tarifa_vigente
FROM public.tarifas t
LEFT JOIN public.tarifa_importe ti
  ON ti.id = t.current_tarifa_id
 AND ti.tarifa_id = t.id
JOIN public.peajes pj ON pj.id = t.peaje_id
JOIN public.estaciones e ON e.id = t.estacion_id;

COMMENT ON VIEW public.pwbi_tarifas_v2 IS
  'Power BI / Data API: tarifas + importe current y metadata histórica. tarifa_vigente depende únicamente de la existencia de la identidad en tarifas; no usa fechas, enabled ni current_tarifa_id. security_invoker=false.';

REVOKE ALL ON public.pwbi_tarifas_v2 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_tarifas_v2 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
