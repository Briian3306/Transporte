-- pgTAP: peajes_backfill_pasadas_tarifa_importe passes 1–4 (IS NULL, LEAST+status,
-- IDA 1%, IDA historical REVISAR/no_coincide without promoting current).
BEGIN;
SELECT plan(13);

INSERT INTO public.peajes (id, nombre) VALUES
  ('20260915-bbbb-4bb1-8bb1-000000000001', 'Peaje BF status');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '20260915-bbbb-4bb1-8bb1-000000000002',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    'Estacion BF AMBAS'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000012',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    'Estacion BF IDA'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000022',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    'Estacion BF insert'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000032',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    'Estacion BF create IDA'
  );

INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('20260915-bbbb-4bb1-8bb1-000000000003', 'BFST15', 'FLOTA CAMIONES');

INSERT INTO public.pases (id, pase, patente_id) VALUES
  (
    '20260915-bbbb-4bb1-8bb1-000000000004',
    'BF-PASE-15',
    '20260915-bbbb-4bb1-8bb1-000000000003'
  );

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  '20260915-bbbb-4bb1-8bb1-000000000005',
  'BF-DOC-15', NULL, '__global__', DATE '2026-09-15', 'FC',
  1000, 0, 0, 1000, 0
);

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  fecha_actualizacion, current_tarifa_id
) VALUES
  (
    '20260915-bbbb-4bb1-8bb1-000000000010',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    '20260915-bbbb-4bb1-8bb1-000000000002',
    'PICO', 5, 'AMBAS', now(), NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000110',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    '20260915-bbbb-4bb1-8bb1-000000000012',
    'PICO', 6, 'IDA', now(), NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000111',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    '20260915-bbbb-4bb1-8bb1-000000000012',
    'PICO', 6, 'VUELTA', now(), NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000210',
    '20260915-bbbb-4bb1-8bb1-000000000001',
    '20260915-bbbb-4bb1-8bb1-000000000022',
    'PICO', 6, 'IDA', now(), NULL
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, fecha_vigencia_inicio, diagnostico
) VALUES
  (
    '20260915-bbbb-4bb1-8bb1-000000000020',
    '20260915-bbbb-4bb1-8bb1-000000000010',
    5000.00, timestamptz '2026-08-01 00:00:00+00', DATE '2026-08-01',
    'CONFIRMADO'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000120',
    '20260915-bbbb-4bb1-8bb1-000000000110',
    17962.75, timestamptz '2026-08-01 00:00:00+00', DATE '2026-08-01',
    'CONFIRMADO'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000121',
    '20260915-bbbb-4bb1-8bb1-000000000111',
    17962.75, timestamptz '2026-08-01 00:00:00+00', DATE '2026-08-01',
    'CONFIRMADO'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000220',
    '20260915-bbbb-4bb1-8bb1-000000000210',
    14968.96, timestamptz '2026-08-01 00:00:00+00', DATE '2026-08-01',
    'CONFIRMADO'
  );

UPDATE public.tarifas
SET current_tarifa_id = '20260915-bbbb-4bb1-8bb1-000000000020'
WHERE id = '20260915-bbbb-4bb1-8bb1-000000000010';

UPDATE public.tarifas
SET current_tarifa_id = '20260915-bbbb-4bb1-8bb1-000000000120'
WHERE id = '20260915-bbbb-4bb1-8bb1-000000000110';

UPDATE public.tarifas
SET current_tarifa_id = '20260915-bbbb-4bb1-8bb1-000000000121'
WHERE id = '20260915-bbbb-4bb1-8bb1-000000000111';

UPDATE public.tarifas
SET current_tarifa_id = '20260915-bbbb-4bb1-8bb1-000000000220'
WHERE id = '20260915-bbbb-4bb1-8bb1-000000000210';

INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  '20260915-bbbb-4bb1-8bb1-000000000040',
  '20260915-bbbb-4bb1-8bb1-000000000001',
  '20260915-bbbb-4bb1-8bb1-000000000002',
  '5', 4321, 4321, 1, 'B', 'CONFIRMADO', 'PICO'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico,
  tarifas_normalizadas_id, no_coincide_con_tarifario
) VALUES (
  '20260915-bbbb-4bb1-8bb1-000000000040',
  '20260915-bbbb-4bb1-8bb1-000000000010',
  4321.00, timestamptz '2026-07-01 00:00:00+00',
  'REVISAR', '20260915-bbbb-4bb1-8bb1-000000000040', false
);

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  tarifa_status, sentido, tarifa_importe_id
) VALUES
  (
    '20260915-bbbb-4bb1-8bb1-000000000030',
    timestamptz '2026-08-10 12:00:00+00',
    '20260915-bbbb-4bb1-8bb1-000000000004',
    '20260915-bbbb-4bb1-8bb1-000000000003',
    '20260915-bbbb-4bb1-8bb1-000000000002',
    '20260915-bbbb-4bb1-8bb1-000000000005',
    5000, 0, 1, 5000, '5', 'PICO', 'AMBAS',
    '20260915-bbbb-4bb1-8bb1-000000000020'
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000031',
    timestamptz '2026-08-10 12:01:00+00',
    '20260915-bbbb-4bb1-8bb1-000000000004',
    '20260915-bbbb-4bb1-8bb1-000000000003',
    '20260915-bbbb-4bb1-8bb1-000000000002',
    '20260915-bbbb-4bb1-8bb1-000000000005',
    5000, 0, 1, 5000, '8', 'PICO', 'AMBAS', NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000032',
    timestamptz '2026-08-10 12:02:00+00',
    '20260915-bbbb-4bb1-8bb1-000000000004',
    '20260915-bbbb-4bb1-8bb1-000000000003',
    '20260915-bbbb-4bb1-8bb1-000000000012',
    '20260915-bbbb-4bb1-8bb1-000000000005',
    17962.75, 0, 1, 17962.75, '6', 'PICO', 'AMBAS', NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000033',
    timestamptz '2026-08-10 12:03:00+00',
    '20260915-bbbb-4bb1-8bb1-000000000004',
    '20260915-bbbb-4bb1-8bb1-000000000003',
    '20260915-bbbb-4bb1-8bb1-000000000022',
    '20260915-bbbb-4bb1-8bb1-000000000005',
    11975.15, 0, 1, 11975.15, '6', 'PICO', 'AMBAS', NULL
  ),
  (
    '20260915-bbbb-4bb1-8bb1-000000000034',
    timestamptz '2026-08-10 12:04:00+00',
    '20260915-bbbb-4bb1-8bb1-000000000004',
    '20260915-bbbb-4bb1-8bb1-000000000003',
    '20260915-bbbb-4bb1-8bb1-000000000032',
    '20260915-bbbb-4bb1-8bb1-000000000005',
    2395.04, 0, 1, 2395.04, '2', 'NO_PICO', 'AMBAS', NULL
  );

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  tarifa_status, sentido, tarifa_importe_id, tarifa_normalizada_id
) VALUES (
  '20260915-bbbb-4bb1-8bb1-000000000035',
  timestamptz '2026-08-10 12:05:00+00',
  '20260915-bbbb-4bb1-8bb1-000000000004',
  '20260915-bbbb-4bb1-8bb1-000000000003',
  '20260915-bbbb-4bb1-8bb1-000000000002',
  '20260915-bbbb-4bb1-8bb1-000000000005',
  4321, 0, 1, 4321, '5', 'PENDIENTE', 'AMBAS', NULL,
  '20260915-bbbb-4bb1-8bb1-000000000040'
);

SELECT lives_ok(
  $$SELECT public.peajes_backfill_pasadas_tarifa_importe()$$,
  'backfill status ejecuta'
);

SELECT is(
  (
    SELECT tarifa_importe_id
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000030'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000020'::uuid,
  'backfill no pisa tarifa_importe_id ya cargado'
);

SELECT is(
  (
    SELECT tarifa_importe_id
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000035'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000040'::uuid,
  'pass 1 linaje 1:1 escribe tarifa_importe_id'
);

SELECT is(
  (
    SELECT tarifa_normalizada_id
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000035'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000040'::uuid,
  'backfill no toca tarifa_normalizada_id'
);

SELECT is(
  (
    SELECT tarifa_importe_id
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000031'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000020'::uuid,
  'pass 2 LEAST(8,5)+PICO enlaza el importe AMBAS a 1%'
);

SELECT is(
  (
    SELECT tarifa_importe_id
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000032'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000120'::uuid,
  'pass 3 AMBAS sin catalogo AMBAS enlaza IDA a 1%'
);

SELECT is(
  (
    SELECT tarifa_importe_id IS NOT NULL
       AND tarifa_importe_id <> '20260915-bbbb-4bb1-8bb1-000000000220'::uuid
    FROM public.pasadas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000033'
  ),
  true,
  'pass 4 enlaza un tarifa_importe nuevo para el precio IDA sin match 1%'
);

SELECT is(
  (
    SELECT current_tarifa_id
    FROM public.tarifas
    WHERE id = '20260915-bbbb-4bb1-8bb1-000000000210'
  ),
  '20260915-bbbb-4bb1-8bb1-000000000220'::uuid,
  'pass 4 no pisa el current IDA 14968.96'
);

SELECT is(
  (
    SELECT ti.diagnostico = 'REVISAR'
       AND ti.no_coincide_con_tarifario
       AND ti.fecha_vigencia_inicio IS NULL
       AND ti.importe = 11975.15
    FROM public.pasadas p
    JOIN public.tarifa_importe ti ON ti.id = p.tarifa_importe_id
    WHERE p.id = '20260915-bbbb-4bb1-8bb1-000000000033'
  ),
  true,
  'pass 4 inserta REVISAR no_coincide sin vigencia'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.tarifas t
    JOIN public.pasadas p ON p.estacion_id = t.estacion_id
    JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id AND ti.id = p.tarifa_importe_id
    WHERE p.id = '20260915-bbbb-4bb1-8bb1-000000000034'
      AND t.sentido = 'IDA'
      AND t.status = 'NO_PICO'
      AND t.categoria = 2
      AND t.current_tarifa_id IS NULL
      AND ti.diagnostico = 'REVISAR'
  ),
  'pass 4 crea identidad IDA faltante con current NULL'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tarifa_importe ti
    JOIN public.tarifas t ON t.id = ti.tarifa_id
    WHERE t.id = '20260915-bbbb-4bb1-8bb1-000000000210'
      AND ti.importe = 11975.15
  ),
  1,
  'retry no duplica el importe historico 11975.15'
);

SELECT lives_ok(
  $$SELECT public.peajes_backfill_pasadas_tarifa_importe()$$,
  'backfill status retry ejecuta'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tarifa_importe ti
    JOIN public.tarifas t ON t.id = ti.tarifa_id
    WHERE t.id = '20260915-bbbb-4bb1-8bb1-000000000210'
      AND ti.importe = 11975.15
  ),
  1,
  'pass 4 es idempotente'
);

SELECT * FROM finish();
ROLLBACK;
