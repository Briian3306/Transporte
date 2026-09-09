-- Power BI: dimensión documentos (FC|NC) para relacionar con pwbi_pasadas.Documento_ID.
-- security_invoker=false + GRANT SELECT a anon (Data API / Power BI).

CREATE OR REPLACE VIEW public.pwbi_documentos
WITH (security_invoker = false)
AS
SELECT
  d.id AS "Documento_ID",
  d.factura AS "Documento_Numero",
  d.tipo AS "Documento_Tipo",
  d.cuenta AS "Documento_Cuenta",
  d.empresa_id AS "Empresa_ID",
  emp.nombre AS "Empresa_Nombre",
  d.fecha_factura,
  d.importe_sin_iva AS "Documento_Importe_Sin_Iva",
  d.bonificacion AS "Documento_Bonificacion",
  d.percepciones AS "Documento_Percepciones",
  d.iva AS "Documento_Iva",
  d.importe_total AS "Documento_Importe_Total",
  d.created_at
FROM public.documentos d
LEFT JOIN public.empresas emp ON emp.id::text = d.empresa_id;

COMMENT ON VIEW public.pwbi_documentos IS
  'Power BI / Data API: dimensión documentos FC|NC (anon SELECT; security_invoker=false)';

REVOKE ALL ON public.pwbi_documentos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_documentos TO anon, authenticated, service_role;
