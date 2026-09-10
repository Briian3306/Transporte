-- pgTAP: F14-19 validity, diagnostics, safe lineage backfill and pointer gates.
BEGIN;
SELECT plan(51);

-- Legacy compatibility remains intact.
SELECT has_table('public', 'tarifa_importe', 'F14-19 tarifa_importe sigue existiendo');
SELECT has_table('public', 'tarifas_normalizadas', 'F14-19 tarifas_normalizadas sigue existiendo');
SELECT has_column(
  'public', 'pasadas', 'tarifa_normalizada_id',
  'F14-19 pasadas.tarifa_normalizada_id sigue existiendo'
);
SELECT fk_ok(
  'pasadas', 'tarifa_normalizada_id', 'tarifas_normalizadas', 'id',
  'F14-19 FK legado pasadas.tarifa_normalizada_id sigue intacta'
);
SELECT fk_ok(
  'tarifa_importe', 'tarifas_normalizadas_id', 'tarifas_normalizadas', 'id',
  'F14-19 FK de linaje tarifa_importe.tarifas_normalizadas_id sigue intacta'
);

SELECT has_column(
  'public', 'tarifa_importe', 'fecha_vigencia_inicio',
  'F14-19 tarifa_importe.fecha_vigencia_inicio'
);
SELECT col_type_is(
  'public', 'tarifa_importe', 'fecha_vigencia_inicio', 'date',
  'F14-19 tarifa_importe.fecha_vigencia_inicio date'
);
SELECT col_is_null(
  'public', 'tarifa_importe', 'fecha_vigencia_inicio',
  'F14-19 tarifa_importe.fecha_vigencia_inicio nullable'
);

SELECT has_column(
  'public', 'tarifa_importe', 'fecha_vigencia_fin',
  'F14-19 tarifa_importe.fecha_vigencia_fin'
);
SELECT col_type_is(
  'public', 'tarifa_importe', 'fecha_vigencia_fin', 'date',
  'F14-19 tarifa_importe.fecha_vigencia_fin date'
);
SELECT col_is_null(
  'public', 'tarifa_importe', 'fecha_vigencia_fin',
  'F14-19 tarifa_importe.fecha_vigencia_fin nullable'
);

SELECT has_column(
  'public', 'tarifa_importe', 'diagnostico',
  'F14-19 tarifa_importe.diagnostico'
);
SELECT col_type_is(
  'public', 'tarifa_importe', 'diagnostico', 'text',
  'F14-19 tarifa_importe.diagnostico text'
);
SELECT col_is_null(
  'public', 'tarifa_importe', 'diagnostico',
  'F14-19 tarifa_importe.diagnostico nullable'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist'
      AND n.nspname = 'extensions'
  ),
  'F14-19 btree_gist está habilitada en extensions'
);

SELECT ok(
  (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_diagnostico_chk'
      AND c.contype = 'c'
  ) ILIKE ALL (ARRAY[
    '%MUESTRA_INSUFICIENTE%',
    '%TARIFA_UNICA%',
    '%CATEGORIA%',
    '%POSIBLE_HORARIO%',
    '%REVISAR%',
    '%CONFIRMADO%'
  ]),
  'F14-19 diagnostico usa los seis valores de tarifas_normalizadas'
);

SELECT ok(
  regexp_replace(
    COALESCE((
      SELECT pg_get_expr(c.conbin, c.conrelid)
      FROM pg_constraint c
      WHERE c.conrelid = 'public.tarifa_importe'::regclass
        AND c.conname = 'tarifa_importe_vigencia_fechas_chk'
        AND c.contype = 'c'
    ), ''),
    '\s+', '', 'g'
  ) = '((fecha_vigencia_finISNULL)OR(fecha_vigencia_inicioISNULL)OR(fecha_vigencia_inicio<fecha_vigencia_fin))',
  'F14-19 check de fechas conserva la expresión acordada'
);

SELECT ok(
  (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_vigencia_confirmada_excl'
      AND c.contype = 'x'
  ) ILIKE '%EXCLUDE USING gist%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_vigencia_confirmada_excl'
      AND c.contype = 'x'
  ) ILIKE '%tarifa_id WITH =%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_vigencia_confirmada_excl'
      AND c.contype = 'x'
  ) ILIKE '%daterange(fecha_vigencia_inicio, COALESCE(fecha_vigencia_fin, ''infinity''::date), ''[)''::text) WITH &&%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_vigencia_confirmada_excl'
      AND c.contype = 'x'
  ) ILIKE '%diagnostico = ''CONFIRMADO''%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.conrelid = 'public.tarifa_importe'::regclass
      AND c.conname = 'tarifa_importe_vigencia_confirmada_excl'
      AND c.contype = 'x'
  ) ILIKE '%fecha_vigencia_inicio IS NOT NULL%',
  'F14-19 exclusión GiST parcial cubre intervalos CONFIRMADO por tarifa_id'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('21900000-aaaa-4aa1-8aa1-000000000001', 'Vigencia F14-19');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '21900000-aaaa-4aa1-8aa1-000000000002',
    '21900000-aaaa-4aa1-8aa1-000000000001',
    'ESTACION VIGENCIA F14-19'
  );

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
) VALUES
  ('21900000-aaaa-4aa1-8aa1-000000000010', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 0, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000011', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 1, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000012', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 2, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000013', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 3, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000014', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'PICO', 3, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000015', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 4, 'AMBAS', '2026-01-01'),
  ('21900000-aaaa-4aa1-8aa1-000000000016', '21900000-aaaa-4aa1-8aa1-000000000001', '21900000-aaaa-4aa1-8aa1-000000000002', 'NO_PICO', 5, 'AMBAS', '2026-01-01');

-- Complete six-value diagnostic domain.
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000100', '21900000-aaaa-4aa1-8aa1-000000000010', 100, now(), 'MUESTRA_INSUFICIENTE')$$,
  'F14-19 acepta diagnostico MUESTRA_INSUFICIENTE'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000101', '21900000-aaaa-4aa1-8aa1-000000000010', 101, now(), 'TARIFA_UNICA')$$,
  'F14-19 acepta diagnostico TARIFA_UNICA'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000102', '21900000-aaaa-4aa1-8aa1-000000000010', 102, now(), 'CATEGORIA')$$,
  'F14-19 acepta diagnostico CATEGORIA'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000103', '21900000-aaaa-4aa1-8aa1-000000000010', 103, now(), 'POSIBLE_HORARIO')$$,
  'F14-19 acepta diagnostico POSIBLE_HORARIO'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000104', '21900000-aaaa-4aa1-8aa1-000000000010', 104, now(), 'REVISAR')$$,
  'F14-19 acepta diagnostico REVISAR'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000105', '21900000-aaaa-4aa1-8aa1-000000000010', 105, now(), 'CONFIRMADO')$$,
  'F14-19 acepta diagnostico CONFIRMADO'
);
SELECT throws_ok(
  $$INSERT INTO public.tarifa_importe (tarifa_id, importe, fecha_aparicion, diagnostico)
    VALUES ('21900000-aaaa-4aa1-8aa1-000000000010', 106, now(), 'OTRO')$$,
  '23514', NULL,
  'F14-19 rechaza diagnostico fuera del dominio de seis valores'
);

-- Reapply the one-time migration UPDATE against synthetic legacy rows.
INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  '21900000-aaaa-4aa1-8aa1-000000000200',
  '21900000-aaaa-4aa1-8aa1-000000000001',
  '21900000-aaaa-4aa1-8aa1-000000000002',
  NULL, 200, 200, 1, 'A', 'CATEGORIA', 'PENDIENTE'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, tarifas_normalizadas_id
) VALUES
  (
    '21900000-aaaa-4aa1-8aa1-000000000201',
    '21900000-aaaa-4aa1-8aa1-000000000011',
    200, '2026-02-01',
    '21900000-aaaa-4aa1-8aa1-000000000200'
  ),
  (
    '21900000-aaaa-4aa1-8aa1-000000000202',
    '21900000-aaaa-4aa1-8aa1-000000000011',
    201, '2026-02-02',
    NULL
  );

ALTER TABLE public.tarifa_importe DISABLE TRIGGER trg_tarifa_importe_immutable;
UPDATE public.tarifa_importe AS ti
SET diagnostico = tn.diagnostico
FROM public.tarifas_normalizadas AS tn
WHERE tn.id = ti.tarifas_normalizadas_id
  AND ti.diagnostico IS NULL;
ALTER TABLE public.tarifa_importe ENABLE TRIGGER trg_tarifa_importe_immutable;

SELECT is(
  (SELECT diagnostico FROM public.tarifa_importe WHERE id = '21900000-aaaa-4aa1-8aa1-000000000201'),
  'CATEGORIA',
  'F14-19 backfill copia diagnostico solo por tarifas_normalizadas_id exacto'
);
SELECT is(
  (SELECT diagnostico FROM public.tarifa_importe WHERE id = '21900000-aaaa-4aa1-8aa1-000000000202'),
  NULL,
  'F14-19 backfill deja diagnostico NULL cuando no hay linaje'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.tarifa_importe
    WHERE id IN (
      '21900000-aaaa-4aa1-8aa1-000000000201',
      '21900000-aaaa-4aa1-8aa1-000000000202'
    )
      AND (fecha_vigencia_inicio IS NOT NULL OR fecha_vigencia_fin IS NOT NULL)
  ),
  'F14-19 backfill no deriva vigencia desde fecha_aparicion'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.tarifa_importe
    WHERE fecha_vigencia_inicio IS NOT NULL
       OR fecha_vigencia_fin IS NOT NULL
  ),
  'F14-19 la migración deja toda vigencia preexistente en NULL'
);

-- Exact date ordering: either NULL is accepted; known intervals are [start, end).
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000300', '21900000-aaaa-4aa1-8aa1-000000000012', 300, now(), 'REVISAR', '2026-03-01')$$,
  'F14-19 permite fin conocido con inicio NULL'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000301', '21900000-aaaa-4aa1-8aa1-000000000012', 301, now(), 'REVISAR', '2026-03-01')$$,
  'F14-19 permite inicio conocido con fin NULL'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000302', '21900000-aaaa-4aa1-8aa1-000000000012', 302, now(), 'REVISAR', '2026-03-01', '2026-04-01')$$,
  'F14-19 permite inicio anterior al fin'
);
SELECT throws_ok(
  $$INSERT INTO public.tarifa_importe
      (tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000012', 303, now(), 'REVISAR', '2026-03-01', '2026-03-01')$$,
  '23514', NULL,
  'F14-19 rechaza inicio igual al fin'
);
SELECT throws_ok(
  $$INSERT INTO public.tarifa_importe
      (tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000012', 304, now(), 'REVISAR', '2026-04-01', '2026-03-01')$$,
  '23514', NULL,
  'F14-19 rechaza inicio posterior al fin'
);

-- Confirmed half-open periods: adjacency is valid and overlap is rejected.
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000400', '21900000-aaaa-4aa1-8aa1-000000000013', 400, now(), 'CONFIRMADO', '2026-06-01', '2026-09-01')$$,
  'F14-19 acepta primer intervalo confirmado'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000401', '21900000-aaaa-4aa1-8aa1-000000000013', 401, now(), 'CONFIRMADO', '2026-09-01', '2026-12-01')$$,
  'F14-19 acepta intervalos confirmados adyacentes [inicio, fin)'
);
SELECT throws_ok(
  $$INSERT INTO public.tarifa_importe
      (tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000013', 402, now(), 'CONFIRMADO', '2026-08-01', '2026-10-01')$$,
  '23P01', NULL,
  'F14-19 rechaza intervalos CONFIRMADO superpuestos para la misma tarifa'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000403', '21900000-aaaa-4aa1-8aa1-000000000013', 403, now(), 'REVISAR', '2026-08-01', '2026-10-01')$$,
  'F14-19 REVISAR queda fuera de la exclusión temporal'
);
SELECT lives_ok(
  $$INSERT INTO public.tarifa_importe
      (id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin)
    VALUES
      ('21900000-aaaa-4aa1-8aa1-000000000404', '21900000-aaaa-4aa1-8aa1-000000000014', 404, now(), 'CONFIRMADO', '2026-08-01', '2026-10-01')$$,
  'F14-19 permite el mismo intervalo en otra tarifa_id'
);

-- Immutable history permits only one valid NULL -> non-NULL end transition.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, cases, fecha_aparicion, diagnostico,
  fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '21900000-aaaa-4aa1-8aa1-000000000500',
  '21900000-aaaa-4aa1-8aa1-000000000015',
  500, 7, '2026-01-15', 'CONFIRMADO', '2026-01-01', NULL
);

SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET importe = 999
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 importe permanece inmutable'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET diagnostico = 'REVISAR'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 diagnostico permanece inmutable'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET fecha_vigencia_inicio = '2025-12-01'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 fecha_vigencia_inicio permanece inmutable'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET fecha_vigencia_fin = '2025-12-31'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 no permite cerrar antes del inicio'
);
SELECT lives_ok(
  $$UPDATE public.tarifa_importe SET fecha_vigencia_fin = '2026-06-01'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  'F14-19 permite cerrar una vez un intervalo abierto'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET fecha_vigencia_fin = '2026-07-01'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 no permite cambiar un fin ya cerrado'
);
SELECT throws_ok(
  $$UPDATE public.tarifa_importe SET fecha_vigencia_fin = NULL
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  '23514', NULL,
  'F14-19 no permite reabrir un intervalo cerrado'
);
SELECT lives_ok(
  $$UPDATE public.tarifa_importe SET updated_at = updated_at + interval '1 second'
    WHERE id = '21900000-aaaa-4aa1-8aa1-000000000500'$$,
  'F14-19 updated_at conserva su actualización de auditoría permitida'
);

-- Pointer promotion requires CONFIRMADO + non-null start and orders by effective date.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio
) VALUES
  ('21900000-aaaa-4aa1-8aa1-000000000600', '21900000-aaaa-4aa1-8aa1-000000000016', 600, '2026-12-01', NULL, NULL),
  ('21900000-aaaa-4aa1-8aa1-000000000601', '21900000-aaaa-4aa1-8aa1-000000000016', 601, '2026-12-02', 'REVISAR', NULL),
  ('21900000-aaaa-4aa1-8aa1-000000000602', '21900000-aaaa-4aa1-8aa1-000000000016', 602, '2026-12-03', 'CONFIRMADO', NULL);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '21900000-aaaa-4aa1-8aa1-000000000016'),
  NULL,
  'F14-19 legado, REVISAR y CONFIRMADO sin inicio no promocionan'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico,
  fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '21900000-aaaa-4aa1-8aa1-000000000603',
  '21900000-aaaa-4aa1-8aa1-000000000016',
  603, '2026-10-01', 'CONFIRMADO', '2026-06-01', '2026-09-01'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '21900000-aaaa-4aa1-8aa1-000000000016'),
  '21900000-aaaa-4aa1-8aa1-000000000603'::uuid,
  'F14-19 primer CONFIRMADO con inicio promociona'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico,
  fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '21900000-aaaa-4aa1-8aa1-000000000604',
  '21900000-aaaa-4aa1-8aa1-000000000016',
  604, '2026-01-01', 'CONFIRMADO', '2026-09-01', NULL
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '21900000-aaaa-4aa1-8aa1-000000000016'),
  '21900000-aaaa-4aa1-8aa1-000000000604'::uuid,
  'F14-19 inicio efectivo posterior promociona aunque fecha_aparicion sea anterior'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico
) VALUES (
  '21900000-aaaa-4aa1-8aa1-000000000605',
  '21900000-aaaa-4aa1-8aa1-000000000016',
  605, '2027-01-01', 'REVISAR'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '21900000-aaaa-4aa1-8aa1-000000000016'),
  '21900000-aaaa-4aa1-8aa1-000000000604'::uuid,
  'F14-19 REVISAR posterior nunca mueve un puntero vigente'
);

SELECT * FROM finish();
ROLLBACK;
