-- F14 · Activar mapeo CATEGORIA en plantillas Telepase (Patrón B).
-- No tocar MASIVOOO ni plantillas sin columna de categoría.

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

-- Defensa: si alguna de esas plantillas no tenía fila CATEGORIA, agregarla.
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
