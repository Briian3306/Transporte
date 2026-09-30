-- F14-21 Paso 9: amount-led history lookup scoped to categoria efectiva.
BEGIN;
SELECT plan(10);

SELECT has_function(
  'public',
  'peajes_buscar_historial_importes',
  ARRAY['jsonb'],
  'peajes_buscar_historial_importes(jsonb) exists'
);

INSERT INTO public.peajes (id, nombre)
VALUES ('21500000-aaaa-4aa1-8aa1-000000000001', 'F14-21 hist search');
INSERT INTO public.estaciones (id, peaje_id, nombre)
VALUES
  ('21500000-aaaa-4aa1-8aa1-000000000010', '21500000-aaaa-4aa1-8aa1-000000000001', 'Unique NP'),
  ('21500000-aaaa-4aa1-8aa1-000000000011', '21500000-aaaa-4aa1-8aa1-000000000001', 'Ambiguous'),
  ('21500000-aaaa-4aa1-8aa1-000000000012', '21500000-aaaa-4aa1-8aa1-000000000001', 'Review and disabled');

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion, enabled
) VALUES
  ('21500000-aaaa-4aa1-8aa1-000000000050', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000010', 'NO_PICO', 7, 'AMBAS', now(), true),
  ('21500000-aaaa-4aa1-8aa1-000000000055', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000010', 'NO_PICO', 6, 'AMBAS', now(), true),
  ('21500000-aaaa-4aa1-8aa1-000000000051', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000011', 'NO_PICO', 7, 'AMBAS', now(), true),
  ('21500000-aaaa-4aa1-8aa1-000000000052', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000011', 'PICO', 7, 'AMBAS', now(), true),
  ('21500000-aaaa-4aa1-8aa1-000000000053', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000012', 'NO_PICO', 5, 'AMBAS', now(), true),
  ('21500000-aaaa-4aa1-8aa1-000000000054', '21500000-aaaa-4aa1-8aa1-000000000001', '21500000-aaaa-4aa1-8aa1-000000000012', 'NO_PICO', 6, 'AMBAS', now(), true);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  ('21500000-aaaa-4aa1-8aa1-000000000150', '21500000-aaaa-4aa1-8aa1-000000000050', 8464.0075, timestamptz '2026-08-01 00:00:00+00', 'CONFIRMADO', DATE '2026-08-01', DATE '2026-09-01'),
  ('21500000-aaaa-4aa1-8aa1-000000000156', '21500000-aaaa-4aa1-8aa1-000000000055', 8464.0075, timestamptz '2026-08-01 00:00:00+00', 'CONFIRMADO', DATE '2026-08-01', NULL),
  ('21500000-aaaa-4aa1-8aa1-000000000151', '21500000-aaaa-4aa1-8aa1-000000000050', 9200, timestamptz '2026-09-01 00:00:00+00', 'CONFIRMADO', DATE '2026-09-01', NULL),
  ('21500000-aaaa-4aa1-8aa1-000000000152', '21500000-aaaa-4aa1-8aa1-000000000051', 5100, timestamptz '2026-07-01 00:00:00+00', 'CONFIRMADO', DATE '2026-07-01', NULL),
  ('21500000-aaaa-4aa1-8aa1-000000000153', '21500000-aaaa-4aa1-8aa1-000000000052', 5100, timestamptz '2026-07-01 00:00:00+00', 'CONFIRMADO', DATE '2026-07-01', NULL),
  ('21500000-aaaa-4aa1-8aa1-000000000154', '21500000-aaaa-4aa1-8aa1-000000000053', 3333, timestamptz '2026-06-01 00:00:00+00', 'REVISAR', DATE '2026-06-01', NULL),
  ('21500000-aaaa-4aa1-8aa1-000000000155', '21500000-aaaa-4aa1-8aa1-000000000054', 4444, timestamptz '2026-06-01 00:00:00+00', 'CONFIRMADO', DATE '2026-06-01', NULL);

UPDATE public.tarifas
SET enabled = false
WHERE id = '21500000-aaaa-4aa1-8aa1-000000000054';

SELECT is(
  public.peajes_buscar_historial_importes('[]'::jsonb),
  '[]'::jsonb,
  'empty candidate array returns []'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":8464.0075}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'historial without categoria returns no identities'
);

SELECT is(
  (
    SELECT (e->>'status')
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":8464.0075,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'NO_PICO',
  'unique historical amount inherits NO_PICO at the requested category'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":8464.01,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  1,
  'unique match stays unique within 1 percent even when current importe differs'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000011","importe":5100,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  2,
  'same amount on PICO and NO_PICO is ambiguous'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000012","importe":3333,"categoria":5}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'REVISAR rows do not count as history'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000012","importe":4444,"categoria":6}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'disabled identities do not count as history'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'categoria', (e->>'categoria')::int,
      'match_count', jsonb_array_length(COALESCE(e->'matches', '[]'::jsonb)),
      'match_cat', (e->'matches'->0->>'categoria')::int
    )
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":8464.0075,"categoria":6}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  '{"categoria": 6, "match_count": 1, "match_cat": 6}'::jsonb,
  'querying cat 6 does not return the sibling cat 7 with the same amount'
);

SELECT is(
  (
    SELECT (e->>'tarifa_id')
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000011","importe":5100,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  NULL,
  'ambiguous matches omit identity fields'
);

SELECT finish();
ROLLBACK;
