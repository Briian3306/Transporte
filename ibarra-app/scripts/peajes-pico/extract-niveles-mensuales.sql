-- Extrae niveles mensuales ene–jul de los 6 peajes con hora pico.
-- Solo lectura. Pegar el JSON de resultado en
-- ibarra-app/scripts/peajes-pico/data/niveles-mensuales.json
-- (o pasar --from-json al generador).

SELECT
  pj.nombre AS peaje,
  e.nombre AS estacion,
  p.categoria,
  to_char(date_trunc('month', p.fecha_hora), 'YYYY-MM') AS mes,
  p.precio AS importe,
  tn.id AS tarifa_normalizada_id,
  count(*)::int AS casos,
  min(
    extract(hour FROM p.fecha_hora AT TIME ZONE 'UTC')
    + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
  ) AS hora_min,
  max(
    extract(hour FROM p.fecha_hora AT TIME ZONE 'UTC')
    + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
  ) AS hora_max,
  count(*) FILTER (WHERE p.tarifa_status = 'PICO')::int AS casos_pico,
  count(*) FILTER (WHERE p.tarifa_status = 'NO_PICO')::int AS casos_no_pico
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.tarifas_normalizadas tn
  ON tn.estacion_id = p.estacion_id
 AND tn.categoria IS NOT DISTINCT FROM p.categoria
 AND tn.importe = p.precio
WHERE pj.nombre IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND p.fecha_hora >= '2026-01-01'
  AND p.fecha_hora < '2026-08-01'
GROUP BY
  pj.nombre,
  e.nombre,
  p.categoria,
  date_trunc('month', p.fecha_hora),
  p.precio,
  tn.id
ORDER BY 1, 2, 3, 4, 5;
