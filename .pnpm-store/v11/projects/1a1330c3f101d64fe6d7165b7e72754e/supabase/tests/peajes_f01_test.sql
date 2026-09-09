-- pgTAP: F01-1 … F01-9 (Peajes backend)
BEGIN;
SELECT plan(59);

-- -----------------------------------------------------------------------------
-- F01-1: catálogos + FK estacion → peaje
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'peajes', 'F01-1 peajes existe');
SELECT has_table('public', 'estaciones', 'F01-1 estaciones existe');
SELECT has_table('public', 'patentes', 'F01-1 patentes existe');
SELECT has_table('public', 'pases', 'F01-1 pases existe');
SELECT fk_ok('estaciones', 'peaje_id', 'peajes', 'id', 'F01-1 estacion.peaje_id → peajes.id');

-- Catálogo empresas (PRD §14); empresa_id text en peajes/otros apunta a id::text o '__global__'
SELECT has_table('public', 'empresas', 'empresas existe');
SELECT has_column('public', 'empresas', 'nombre', 'empresas.nombre existe');
SELECT has_column('public', 'empresas', 'descripcion', 'empresas.descripcion existe');
SELECT col_is_unique('public', 'empresas', ARRAY['nombre'], 'empresas.nombre UK');

-- -----------------------------------------------------------------------------
-- F01-2 / F13: documentos + pasadas (estacion_id, sin peaje_id)
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'documentos', 'F13 documentos existe (ex facturas)');
SELECT hasnt_table('public', 'facturas', 'F13 facturas fue renombrada');
SELECT has_table('public', 'pasadas', 'F01-2 pasadas existe');
SELECT fk_ok('pasadas', 'documento_id', 'documentos', 'id', 'F13 pasadas.documento_id → documentos.id');
SELECT fk_ok('pasadas', 'estacion_id', 'estaciones', 'id', 'F01-2 pasadas.estacion_id → estaciones.id');
SELECT hasnt_column('public', 'pasadas', 'peaje_id', 'F01-2 pasadas no tiene peaje_id directo');
SELECT has_column('public', 'documentos', 'tipo', 'F13 documentos.tipo existe');
SELECT ok(
  (
    SELECT is_nullable = 'YES'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documentos'
      AND column_name = 'cuenta'
  ),
  'documentos.cuenta es opcional'
);

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
  ('33333333-3333-3333-3333-333333333333', 'ABC123', 'FLOTA CAMIONES');
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
INSERT INTO public.documentos (id, factura, cuenta, empresa_id, fecha_factura, tipo, importe_sin_iva, percepciones, importe_total)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'F-1', 'C-1', '66666666-6666-6666-6666-666666666666',
  CURRENT_DATE, 'FC', 90, 18.9, 108.9
);

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
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
-- F09: snapshots de plantilla (mapeos + estaciones reconocidas)
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'plantilla_estaciones_reconocidas', 'F09 tabla de reconocimientos por plantilla existe');
SELECT col_is_unique(
  'public', 'plantilla_estaciones_reconocidas', ARRAY['plantilla_id', 'valor_normalizado'],
  'F09 un valor normalizado es único por plantilla'
);
SELECT has_column('public', 'documentos', 'percepciones', 'F11 documentos.percepciones existe');
SELECT has_column('public', 'documentos', 'iva', 'F12 documentos.iva existe');
SELECT lives_ok(
  $$INSERT INTO public.documentos (factura, empresa_id, fecha_factura, importe_sin_iva, percepciones, importe_total)
    VALUES ('F-IMPORTE-INVALIDO', 'empresa-test', CURRENT_DATE, 100, 10, 109)$$,
  'F12 permite total declarado distinto del desglose'
);
SELECT lives_ok(
  $$INSERT INTO public.documentos (factura, empresa_id, fecha_factura, importe_sin_iva, percepciones, iva, importe_total)
    VALUES ('0840-0557074', 'AUSOL', '2026-08-01', 560832.27, 24676.62, 117774.78, 703283.67)$$,
  'F12 persiste la factura real AUSOL 0840-0557074 sin RAE'
);
SELECT is(
  (SELECT importe_total FROM public.documentos WHERE factura = '0840-0557074'),
  703283.67::numeric,
  'F12 conserva el total declarado de la factura real AUSOL'
);
SELECT is(
  (SELECT tipo FROM public.documentos WHERE factura = '0840-0557074'),
  'FC',
  'F13 documentos existentes migran / default tipo = FC'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(105, ARRAY[100]::numeric[], NULL)->>'valido')::boolean,
  false,
  'F11 diff $5 sobre subtotal 105 supera 1% ($1.05) → invalido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[99.5]::numeric[], NULL)->>'valido')::boolean,
  true,
  'F11 diff $0.50 dentro de 1% del subtotal → valido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[98]::numeric[], NULL)->>'valido')::boolean,
  false,
  'F11 diff $2 supera 1% del subtotal → invalido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(560832.27, ARRAY[560832.29]::numeric[], NULL)->>'valido')::boolean,
  true,
  'F11 AUSOL-scale: $0.02 dentro de 1% del subtotal → valido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[50, 50]::numeric[], NULL)->>'tolerancia')::numeric,
  1::numeric,
  'F11 tolerancia por defecto = 1% del subtotal'
);

-- Bonificación de cabecera: Σ neto − bonificacion ≈ subtotal
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[80, 70]::numeric[], NULL, 50)->>'valido')::boolean,
  true,
  'Doc bonificacion: suma 150 − bonif 50 = subtotal 100 → valido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[80, 70]::numeric[], NULL, 0)->>'valido')::boolean,
  false,
  'Doc bonificacion: suma 150 vs subtotal 100 sin bonif → invalido'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[80, 70]::numeric[], NULL, 50)->>'bonificacion')::numeric,
  50::numeric,
  'Doc bonificacion: respuesta JSON incluye bonificacion'
);
SELECT is(
  (public.peajes_validar_factura_pasadas(100, ARRAY[80, 70]::numeric[], NULL, 50)->>'esperado')::numeric,
  150::numeric,
  'Doc bonificacion: esperado = subtotal + bonificacion'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_plantilla_importacion(
    jsonb_build_object('id', '77777777-7777-7777-7777-777777777777', 'nombre', 'Plantilla RPC', 'empresa_id', '__global__', 'estado', 'activa'),
    '[{"nombre_columna":"ESTACION","columna_destino":"ESTACION_ID","orden":10,"tipo":"mapeo","obligatoria":true}]'::jsonb,
    '[{"columnaOrigen":"ESTACION","columnaDestino":"ESTACION_ID","excluida":false}]'::jsonb,
    '[{"estacion_id":"22222222-2222-2222-2222-222222222222","valor_proveedor":"CAMPANA DESCENDENTE","valor_normalizado":"CAMPANA DESCENDENTE","origen":"plantilla"}]'::jsonb
  )$$,
  'F09 guarda plantilla, mapeos y reconocimiento en una operación'
);
SELECT is(
  (SELECT count(*)::integer FROM public.plantilla_estaciones_reconocidas WHERE plantilla_id = '77777777-7777-7777-7777-777777777777'),
  1,
  'F09 persiste relación estación de plantilla'
);
SELECT is(
  (SELECT jsonb_array_length(mapeos) FROM public.plantillas_configuracion WHERE id = '77777777-7777-7777-7777-777777777777'),
  1,
  'F09 persiste snapshot de mapeos'
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
        'percepciones', 18.9,
        'iva', 0,
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
      AND (SELECT d.percepciones FROM public.documentos d WHERE d.id = r.documento_id) = 18.9
      AND (SELECT d.iva FROM public.documentos d WHERE d.id = r.documento_id) = 0
      AND (SELECT d.tipo FROM public.documentos d WHERE d.id = r.documento_id) = 'FC'
  ),
  'F01-9 registro carga persiste plantilla, parámetros, algoritmos y filas'
);

-- -----------------------------------------------------------------------------
-- F13: nota de crédito (NC) normaliza PRECIO negativo
-- -----------------------------------------------------------------------------
SELECT lives_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'NC-AUDIT',
        'cuenta', 'C-NC',
        'empresa_id', '66666666-6666-6666-6666-666666666666',
        'fecha_factura', CURRENT_DATE::text,
        'tipo', 'NC',
        'importe_sin_iva', 90,
        'percepciones', 0,
        'iva', 0,
        'importe_total', 90
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-07-03T11:00:00Z',
          'pase_id', '44444444-4444-4444-4444-444444444444',
          'patente_id', '33333333-3333-3333-3333-333333333333',
          'estacion_id', '22222222-2222-2222-2222-222222222222',
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
      'nc-test.xlsx'
    )$$,
  'F13 confirmar carga NC ok'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.documentos d
    JOIN public.pasadas p ON p.documento_id = d.id
    WHERE d.factura = 'NC-AUDIT'
      AND d.tipo = 'NC'
      AND d.importe_sin_iva = -90
      AND p.precio = -100
      AND p.importe_neto = -90
  ),
  'F13 NC persiste importes negativos en documento y pasadas'
);

SELECT * FROM finish();
ROLLBACK;
