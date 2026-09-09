-- pgTAP: peajes_listar_estaciones_pendientes (F08-2)
BEGIN;
SELECT plan(6);

SELECT has_function(
  'public',
  'peajes_listar_estaciones_pendientes',
  ARRAY['jsonb', 'text', 'text', 'integer', 'integer'],
  'RPC peajes_listar_estaciones_pendientes existe'
);

SELECT function_lang_is(
  'public',
  'peajes_listar_estaciones_pendientes',
  ARRAY['jsonb', 'text', 'text', 'integer', 'integer'],
  'plpgsql',
  'RPC usa plpgsql'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'peajes_listar_estaciones_pendientes'
  ),
  false,
  'RPC es SECURITY INVOKER'
);

-- Respuesta vacía válida (sin pasadas PENDING en DB limpia)
SELECT ok(
  (public.peajes_listar_estaciones_pendientes('{}'::jsonb, 'cantidad_pasadas', 'desc', 10, 0)
    ->> 'total')::bigint = 0
  OR (public.peajes_listar_estaciones_pendientes('{}'::jsonb, 'cantidad_pasadas', 'desc', 10, 0)
    -> 'rows') IS NOT NULL,
  'RPC retorna jsonb con total/rows'
);

SELECT ok(
  jsonb_typeof(
    public.peajes_listar_estaciones_pendientes('{}'::jsonb, 'cantidad_pasadas', 'desc', 10, 0) -> 'rows'
  ) = 'array',
  'RPC.rows es array'
);

SELECT ok(
  (
    SELECT has_table_privilege('authenticated', 'pasadas_gestion', 'SELECT')
  ),
  'authenticated puede leer pasadas_gestion (base del listado PENDING)'
);

SELECT * FROM finish();
ROLLBACK;
