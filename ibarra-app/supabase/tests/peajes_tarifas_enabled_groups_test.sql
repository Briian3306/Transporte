-- F14-21: enabled/disabled tariff state and atomic grouped saves.
BEGIN;
SELECT plan(11);

SELECT has_column('public', 'tarifas', 'enabled', 'tarifas stores an explicit enabled state');
SELECT col_not_null('public', 'tarifas', 'enabled', 'enabled is not nullable');
SELECT col_default_is('public', 'tarifas', 'enabled', 'true', 'new tariffs default to enabled');
SELECT has_function(
  'public',
  'peajes_actualizar_estado_categorias',
  ARRAY['jsonb'],
  'category state RPC exists'
);
SELECT has_function(
  'public',
  'peajes_guardar_tarifario_grupos',
  ARRAY['jsonb'],
  'group save RPC exists'
);

INSERT INTO public.peajes (id, nombre)
VALUES ('21400000-aaaa-4aa1-8aa1-000000000001', 'F14-21 toll');
INSERT INTO public.estaciones (id, peaje_id, nombre)
VALUES
  ('21400000-aaaa-4aa1-8aa1-000000000010', '21400000-aaaa-4aa1-8aa1-000000000001', 'Station 1'),
  ('21400000-aaaa-4aa1-8aa1-000000000011', '21400000-aaaa-4aa1-8aa1-000000000001', 'Station 2');

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion, enabled
) VALUES
  ('21400000-aaaa-4aa1-8aa1-000000000050', '21400000-aaaa-4aa1-8aa1-000000000001', '21400000-aaaa-4aa1-8aa1-000000000010', 'NO_PICO', 7, 'AMBAS', now(), true),
  ('21400000-aaaa-4aa1-8aa1-000000000051', '21400000-aaaa-4aa1-8aa1-000000000001', '21400000-aaaa-4aa1-8aa1-000000000010', 'PICO', 7, 'AMBAS', now(), true),
  ('21400000-aaaa-4aa1-8aa1-000000000052', '21400000-aaaa-4aa1-8aa1-000000000001', '21400000-aaaa-4aa1-8aa1-000000000011', 'NO_PICO', 7, 'AMBAS', now(), true);

SELECT lives_ok(
  $$SELECT public.peajes_actualizar_estado_categorias(
    '[{"peaje_id":"21400000-aaaa-4aa1-8aa1-000000000001","estacion_id":"21400000-aaaa-4aa1-8aa1-000000000010","sentido":"AMBAS","categoria":7,"enabled":false}]'::jsonb
  )$$,
  'disable operation is immediate'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarifas WHERE estacion_id = '21400000-aaaa-4aa1-8aa1-000000000010' AND categoria = 7 AND enabled = false),
  2,
  'state action updates both PICO and NO_PICO identities'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarifa_importe WHERE tarifa_id IN ('21400000-aaaa-4aa1-8aa1-000000000050', '21400000-aaaa-4aa1-8aa1-000000000051')),
  0,
  'state action does not create history'
);

SELECT lives_ok(
  $$SELECT public.peajes_actualizar_estado_categorias(
    '[{"peaje_id":"21400000-aaaa-4aa1-8aa1-000000000001","estacion_id":"21400000-aaaa-4aa1-8aa1-000000000010","sentido":"AMBAS","categoria":7,"enabled":true}]'::jsonb
  )$$,
  'enable operation is immediate'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarifas WHERE estacion_id = '21400000-aaaa-4aa1-8aa1-000000000010' AND categoria = 7 AND enabled),
  2,
  'enable restores both identities'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_tarifario_grupos(
    '[
      {"peaje_id":"21400000-aaaa-4aa1-8aa1-000000000001","estacion_id":"21400000-aaaa-4aa1-8aa1-000000000010","sentido":"AMBAS","categoria":8,"status":"NO_PICO","importe":8200,"fecha_vigencia_inicio":"2026-09-01"},
      {"peaje_id":"21400000-aaaa-4aa1-8aa1-000000000001","estacion_id":"21400000-aaaa-4aa1-8aa1-000000000011","sentido":"AMBAS","categoria":8,"status":"NO_PICO","importe":8200,"fecha_vigencia_inicio":"2026-09-01"}
    ]'::jsonb
  )$$,
  'group payload validates and saves atomically'
);

SELECT finish();
ROLLBACK;
