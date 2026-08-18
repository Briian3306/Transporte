-- empresas.tarifa_url (auditoría de tarifas: link desde peaje_nombre)
BEGIN;
SELECT plan(3);

SELECT has_column('public', 'empresas', 'tarifa_url', 'empresas.tarifa_url existe');
SELECT ok(
  (
    SELECT is_nullable = 'YES'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'empresas'
      AND column_name = 'tarifa_url'
  ),
  'empresas.tarifa_url es nullable'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_tarifa_url_http_chk'
      AND conrelid = 'public.empresas'::regclass
  ),
  'empresas.tarifa_url tiene CHECK http(s)'
);

SELECT * FROM finish();
ROLLBACK;
