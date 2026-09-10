-- pgTAP: tarifa_importe.cases is an immutable audit snapshot.
BEGIN;
SELECT plan(16);

SELECT has_column('public', 'tarifa_importe', 'cases', 'tarifa_importe has cases');
SELECT col_not_null('public', 'tarifa_importe', 'cases', 'tarifa_importe.cases is NOT NULL');
SELECT col_type_is('public', 'tarifa_importe', 'cases', 'integer', 'tarifa_importe.cases is integer');
SELECT ok(
  (SELECT pg_get_expr(d.adbin, d.adrelid)
   FROM pg_attrdef d
   JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
   WHERE d.adrelid = 'public.tarifa_importe'::regclass
     AND a.attname = 'cases') ILIKE '%0%',
  'tarifa_importe.cases defaults to zero'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('19990000-aaaa-4aa1-8aa1-000000000001', 'Cases test peaje');
INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('19990000-aaaa-4aa1-8aa1-000000000010', '19990000-aaaa-4aa1-8aa1-000000000001', 'Cases test station');
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
) VALUES (
  '19990000-aaaa-4aa1-8aa1-000000000020',
  '19990000-aaaa-4aa1-8aa1-000000000001',
  '19990000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'IDA', timestamptz '2026-01-01 00:00:00+00'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '19990000-aaaa-4aa1-8aa1-000000000100',
  '19990000-aaaa-4aa1-8aa1-000000000020',
  1000, timestamptz '2026-01-01 00:00:00+00',
  'CONFIRMADO', DATE '2026-01-01', DATE '2026-01-02'
);
SELECT is(
  (SELECT cases FROM public.tarifa_importe WHERE id = '19990000-aaaa-4aa1-8aa1-000000000100'),
  0,
  'manual or catalogue history defaults to zero cases'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, cases, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio
) VALUES (
  '19990000-aaaa-4aa1-8aa1-000000000101',
  '19990000-aaaa-4aa1-8aa1-000000000020',
  1100, 7, timestamptz '2026-01-02 00:00:00+00',
  'CONFIRMADO', DATE '2026-01-02'
);
SELECT is(
  (SELECT cases FROM public.tarifa_importe WHERE id = '19990000-aaaa-4aa1-8aa1-000000000101'),
  7,
  'explicit detected case count is retained'
);

SELECT throws_ok(
  $$INSERT INTO public.tarifa_importe (tarifa_id, importe, cases, fecha_aparicion)
    VALUES ('19990000-aaaa-4aa1-8aa1-000000000020', 1200, -1, now())$$,
  '23514', NULL,
  'negative cases is rejected'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe
      SET cases = 8
    WHERE id = '19990000-aaaa-4aa1-8aa1-000000000101'$$,
  '23514', NULL,
  'cases is immutable after insertion'
);
SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '19990000-aaaa-4aa1-8aa1-000000000020'),
  '19990000-aaaa-4aa1-8aa1-000000000101'::uuid,
  'case validation and immutable updates do not change the current pointer'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_tarifas_actuales(
      '19990000-aaaa-4aa1-8aa1-000000000001',
      '19990000-aaaa-4aa1-8aa1-000000000010',
      'IDA',
      '[{"categoria":1,"status":"NO_PICO","importe":1200,"fecha_vigencia_inicio":"2026-02-01"}]'::jsonb
    )$$,
  'manual tariff save succeeds'
);
SELECT is(
  (
    SELECT ti.cases
    FROM public.tarifas t
    JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id
    WHERE t.id = '19990000-aaaa-4aa1-8aa1-000000000020'
  ),
  0,
  'manual tariff save explicitly appends zero cases'
);

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
) VALUES (
  '19990000-aaaa-4aa1-8aa1-000000000021',
  '19990000-aaaa-4aa1-8aa1-000000000001',
  '19990000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'VUELTA', timestamptz '2026-01-01 00:00:00+00'
);
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio
) VALUES (
  '19990000-aaaa-4aa1-8aa1-000000000102',
  '19990000-aaaa-4aa1-8aa1-000000000021',
  2000, timestamptz '2026-01-01 00:00:00+00',
  'CONFIRMADO', DATE '2026-01-01'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    '[
      {"peaje_id":"19990000-aaaa-4aa1-8aa1-000000000001","estacion_id":"19990000-aaaa-4aa1-8aa1-000000000010","sentido":"IDA","categoria":1,"status":"NO_PICO","importe":1300,"cases":3,"action":"CONFIRM_NEW","fecha_vigencia_inicio":"2026-03-01"},
      {"peaje_id":"19990000-aaaa-4aa1-8aa1-000000000001","estacion_id":"19990000-aaaa-4aa1-8aa1-000000000010","sentido":"VUELTA","categoria":1,"status":"NO_PICO","importe":2100,"cases":5,"action":"CONFIRM_NEW","fecha_vigencia_inicio":"2026-03-01"}
    ]'::jsonb
  )$$,
  'Paso 9 saves independent directional case snapshots'
);
SELECT ok(
  (
    SELECT (SELECT ti.cases FROM public.tarifas t JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id WHERE t.id = '19990000-aaaa-4aa1-8aa1-000000000020') = 3
       AND (SELECT ti.cases FROM public.tarifas t JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id WHERE t.id = '19990000-aaaa-4aa1-8aa1-000000000021') = 5
  ),
  'Paso 9 writes each detected row count to its own IDA or VUELTA identity'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    '[
      {"peaje_id":"19990000-aaaa-4aa1-8aa1-000000000001","estacion_id":"19990000-aaaa-4aa1-8aa1-000000000010","sentido":"IDA","categoria":1,"status":"NO_PICO","importe":1400,"cases":4,"action":"CONFIRM_NEW","fecha_vigencia_inicio":"2026-04-01"},
      {"peaje_id":"19990000-aaaa-4aa1-8aa1-000000000001","estacion_id":"19990000-aaaa-4aa1-8aa1-000000000010","sentido":"VUELTA","categoria":1,"status":"NO_PICO","importe":2200,"cases":1.5,"action":"CONFIRM_NEW","fecha_vigencia_inicio":"2026-04-01"}
    ]'::jsonb
  )$$,
  '23514', NULL,
  'fractional Paso 9 cases is rejected'
);
SELECT is(
  (SELECT count(*)::integer FROM public.tarifa_importe),
  6,
  'invalid Paso 9 payload rolls back all of its history inserts'
);
SELECT ok(
  (
    SELECT (SELECT ti.importe FROM public.tarifas t JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id WHERE t.id = '19990000-aaaa-4aa1-8aa1-000000000020') = 1300
       AND (SELECT ti.importe FROM public.tarifas t JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id WHERE t.id = '19990000-aaaa-4aa1-8aa1-000000000021') = 2100
  ),
  'invalid Paso 9 payload leaves both directional current pointers unchanged'
);

SELECT finish();
ROLLBACK;
