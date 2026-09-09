-- Histograma de horas PICO en julio (referencia de ventana por peaje).

SELECT
  pj.nombre AS peaje,
  extract(hour FROM p.fecha_hora AT TIME ZONE 'UTC')::int AS hora,
  count(*)::int AS n
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
WHERE pj.nombre IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND p.fecha_hora >= '2026-07-01'
  AND p.fecha_hora < '2026-08-01'
  AND p.tarifa_status = 'PICO'
GROUP BY 1, 2
ORDER BY 1, 2;
