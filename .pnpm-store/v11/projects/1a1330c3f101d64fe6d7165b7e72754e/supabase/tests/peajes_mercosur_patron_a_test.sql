-- Mercosur Pattern A: plantilla excludes CATEGORIA; B→A repair; RN-13/17 1%.
BEGIN;
SELECT plan(13);

-- -----------------------------------------------------------------------------
-- Plantilla: MERCA-SUR excludes CATEGORIA; AUSA Pattern B stays
-- -----------------------------------------------------------------------------
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado, mapeos)
VALUES
(
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'MERCA-SUR-001-ZARATE',
  '37ab9246-a07a-40b5-b62d-7a8b8e7782db',
  'activa',
  '[
    {"columnaOrigen": "DOMINIO", "columnaDestino": "PATENTE_ID", "excluida": false},
    {"columnaOrigen": "CATEGORIA", "columnaDestino": "CATEGORIA", "excluida": false}
  ]'::jsonb
),
(
  '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'AUSA-8-2026',
  '710f497d-7fa6-4259-b8dc-16fb1b3b1468',
  'activa',
  '[
    {"columnaOrigen": "CATEGORIA", "columnaDestino": "CATEGORIA", "excluida": false}
  ]'::jsonb
);

UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', NULL,
          'excluida', true
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.empresa_id = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
   OR p.nombre LIKE 'MERCA-SUR-%';

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'MERCA-SUR-001-ZARATE'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  0,
  'MERCA-SUR-001-ZARATE: 0 mapeos CATEGORIA activos (Patrón A)'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'MERCA-SUR-001-ZARATE'
      AND upper(trim(e->>'columnaOrigen')) = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = true
  ),
  'MERCA-SUR-001-ZARATE: fila CATEGORIA queda excluida'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUSA-8-2026'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  1,
  'AUSA-8-2026: mapeo CATEGORIA intacto (Patrón B)'
);

-- Idempotencia
UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', NULL,
          'excluida', true
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.empresa_id = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
   OR p.nombre LIKE 'MERCA-SUR-%';

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'MERCA-SUR-001-ZARATE'
      AND upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
  ),
  1,
  'Idempotente: una sola fila CATEGORIA tras segunda corrida'
);

-- -----------------------------------------------------------------------------
-- B→A data repair + Σ importe_neto vs documento (1%)
-- -----------------------------------------------------------------------------
INSERT INTO public.peajes (id, nombre, empresa_id)
VALUES (
  'aa111111-1111-4111-8111-111111111111',
  'Autovía del Mercosur TEST',
  '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
);

INSERT INTO public.estaciones (id, peaje_id, nombre)
VALUES (
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  'Zarate TEST'
);

INSERT INTO public.patentes (id, patente, categoria)
VALUES ('cc111111-1111-4111-8111-111111111111', 'MSRPAT', 'FLOTA CAMIONES');

INSERT INTO public.pases (id, pase, patente_id)
VALUES (
  'dd111111-1111-4111-8111-111111111111',
  'MSR-PASE',
  'cc111111-1111-4111-8111-111111111111'
);

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  'ee111111-1111-4111-8111-111111111111',
  'MSR-B2A',
  NULL,
  '37ab9246-a07a-40b5-b62d-7a8b8e7782db',
  CURRENT_DATE,
  'FC',
  1035611.20,
  0,
  0,
  1035611.20,
  0
);

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria
)
SELECT
  (timestamp '2026-07-01 00:00:00' + make_interval(hours => gs, mins => gs % 60))
    AT TIME ZONE 'UTC',
  'dd111111-1111-4111-8111-111111111111',
  'cc111111-1111-4111-8111-111111111111',
  'bb111111-1111-4111-8111-111111111111',
  'ee111111-1111-4111-8111-111111111111',
  CASE WHEN gs < 20 THEN 23536.62 ELSE 28243.94 END,
  0,
  1,
  CASE WHEN gs < 20 THEN 23536.62 ELSE 28243.94 END,
  '7'
FROM generate_series(0, 39) AS gs;

SELECT is(
  (SELECT count(*)::integer FROM public.pasadas
    WHERE documento_id = 'ee111111-1111-4111-8111-111111111111'),
  40,
  'Seed: 40 pasadas Pattern B (categoria=7)'
);

SELECT ok(
  (public.peajes_validar_documento_id('ee111111-1111-4111-8111-111111111111')->>'valido')::boolean,
  'Pre-repair: Σ importe_neto vs documento dentro del 1%'
);

SELECT public.peajes_recalcular_tarifas('aa111111-1111-4111-8111-111111111111');

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'bb111111-1111-4111-8111-111111111111'
      AND categoria = '7'
      AND importe = 23536.62
  ),
  'REVISAR',
  'Pattern B: cat 7 con dos precios → REVISAR'
);

-- Repair B→A (same sequence as DESARROLLO)
UPDATE public.pasadas p
SET categoria = NULL
FROM public.estaciones e
WHERE e.id = p.estacion_id
  AND e.peaje_id = 'aa111111-1111-4111-8111-111111111111';

DELETE FROM public.tarifas_normalizadas
WHERE peaje_id = 'aa111111-1111-4111-8111-111111111111';

SELECT public.peajes_recalcular_tarifas('aa111111-1111-4111-8111-111111111111');

SELECT is(
  (
    SELECT count(*)::integer FROM public.pasadas
    WHERE documento_id = 'ee111111-1111-4111-8111-111111111111'
      AND categoria IS NOT NULL
  ),
  0,
  'Post-repair: pasadas.categoria IS NULL'
);

SELECT is(
  (
    SELECT count(DISTINCT patron)::integer FROM public.tarifas_normalizadas
    WHERE peaje_id = 'aa111111-1111-4111-8111-111111111111'
  ),
  1,
  'Post-repair: un solo patrón'
);

SELECT is(
  (
    SELECT min(patron) FROM public.tarifas_normalizadas
    WHERE peaje_id = 'aa111111-1111-4111-8111-111111111111'
  ),
  'A',
  'Post-repair: patrón A'
);

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'bb111111-1111-4111-8111-111111111111'
      AND categoria IS NULL
      AND importe = 23536.62
  ),
  'CATEGORIA',
  'Pattern A: familia estación con dos precios dispersos → CATEGORIA'
);

SELECT is(
  (
    SELECT round(sum(importe_neto), 2)
    FROM public.pasadas
    WHERE documento_id = 'ee111111-1111-4111-8111-111111111111'
  ),
  1035611.20,
  'Post-repair: Σ importe_neto de pasadas no cambia'
);

SELECT ok(
  (public.peajes_validar_documento_id('ee111111-1111-4111-8111-111111111111')->>'valido')::boolean,
  'Post-repair: Σ importe_neto vs documento (importe_sin_iva) dentro del 1%'
);

SELECT * FROM finish();
ROLLBACK;
