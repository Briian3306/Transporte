-- F14 · plantillas Telepase: mapeo CATEGORIA activo (Patrón B)
BEGIN;
SELECT plan(6);

-- Plantilla Telepase con CATEGORIA excluida (estado previo al fix)
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado, mapeos)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'AUSA-8-2026',
  '__global__',
  'activa',
  '[
    {"columnaOrigen": "FECHA", "columnaDestino": "FECHA_HORA", "excluida": false},
    {"columnaOrigen": "CATEGORIA", "columnaDestino": null, "excluida": true}
  ]'::jsonb
);

-- MASIVOOO: sin CATEGORIA, no debe cambiar
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado, mapeos)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'MASIVOOO',
  '__global__',
  'activa',
  '[
    {"columnaOrigen": "DOMINIO", "columnaDestino": "PATENTE_ID", "excluida": false},
    {"columnaOrigen": "PRECIO", "columnaDestino": "PRECIO", "excluida": false}
  ]'::jsonb
);

-- Aplicar la misma lógica de la migración (idempotente)
UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', 'CATEGORIA',
          'excluida', false
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.nombre IN (
  'AUSA-8-2026',
  'AUSA-V2',
  'AUSA-V3',
  'AUSOL-7-2026',
  'AUBASA-7-2026',
  'AU-OESTE-V1-08-26',
  'CORRE-VIALES-V1'
);

UPDATE public.plantillas_configuracion p
SET mapeos = COALESCE(p.mapeos, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'columnaOrigen', 'CATEGORIA',
    'columnaDestino', 'CATEGORIA',
    'excluida', false
  )
)
WHERE p.nombre IN (
  'AUSA-8-2026',
  'AUSA-V2',
  'AUSA-V3',
  'AUSOL-7-2026',
  'AUBASA-7-2026',
  'AU-OESTE-V1-08-26',
  'CORRE-VIALES-V1'
)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) e
  WHERE e->>'columnaDestino' = 'CATEGORIA'
    AND COALESCE((e->>'excluida')::boolean, false) = false
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUSA-8-2026'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  1,
  'AUSA-8-2026: exactamente 1 mapeo CATEGORIA activo'
);

SELECT is(
  (
    SELECT e->>'columnaOrigen'
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUSA-8-2026'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
    LIMIT 1
  ),
  'CATEGORIA',
  'AUSA-8-2026: origen CATEGORIA preservado'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'MASIVOOO'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  0,
  'MASIVOOO: 0 mapeos CATEGORIA activos'
);

-- Idempotencia: segunda corrida no duplica
UPDATE public.plantillas_configuracion p
SET mapeos = COALESCE(p.mapeos, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'columnaOrigen', 'CATEGORIA',
    'columnaDestino', 'CATEGORIA',
    'excluida', false
  )
)
WHERE p.nombre IN (
  'AUSA-8-2026',
  'AUSA-V2',
  'AUSA-V3',
  'AUSOL-7-2026',
  'AUBASA-7-2026',
  'AU-OESTE-V1-08-26',
  'CORRE-VIALES-V1'
)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) e
  WHERE e->>'columnaDestino' = 'CATEGORIA'
    AND COALESCE((e->>'excluida')::boolean, false) = false
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUSA-8-2026'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  1,
  'Idempotente: sigue 1 mapeo CATEGORIA activo tras segunda corrida defensa'
);

-- Alias CLASE también se activa
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado, mapeos)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'AUSOL-7-2026',
  '__global__',
  'activa',
  '[{"columnaOrigen": "CLASE", "columnaDestino": null, "excluida": true}]'::jsonb
);

UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', 'CATEGORIA',
          'excluida', false
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.nombre = 'AUSOL-7-2026';

SELECT is(
  (
    SELECT e->>'columnaOrigen'
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUSOL-7-2026'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
    LIMIT 1
  ),
  'CLASE',
  'AUSOL-7-2026: alias CLASE → CATEGORIA activo'
);

-- Plantilla sin fila CATEGORIA recibe append defensivo
INSERT INTO public.plantillas_configuracion (id, nombre, empresa_id, estado, mapeos)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'AUBASA-7-2026',
  '__global__',
  'activa',
  '[{"columnaOrigen": "FECHA", "columnaDestino": "FECHA_HORA", "excluida": false}]'::jsonb
);

UPDATE public.plantillas_configuracion p
SET mapeos = COALESCE(p.mapeos, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'columnaOrigen', 'CATEGORIA',
    'columnaDestino', 'CATEGORIA',
    'excluida', false
  )
)
WHERE p.nombre = 'AUBASA-7-2026'
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) e
  WHERE e->>'columnaDestino' = 'CATEGORIA'
    AND COALESCE((e->>'excluida')::boolean, false) = false
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.plantillas_configuracion p
    CROSS JOIN LATERAL jsonb_array_elements(p.mapeos) e
    WHERE p.nombre = 'AUBASA-7-2026'
      AND e->>'columnaOrigen' = 'CATEGORIA'
      AND e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ),
  'AUBASA-7-2026: append defensivo agrega CATEGORIA'
);

SELECT * FROM finish();
ROLLBACK;
