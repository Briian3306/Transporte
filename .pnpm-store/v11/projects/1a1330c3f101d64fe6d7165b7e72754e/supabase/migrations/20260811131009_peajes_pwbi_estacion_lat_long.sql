-- Power BI: exponer latitud/longitud en pwbi_estacion (como estaciones.latitud/longitud).

DROP VIEW IF EXISTS public.pwbi_estacion;

CREATE VIEW public.pwbi_estacion
WITH (security_invoker = false)
AS
SELECT
  e.id AS "Estacion_ID",
  e.nombre AS "Estacion_Nombre",
  e.peaje_id AS "Peaje_ID",
  pj.nombre AS "Peaje_Nombre",
  e.ubicacion AS "Ubicacion",
  e.latitud AS "Latitud",
  e.longitud AS "Longitud",
  e.estado_geocodificacion AS "Status",
  e.created_at
FROM public.estaciones e
JOIN public.peajes pj ON pj.id = e.peaje_id;

COMMENT ON VIEW public.pwbi_estacion IS
  'Power BI / Data API: dimensión estaciones (+ Latitud/Longitud; anon SELECT; security_invoker=false)';

REVOKE ALL ON public.pwbi_estacion FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_estacion TO anon, authenticated, service_role;
