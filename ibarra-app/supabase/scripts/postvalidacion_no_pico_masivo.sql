-- =============================================================================
-- Parte 1c — Post-validación SOLO LECTURA
-- Correr DESPUÉS de update_no_pico_masivo.sql (COMMIT).
-- =============================================================================

-- 01) Peajes sin esquema pico: no debe quedar ningún nivel no confirmado
--     distinto de NO_PICO.
SELECT
  '01_pendientes_restantes' AS seccion,
  pj.nombre AS peaje,
  tn.status,
  tn.confirmado_manual,
  count(*) AS niveles
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
WHERE pj.nombre NOT IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND tn.confirmado_manual = false
  AND tn.status IS DISTINCT FROM 'NO_PICO'
GROUP BY pj.nombre, tn.status, tn.confirmado_manual
ORDER BY pj.nombre;

-- Esperado: 0 filas.

-- 02) Resumen por peaje afectado: status de niveles confirmados.
SELECT
  '02_resumen_afectados' AS seccion,
  pj.nombre AS peaje,
  tn.status,
  tn.confirmado_manual,
  count(*) AS niveles
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
WHERE pj.nombre NOT IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
GROUP BY pj.nombre, tn.status, tn.confirmado_manual
ORDER BY pj.nombre, tn.status, tn.confirmado_manual;

-- 03) Discrepancias pasadas.tarifa_status vs nivel (peajes afectados, con FK).
--     Esperado: 0 filas.
SELECT
  '03_discrepancias_pasadas' AS seccion,
  pj.nombre AS peaje,
  p.tarifa_status AS status_pasada,
  tn.status AS status_nivel,
  count(*) AS pasadas
FROM public.pasadas p
JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id
JOIN public.peajes pj ON pj.id = tn.peaje_id
WHERE pj.nombre NOT IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND p.tarifa_status IS DISTINCT FROM tn.status
GROUP BY pj.nombre, p.tarifa_status, tn.status
ORDER BY pj.nombre;

-- 04) Snapshot de los 6 peajes pico — comparar con verificación sección 08.
--     No deben haber cambiado.
SELECT
  '04_snapshot_peajes_pico' AS seccion,
  pj.nombre AS peaje,
  tn.status,
  tn.confirmado_manual,
  count(*) AS niveles
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
WHERE pj.nombre IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
GROUP BY pj.nombre, tn.status, tn.confirmado_manual
ORDER BY pj.nombre, tn.status, tn.confirmado_manual;

-- 05) Huérfanas restantes en peajes afectados.
SELECT
  '05_huerfanas_restantes' AS seccion,
  pj.nombre AS peaje,
  coalesce(p.tarifa_status, '(null)') AS tarifa_status,
  count(*) AS pasadas
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
WHERE pj.nombre NOT IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND p.tarifa_normalizada_id IS NULL
GROUP BY pj.nombre, p.tarifa_status
ORDER BY pj.nombre, pasadas DESC;
