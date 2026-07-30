-- pgTAP: F01-1 … F01-9 (Peajes backend)
BEGIN;
SELECT plan(30);

-- -----------------------------------------------------------------------------
-- F01-1: catálogos + FK estacion → peaje
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'peajes', 'F01-1 peajes existe');
SELECT has_table('public', 'estaciones', 'F01-1 estaciones existe');
SELECT has_table('public', 'patentes', 'F01-1 patentes existe');
SELECT has_table('public', 'pases', 'F01-1 pases existe');
SELECT fk_ok('estaciones', 'peaje_id', 'peajes', 'id', 'F01-1 estacion.peaje_id → peajes.id');

-- -----------------------------------------------------------------------------
-- F01-2: facturas + pasadas (estacion_id, sin peaje_id)
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'facturas', 'F01-2 facturas existe');
SELECT has_table('public', 'pasadas', 'F01-2 pasadas existe');
SELECT fk_ok('pasadas', 'factura_id', 'facturas', 'id', 'F01-2 pasadas.factura_id → facturas.id');
SELECT fk_ok('pasadas', 'estacion_id', 'estaciones', 'id', 'F01-2 pasadas.estacion_id → estaciones.id');
SELECT hasnt_column('public', 'pasadas', 'peaje_id', 'F01-2 pasadas no tiene peaje_id directo');

-- -----------------------------------------------------------------------------
-- F01-3 / F01-4: constraints únicas
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'plantillas_configuracion', 'F01-3 plantillas_configuracion existe');
SELECT has_table('public', 'configuraciones_plantilla', 'F01-3 configuraciones_plantilla existe');
SELECT col_is_unique(
  'public',
  'configuraciones_plantilla',
  ARRAY['plantilla_id', 'nombre_columna', 'orden'],
  'F01-3 UK (plantilla_id, nombre_columna, orden)'
);

SELECT has_table('public', 'algoritmos_combinados', 'F01-4 algoritmos_combinados existe');
SELECT has_table('public', 'algoritmo_combinado_pasos', 'F01-4 algoritmo_combinado_pasos existe');
SELECT col_is_unique(
  'public',
  'algoritmo_combinado_pasos',
  ARRAY['algoritmo_combinado_id', 'orden'],
  'F01-4 UK (algoritmo_combinado_id, orden)'
);
SELECT col_is_unique(
  'public',
  'algoritmos_combinados',
  ARRAY['nombre', 'empresa_id'],
  'F01-4 UK (nombre, empresa_id)'
);

-- Contrato Agente 03: recurso global = empresa_id text '__global__'
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  'Plantilla Global',
  '__global__',
  'activa'
);

SELECT is(
  (SELECT empresa_id FROM public.plantillas_configuracion
   WHERE id = '88888888-8888-8888-8888-888888888888'),
  '__global__',
  'F01-3 empresa_id text admite marcador __global__'
);

-- Seed mínimo para RPCs
INSERT INTO public.peajes (id, nombre) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Peaje Test');
INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Estacion A');
INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('33333333-3333-3333-3333-333333333333', 'ABC123', 'TRANSPORTE');
INSERT INTO public.pases (id, pase, patente_id) VALUES
  ('44444444-4444-4444-4444-444444444444', 'PASE-001', '33333333-3333-3333-3333-333333333333');

-- -----------------------------------------------------------------------------
-- F01-5: cálculo + validación tolerancia
-- -----------------------------------------------------------------------------
SELECT is(
  public.peajes_calcular_importe_neto(100, 10),
  90::numeric,
  'F01-5 RN-10: importe_neto = precio - bonificacion'
);

SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[50, 50]::numeric[], 0.01)->>'valido')::boolean,
  true,
  'F01-5 diferencia = 0 → valido'
);

SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[50, 40]::numeric[], 0.01)->>'valido')::boolean,
  false,
  'F01-5 diferencia > tolerancia → invalido'
);

-- -----------------------------------------------------------------------------
-- F01-6: duplicados
-- -----------------------------------------------------------------------------
INSERT INTO public.facturas (id, factura, cuenta, empresa_id, fecha_factura, importe_sin_iva, importe_total)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'F-1', 'C-1', '66666666-6666-6666-6666-666666666666',
  CURRENT_DATE, 90, 108.9
);

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, factura_id,
  precio, bonificacion, quantity, importe_neto
) VALUES (
  '2026-07-01 10:00:00+00',
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555',
  100, 10, 1, 90
);

SELECT is(
  jsonb_array_length(
    public.peajes_detectar_duplicados(
      jsonb_build_array(
        jsonb_build_object(
          'pase_id', '44444444-4444-4444-4444-444444444444',
          'patente_id', '33333333-3333-3333-3333-333333333333',
          'estacion_id', '22222222-2222-2222-2222-222222222222',
          'fecha_hora', '2026-07-01T10:00:00Z'
        )
      )
    )
  ),
  1,
  'F01-6 clave repetida → rechazo'
);

-- -----------------------------------------------------------------------------
-- F01-8: algoritmo_codigo inexistente + orden duplicado
-- -----------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.peajes_validar_algoritmo_combinado(
      '[{"orden":1,"algoritmo_codigo":"NO_EXISTE"}]'::jsonb
    )$$,
  'P0001',
  'algoritmo_codigo inexistente o inactivo: NO_EXISTE (RN-20)',
  'F01-8 referencia algoritmo_codigo inexistente → error'
);

SELECT throws_ok(
  $$SELECT public.peajes_validar_algoritmo_combinado(
      '[{"orden":1,"algoritmo_codigo":"BORRAR_ESPACIOS"},{"orden":1,"algoritmo_codigo":"CONVERTIR_MAYUSCULAS"}]'::jsonb
    )$$,
  'P0001',
  'Orden duplicado dentro del algoritmo: 1 (RN-18)',
  'F01-8 orden duplicado → error'
);

-- -----------------------------------------------------------------------------
-- F01-7: sobrescritura transaccional (fallo no deja parciales)
-- -----------------------------------------------------------------------------
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  'Plantilla Test',
  '66666666-6666-6666-6666-666666666666',
  'borrador'
);

INSERT INTO public.configuraciones_plantilla (
  plantilla_id, nombre_columna, orden, tipo, obligatoria
) VALUES (
  '77777777-7777-7777-7777-777777777777', 'FECHA_HORA', 10, 'transformacion', true
);

SELECT throws_ok(
  $$SELECT public.peajes_sobrescribir_configuraciones_plantilla(
      '77777777-7777-7777-7777-777777777777',
      '[
        {"nombre_columna":"A","orden":1,"tipo":"transformacion"},
        {"nombre_columna":"A","orden":1,"tipo":"mapeo"}
      ]'::jsonb
    )$$,
  'P0001',
  'Orden duplicado para columna A (orden=1) — RN-18',
  'F01-7 edición inválida falla'
);

SELECT is(
  (SELECT count(*)::integer FROM public.configuraciones_plantilla
   WHERE plantilla_id = '77777777-7777-7777-7777-777777777777'),
  1,
  'F01-7 fallo no deja configuraciones parciales (sigue 1 original)'
);

-- Sobrescritura exitosa
SELECT lives_ok(
  $$SELECT public.peajes_sobrescribir_configuraciones_plantilla(
      '77777777-7777-7777-7777-777777777777',
      '[
        {"nombre_columna":"FECHA_HORA","orden":10,"tipo":"transformacion","obligatoria":true},
        {"nombre_columna":"PATENTE_ID","orden":20,"tipo":"mapeo","obligatoria":true}
      ]'::jsonb
    )$$,
  'F01-7 sobrescritura válida ok'
);

SELECT is(
  (SELECT count(*)::integer FROM public.configuraciones_plantilla
   WHERE plantilla_id = '77777777-7777-7777-7777-777777777777'),
  2,
  'F01-7 sobrescritura reemplaza a 2 configs'
);

-- -----------------------------------------------------------------------------
-- F01-9: confirmar carga persiste auditoría
-- -----------------------------------------------------------------------------
SELECT lives_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'F-AUDIT',
        'cuenta', 'C-2',
        'empresa_id', '66666666-6666-6666-6666-666666666666',
        'fecha_factura', CURRENT_DATE::text,
        'importe_sin_iva', 90,
        'importe_total', 108.9
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-07-02T11:00:00Z',
          'pase_id', '44444444-4444-4444-4444-444444444444',
          'patente_id', '33333333-3333-3333-3333-333333333333',
          'estacion_id', '22222222-2222-2222-2222-222222222222',
          'precio', 100,
          'bonificacion', 10,
          'quantity', 1
        )
      ),
      '77777777-7777-7777-7777-777777777777',
      '{"fuente":"test"}'::jsonb,
      '[{"codigo":"BORRAR_ESPACIOS"}]'::jsonb,
      '[]'::jsonb,
      'archivo-test.xlsx'
    )$$,
  'F01-9 confirmar carga ok'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.registros_carga_peajes r
    WHERE r.plantilla_id = '77777777-7777-7777-7777-777777777777'
      AND r.filas_procesadas >= 1
      AND r.parametros_efectivos ? 'fuente'
      AND jsonb_array_length(r.algoritmos_efectivos) >= 1
  ),
  'F01-9 registro carga persiste plantilla, parámetros, algoritmos y filas'
);

SELECT * FROM finish();
ROLLBACK;
