BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions, pg_catalog;
SELECT plan(20);

SELECT col_type_is('public', 'peajes', 'empresa_id', 'uuid', 'peajes company uses UUID');
SELECT fk_ok('public', 'peajes', 'empresa_id', 'public', 'empresas', 'id', 'peajes company FK');
SELECT has_index('public', 'peajes', 'idx_peajes_empresa_id', 'company FK index retained');
SELECT col_type_is('public', 'documentos', 'empresa_id', 'text', 'documents retain text company');
SELECT col_type_is('public', 'plantillas_configuracion', 'empresa_id', 'text', 'templates retain text company');
SELECT col_type_is('public', 'algoritmos_combinados', 'empresa_id', 'text', 'algorithms retain text company');

INSERT INTO public.empresas (id, nombre)
VALUES ('a06f0000-0000-4000-8000-000000000001', 'Empresa FK pgTAP');
SELECT lives_ok($$INSERT INTO public.peajes (id, nombre, empresa_id)
  VALUES ('a06f0000-0000-4000-8000-000000000002', 'Peaje FK pgTAP', 'a06f0000-0000-4000-8000-000000000001')$$,
  'existing company accepted');
SELECT throws_ok($$INSERT INTO public.peajes (nombre, empresa_id)
  VALUES ('Unknown company pgTAP', 'a06f0000-0000-4000-8000-000000000099')$$,
  '23503', NULL, 'unknown company rejected');
SELECT throws_ok($$INSERT INTO public.peajes (nombre, empresa_id)
  VALUES ('Global text pgTAP', '__global__')$$,
  '22P02', NULL, 'global text rejected on peajes');
SELECT lives_ok($$INSERT INTO public.peajes (nombre, empresa_id)
  VALUES ('Global NULL pgTAP', NULL)$$, 'NULL company accepted as global');
SELECT throws_ok($$DELETE FROM public.empresas WHERE id = 'a06f0000-0000-4000-8000-000000000001'$$,
  '23503', NULL, 'deleting a referenced company restricted');
SELECT is((SELECT e.nombre FROM public.peajes p JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = 'a06f0000-0000-4000-8000-000000000002'), 'Empresa FK pgTAP', 'UUID join resolves company name');

INSERT INTO public.estaciones (id, peaje_id, nombre, codigos_proveedor)
VALUES ('a06f0000-0000-4000-8000-000000000003', 'a06f0000-0000-4000-8000-000000000002', 'Estacion FK pgTAP', ARRAY['FK-CODE']);
SELECT is((SELECT empresa_nombre FROM public.peajes_auditoria_estaciones_universo()
  WHERE estacion_id = 'a06f0000-0000-4000-8000-000000000003' LIMIT 1), 'Empresa FK pgTAP', 'audit RPC resolves company name');
SELECT col_type_is('public', 'pwbi_pasadas', 'Empresa_ID', 'text', 'Power BI retains text company contract');
SELECT lives_ok($$SELECT public.peajes_listar_tarifas_normalizadas('{}'::jsonb, 1, 1, 'cases:desc')$$,
  'legacy tariff listing remains callable after UUID conversion');

SELECT lives_ok($$INSERT INTO public.estaciones_alias_proveedor (empresa_id, estacion_id, valor_proveedor)
  VALUES ('a06f0000-0000-4000-8000-000000000001', 'a06f0000-0000-4000-8000-000000000003', 'FK-ALIAS')$$,
  'alias trigger compares UUID company through its text contract');
SELECT col_type_is('public', 'pasadas_gestion', 'empresa_id', 'text', 'management view retains text company contract');
SELECT is((SELECT count(*)::integer FROM public.tarifas
  WHERE estacion_id = 'a06f0000-0000-4000-8000-000000000003'), 0, 'new station has no tariff identities');
SELECT lives_ok($$SELECT public.peajes_guardar_refresco_tarifas(jsonb_build_array(jsonb_build_object(
  'candidate_id', 'empresa-fk-new', 'action', 'CONFIRM_NEW',
  'peaje_id', 'a06f0000-0000-4000-8000-000000000002',
  'estacion_id', 'a06f0000-0000-4000-8000-000000000003',
  'sentido', 'AMBAS', 'categoria', 1, 'status', 'NO_PICO', 'importe', 12500,
  'fecha_vigencia_inicio', '2026-10-01', 'requiere_normalizacion_iva', false)))$$,
  'existing CONFIRM_NEW RPC creates the first station tariff');
SELECT is((SELECT ti.importe FROM public.tarifas t JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id
  WHERE t.estacion_id = 'a06f0000-0000-4000-8000-000000000003' AND t.status = 'NO_PICO'),
  12500::numeric, 'new identity has the saved current amount');

SELECT * FROM finish();
ROLLBACK;
