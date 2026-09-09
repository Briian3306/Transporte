-- pgTAP F16-1 auditoría de estaciones
BEGIN;
SELECT plan(12);

SELECT has_function(
  'public',
  'peajes_listar_auditoria_estaciones',
  ARRAY['jsonb', 'integer', 'integer', 'text'],
  'RPC peajes_listar_auditoria_estaciones existe'
);

SELECT is(
  (
    SELECT prosecdef FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'peajes_listar_auditoria_estaciones'
      AND pg_get_function_identity_arguments(p.oid) = 'p_filtros jsonb, p_page integer, p_page_size integer, p_sort text'
  ),
  false,
  'listar es SECURITY INVOKER'
);

SELECT is(
  public.peajes_normalizar_codigo_estacion('0001'),
  '1',
  '0001 se normaliza a 1'
);

SELECT is(
  public.peajes_normalizar_codigo_estacion('0003'),
  '3',
  '0003 se normaliza a 3'
);

-- Fixtures: peaje con 1,2,3,5 (hueco 4) y peaje aislado 3,5
INSERT INTO public.empresas (id, nombre)
VALUES ('11111111-1111-4111-8111-111111111111', 'CLI Auditoría estaciones')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.peajes (id, nombre, empresa_id)
VALUES
  ('22222222-2222-4222-8222-222222222222', 'Peaje secuencia F16', '11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333', 'Peaje aislado F16', '11111111-1111-4111-8111-111111111111');

INSERT INTO public.estaciones (id, peaje_id, nombre, codigos_proveedor)
VALUES
  ('67486ca3-6e88-49a8-b628-7f41e946da5a', '22222222-2222-4222-8222-222222222222', 'E1', ARRAY['1']),
  ('60014adb-62f4-4ad9-86a0-50bd36efd1e3', '22222222-2222-4222-8222-222222222222', 'E2', ARRAY['2']),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'E3', ARRAY['3']),
  ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'E5', ARRAY['5']),
  ('66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333', 'A3', ARRAY['3']),
  ('77777777-7777-4777-8777-777777777777', '33333333-3333-4333-8333-333333333333', 'A5', ARRAY['5']);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.peajes_listar_auditoria_estaciones(
        jsonb_build_object('peaje_ids', jsonb_build_array('22222222-2222-4222-8222-222222222222')),
        1, 50, 'estacion_nombre:asc'
      )->'rows'
    ) r
    WHERE (r->>'hallazgos')::jsonb ? 'SECUENCIA_NUMERICA_CON_SALTO'
      AND (r->'secuencia_esperada'->'faltantes') @> '4'::jsonb
  ),
  'secuencia 1,2,3,5 marca hueco 4'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.peajes_listar_auditoria_estaciones(
        jsonb_build_object('peaje_ids', jsonb_build_array('33333333-3333-4333-8333-333333333333')),
        1, 50, 'estacion_nombre:asc'
      )->'rows'
    ) r
    WHERE (r->>'hallazgos')::jsonb ? 'SECUENCIA_NUMERICA_CON_SALTO'
  ),
  '3 y 5 aislados no generan hallazgo de secuencia'
);

SELECT lives_ok(
  $$SELECT public.peajes_transicionar_caso_estacion(
    public.peajes_fingerprint_caso_estacion(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'SECUENCIA_NUMERICA_CON_SALTO',
      ARRAY['1','2','3','5']
    ),
    'VALIDADO',
    'ok',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '67486ca3-6e88-49a8-b628-7f41e946da5a',
    'SECUENCIA_NUMERICA_CON_SALTO'
  )$$,
  'transición a VALIDADO'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM jsonb_array_elements(
      public.peajes_listar_auditoria_estaciones(
        jsonb_build_object(
          'peaje_ids', jsonb_build_array('22222222-2222-4222-8222-222222222222'),
          'estados', jsonb_build_array('PENDIENTE')
        ),
        1, 50, 'estacion_nombre:asc'
      )->'rows'
    ) r
  ),
  0,
  'caso validado no vuelve a Pendientes'
);

UPDATE public.estaciones
SET codigos_proveedor = ARRAY['1']
WHERE id = '55555555-5555-4555-8555-555555555555';
UPDATE public.estaciones
SET codigos_proveedor = ARRAY['6']
WHERE id = '55555555-5555-4555-8555-555555555555';

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.peajes_listar_auditoria_estaciones(
        jsonb_build_object(
          'peaje_ids', jsonb_build_array('22222222-2222-4222-8222-222222222222'),
          'estados', jsonb_build_array('PENDIENTE')
        ),
        1, 50, 'estacion_nombre:asc'
      )->'rows'
    ) r
    WHERE r->>'estado' = 'PENDIENTE'
  ),
  'cambio de códigos crea caso pendiente nuevo'
);

SELECT throws_ok(
  $$SELECT public.peajes_corregir_caso_estacion(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '60014adb-62f4-4ad9-86a0-50bd36efd1e3',
    'SOLO_FUTUROS',
    NULL,
    'no'
  )$$,
  'P0001',
  'se requiere previsualización y confirmación',
  'corrección sin preview se rechaza'
);

SELECT has_function(
  'public',
  'peajes_previsualizar_correccion_estacion',
  ARRAY['uuid', 'uuid'],
  'RPC preview existe'
);

SELECT has_function(
  'public',
  'peajes_corregir_caso_estacion',
  ARRAY['uuid', 'uuid', 'text', 'text', 'text'],
  'RPC corrección existe'
);

SELECT * FROM finish();
ROLLBACK;
