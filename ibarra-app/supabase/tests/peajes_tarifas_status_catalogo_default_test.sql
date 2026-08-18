-- Default PICO/NO_PICO catalog: backfill + AFTER INSERT on peajes.
BEGIN;
SELECT plan(5);

SELECT has_function(
  'public',
  'peajes_seed_status_catalogo_default',
  ARRAY['uuid'],
  'peajes_seed_status_catalogo_default(uuid) existe'
);

SELECT has_function(
  'public',
  'peajes_trg_seed_status_catalogo',
  'peajes_trg_seed_status_catalogo() existe'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.peajes p
    WHERE (
      SELECT count(*) FROM public.tarifas_status_catalogo c
      WHERE c.peaje_id = p.id AND c.codigo IN ('PICO', 'NO_PICO')
    ) < 2
  ),
  0,
  'todo peaje existente tiene PICO y NO_PICO (backfill)'
);

INSERT INTO public.peajes (id, nombre)
VALUES ('e3333333-3333-3333-3333-333333333333', 'Peaje catalogo seed');

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tarifas_status_catalogo
    WHERE peaje_id = 'e3333333-3333-3333-3333-333333333333'
      AND codigo IN ('PICO', 'NO_PICO')
  ),
  2,
  'INSERT peaje siembra PICO y NO_PICO'
);

SELECT lives_ok(
  $$SELECT public.peajes_seed_status_catalogo_default('e3333333-3333-3333-3333-333333333333')$$,
  'seed default es idempotente (ON CONFLICT DO NOTHING)'
);

SELECT * FROM finish();
ROLLBACK;
