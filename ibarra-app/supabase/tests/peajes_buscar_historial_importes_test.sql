-- F14-21 Paso 9: amount-led history lookup scoped to categoria efectiva.
BEGIN;
SELECT plan(13);

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
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":9200}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'history lookup requires an effective category'
);

SELECT is(
  (
    SELECT (e->>'status')
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":9200,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  'NO_PICO',
  'unique historical amount returns its status in the requested effective category'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":9200.01,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  1,
  'unique history match stays within 1 percent and the effective category'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":9200,"categoria":6}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'historical price in another category does not match the effective category'
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
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":8464.0075,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  1,
  'same price in another category does not make the requested history category ambiguous'
);

SELECT is(
  (
    SELECT (e->>'categoria')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":9200,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  7,
  'returned category is the uniquely matching effective category'
);

SELECT is(
  (
    SELECT (e->>'count_identities')::int
    FROM jsonb_array_elements(
      public.peajes_buscar_historial_importes(
        '[{"estacion_id":"21500000-aaaa-4aa1-8aa1-000000000010","importe":5430.70,"categoria":7}]'::jsonb
      )
    ) e
    LIMIT 1
  ),
  0,
  'an amount with no matching tariff remains unresolved'
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
