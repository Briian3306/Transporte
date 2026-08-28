-- pgTAP: F18-2 duplicados permitidos con consentimiento
BEGIN;
SELECT plan(10);

INSERT INTO public.peajes (id, nombre) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Peaje Dup');
INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Estacion Dup');
INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'F18DUP01', 'FLOTA CAMIONES');
INSERT INTO public.pases (id, pase, patente_id) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'PASE-F18-DUP-01', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1');

INSERT INTO public.documentos (id, factura, cuenta, empresa_id, fecha_factura, tipo, importe_sin_iva, percepciones, importe_total)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'F-DUP-1', 'C-1', 'empresa-dup',
  CURRENT_DATE, 'FC', 90, 0, 90
);

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, file_upload_name
) VALUES (
  '2026-08-01 10:00:00+00',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  100, 10, 1, 90, 'carga-original.csv'
);

SELECT has_column('public', 'pasadas', 'duplicado', 'pasadas.duplicado existe');

SELECT is(
  (public.peajes_detectar_duplicados(
    jsonb_build_array(
      jsonb_build_object(
        'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'fecha_hora', '2026-08-01T10:00:00Z',
        'importe_neto', 90
      )
    )
  )->0->>'patente_nombre'),
  'F18DUP01',
  'detectar_duplicados expone patente_nombre'
);

SELECT is(
  (public.peajes_detectar_duplicados(
    jsonb_build_array(
      jsonb_build_object(
        'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'fecha_hora', '2026-08-01T10:00:00Z',
        'importe_neto', 90
      )
    )
  )->0->>'pase_nombre'),
  'PASE-F18-DUP-01',
  'detectar_duplicados expone pase_nombre'
);

SELECT is(
  (public.peajes_detectar_duplicados(
    jsonb_build_array(
      jsonb_build_object(
        'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'fecha_hora', '2026-08-01T10:00:00Z',
        'importe_neto', 90
      )
    )
  )->0->>'file_upload_name'),
  'carga-original.csv',
  'detectar_duplicados expone file_upload_name existente'
);

SELECT is(
  (public.peajes_detectar_duplicados(
    jsonb_build_array(
      jsonb_build_object(
        'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'fecha_hora', '2026-08-01T10:00:00Z',
        'importe_neto', 90
      )
    )
  )->0->>'duplicado')::boolean,
  true,
  'detectar_duplicados marca duplicado=true en coincidencia de clave'
);

SELECT throws_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'F-DUP-BLOCK',
        'cuenta', 'C-2',
        'empresa_id', 'empresa-dup',
        'fecha_factura', CURRENT_DATE::text,
        'importe_sin_iva', 90,
        'percepciones', 0,
        'iva', 0,
        'importe_total', 90
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-08-01T10:00:00Z',
          'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
          'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
          'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          'precio', 100,
          'bonificacion', 10,
          'quantity', 1,
          'importe_neto', 90
        )
      )
    )$$,
  'P0001',
  NULL,
  'sin p_permitir_duplicados la carga duplicada sigue bloqueada'
);

SELECT lives_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'F-DUP-OK',
        'cuenta', 'C-3',
        'empresa_id', 'empresa-dup',
        'fecha_factura', CURRENT_DATE::text,
        'importe_sin_iva', 90,
        'percepciones', 0,
        'iva', 0,
        'importe_total', 90
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-08-01T10:00:00Z',
          'pase_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
          'patente_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
          'estacion_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          'precio', 100,
          'bonificacion', 10,
          'quantity', 1,
          'importe_neto', 90
        )
      ),
      NULL,
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'carga-nueva.csv',
      NULL,
      true
    )$$,
  'con p_permitir_duplicados=true inserta la pasada duplicada'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.pasadas
    WHERE pase_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
      AND fecha_hora = '2026-08-01 10:00:00+00'
      AND duplicado = true
  ),
  1,
  'la pasada consentida queda con duplicado=true'
);

SELECT is(
  (
    SELECT (parametros_efectivos->>'duplicados_permitidos')::integer
    FROM public.registros_carga_peajes
    WHERE nombre_archivo = 'carga-nueva.csv'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  1,
  'auditoría registra duplicados_permitidos en parametros_efectivos'
);

SELECT throws_ok(
  $$INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, documento_id,
      precio, bonificacion, quantity, importe_neto, duplicado
    ) VALUES (
      '2026-08-01 10:00:00+00',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      100, 10, 1, 90, false
    )$$,
  '23505',
  NULL,
  'índice único parcial sigue bloqueando un segundo duplicado=false'
);

SELECT * FROM finish();
ROLLBACK;
