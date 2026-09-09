-- =============================================================================
-- Parte 1a — Verificación SOLO LECTURA
-- NO_PICO masivo para peajes SIN esquema de hora pico.
--
-- Correr ANTES de update_no_pico_masivo.sql. No muta nada.
-- Revisar cada sección; si 02 (catálogo) o 01 (match de nombres) fallan,
-- no ejecutar el UPDATE.
--
-- Peajes CON hora pico (excluidos del update):
--   AUBASA, AUTOPISTA DEL OESTE, AUSA, CORREDORES VIALES SA,
--   RUTAS SUR ATLANTICO S.A., AUSOL
-- =============================================================================

-- 01) Match exacto de los 6 peajes excluidos (1 fila por nombre esperado).
--     Si alguna fila falta, el nombre en DESARROLLO no coincide y el UPDATE
--     los marcaría NO_PICO por error.
SELECT
  '01_peajes_excluidos' AS seccion,
  esperado.nombre,
  CASE WHEN pj.id IS NULL THEN 'FALTA — no ejecutar UPDATE' ELSE 'OK' END AS match,
  pj.id AS peaje_id
FROM (
  VALUES
    ('AUBASA'),
    ('AUTOPISTA DEL OESTE'),
    ('AUSA'),
    ('CORREDORES VIALES SA'),
    ('RUTAS SUR ATLANTICO S.A.'),
    ('AUSOL')
) AS esperado(nombre)
LEFT JOIN public.peajes pj ON pj.nombre = esperado.nombre
ORDER BY esperado.nombre;

-- 02) Catálogo NO_PICO en peajes AFECTADOS (los que SÍ van al update).
--     El trigger trg_validar_status_tarifa rechaza el UPDATE si falta.
SELECT
  '02_catalogo_no_pico' AS seccion,
  pj.nombre AS peaje,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.tarifas_status_catalogo c
      WHERE c.peaje_id = pj.id
        AND c.codigo = 'NO_PICO'
    ) THEN 'OK'
    ELSE 'FALTA NO_PICO — sembrar con peajes_seed_status_catalogo_default'
  END AS catalogo
FROM public.peajes pj
WHERE pj.nombre NOT IN (
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL'
)
  AND EXISTS (
    SELECT 1
    FROM public.tarifas_normalizadas tn
    WHERE tn.peaje_id = pj.id
  )
ORDER BY pj.nombre;

-- 03) Niveles que el UPDATE tocaría, por peaje y status actual.
SELECT
  '03_niveles_a_actualizar' AS seccion,
  pj.nombre AS peaje,
  tn.status,
  count(*) AS niveles,
  sum(tn.cases) AS casos_nivel
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
GROUP BY pj.nombre, tn.status
ORDER BY pj.nombre, tn.status;

-- 04) Totales del objetivo (una sola fila).
SELECT
  '04_totales_objetivo' AS seccion,
  count(*) AS niveles,
  coalesce(sum(tn.cases), 0) AS casos_en_niveles
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
  AND tn.status IS DISTINCT FROM 'NO_PICO';

-- 05) Niveles confirmados a mano que se PRESERVAN (no se tocan).
SELECT
  '05_confirmados_preservados' AS seccion,
  pj.nombre AS peaje,
  tn.status,
  count(*) AS niveles,
  sum(tn.cases) AS casos_nivel
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
  AND tn.confirmado_manual = true
GROUP BY pj.nombre, tn.status
ORDER BY pj.nombre, tn.status;

-- 06) Pasadas ligadas a niveles del objetivo (se actualizarían).
SELECT
  '06_pasadas_ligadas' AS seccion,
  count(*) AS pasadas
FROM public.pasadas p
WHERE p.tarifa_normalizada_id IN (
  SELECT tn.id
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
);

-- 07) Pasadas huérfanas de peajes afectados (sin tarifa_normalizada_id).
--     El UPDATE por FK no las toca; quedan para recálculo / revisión.
SELECT
  '07_pasadas_huerfanas' AS seccion,
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

-- 08) Snapshot de los 6 peajes pico (para comparar post-update: no deben cambiar).
SELECT
  '08_snapshot_peajes_pico' AS seccion,
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
