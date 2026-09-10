-- pgTAP: F14-18 Task 3 — batch prepare/detect refresh RPCs.
-- Fixture namespace 18180000-… (avoids F14-16 162/166 and F14-17 174).
-- Empty tables; synthetic Dock Sud-like fixtures only.
BEGIN;
SELECT plan(79);

CREATE FUNCTION pg_temp.rpc_jsonb(p_fn text, p_arg jsonb)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v jsonb;
BEGIN
  EXECUTE format('SELECT public.%I($1)', p_fn) INTO v USING p_arg;
  RETURN v;
EXCEPTION
  WHEN undefined_function THEN
    RETURN jsonb_build_object('_sqlstate', SQLSTATE);
END;
$$;

CREATE FUNCTION pg_temp.rpc_jsonb_any(p_fn text, p_arg jsonb)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v jsonb;
BEGIN
  EXECUTE format('SELECT public.%I($1)', p_fn) INTO v USING p_arg;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('_sqlstate', SQLSTATE, '_message', SQLERRM);
END;
$$;

CREATE FUNCTION pg_temp.fn_def(p_signature text)
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_get_functiondef(p_signature::regprocedure);
EXCEPTION
  WHEN undefined_function THEN
    RETURN NULL;
END;
$$;

CREATE FUNCTION pg_temp.codigo(p_id text, p_result jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT e->>'codigo'
  FROM jsonb_array_elements(p_result) e
  WHERE e->>'id' = p_id
  LIMIT 1;
$$;

CREATE FUNCTION pg_temp.elem(p_id text, p_result jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT e
  FROM jsonb_array_elements(p_result) e
  WHERE e->>'id' = p_id
  LIMIT 1;
$$;

CREATE FUNCTION pg_temp.matching_helper_ranks_ok()
RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    SELECT
      bool_or(c.same_category IS TRUE)
      AND bool_or(c.same_category IS FALSE)
      AND bool_or(c.dir_rank = 0)
      AND bool_or(c.current_rank = 0)
      AND bool_or(c.current_rank = 1)
      AND bool_or(c.validity_rank = 0)
      AND bool_or(c.diagnostico = 'CONFIRMADO')
      AND bool_or(c.error_relativo = 0)
    FROM public._peajes_tarifas_matching_candidatos(
      '18180000-aaaa-4aa1-8aa1-000000000012',
      3::smallint,
      'AMBAS',
      'PICO',
      DATE '2026-08-01',
      5300,
      NULL
    ) c
  );
EXCEPTION
  WHEN undefined_function THEN
    RETURN false;
END;
$$;

SELECT has_function(
  'public',
  'peajes_preparar_refresco_tarifas',
  ARRAY['jsonb'],
  'F14-18 peajes_preparar_refresco_tarifas(jsonb) existe'
);

SELECT has_function(
  'public',
  'peajes_detectar_refresco_tarifas',
  ARRAY['jsonb'],
  'F14-18 peajes_detectar_refresco_tarifas(jsonb) existe'
);

SELECT has_function(
  'public',
  '_peajes_tarifas_montos_candidatos',
  ARRAY['uuid', 'smallint', 'text', 'text'],
  'F14-18 helper privado de dirección/current/historial existe'
);

INSERT INTO public.peajes (id, nombre, empresa_id) VALUES
  ('18180000-aaaa-4aa1-8aa1-000000000001', 'AUBASA F14-18', 'test');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('18180000-aaaa-4aa1-8aa1-000000000010', '18180000-aaaa-4aa1-8aa1-000000000001', 'DOCK SUD'),
  ('18180000-aaaa-4aa1-8aa1-000000000011', '18180000-aaaa-4aa1-8aa1-000000000001', 'SENTIDO MIXTO'),
  ('18180000-aaaa-4aa1-8aa1-000000000012', '18180000-aaaa-4aa1-8aa1-000000000001', 'CORR 5300'),
  ('18180000-aaaa-4aa1-8aa1-000000000013', '18180000-aaaa-4aa1-8aa1-000000000001', 'AMB 5300'),
  ('18180000-aaaa-4aa1-8aa1-000000000014', '18180000-aaaa-4aa1-8aa1-000000000001', 'HIST 5300'),
  ('18180000-aaaa-4aa1-8aa1-000000000015', '18180000-aaaa-4aa1-8aa1-000000000001', 'REVISAR 5300'),
  ('18180000-aaaa-4aa1-8aa1-000000000016', '18180000-aaaa-4aa1-8aa1-000000000001', 'VIGENCIA CAT3');

-- Dock Sud cat 2 AMBAS: NO_PICO 11975.15 (hist 12000) / PICO 14968.96
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000050',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'NO_PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000051',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000150',
    '18180000-aaaa-4aa1-8aa1-000000000050',
    12000.00,
    timestamptz '2025-01-01 00:00:00+00',
    'CONFIRMADO', DATE '2025-01-01', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000151',
    '18180000-aaaa-4aa1-8aa1-000000000050',
    11975.15,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000161',
    '18180000-aaaa-4aa1-8aa1-000000000051',
    14968.96,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  );

-- Cat 5: current 14500, historical 12000 (historical-only match for 12010)
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES (
  '18180000-aaaa-4aa1-8aa1-000000000052',
  '18180000-aaaa-4aa1-8aa1-000000000001',
  '18180000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 5, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000170',
    '18180000-aaaa-4aa1-8aa1-000000000052',
    12000.00,
    timestamptz '2025-06-01 00:00:00+00',
    'CONFIRMADO', DATE '2025-06-01', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000171',
    '18180000-aaaa-4aa1-8aa1-000000000052',
    14500.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  );

-- Direction fixtures on SENTIDO MIXTO cat 1
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000060',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000011',
    'NO_PICO', 1, 'IDA', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000061',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000011',
    'NO_PICO', 1, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000062',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000011',
    'NO_PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000063',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000011',
    'NO_PICO', 3, 'IDA', false, timestamptz '2026-07-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000180',
    '18180000-aaaa-4aa1-8aa1-000000000060',
    1000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000181',
    '18180000-aaaa-4aa1-8aa1-000000000061',
    2000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000182',
    '18180000-aaaa-4aa1-8aa1-000000000062',
    3333.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000183',
    '18180000-aaaa-4aa1-8aa1-000000000063',
    4444.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  );

-- Ambiguous status-less: both PICO and NO_PICO share 10000
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000070',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'NO_PICO', 7, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000071',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'PICO', 7, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000190',
    '18180000-aaaa-4aa1-8aa1-000000000070',
    10000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000191',
    '18180000-aaaa-4aa1-8aa1-000000000071',
    10000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  );

-- IVA flag identity: current 100, flag true
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES (
  '18180000-aaaa-4aa1-8aa1-000000000080',
  '18180000-aaaa-4aa1-8aa1-000000000001',
  '18180000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 8, 'AMBAS', true, timestamptz '2026-07-01 00:00:00+00'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000200',
    '18180000-aaaa-4aa1-8aa1-000000000080',
    100.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01'
  );

-- F14-19 Task 3: dedicated identities for atomic confirmed/review saves.
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000090',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'NO_PICO', 10, 'AMBAS', false, timestamptz '2026-06-01 12:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000040',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000010',
    'NO_PICO', 0, 'AMBAS', false, timestamptz '2026-06-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, cases, fecha_aparicion, categoria_calculated,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000289',
    '18180000-aaaa-4aa1-8aa1-000000000090',
    3500.00,
    1,
    timestamptz '2026-01-01 00:00:00+00',
    10,
    'CONFIRMADO', DATE '2026-01-01', DATE '2026-06-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000290',
    '18180000-aaaa-4aa1-8aa1-000000000090',
    4000.00,
    2,
    timestamptz '2026-06-01 12:00:00+00',
    10,
    'CONFIRMADO', DATE '2026-06-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000240',
    '18180000-aaaa-4aa1-8aa1-000000000040',
    1111.00,
    0,
    timestamptz '2026-06-01 00:00:00+00',
    NULL,
    'CONFIRMADO', DATE '2026-06-01', NULL
  );

-- F14-19 Task 4: validity-aware matching and category correction fixtures.
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-0000000000a2',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000012',
    'PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000a3',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000012',
    'PICO', 3, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000b2',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000013',
    'PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000b3',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000013',
    'PICO', 3, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000c2',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000014',
    'PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000c3',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000014',
    'PICO', 3, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000d2',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000015',
    'PICO', 2, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000d3',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000015',
    'PICO', 3, 'AMBAS', false, timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000000e3',
    '18180000-aaaa-4aa1-8aa1-000000000001',
    '18180000-aaaa-4aa1-8aa1-000000000016',
    'PICO', 3, 'AMBAS', false, timestamptz '2026-08-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-0000000003a0',
    '18180000-aaaa-4aa1-8aa1-0000000000a2',
    5000.00,
    timestamptz '2026-01-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-01-01', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003a1',
    '18180000-aaaa-4aa1-8aa1-0000000000a2',
    5300.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003a2',
    '18180000-aaaa-4aa1-8aa1-0000000000a2',
    5300.00,
    timestamptz '2026-07-15 00:00:00+00',
    'REVISAR', NULL, NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003a3',
    '18180000-aaaa-4aa1-8aa1-0000000000a3',
    9000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003b2',
    '18180000-aaaa-4aa1-8aa1-0000000000b2',
    5300.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003b3',
    '18180000-aaaa-4aa1-8aa1-0000000000b3',
    5300.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003c0',
    '18180000-aaaa-4aa1-8aa1-0000000000c2',
    5300.00,
    timestamptz '2026-01-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-01-01', DATE '2026-07-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003c1',
    '18180000-aaaa-4aa1-8aa1-0000000000c2',
    7000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003c3',
    '18180000-aaaa-4aa1-8aa1-0000000000c3',
    9000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003d2',
    '18180000-aaaa-4aa1-8aa1-0000000000d2',
    5300.00,
    timestamptz '2026-07-01 00:00:00+00',
    'REVISAR', NULL, NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003d3',
    '18180000-aaaa-4aa1-8aa1-0000000000d3',
    9000.00,
    timestamptz '2026-07-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003e0',
    '18180000-aaaa-4aa1-8aa1-0000000000e3',
    5300.00,
    timestamptz '2026-01-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-01-01', DATE '2026-08-01'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-0000000003e1',
    '18180000-aaaa-4aa1-8aa1-0000000000e3',
    5300.00,
    timestamptz '2026-08-01 00:00:00+00',
    'CONFIRMADO', DATE '2026-08-01', NULL
  );

SELECT ok(
  (
    SELECT
      count(*) FILTER (WHERE e->>'status' = 'NO_PICO') = 1
      AND count(*) FILTER (WHERE e->>'status' = 'PICO') = 1
      AND bool_or((e->>'importe')::numeric = 11975.15)
      AND bool_or((e->>'importe')::numeric = 14968.96)
      AND bool_and(e->>'peaje_id' = '18180000-aaaa-4aa1-8aa1-000000000001')
    FROM jsonb_array_elements(
      pg_temp.rpc_jsonb(
        'peajes_preparar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'c-dock',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
            'categoria', 2,
            'status_solicitado', NULL,
            'sentido_solicitado', 'AMBAS'
          )
        )
      )
    ) e
  ),
  'F14-18 prepare devuelve PICO y NO_PICO vigentes de Dock Sud cat 2'
);

SELECT ok(
  pg_temp.fn_def('public.peajes_preparar_refresco_tarifas(jsonb)') IS NULL
  OR (
    pg_temp.fn_def('public.peajes_preparar_refresco_tarifas(jsonb)') NOT ILIKE '%/ 1.21%'
    AND pg_temp.fn_def('public.peajes_preparar_refresco_tarifas(jsonb)') NOT ILIKE '%/1.21%'
  ),
  'F14-18 prepare no reproduce IVA / 1.21'
);

SELECT is(
  pg_temp.codigo(
    'np',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'np',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect Dock Sud NO_PICO vigente 11975.15'
);

SELECT is(
  pg_temp.codigo(
    'pico',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'pico',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 14968.96,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect Dock Sud PICO vigente 14968.96'
);

SELECT is(
  pg_temp.codigo(
    'e023',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'e023',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 12002.69,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect diferencia 0.23% es CURRENT_TARIFF'
);

SELECT is(
  pg_temp.codigo(
    'e1',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'e1',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 12094.9015,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect exactamente 1% es CURRENT_TARIFF inclusivo'
);

SELECT is(
  pg_temp.codigo(
    'gt1',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'gt1',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 12500,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'NEW_TARIFF',
  'F14-18 detect > 1% vs vigente e historial es NEW_TARIFF'
);

SELECT is(
  pg_temp.codigo(
    'hist',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'hist',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 5,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 12010,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'HISTORICAL_TARIFF_MATCH',
  'F14-18 detect 12010 vs vigente 14500 / hist 12000 es HISTORICAL_TARIFF_MATCH'
);

SELECT ok(
  (
    SELECT jsonb_array_length(r) = 1 AND r -> 0 ->> 'id' = 'many'
    FROM pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'many',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-18 detect un candidato representa muchas filas: un solo resultado'
);

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'codigo' = 'CURRENT_TARIFF'
      AND r -> 0 ->> 'tarifa_id' = '18180000-aaaa-4aa1-8aa1-000000000060'
      AND r -> 0 ->> 'sentido_aplicado' = 'IDA'
    FROM pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ida',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000011',
          'categoria', 1,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'IDA',
          'precio_directo', 1000,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-18 detect prioriza sentido IDA exacto sobre AMBAS'
);

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'codigo' = 'CURRENT_TARIFF'
      AND r -> 0 ->> 'tarifa_id' = '18180000-aaaa-4aa1-8aa1-000000000062'
      AND r -> 0 ->> 'sentido_aplicado' = 'AMBAS'
    FROM pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'vuelta',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000011',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'VUELTA',
          'precio_directo', 3333,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-18 detect VUELTA cae a AMBAS si no hay VUELTA'
);

SELECT is(
  pg_temp.codigo(
    'ambas',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ambas',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000011',
          'categoria', 3,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 4444,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'NEW_TARIFF',
  'F14-18 detect AMBAS no elige IDA aunque el importe coincida'
);

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'codigo' = 'CURRENT_TARIFF'
      AND r -> 0 ->> 'status' = 'NO_PICO'
    FROM pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'unique',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', NULL,
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-18 detect sin status resuelve el único precio vigente coincidente'
);

SELECT is(
  pg_temp.codigo(
    'amb',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'amb',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 7,
          'status_solicitado', NULL,
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 10000,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'STATUS_AMBIGUOUS',
  'F14-18 detect sin status con dos contextos coincidentes es STATUS_AMBIGUOUS'
);

SELECT is(
  pg_temp.codigo(
    'need',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'need',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', NULL,
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 12500,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'STATUS_REQUIRED',
  'F14-18 detect sin status y sin match exige elección del usuario'
);

SELECT is(
  pg_temp.codigo(
    'ctx',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'ctx',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', NULL,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CONTEXT_INCOMPLETE',
  'F14-18 detect sin categoría es CONTEXT_INCOMPLETE'
);

SELECT is(
  pg_temp.codigo(
    'badst',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'badst',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000099',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CONTEXT_INCOMPLETE',
  'F14-18 detect estación inexistente es CONTEXT_INCOMPLETE'
);

SELECT is(
  pg_temp.codigo(
    'iva',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'iva',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 8,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 121,
          'precio_normalizado', 100
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect usa precio_normalizado solo si requiere_normalizacion_iva'
);

SELECT is(
  pg_temp.codigo(
    'noiva',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'noiva',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'categoria', 2,
          'status_solicitado', 'NO_PICO',
          'sentido_solicitado', 'AMBAS',
          'precio_directo', 11975.15,
          'precio_normalizado', 1
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-18 detect ignora precio_normalizado cuando el flag es false'
);

SELECT ok(
  (
    SELECT r -> 0 ->> 'tarifa_id' = '18180000-aaaa-4aa1-8aa1-000000000060'
    FROM pg_temp.rpc_jsonb(
      'peajes_resolver_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000011',
          'categoria', 1,
          'status', 'NO_PICO',
          'sentido', 'IDA'
        )
      )
    ) AS r
  ),
  'F14-18 F14-16 resolver sigue priorizando IDA exacto tras extraer helper'
);

SELECT ok(
  NOT COALESCE(
    (
      SELECT has_function_privilege(
        'anon',
        'public.peajes_preparar_refresco_tarifas(jsonb)',
        'EXECUTE'
      )
    ),
    false
  ),
  'F14-18 prepare REVOKE PUBLIC / anon sin EXECUTE'
);

SELECT ok(
  NOT COALESCE(
    (
      SELECT has_function_privilege(
        'anon',
        'public.peajes_detectar_refresco_tarifas(jsonb)',
        'EXECUTE'
      )
    ),
    false
  ),
  'F14-18 detect REVOKE PUBLIC / anon sin EXECUTE'
);

SELECT ok(
  (
    SELECT p.prosecdef IS FALSE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'peajes_preparar_refresco_tarifas'
  ),
  'F14-18 prepare es SECURITY INVOKER'
);

SELECT ok(
  (
    SELECT p.prosecdef IS FALSE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'peajes_detectar_refresco_tarifas'
  ),
  'F14-18 detect es SECURITY INVOKER'
);

SELECT throws_ok(
  $$SELECT public.peajes_detectar_refresco_tarifas('{"id":"x"}'::jsonb)$$,
  'P0001',
  'p_candidatos debe ser un arreglo JSON',
  'F14-18 detect rechaza JSON que no es arreglo'
);

SELECT ok(
  pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') IS NULL
  OR (
    pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') NOT ILIKE '%/ 1.21%'
    AND pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') NOT ILIKE '%/1.21%'
  ),
  'F14-18 detect no reproduce IVA / 1.21'
);

-- -----------------------------------------------------------------------------
-- Task 4: peajes_guardar_refresco_tarifas
-- -----------------------------------------------------------------------------
SELECT has_function(
  'public',
  'peajes_guardar_refresco_tarifas',
  ARRAY['jsonb'],
  'F14-18 peajes_guardar_refresco_tarifas(jsonb) existe'
);

CREATE TEMP TABLE pg_temp._g31 AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'g31-nopico',
      'action', 'CONFIRM_NEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 2,
      'status', 'NO_PICO',
      'importe', 12500,
      'fecha_vigencia_inicio', '2026-09-01',
      'requiere_normalizacion_iva', false
    ),
    jsonb_build_object(
      'candidate_id', 'g31-pico',
      'action', 'CONFIRM_NEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 2,
      'status', 'PICO',
      'importe', 15500,
      'fecha_vigencia_inicio', '2026-09-01',
      'requiere_normalizacion_iva', false
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      jsonb_array_length(r) = 2
      AND r -> 0 ->> 'accion' = 'ACTUALIZADA'
      AND r -> 1 ->> 'accion' = 'ACTUALIZADA'
      AND (r -> 0 ->> 'anterior')::numeric = 11975.15
      AND (r -> 0 ->> 'nueva')::numeric = 12500
      AND (r -> 1 ->> 'anterior')::numeric = 14968.96
      AND (r -> 1 ->> 'nueva')::numeric = 15500
      AND (SELECT importe FROM public.tarifa_importe WHERE id = '18180000-aaaa-4aa1-8aa1-000000000151') = 11975.15
      AND (SELECT importe FROM public.tarifa_importe WHERE id = '18180000-aaaa-4aa1-8aa1-000000000161') = 14968.96
      AND (
        SELECT t.current_tarifa_id
        FROM public.tarifas t
        WHERE t.id = '18180000-aaaa-4aa1-8aa1-000000000050'
      ) IS DISTINCT FROM '18180000-aaaa-4aa1-8aa1-000000000151'::uuid
    FROM pg_temp._g31
  ),
  'F14-18 guardar actualiza PICO y NO_PICO, preserva historial y avanza current'
);

CREATE TEMP TABLE pg_temp._g32 AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'g32-new',
      'action', 'CONFIRM_NEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 9,
      'status', 'NO_PICO',
      'importe', 900,
      'fecha_vigencia_inicio', '2026-09-01',
      'requiere_normalizacion_iva', true
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'accion' = 'IDENTIDAD_CREADA'
      AND r -> 0 ->> 'tarifa_id' IS NOT NULL
      AND (r -> 0 ->> 'anterior') IS NULL
      AND (r -> 0 ->> 'nueva')::numeric = 900
      AND EXISTS (
        SELECT 1
        FROM public.tarifas t
        WHERE t.estacion_id = '18180000-aaaa-4aa1-8aa1-000000000010'
          AND t.categoria = 9
          AND t.status = 'NO_PICO'
          AND t.requiere_normalizacion_iva IS TRUE
      )
    FROM pg_temp._g32
  ),
  'F14-18 guardar crea identidad faltante con IVA explícito'
);

SELECT is(
  (
    SELECT COALESCE(r -> 0 ->> 'accion', r ->> '_sqlstate')
    FROM pg_temp.rpc_jsonb_any(
      'peajes_guardar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'candidate_id', 'g33-same',
          'action', 'CONFIRM_NEW',
          'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'sentido', 'AMBAS',
          'categoria', 5,
          'status', 'NO_PICO',
          'importe', 14500,
          'fecha_vigencia_inicio', '2026-07-01',
          'requiere_normalizacion_iva', false
        )
      )
    ) AS r
  ),
  'SIN_CAMBIO',
  'F14-18 guardar importe exacto vigente con el mismo inicio es SIN_CAMBIO'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tarifa_importe
    WHERE tarifa_id = '18180000-aaaa-4aa1-8aa1-000000000052'
  ),
  2,
  'F14-18 SIN_CAMBIO no inserta otro tarifa_importe'
);

CREATE TEMP TABLE pg_temp._g19_same_amt AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'g33-later',
      'action', 'CONFIRM_NEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 5,
      'status', 'NO_PICO',
      'importe', 14500,
      'fecha_vigencia_inicio', '2026-09-01',
      'requiere_normalizacion_iva', false
    )
  )
) AS r;

SELECT is(
  (
    SELECT r -> 0 ->> 'accion'
    FROM pg_temp._g19_same_amt
  ),
  'ACTUALIZADA',
  'F14-19 CONFIRM_NEW mismo importe e inicio posterior no es SIN_CAMBIO'
);

SELECT ok(
  (
    SELECT
      (r -> 0 ->> 'anterior')::numeric = 14500
      AND (r -> 0 ->> 'nueva')::numeric = 14500
      AND (r -> 0 ->> 'anterior_fin')::date = DATE '2026-09-01'
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = '18180000-aaaa-4aa1-8aa1-000000000171') = DATE '2026-09-01'
      AND (SELECT t.current_tarifa_id FROM public.tarifas t
            WHERE t.id = '18180000-aaaa-4aa1-8aa1-000000000052')
        IS DISTINCT FROM '18180000-aaaa-4aa1-8aa1-000000000171'::uuid
      AND (SELECT diagnostico FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000052'
            )) = 'CONFIRMADO'
      AND (SELECT fecha_vigencia_inicio FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000052'
            )) = DATE '2026-09-01'
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000052'
            )) IS NULL
      AND (SELECT importe FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000052'
            )) = 14500
      AND (
        SELECT count(*)::integer
        FROM public.tarifa_importe
        WHERE tarifa_id = '18180000-aaaa-4aa1-8aa1-000000000052'
      ) = 3
      AND (SELECT fecha_actualizacion FROM public.tarifas
            WHERE id = '18180000-aaaa-4aa1-8aa1-000000000052')
          > timestamptz '2026-07-01 00:00:00+00'
    FROM pg_temp._g19_same_amt
  ),
  'F14-19 CONFIRM_NEW mismo importe e inicio posterior cierra e inserta CONFIRMADO abierto'
);

SELECT ok(
  (
    SELECT t.requiere_normalizacion_iva IS TRUE
    FROM pg_temp.rpc_jsonb(
      'peajes_guardar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'candidate_id', 'g34-iva',
          'action', 'CONFIRM_NEW',
          'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'sentido', 'AMBAS',
          'categoria', 8,
          'status', 'NO_PICO',
          'importe', 110,
          'fecha_vigencia_inicio', '2026-09-01',
          'requiere_normalizacion_iva', false
        )
      )
    ) AS r
    JOIN public.tarifas t ON t.id = '18180000-aaaa-4aa1-8aa1-000000000080'
    WHERE r -> 0 ->> 'accion' = 'ACTUALIZADA'
  ),
  'F14-18 guardar no cambia el flag IVA de una identidad existente'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'g35-dup-a',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 4,
        'status', 'NO_PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', true
      ),
      jsonb_build_object(
        'candidate_id', 'g35-dup-b',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 4,
        'status', 'NO_PICO',
        'importe', 2,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', true
      )
    )
  )$$,
  'P0001',
  'p_cambios contiene celdas duplicadas',
  'F14-18 guardar rechaza duplicados en el payload antes de escribir'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'g36-iva-missing',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 6,
        'status', 'PICO',
        'importe', 800,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', NULL
      )
    )
  )$$,
  'P0001',
  'requiere_normalizacion_iva es obligatorio para una identidad nueva',
  'F14-18 guardar exige IVA explícito al crear identidad'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'g37-station',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000009999',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 13000,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'la estacion no pertenece al peaje indicado',
  'F14-18 guardar rechaza peaje/estacion inconsistentes'
);

SELECT ok(
  (
    SELECT p.prosecdef IS FALSE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'peajes_guardar_refresco_tarifas'
  ),
  'F14-18 guardar es SECURITY INVOKER'
);

SELECT ok(
  NOT COALESCE(
    (
      SELECT has_function_privilege(
        'anon',
        'public.peajes_guardar_refresco_tarifas(jsonb)',
        'EXECUTE'
      )
    ),
    false
  ),
  'F14-18 guardar REVOKE PUBLIC / anon sin EXECUTE'
);

-- -----------------------------------------------------------------------------
-- F14-19 Task 3: atomic CONFIRM_NEW / MARK_REVIEW saves
-- -----------------------------------------------------------------------------
SELECT ok(
  pg_temp.fn_def('public.peajes_guardar_refresco_tarifas(jsonb)') ILIKE '%FOR UPDATE%'
  AND pg_temp.fn_def('public.peajes_guardar_refresco_tarifas(jsonb)')
    ~* 'ORDER BY[[:space:]]+t\.peaje_id,[[:space:]]*t\.estacion_id,[[:space:]]*t\.sentido,[[:space:]]*t\.categoria,[[:space:]]*t\.status',
  'F14-19 guardar lockea tarifas existentes en orden (peaje_id, estacion_id, sentido, categoria, status)'
);

CREATE TEMP TABLE pg_temp._g19_confirm AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'confirm-cat10',
      'action', 'CONFIRM_NEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'categoria', 10,
      'categoria_calculada', 10,
      'status', 'NO_PICO',
      'sentido', 'AMBAS',
      'importe', 5000,
      'fecha_vigencia_inicio', '2026-09-01',
      'cases', 4,
      'requiere_normalizacion_iva', false
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      (SELECT t.current_tarifa_id FROM public.tarifas t
        WHERE t.id = '18180000-aaaa-4aa1-8aa1-000000000090')
        IS DISTINCT FROM '18180000-aaaa-4aa1-8aa1-000000000290'::uuid
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = '18180000-aaaa-4aa1-8aa1-000000000290') = DATE '2026-09-01'
      AND (SELECT diagnostico FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
            )) = 'CONFIRMADO'
      AND (SELECT fecha_vigencia_inicio FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
            )) = DATE '2026-09-01'
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = (
              SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
            )) IS NULL
      AND (SELECT fecha_actualizacion FROM public.tarifas
            WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090')
          > timestamptz '2026-06-01 12:00:00+00'
    FROM pg_temp._g19_confirm
  ),
  'F14-19 CONFIRM_NEW cierra el vigente, inserta CONFIRMADO abierto, mueve el puntero y actualiza fecha_actualizacion'
);

SELECT ok(
  (
    SELECT importe = 4000.00
       AND cases = 2
       AND categoria_calculated = 10
       AND fecha_aparicion = timestamptz '2026-06-01 12:00:00+00'
       AND tarifas_normalizadas_id IS NULL
    FROM public.tarifa_importe
    WHERE id = '18180000-aaaa-4aa1-8aa1-000000000290'
  ),
  'F14-19 al cerrar el vigente no muta importe, categoria_calculated, fecha_aparicion, linaje ni cases'
);

SELECT ok(
  (
    SELECT (SELECT fecha_vigencia_inicio FROM public.tarifa_importe
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000290') = DATE '2026-06-01'
       AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000290') = DATE '2026-09-01'
       AND (SELECT fecha_vigencia_inicio FROM public.tarifa_importe
              WHERE id = (
                SELECT current_tarifa_id FROM public.tarifas
                WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
              )) = DATE '2026-09-01'
       AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
              WHERE id = (
                SELECT current_tarifa_id FROM public.tarifas
                WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
              )) IS NULL
  ),
  'F14-19 [2026-06-01, 2026-09-01) seguido de [2026-09-01, infinity) se acepta'
);

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'accion' = 'ACTUALIZADA'
      AND (r -> 0 ->> 'anterior')::numeric = 4000
      AND (r -> 0 ->> 'nueva')::numeric = 5000
      AND (r -> 0 ->> 'anterior_fin')::date = DATE '2026-09-01'
      AND (r -> 0 ->> 'fecha_vigencia_inicio')::date = DATE '2026-09-01'
      AND (r -> 0 ->> 'fecha_vigencia_fin') IS NULL
      AND r -> 0 ->> 'diagnostico' = 'CONFIRMADO'
      AND (r -> 0 ->> 'categoria_calculada')::int = 10
      AND r -> 0 ->> 'tarifa_importe_id' IS NOT NULL
      AND r -> 0 ->> 'candidate_id' = 'confirm-cat10'
    FROM pg_temp._g19_confirm
  ),
  'F14-19 CONFIRM_NEW conserva el orden de entrada y devuelve anterior, fin previo, vigencia, diagnostico, categoria calculada e id nuevo'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'before-start',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 0,
        'status', 'NO_PICO',
        'importe', 2222,
        'fecha_vigencia_inicio', '2026-05-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'la vigencia nueva se superpone o inicia antes del vigente',
  'F14-19 CONFIRM_NEW rechaza un inicio anterior al vigente'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'batch-ok',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 0,
        'status', 'NO_PICO',
        'importe', 2222,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      ),
      jsonb_build_object(
        'candidate_id', 'inside-hist',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 10,
        'status', 'NO_PICO',
        'importe', 6000,
        'fecha_vigencia_inicio', '2026-03-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'la vigencia nueva se superpone o inicia antes del vigente',
  'F14-19 un inicio dentro de un intervalo conocido rechaza el lote entero'
);

SELECT ok(
  (
    SELECT (SELECT current_tarifa_id FROM public.tarifas
              WHERE id = '18180000-aaaa-4aa1-8aa1-000000000040')
             = '18180000-aaaa-4aa1-8aa1-000000000240'::uuid
       AND (SELECT importe FROM public.tarifa_importe
              WHERE id = (
                SELECT current_tarifa_id FROM public.tarifas
                WHERE id = '18180000-aaaa-4aa1-8aa1-000000000090'
              )) = 5000
       AND (SELECT count(*) FROM public.tarifa_importe
              WHERE tarifa_id = '18180000-aaaa-4aa1-8aa1-000000000040') = 1
  ),
  'F14-19 el rechazo por vigencia no deja escrituras parciales en el lote'
);

CREATE TEMP TABLE pg_temp._g19_review AS
SELECT public.peajes_guardar_refresco_tarifas(
  jsonb_build_array(
    jsonb_build_object(
      'candidate_id', 'review-cat7',
      'action', 'MARK_REVIEW',
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 7,
      'status', 'NO_PICO',
      'importe', 11111,
      'cases', 3,
      'requiere_normalizacion_iva', false
    )
  )
) AS r;

SELECT ok(
  (
    SELECT
      (SELECT current_tarifa_id FROM public.tarifas
        WHERE id = '18180000-aaaa-4aa1-8aa1-000000000070')
        = '18180000-aaaa-4aa1-8aa1-000000000190'::uuid
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = '18180000-aaaa-4aa1-8aa1-000000000190') IS NULL
      AND (SELECT diagnostico FROM public.tarifa_importe
            WHERE id = (r -> 0 ->> 'tarifa_importe_id')::uuid) = 'REVISAR'
      AND (SELECT fecha_vigencia_inicio FROM public.tarifa_importe
            WHERE id = (r -> 0 ->> 'tarifa_importe_id')::uuid) IS NULL
      AND (SELECT fecha_vigencia_fin FROM public.tarifa_importe
            WHERE id = (r -> 0 ->> 'tarifa_importe_id')::uuid) IS NULL
      AND r -> 0 ->> 'diagnostico' = 'REVISAR'
    FROM pg_temp._g19_review
  ),
  'F14-19 MARK_REVIEW inserta REVISAR sin vigencia, no cierra el vigente y no mueve el puntero'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'bad-action',
        'action', 'IGNORE',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'accion invalida: IGNORE',
  'F14-19 guardar rechaza una accion no permitida'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'bad-status',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'PENDIENTE',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'status invalido: PENDIENTE',
  'F14-19 guardar rechaza un status no permitido'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'bad-sentido',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'DESCONOCIDO',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'sentido invalido: DESCONOCIDO',
  'F14-19 guardar rechaza un sentido no permitido'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'bad-importe',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 0,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'importe debe ser > 0',
  'F14-19 guardar rechaza un importe no positivo'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'bad-cat',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 11,
        'status', 'NO_PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'categoria invalida: 11',
  'F14-19 guardar rechaza categoria fuera de 0-10'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'missing-start',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 1,
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'fecha_vigencia_inicio es obligatorio para CONFIRM_NEW',
  'F14-19 CONFIRM_NEW exige fecha_vigencia_inicio'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'review-with-start',
        'action', 'MARK_REVIEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 7,
        'status', 'PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-09-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'fecha_vigencia_inicio no aplica a MARK_REVIEW',
  'F14-19 MARK_REVIEW prohibe fecha_vigencia_inicio'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_refresco_tarifas(
    jsonb_build_array(
      jsonb_build_object(
        'candidate_id', 'dup-cand',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 1,
        'fecha_vigencia_inicio', '2026-10-01',
        'requiere_normalizacion_iva', false
      ),
      jsonb_build_object(
        'candidate_id', 'dup-cand',
        'action', 'CONFIRM_NEW',
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'PICO',
        'importe', 2,
        'fecha_vigencia_inicio', '2026-10-01',
        'requiere_normalizacion_iva', false
      )
    )
  )$$,
  'P0001',
  'p_cambios contiene candidatos duplicados',
  'F14-19 guardar rechaza candidate_id duplicados antes de escribir'
);

SELECT ok(
  COALESCE(
    has_function_privilege(
      'authenticated',
      'public.peajes_guardar_refresco_tarifas(jsonb)',
      'EXECUTE'
    ),
    false
  ),
  'F14-19 guardar_refresco EXECUTE queda en authenticated'
);

SELECT ok(
  COALESCE(
    has_function_privilege(
      'service_role',
      'public.peajes_guardar_refresco_tarifas(jsonb)',
      'EXECUTE'
    ),
    false
  ),
  'F14-19 guardar_refresco EXECUTE queda en service_role'
);

SELECT has_function(
  'public',
  'peajes_auditar_tarifas_direccion_colisiones',
  ARRAY[]::text[],
  'directional collision audit is read-only and callable'
);

SELECT is(
  pg_temp.codigo('missing-direction', public.peajes_detectar_refresco_tarifas(jsonb_build_array(
    jsonb_build_object(
      'id', 'missing-direction',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'categoria', 2,
      'status_solicitado', 'NO_PICO',
      'precio_directo', 11975.15
    )
  ))),
  'DIRECTION_REQUIRED',
  'directionless refresh candidates fail closed instead of becoming AMBAS'
);

SELECT ok(
  to_regclass('public.estaciones_vias_sentido') IS NOT NULL,
  'station/lane direction catalogue exists'
);

SELECT throws_ok(
  $$INSERT INTO public.estaciones_vias_sentido
    (empresa_id, estacion_id, codigo_estacion, via, sentido)
    VALUES ('test', '18180000-aaaa-4aa1-8aa1-000000000010', '0004', '01M', 'AMBAS')$$,
  '23514',
  NULL,
  'station/lane catalogue rejects inferred AMBAS'
);

SELECT has_function(
  'public',
  '_peajes_tarifas_matching_candidatos',
  ARRAY['uuid', 'smallint', 'text', 'text', 'date', 'numeric', 'numeric'],
  'F14-19 matching helper returns current and historical rows across categories'
);

SELECT ok(
  pg_temp.matching_helper_ranks_ok(),
  'F14-19 matching helper keeps same_category, ranks, diagnostic and relative error'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'CURRENT_CATEGORY_CORRECTION'
      AND (e->>'categoria_proveedor')::int = 3
      AND (e->>'categoria')::int = 3
      AND (e->>'categoria_calculada')::int = 2
      AND e->>'status' = 'PICO'
      AND e->>'tarifa_id' = '18180000-aaaa-4aa1-8aa1-0000000000a2'
      AND (e->>'importe_actual')::numeric = 5300
    FROM pg_temp.elem(
      'corr-5300',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'corr-5300',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000012',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-08-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 detect 5300 matches only Category 2 PICO when provider category is 3'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'AMBIGUOUS_TARIFF_MATCH'
      AND (e->>'categoria_proveedor')::int = 3
      AND e->>'categoria_calculada' IS NULL
      AND jsonb_array_length(e->'possible_matches') >= 2
      AND (
        SELECT count(DISTINCT m->>'categoria')
        FROM jsonb_array_elements(e->'possible_matches') m
        WHERE (m->>'categoria')::int IN (2, 3)
          AND m->>'status' = 'PICO'
          AND (m->>'importe')::numeric = 5300
      ) = 2
      AND e->>'tarifa_id' IS NULL
    FROM pg_temp.elem(
      'amb-5300',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'amb-5300',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000013',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-08-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 detect same 5300 in Categories 2 and 3 remains AMBIGUOUS_TARIFF_MATCH'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'HISTORICAL_CATEGORY_CORRECTION'
      AND e->>'codigo' <> 'NEW_TARIFF'
      AND (e->>'categoria_proveedor')::int = 3
      AND (e->>'categoria_calculada')::int = 2
      AND e->>'tarifa_id' = '18180000-aaaa-4aa1-8aa1-0000000000c2'
      AND (e->>'importe_actual')::numeric = 5300
      AND (e->>'fecha_vigencia_inicio')::date = DATE '2026-01-01'
    FROM pg_temp.elem(
      'hist-5300',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'hist-5300',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000014',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-03-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 detect historical Category 2 5300 never returns NEW_TARIFF'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'CURRENT_CATEGORY_CORRECTION'
      AND (
        SELECT bool_or(m->>'diagnostico' = 'REVISAR')
        FROM jsonb_array_elements(COALESCE(e->'possible_matches', '[]'::jsonb)) m
      )
      AND e->>'tarifa_importe_id' = '18180000-aaaa-4aa1-8aa1-0000000003a1'
    FROM pg_temp.elem(
      'corr-revisar',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'corr-revisar',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000012',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-08-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 REVISAR is excluded from the safe match but listed in possible_matches'
);

SELECT is(
  pg_temp.codigo(
    'rev-only',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'rev-only',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000015',
          'categoria_proveedor', 3,
          'status_solicitado', 'PICO',
          'sentido_solicitado', 'AMBAS',
          'fecha_pasada', '2026-08-01',
          'precio_directo', 5300,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'NEW_TARIFF',
  'F14-19 REVISAR-only 5300 is unresolved/new, never a safe current match'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'NEW_TARIFF'
      AND (
        SELECT bool_or(m->>'diagnostico' = 'REVISAR' AND (m->>'importe')::numeric = 5300)
        FROM jsonb_array_elements(COALESCE(e->'possible_matches', '[]'::jsonb)) m
      )
    FROM pg_temp.elem(
      'rev-only',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'rev-only',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000015',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-08-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 unresolved REVISAR evidence still appears in possible_matches'
);

SELECT is(
  pg_temp.codigo(
    'val-hist',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'val-hist',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000016',
          'categoria_proveedor', 3,
          'status_solicitado', 'PICO',
          'sentido_solicitado', 'AMBAS',
          'fecha_pasada', '2026-03-01',
          'precio_directo', 5300,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'HISTORICAL_TARIFF_MATCH',
  'F14-19 known interval that does not cover fecha_pasada is not a current match'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'HISTORICAL_TARIFF_MATCH'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(e->'possible_matches', '[]'::jsonb)) m
        WHERE m->>'tarifa_importe_id' = '18180000-aaaa-4aa1-8aa1-0000000003e1'
           OR (
             m->>'es_actual' IN ('true', 't')
             AND (m->>'importe')::numeric = 5300
             AND (m->>'fecha_vigencia_inicio')::date = DATE '2026-08-01'
           )
      )
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(e->'possible_matches', '[]'::jsonb)) m
        WHERE m->>'tarifa_importe_id' = '18180000-aaaa-4aa1-8aa1-0000000003e0'
      )
    FROM pg_temp.elem(
      'val-hist',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'val-hist',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000016',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-03-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 val-hist possible_matches excludes the non-covering current 5300 pointer'
);

SELECT is(
  pg_temp.codigo(
    'val-cur',
    pg_temp.rpc_jsonb(
      'peajes_detectar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'val-cur',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000016',
          'categoria_proveedor', 3,
          'status_solicitado', 'PICO',
          'sentido_solicitado', 'AMBAS',
          'fecha_pasada', '2026-09-01',
          'precio_directo', 5300,
          'precio_normalizado', NULL
        )
      )
    )
  ),
  'CURRENT_TARIFF',
  'F14-19 covering current interval is CURRENT_TARIFF after original-category current stage'
);

SELECT ok(
  (
    SELECT
      e->>'codigo' = 'AMBIGUOUS_TARIFF_MATCH'
      AND (
        SELECT min((m->>'error_relativo')::numeric) = 0
          AND max((m->>'error_relativo')::numeric) = 0
          AND count(*) FILTER (WHERE m->>'es_actual' IN ('true', 't')) >= 2
        FROM jsonb_array_elements(e->'possible_matches') m
        WHERE m->>'diagnostico' IS DISTINCT FROM 'REVISAR'
      )
    FROM pg_temp.elem(
      'amb-5300-err',
      pg_temp.rpc_jsonb(
        'peajes_detectar_refresco_tarifas',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'amb-5300-err',
            'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000013',
            'categoria_proveedor', 3,
            'status_solicitado', 'PICO',
            'sentido_solicitado', 'AMBAS',
            'fecha_pasada', '2026-08-01',
            'precio_directo', 5300,
            'precio_normalizado', NULL
          )
        )
      )
    ) e
  ),
  'F14-19 ambiguous matches are not collapsed by lowest error or amount order'
);

SELECT ok(
  pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') IS NULL
  OR (
    pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') NOT ILIKE '%/ 1.21%'
    AND pg_temp.fn_def('public.peajes_detectar_refresco_tarifas(jsonb)') NOT ILIKE '%/1.21%'
  ),
  'F14-19 detect still does not reproduce IVA / 1.21'
);

SELECT is(
  pg_temp.codigo(
    'conflict-direction',
    public.peajes_detectar_refresco_tarifas(jsonb_build_array(
      jsonb_build_object(
        'id', 'conflict-direction',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000012',
        'categoria_proveedor', 3,
        'status_solicitado', 'PICO',
        'unresolvedReason', 'CONFLICT',
        'precio_directo', 5300
      )
    ))
  ),
  'DIRECTION_CONFLICT',
  'F14-19 conflicting direction never becomes AMBAS at the RPC boundary'
);

SELECT * FROM finish();
ROLLBACK;
