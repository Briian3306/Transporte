-- pgTAP: vistas Power BI pwbi_* (+ anon API + documentos + tarifas)
BEGIN;
SELECT plan(40);

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

SELECT * FROM finish();
ROLLBACK;
