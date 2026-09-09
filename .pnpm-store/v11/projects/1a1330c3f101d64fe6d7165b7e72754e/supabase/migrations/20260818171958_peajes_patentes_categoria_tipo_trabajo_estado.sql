-- Catálogo de patentes: categorías canónicas, tipo de trabajo y baja lógica.
ALTER TABLE public.patentes
  ADD COLUMN IF NOT EXISTS tipo_trabajo text NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;

ALTER TABLE public.patentes DROP CONSTRAINT IF EXISTS patentes_categoria_chk;

UPDATE public.patentes
SET categoria = 'FLOTA CAMIONES'
WHERE categoria = 'TRANSPORTE';

ALTER TABLE public.patentes
  ADD CONSTRAINT patentes_categoria_chk
  CHECK (categoria IN ('FLOTA CAMIONES', 'FLOTA UTILITARIA', 'REMIS', 'OBRA', 'AUTO'));

-- Importación explícita del archivo compartido. No crea patentes nuevas.
UPDATE public.patentes AS p
SET tipo_trabajo = v.tipo_trabajo
FROM (VALUES
  ('AA561YA', 'E 52,5 media'), ('AB151SM', 'E 52,5 media'), ('AB247VR', 'Acindar local'),
  ('AB289LU', 'Interno TZ'), ('AB456CP', 'Acindar local'), ('AB456CQ', 'Acindar local'),
  ('AB456CU', 'E 52,5 media'), ('AB633TY', 'Acindar local'), ('AB633TZ', 'Acindar local'),
  ('AC264UA', 'E 52,5 media'), ('AC295IE', 'E 52,5 media'), ('AC561DQ', 'E 52,5 media'),
  ('AC812DO', 'E 52,5 media'), ('AD096FX', 'E 52,5 corta'), ('AD239PP', 'E 55,5 media'),
  ('AD328WK', 'E 55,5 larga'), ('AD482MT', 'E 55,5 larga'), ('AD625QA', 'E 52,5 media'),
  ('AD625QB', 'E 52,5 media'), ('AD667DM', 'E 55,5 larga'), ('AD736OU', 'E 52,5 larga'),
  ('AD933WS', 'Bitren Arauco'), ('AD985XP', 'E 55,5 media'), ('AE284KH', 'Bitren Arauco'),
  ('AE454PH', 'Bitren Arauco'), ('AE469PH', 'E 55,5 media'), ('AE469PL', 'E 55,5 larga'),
  ('AE733PC', 'Bitren Arauco'), ('AE751PA', 'E 55,5 larga'), ('AE831SI', 'E 52,5 larga'),
  ('AE908YL', 'Bitren Arauco'), ('AE952TH', 'E 55,5 media'), ('AF091AI', 'E 55,5 larga'),
  ('AF103ZL', 'E 52,5 GNC'), ('AF136HN', 'E 52,5 GNC'), ('AF202UU', 'Bitren Siderar'),
  ('AF231PZ', 'E 55,5 media'), ('AF389UV', 'Bitren Arauco'), ('AF411UY', 'Acindar local'),
  ('AF436WI', 'Bitren Siderar'), ('AF509QF', 'Bitren Arauco'), ('AF533SR', 'Bitren Siderar'),
  ('AF734UP', 'Bitren Arauco'), ('AF791ER', 'Bitren Siderar'), ('AF948ET', 'Interno TZ'),
  ('AF993HA', 'Bitren Siderar'), ('AF993HK', 'E 55,5 larga'), ('AG110LK', 'E 55,5 larga'),
  ('AG143GM', 'Interno TZ'), ('AG309CO', 'Bitren Siderar'), ('AG507DK', 'Bitren Siderar'),
  ('AG676SP', 'Bitren Arauco'), ('AG822HO', 'Batea YPF'), ('AG862VH', 'Bitren GNC Arauco'),
  ('AG893YR', 'Bitren Siderar'), ('AG916MK', 'Bitren Siderar'), ('AG939HR', 'Bitren Siderar'),
  ('AG939HX', 'Bitren Bivuelco'), ('AH033DL', 'E 55,5 larga'), ('AH185KI', 'Bitren Siderar'),
  ('AH251LE', 'Bitren Arauco'), ('AH272KN', 'Bitren Arauco'), ('AH285SP', 'Bitren Bivuelco'),
  ('AH351RS', 'Batea YPF'), ('AH351RT', 'Bitren Siderar'), ('AH543IQ', 'Bitren Siderar'),
  ('AH554RP', 'Batea YPF'), ('AH554RQ', 'Batea YPF'), ('AH729QW', 'Bitren Siderar'),
  ('AH800QR', 'Bitren Arauco'), ('AH800QT', 'E 52,5 larga'), ('AI015SZ', 'Batea YPF'),
  ('AI042WD', 'E 55,5 larga'), ('AI086DI', 'Batea YPF'), ('AI178EO', 'Batea YPF'),
  ('AI178ER', 'E 55,5 larga'), ('AI178EY', 'Bitren Bivuelco'), ('AI178EZ', 'Bitren Arauco'),
  ('AI348TR', 'Batea YPF'), ('EXT374', 'Acindar local'), ('OWG130', 'E 52,5 media')
) AS v(patente, tipo_trabajo)
WHERE p.patente = v.patente;

-- Dimensión Power BI actualizada.
DROP VIEW IF EXISTS public.pwbi_patentes CASCADE;
CREATE VIEW public.pwbi_patentes
WITH (security_invoker = false)
AS
SELECT
  p.id AS "Patente_ID",
  p.patente AS "Patente",
  p.categoria AS "Patente_Categoria",
  p.tipo_trabajo AS "Patente_Tipo_Trabajo",
  p.activa AS "Patente_Activa",
  p.created_at
FROM public.patentes p;
GRANT SELECT ON public.pwbi_patentes TO anon, authenticated, service_role;

-- Hecho Power BI: conserva Categoria cruda de la pasada y expone la clasificación del catálogo.
DROP VIEW IF EXISTS public.pwbi_pasadas CASCADE;
CREATE VIEW public.pwbi_pasadas
WITH (security_invoker = false)
AS
SELECT
  p.id AS "Pasada_ID", p.fecha_hora, p.pase_id AS "Pase_ID", p.patente_id AS "Patente_ID",
  p.estacion_id AS "Estacion_ID", p.documento_id AS "Documento_ID", e.peaje_id AS "Peaje_ID",
  pj.empresa_id AS "Empresa_ID", p.precio, p.bonificacion, p.quantity, p.importe_neto,
  p.categoria AS "Categoria",
  CASE WHEN p.categoria IS NULL THEN tn.categoria_calculated ELSE NULL END AS "Categoria_Calculated",
  (p.categoria IS NULL AND tn.categoria_calculated IS NOT NULL) AS "Categoria_Calculated_Boolean",
  p.tarifa_normalizada_id AS "Tarifa_Normalizada_ID", p.tarifa_status AS "Tarifa_Status",
  p.created_at, p.user_id, p.file_upload_name, e.nombre AS "Estacion_Nombre",
  e.estado_geocodificacion AS "Estacion_Geocodificacion_Status", e.latitud AS "Estacion_Latitud",
  e.longitud AS "Estacion_Longitud", pj.nombre AS "Peaje_Nombre", emp.nombre AS "Empresa_Nombre",
  pt.patente AS "Patente", pt.categoria AS "Patente_Categoria", pt.tipo_trabajo AS "Patente_Tipo_Trabajo",
  pt.activa AS "Patente_Activa", pa.pase AS "Pase", d.factura AS "Documento_Numero",
  d.tipo AS "Documento_Tipo", d.cuenta AS "Documento_Cuenta", d.fecha_factura,
  d.importe_sin_iva AS "Documento_Importe_Sin_Iva", d.importe_total AS "Documento_Importe_Total"
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.documentos d ON d.id = p.documento_id
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;
