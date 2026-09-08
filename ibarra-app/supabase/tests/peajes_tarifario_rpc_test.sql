-- pgTAP: F14-17 Tarifario RPCs (list current / editor / save / history)
-- Fixture namespace 17400000-… so this file does not collide with F14-16 (16200000-…).
BEGIN;
SELECT plan(15);

SELECT has_function(
  'public',
  'peajes_listar_tarifas_actuales',
  ARRAY['jsonb', 'integer', 'integer', 'text'],
  'F14-17 peajes_listar_tarifas_actuales(jsonb,int,int,text)'
);
SELECT has_function(
  'public',
  'peajes_obtener_tarifario_editor',
  ARRAY['uuid', 'uuid', 'text'],
  'F14-17 peajes_obtener_tarifario_editor(uuid,uuid,text)'
);
SELECT has_function(
  'public',
  'peajes_guardar_tarifas_actuales',
  ARRAY['uuid', 'uuid', 'text', 'jsonb'],
  'F14-17 peajes_guardar_tarifas_actuales(uuid,uuid,text,jsonb)'
);
SELECT has_function(
  'public',
  'peajes_listar_tarifa_historial',
  ARRAY['uuid'],
  'F14-17 peajes_listar_tarifa_historial(uuid)'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000001', 'AUBASA F14-17');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000010', '17400000-aaaa-4aa1-8aa1-000000000001', 'HUDSON'),
  ('17400000-aaaa-4aa1-8aa1-000000000011', '17400000-aaaa-4aa1-8aa1-000000000001', 'VACIA');

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  fecha_actualizacion
) VALUES (
  '17400000-aaaa-4aa1-8aa1-000000000050',
  '17400000-aaaa-4aa1-8aa1-000000000001',
  '17400000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'IDA',
  '2026-03-10T00:00:00Z'
);

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '17400000-aaaa-4aa1-8aa1-000000000099',
    '17400000-aaaa-4aa1-8aa1-000000000050',
    5000,
    '2025-08-21T00:00:00Z'
  );

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '17400000-aaaa-4aa1-8aa1-000000000100',
    '17400000-aaaa-4aa1-8aa1-000000000050',
    5500,
    '2026-03-10T00:00:00Z'
  );

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  fecha_actualizacion
) VALUES (
  '17400000-aaaa-4aa1-8aa1-000000000051',
  '17400000-aaaa-4aa1-8aa1-000000000001',
  '17400000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'VUELTA',
  '2026-03-10T00:00:00Z'
);

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  (
    '17400000-aaaa-4aa1-8aa1-000000000110',
    '17400000-aaaa-4aa1-8aa1-000000000051',
    5700,
    '2026-03-10T00:00:00Z'
  );

SELECT ok(
  (
    SELECT (r -> 0 ->> 'importe')::numeric = 5500
       AND (r -> 0 ->> 'current_tarifa_importe_id')
           = '17400000-aaaa-4aa1-8aa1-000000000100'
    FROM (
      SELECT public.peajes_listar_tarifas_actuales(
        jsonb_build_object(
          'estacion_ids', jsonb_build_array('17400000-aaaa-4aa1-8aa1-000000000010'),
          'sentidos', jsonb_build_array('IDA'),
          'categorias', jsonb_build_array(1),
          'status', jsonb_build_array('NO_PICO')
        ),
        1, 50, 'categoria:asc'
      ) -> 'rows' AS r
    ) s
  ),
  'F14-17 listar solo importe current IDA 5500'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM jsonb_array_elements(
      public.peajes_obtener_tarifario_editor(
        '17400000-aaaa-4aa1-8aa1-000000000001',
        '17400000-aaaa-4aa1-8aa1-000000000010',
        'IDA'
      ) -> 'existentes'
    ) e
    WHERE (e ->> 'importe')::numeric = 5700
  ),
  0,
  'F14-17 editor IDA no incluye VUELTA 5700'
);

SELECT is(
  (
    SELECT jsonb_array_length(
      public.peajes_obtener_tarifario_editor(
        '17400000-aaaa-4aa1-8aa1-000000000001',
        '17400000-aaaa-4aa1-8aa1-000000000011',
        'IDA'
      ) -> 'existentes'
    )
  ),
  0,
  'F14-17 editor vacio es exito con existentes []'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000010',
      'IDA',
      '[{"categoria":1,"status":"NO_PICO","importe":5800}]'::jsonb
    )$$,
  'F14-17 guardar append 5800'
);

SELECT ok(
  (
    SELECT importe = 5000
    FROM public.tarifa_importe
    WHERE id = '17400000-aaaa-4aa1-8aa1-000000000099'
  ),
  'F14-17 historial TI-099 intacto'
);

SELECT ok(
  (
    SELECT importe = 5500
    FROM public.tarifa_importe
    WHERE id = '17400000-aaaa-4aa1-8aa1-000000000100'
  ),
  'F14-17 historial TI-100 intacto'
);

SELECT ok(
  (
    SELECT ti.importe = 5800
    FROM public.tarifas t
    JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id
    WHERE t.id = '17400000-aaaa-4aa1-8aa1-000000000050'
  ),
  'F14-17 current apunta a 5800'
);

SELECT ok(
  (
    SELECT bool_or((h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5800)
       AND bool_or(NOT (h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5500)
       AND bool_or(NOT (h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5000)
    FROM jsonb_array_elements(
      public.peajes_listar_tarifa_historial(
        '17400000-aaaa-4aa1-8aa1-000000000050'
      )
    ) h
  ),
  'F14-17 historial marca vigente 5800 y conserva 5500/5000'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000010',
      'IDA',
      '[{"categoria":1,"status":"NO_PICO","importe":0}]'::jsonb
    )$$,
  '23514',
  'importe debe ser > 0 (F14-16 tarifa_importe_importe_chk)',
  'F14-17 rechaza importe 0'
);

SELECT is(
  (
    SELECT (public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000011',
      'IDA',
      '[{"categoria":4,"status":"PICO","importe":9500}]'::jsonb
    ) ->> 'actualizadas')::int
  ),
  1,
  'F14-17 guardar crea identidad faltante'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.tarifas
    WHERE estacion_id = '17400000-aaaa-4aa1-8aa1-000000000011'
      AND categoria = 4 AND status = 'PICO' AND sentido = 'IDA'
  ),
  1,
  'F14-17 VACIA gana una fila tarifas'
);

SELECT finish();
ROLLBACK;
