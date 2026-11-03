-- Paso 9: categoria_efectiva + no_coincide_con_tarifario.
BEGIN;
SELECT plan(12);

SELECT has_column(
  'public', 'tarifa_importe', 'no_coincide_con_tarifario',
  'tarifa_importe.no_coincide_con_tarifario exists'
);

SELECT col_default_is(
  'public', 'tarifa_importe', 'no_coincide_con_tarifario', 'false',
  'no_coincide_con_tarifario defaults to false'
);

INSERT INTO public.peajes (id, nombre)
VALUES ('21600000-aaaa-4aa1-8aa1-000000000001', 'F14-22 ceiling');
INSERT INTO public.estaciones (id, peaje_id, nombre)
VALUES
  ('21600000-aaaa-4aa1-8aa1-000000000010', '21600000-aaaa-4aa1-8aa1-000000000001', 'Ceiling 5'),
  ('21600000-aaaa-4aa1-8aa1-000000000011', '21600000-aaaa-4aa1-8aa1-000000000001', 'Same cat match');

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion, enabled
) VALUES
  ('21600000-aaaa-4aa1-8aa1-000000000050', '21600000-aaaa-4aa1-8aa1-000000000001', '21600000-aaaa-4aa1-8aa1-000000000010', 'NO_PICO', 5, 'AMBAS', now(), true),
  ('21600000-aaaa-4aa1-8aa1-000000000051', '21600000-aaaa-4aa1-8aa1-000000000001', '21600000-aaaa-4aa1-8aa1-000000000010', 'PICO', 5, 'AMBAS', now(), true),
  ('21600000-aaaa-4aa1-8aa1-000000000052', '21600000-aaaa-4aa1-8aa1-000000000001', '21600000-aaaa-4aa1-8aa1-000000000011', 'NO_PICO', 2, 'AMBAS', now(), true);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio
) VALUES
  ('21600000-aaaa-4aa1-8aa1-000000000150', '21600000-aaaa-4aa1-8aa1-000000000050', 5000, now(), 'CONFIRMADO', DATE '2026-01-01'),
  ('21600000-aaaa-4aa1-8aa1-000000000151', '21600000-aaaa-4aa1-8aa1-000000000051', 6000, now(), 'CONFIRMADO', DATE '2026-01-01'),
  ('21600000-aaaa-4aa1-8aa1-000000000152', '21600000-aaaa-4aa1-8aa1-000000000052', 1995.65, now(), 'CONFIRMADO', DATE '2026-01-01');

UPDATE public.tarifas
SET current_tarifa_id = '21600000-aaaa-4aa1-8aa1-000000000150'
WHERE id = '21600000-aaaa-4aa1-8aa1-000000000050';
UPDATE public.tarifas
SET current_tarifa_id = '21600000-aaaa-4aa1-8aa1-000000000151'
WHERE id = '21600000-aaaa-4aa1-8aa1-000000000051';
UPDATE public.tarifas
SET current_tarifa_id = '21600000-aaaa-4aa1-8aa1-000000000152'
WHERE id = '21600000-aaaa-4aa1-8aa1-000000000052';

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'CURRENT_CATEGORY_CORRECTION'
      AND (e->>'categoria_calculada')::int = 5
      AND e->>'status' = 'NO_PICO'
      AND (e->>'importe_actual')::numeric = 5000
    FROM jsonb_array_elements(
      public.peajes_detectar_refresco_tarifas(
        '[{"id":"ceil","estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","categoria":8,"status_solicitado":"NO_PICO","sentido_solicitado":"AMBAS","precio_directo":5000}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'provider cat 8 + $5000 caps to max 5 and matches NO_PICO'
);

SELECT is(
  (
    SELECT e->>'codigo'
    FROM jsonb_array_elements(
      public.peajes_detectar_refresco_tarifas(
        '[{"id":"nomatch","estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","categoria":8,"status_solicitado":"NO_PICO","sentido_solicitado":"AMBAS","precio_directo":7000}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'NEW_TARIFF',
  'capped category without importe match stays NEW_TARIFF'
);

SELECT is(
  (
    SELECT e->>'codigo'
    FROM jsonb_array_elements(
      public.peajes_detectar_refresco_tarifas(
        '[{"id":"normal","estacion_id":"21600000-aaaa-4aa1-8aa1-000000000011","categoria":2,"status_solicitado":"NO_PICO","sentido_solicitado":"AMBAS","precio_directo":1995.65}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'CURRENT_TARIFF',
  'same category + importe is a normal CURRENT_TARIFF match'
);

SELECT is(
  (
    SELECT e->>'codigo'
    FROM jsonb_array_elements(
      public.peajes_detectar_refresco_tarifas(
        '[{"id":"nullcat","estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","categoria":null,"status_solicitado":"NO_PICO","sentido_solicitado":"AMBAS","precio_directo":5000}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'CURRENT_CATEGORY_CORRECTION',
  'a unique price can resolve the category when provider category is missing'
);

SELECT is(
  (
    SELECT e->>'codigo'
    FROM jsonb_array_elements(
      public.peajes_detectar_refresco_tarifas(
        '[{"id":"outdate","estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","categoria":8,"status_solicitado":"NO_PICO","sentido_solicitado":"AMBAS","fecha_pasada":"2025-01-01","precio_directo":5000}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'HISTORICAL_CATEGORY_CORRECTION',
  'fecha_pasada outside vigencia still matches by categoria+importe'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","peaje_id":"21600000-aaaa-4aa1-8aa1-000000000001","importe":5000,"categoria":5}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  1,
  'history finds the matching identity even when the requested category is different'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21600000-aaaa-4aa1-8aa1-000000000010","peaje_id":"21600000-aaaa-4aa1-8aa1-000000000001","importe":5000,"categoria":4}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'history stays scoped to the effective category when another category has the price'
);

CREATE TEMP TABLE pg_temp._ceil_save AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'action', 'CONFIRM_NEW',
      'peaje_id', '21600000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '21600000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 5,
      'status', 'NO_PICO',
      'importe', 7000,
      'fecha_vigencia_inicio', '2026-09-02',
      'cases', 1,
      'no_coincide_con_tarifario', true
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'accion' = 'ACTUALIZADA'
      AND NULLIF(r -> 0 ->> 'tarifa_importe_id', '') IS NOT NULL
      AND (r -> 0 ->> 'nueva')::numeric = 7000
      AND (r -> 0 ->> 'no_coincide_con_tarifario')::boolean
      AND EXISTS (
        SELECT 1 FROM public.tarifa_importe ti
        WHERE ti.id = (r -> 0 ->> 'tarifa_importe_id')::uuid
          AND ti.importe = 7000
          AND ti.no_coincide_con_tarifario
          AND ti.diagnostico = 'CONFIRMADO'
      )
    FROM pg_temp._ceil_save
  ),
  'no-match CONFIRM_NEW persists importe and no_coincide_con_tarifario'
);

CREATE TEMP TABLE pg_temp._ceil_multi AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'ceil-multi-a',
      'action', 'CONFIRM_NEW',
      'peaje_id', '21600000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '21600000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 5,
      'status', 'NO_PICO',
      'importe', 6772.21,
      'fecha_vigencia_inicio', '2026-09-13',
      'cases', 2,
      'no_coincide_con_tarifario', true
    ),
    jsonb_build_object(
      'candidate_id', 'ceil-multi-b',
      'action', 'CONFIRM_NEW',
      'peaje_id', '21600000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '21600000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 5,
      'status', 'NO_PICO',
      'importe', 6961.8,
      'fecha_vigencia_inicio', '2026-09-13',
      'cases', 1,
      'no_coincide_con_tarifario', true
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      jsonb_array_length(r) = 2
      AND (r -> 1 ->> 'nueva')::numeric = 6961.8
      AND (r -> 1 ->> 'no_coincide_con_tarifario')::boolean
      AND EXISTS (
        SELECT 1 FROM public.tarifa_importe ti
        WHERE ti.tarifa_id = '21600000-aaaa-4aa1-8aa1-000000000050'
          AND ti.importe = 6772.21
          AND ti.no_coincide_con_tarifario
          AND ti.diagnostico = 'CONFIRMADO'
      )
      AND EXISTS (
        SELECT 1 FROM public.tarifa_importe ti
        WHERE ti.tarifa_id = '21600000-aaaa-4aa1-8aa1-000000000050'
          AND ti.importe = 6961.8
          AND ti.no_coincide_con_tarifario
          AND ti.diagnostico = 'CONFIRMADO'
          AND ti.fecha_vigencia_inicio = DATE '2026-09-14'
          AND ti.id = (SELECT current_tarifa_id FROM public.tarifas WHERE id = '21600000-aaaa-4aa1-8aa1-000000000050')
      )
    FROM pg_temp._ceil_multi
  ),
  'no-match leftovers with distinct importes append both tarifa_importe rows'
);

SELECT throws_ok(
  $$UPDATE public.tarifa_importe
      SET no_coincide_con_tarifario = true
    WHERE id = '21600000-aaaa-4aa1-8aa1-000000000150'$$,
  '23514',
  NULL,
  'no_coincide_con_tarifario is immutable'
);

SELECT finish();
ROLLBACK;
