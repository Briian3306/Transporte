-- pgTAP: vistas Power BI pwbi_* (+ anon API + documentos + tarifas)
-- Task 8 RED: pwbi_tarifas_v2 is a parallel reader; do not change pwbi_tarifas.
BEGIN;
SELECT plan(58);

SELECT has_view('public', 'pwbi_estacion', 'vista pwbi_estacion existe');
SELECT has_view('public', 'pwbi_patentes', 'vista pwbi_patentes existe');
SELECT has_view('public', 'pwbi_pasadas', 'vista pwbi_pasadas existe');
SELECT has_view('public', 'pwbi_documentos', 'vista pwbi_documentos existe');
SELECT has_view('public', 'pwbi_tarifas', 'vista pwbi_tarifas existe');

SELECT has_column('public', 'pwbi_estacion', 'Estacion_ID', 'pwbi_estacion.Estacion_ID');
SELECT has_column('public', 'pwbi_estacion', 'Estacion_Nombre', 'pwbi_estacion.Estacion_Nombre');
SELECT has_column('public', 'pwbi_estacion', 'Peaje_ID', 'pwbi_estacion.Peaje_ID');
SELECT has_column('public', 'pwbi_estacion', 'Peaje_Nombre', 'pwbi_estacion.Peaje_Nombre');
SELECT has_column('public', 'pwbi_estacion', 'Ubicacion', 'pwbi_estacion.Ubicacion');
SELECT has_column('public', 'pwbi_estacion', 'Latitud', 'pwbi_estacion.Latitud');
SELECT has_column('public', 'pwbi_estacion', 'Longitud', 'pwbi_estacion.Longitud');
SELECT has_column('public', 'pwbi_estacion', 'Status', 'pwbi_estacion.Status');
SELECT has_column('public', 'pwbi_estacion', 'created_at', 'pwbi_estacion.created_at');

SELECT has_column('public', 'pwbi_patentes', 'Patente_ID', 'pwbi_patentes.Patente_ID');
SELECT has_column('public', 'pwbi_patentes', 'Patente', 'pwbi_patentes.Patente');
SELECT has_column('public', 'pwbi_patentes', 'Patente_Categoria', 'pwbi_patentes.Patente_Categoria');
SELECT has_column('public', 'pwbi_patentes', 'Patente_Tipo_Trabajo', 'pwbi_patentes.Patente_Tipo_Trabajo');
SELECT has_column('public', 'pwbi_patentes', 'Patente_Activa', 'pwbi_patentes.Patente_Activa');
SELECT has_column('public', 'pwbi_patentes', 'created_at', 'pwbi_patentes.created_at');

SELECT has_column('public', 'pwbi_pasadas', 'Pasada_ID', 'pwbi_pasadas.Pasada_ID');
SELECT has_column('public', 'pwbi_pasadas', 'Estacion_ID', 'pwbi_pasadas.Estacion_ID');
SELECT has_column('public', 'pwbi_pasadas', 'Patente_ID', 'pwbi_pasadas.Patente_ID');
SELECT has_column('public', 'pwbi_pasadas', 'Pase_ID', 'pwbi_pasadas.Pase_ID');
SELECT has_column('public', 'pwbi_pasadas', 'Documento_ID', 'pwbi_pasadas.Documento_ID');
SELECT has_column('public', 'pwbi_pasadas', 'Tarifa_Status', 'pwbi_pasadas.Tarifa_Status');
SELECT has_column('public', 'pwbi_pasadas', 'Estacion_Geocodificacion_Status', 'pwbi_pasadas.Estacion_Geocodificacion_Status');
SELECT has_column('public', 'pwbi_pasadas', 'Categoria_Calculated', 'pwbi_pasadas.Categoria_Calculated');
SELECT has_column('public', 'pwbi_pasadas', 'Categoria_Calculated_Boolean', 'pwbi_pasadas.Categoria_Calculated_Boolean');
SELECT has_column('public', 'pwbi_pasadas', 'Patente_Tipo_Trabajo', 'pwbi_pasadas.Patente_Tipo_Trabajo');
SELECT has_column('public', 'pwbi_pasadas', 'Patente_Activa', 'pwbi_pasadas.Patente_Activa');

SELECT has_column('public', 'pwbi_documentos', 'Documento_ID', 'pwbi_documentos.Documento_ID');
SELECT has_column('public', 'pwbi_documentos', 'Documento_Numero', 'pwbi_documentos.Documento_Numero');
SELECT has_column('public', 'pwbi_documentos', 'Documento_Tipo', 'pwbi_documentos.Documento_Tipo');

SELECT has_column('public', 'pwbi_tarifas', 'Tarifa_Normalizada_ID', 'pwbi_tarifas.Tarifa_Normalizada_ID');
SELECT has_column('public', 'pwbi_tarifas', 'Status', 'pwbi_tarifas.Status');
SELECT has_column('public', 'pwbi_tarifas', 'Hora_Min', 'pwbi_tarifas.Hora_Min');
SELECT has_column('public', 'pwbi_tarifas', 'fecha_aparicion', 'pwbi_tarifas.fecha_aparicion');

SELECT ok(
  has_table_privilege('authenticated', 'pwbi_pasadas', 'SELECT')
  AND has_table_privilege('authenticated', 'pwbi_estacion', 'SELECT')
  AND has_table_privilege('authenticated', 'pwbi_patentes', 'SELECT')
  AND has_table_privilege('authenticated', 'pwbi_documentos', 'SELECT')
  AND has_table_privilege('authenticated', 'pwbi_tarifas', 'SELECT'),
  'authenticated puede SELECT en vistas pwbi_*'
);

SELECT ok(
  has_table_privilege('anon', 'pwbi_pasadas', 'SELECT')
  AND has_table_privilege('anon', 'pwbi_estacion', 'SELECT')
  AND has_table_privilege('anon', 'pwbi_patentes', 'SELECT')
  AND has_table_privilege('anon', 'pwbi_documentos', 'SELECT')
  AND has_table_privilege('anon', 'pwbi_tarifas', 'SELECT'),
  'anon puede SELECT en vistas pwbi_* (Data API / Power BI)'
);

SELECT ok(
  NOT has_table_privilege('anon', 'pwbi_pasadas', 'INSERT')
  AND NOT has_table_privilege('anon', 'pwbi_estacion', 'INSERT')
  AND NOT has_table_privilege('anon', 'pwbi_patentes', 'INSERT')
  AND NOT has_table_privilege('anon', 'pwbi_documentos', 'INSERT')
  AND NOT has_table_privilege('anon', 'pwbi_tarifas', 'INSERT'),
  'anon no tiene INSERT en vistas pwbi_*'
);

-- Parallel v2 reader (Task 8). Do not fold into the GRANT groups above.
SELECT has_view('public', 'pwbi_tarifas_v2', 'vista pwbi_tarifas_v2 existe');
SELECT has_column('public', 'pwbi_tarifas_v2', 'Tarifa_ID', 'pwbi_tarifas_v2.Tarifa_ID');
SELECT has_column('public', 'pwbi_tarifas_v2', 'Importe', 'pwbi_tarifas_v2.Importe');
SELECT has_column('public', 'pwbi_tarifas_v2', 'Sentido', 'pwbi_tarifas_v2.Sentido');
SELECT has_column('public', 'pwbi_tarifas_v2', 'fecha_vigencia_inicio', 'pwbi_tarifas_v2.fecha_vigencia_inicio');
SELECT has_column('public', 'pwbi_tarifas_v2', 'fecha_vigencia_fin', 'pwbi_tarifas_v2.fecha_vigencia_fin');
SELECT has_column('public', 'pwbi_tarifas_v2', 'no_coincide_con_tarifario', 'pwbi_tarifas_v2.no_coincide_con_tarifario');
SELECT has_column('public', 'pwbi_tarifas_v2', 'tarifa_vigente', 'pwbi_tarifas_v2.tarifa_vigente');

SELECT ok(
  pg_get_viewdef('public.pwbi_pasadas'::regclass, true) ILIKE '%tarifa_importe%'
    AND pg_get_viewdef('public.pwbi_pasadas'::regclass, true) ILIKE '%tarifas%'
    AND pg_get_viewdef('public.pwbi_pasadas'::regclass, true) ILIKE '%COALESCE%',
  'pwbi_pasadas obtiene Tarifa_Status desde tarifas/tarifa_importe con COALESCE legado'
);

SELECT ok(
  pg_get_viewdef('public.pwbi_tarifas_v2'::regclass, true) ILIKE '%fecha_vigencia_inicio%'
    AND pg_get_viewdef('public.pwbi_tarifas_v2'::regclass, true) ILIKE '%fecha_vigencia_fin%'
    AND pg_get_viewdef('public.pwbi_tarifas_v2'::regclass, true) ILIKE '%no_coincide_con_tarifario%'
    AND pg_get_viewdef('public.pwbi_tarifas_v2'::regclass, true) ILIKE '%tarifa_vigente%',
  'pwbi_tarifas_v2 expone metadata de vigencia y tarifa_vigente'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('20260914-aaaa-4aa1-8aa1-000000000001', 'Peaje PWBI views');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '20260914-aaaa-4aa1-8aa1-000000000002',
    '20260914-aaaa-4aa1-8aa1-000000000001',
    'Estacion PWBI views'
  );

INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('20260914-aaaa-4aa1-8aa1-000000000003', 'PWBI14', 'FLOTA CAMIONES');

INSERT INTO public.pases (id, pase, patente_id) VALUES
  (
    '20260914-aaaa-4aa1-8aa1-000000000004',
    'PWBI-PASE-14',
    '20260914-aaaa-4aa1-8aa1-000000000003'
  );

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  '20260914-aaaa-4aa1-8aa1-000000000005',
  'PWBI-DOC-14', NULL, '__global__', DATE '2026-09-14', 'FC',
  2468, 0, 0, 2468, 0
);

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
) VALUES
  (
    '20260914-aaaa-4aa1-8aa1-000000000010',
    '20260914-aaaa-4aa1-8aa1-000000000001',
    '20260914-aaaa-4aa1-8aa1-000000000002',
    'PICO', 7, 'AMBAS', now()
  ),
  (
    '20260914-aaaa-4aa1-8aa1-000000000011',
    '20260914-aaaa-4aa1-8aa1-000000000001',
    '20260914-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 7, 'AMBAS', now()
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, fecha_vigencia_inicio,
  diagnostico, no_coincide_con_tarifario
) VALUES (
  '20260914-aaaa-4aa1-8aa1-000000000020',
  '20260914-aaaa-4aa1-8aa1-000000000010',
  1234.56, timestamptz '2026-09-14 12:00:00+00', DATE '2026-09-14',
  'CONFIRMADO', true
);

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  tarifa_status, sentido, tarifa_importe_id
) VALUES
  (
    '20260914-aaaa-4aa1-8aa1-000000000030',
    timestamptz '2026-09-14 12:30:00+00',
    '20260914-aaaa-4aa1-8aa1-000000000004',
    '20260914-aaaa-4aa1-8aa1-000000000003',
    '20260914-aaaa-4aa1-8aa1-000000000002',
    '20260914-aaaa-4aa1-8aa1-000000000005',
    1234.56, 0, 1, 1234.56, '7', 'NO_PICO', 'AMBAS',
    '20260914-aaaa-4aa1-8aa1-000000000020'
  ),
  (
    '20260914-aaaa-4aa1-8aa1-000000000031',
    timestamptz '2026-09-14 12:31:00+00',
    '20260914-aaaa-4aa1-8aa1-000000000004',
    '20260914-aaaa-4aa1-8aa1-000000000003',
    '20260914-aaaa-4aa1-8aa1-000000000002',
    '20260914-aaaa-4aa1-8aa1-000000000005',
    999.99, 0, 1, 999.99, '7', 'PICO', 'AMBAS', NULL
  );

SELECT is(
  (SELECT "Tarifa_Status" FROM public.pwbi_pasadas
   WHERE "Pasada_ID" = '20260914-aaaa-4aa1-8aa1-000000000030'),
  'PICO',
  'pwbi_pasadas usa tarifas.status para una pasada con enlace exacto'
);

SELECT is(
  (SELECT count(*)::integer FROM public.pwbi_pasadas
   WHERE "Pasada_ID" = '20260914-aaaa-4aa1-8aa1-000000000031'),
  1,
  'pwbi_pasadas conserva una fila cuando la coincidencia dimensional es ambigua'
);

SELECT is(
  (SELECT "Tarifa_Status" FROM public.pwbi_pasadas
   WHERE "Pasada_ID" = '20260914-aaaa-4aa1-8aa1-000000000031'),
  'PICO',
  'pwbi_pasadas usa pasadas.tarifa_status PICO/NO_PICO si no hay tarifa_importe_id'
);

SELECT is(
  (SELECT "Importe" FROM public.pwbi_tarifas_v2
   WHERE "Tarifa_ID" = '20260914-aaaa-4aa1-8aa1-000000000010'),
  1234.56::numeric,
  'pwbi_tarifas_v2 conserva el importe del puntero current'
);

SELECT is(
  (SELECT fecha_vigencia_inicio FROM public.pwbi_tarifas_v2
   WHERE "Tarifa_ID" = '20260914-aaaa-4aa1-8aa1-000000000010'),
  DATE '2026-09-14',
  'pwbi_tarifas_v2 expone fecha_vigencia_inicio desde tarifa_importe'
);

SELECT is(
  (SELECT no_coincide_con_tarifario FROM public.pwbi_tarifas_v2
   WHERE "Tarifa_ID" = '20260914-aaaa-4aa1-8aa1-000000000010'),
  true,
  'pwbi_tarifas_v2 expone no_coincide_con_tarifario desde tarifa_importe'
);

SELECT is(
  (SELECT tarifa_vigente FROM public.pwbi_tarifas_v2
   WHERE "Tarifa_ID" = '20260914-aaaa-4aa1-8aa1-000000000010'),
  true,
  'tarifa_vigente es true porque existe la identidad en tarifas'
);

SELECT * FROM finish();
ROLLBACK;
