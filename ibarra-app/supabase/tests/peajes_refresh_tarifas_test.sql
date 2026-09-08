-- pgTAP: F14-18 Task 3 — batch prepare/detect refresh RPCs.
-- Fixture namespace 18180000-… (avoids F14-16 162/166 and F14-17 174).
-- Empty tables; synthetic Dock Sud-like fixtures only.
BEGIN;
SELECT plan(44);

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
  ('18180000-aaaa-4aa1-8aa1-000000000011', '18180000-aaaa-4aa1-8aa1-000000000001', 'SENTIDO MIXTO');

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

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000150',
    '18180000-aaaa-4aa1-8aa1-000000000050',
    12000.00,
    timestamptz '2025-01-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000151',
    '18180000-aaaa-4aa1-8aa1-000000000050',
    11975.15,
    timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000161',
    '18180000-aaaa-4aa1-8aa1-000000000051',
    14968.96,
    timestamptz '2026-07-01 00:00:00+00'
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

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000170',
    '18180000-aaaa-4aa1-8aa1-000000000052',
    12000.00,
    timestamptz '2025-06-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000171',
    '18180000-aaaa-4aa1-8aa1-000000000052',
    14500.00,
    timestamptz '2026-07-01 00:00:00+00'
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

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000180',
    '18180000-aaaa-4aa1-8aa1-000000000060',
    1000.00,
    timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000181',
    '18180000-aaaa-4aa1-8aa1-000000000061',
    2000.00,
    timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000182',
    '18180000-aaaa-4aa1-8aa1-000000000062',
    3333.00,
    timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000183',
    '18180000-aaaa-4aa1-8aa1-000000000063',
    4444.00,
    timestamptz '2026-07-01 00:00:00+00'
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

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000190',
    '18180000-aaaa-4aa1-8aa1-000000000070',
    10000.00,
    timestamptz '2026-07-01 00:00:00+00'
  ),
  (
    '18180000-aaaa-4aa1-8aa1-000000000191',
    '18180000-aaaa-4aa1-8aa1-000000000071',
    10000.00,
    timestamptz '2026-07-01 00:00:00+00'
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

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '18180000-aaaa-4aa1-8aa1-000000000200',
    '18180000-aaaa-4aa1-8aa1-000000000080',
    100.00,
    timestamptz '2026-07-01 00:00:00+00'
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
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 2,
      'status', 'NO_PICO',
      'importe', 12500,
      'requiere_normalizacion_iva', false
    ),
    jsonb_build_object(
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 2,
      'status', 'PICO',
      'importe', 15500,
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
      'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
      'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
      'sentido', 'AMBAS',
      'categoria', 9,
      'status', 'NO_PICO',
      'importe', 900,
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
    SELECT r -> 0 ->> 'accion'
    FROM pg_temp.rpc_jsonb(
      'peajes_guardar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'sentido', 'AMBAS',
          'categoria', 5,
          'status', 'NO_PICO',
          'importe', 14500,
          'requiere_normalizacion_iva', false
        )
      )
    ) AS r
  ),
  'SIN_CAMBIO',
  'F14-18 guardar importe exacto vigente es SIN_CAMBIO'
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

SELECT ok(
  (
    SELECT t.requiere_normalizacion_iva IS TRUE
    FROM pg_temp.rpc_jsonb(
      'peajes_guardar_refresco_tarifas',
      jsonb_build_array(
        jsonb_build_object(
          'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
          'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
          'sentido', 'AMBAS',
          'categoria', 8,
          'status', 'NO_PICO',
          'importe', 110,
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
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 4,
        'status', 'NO_PICO',
        'importe', 1,
        'requiere_normalizacion_iva', true
      ),
      jsonb_build_object(
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 4,
        'status', 'NO_PICO',
        'importe', 2,
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
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000000001',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 6,
        'status', 'PICO',
        'importe', 800,
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
        'peaje_id', '18180000-aaaa-4aa1-8aa1-000000009999',
        'estacion_id', '18180000-aaaa-4aa1-8aa1-000000000010',
        'sentido', 'AMBAS',
        'categoria', 2,
        'status', 'NO_PICO',
        'importe', 13000,
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

SELECT * FROM finish();
ROLLBACK;
