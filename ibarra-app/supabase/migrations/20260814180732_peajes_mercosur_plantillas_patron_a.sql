-- Autovía del Mercosur: CSV CATEGORIA does not match tariff classes (Telepase
-- cat 7 mixes 5×/6×/7×/9×). Load as Pattern A (categoria NULL).
-- Inverse of 20260813100000_peajes_plantillas_mapeo_categoria.sql, scoped to
-- MERCA-SUR plantillas / empresa 37ab9246-…. Do not touch AUSA/AUSOL/AUBASA.

UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', NULL,
          'excluida', true
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.empresa_id = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
   OR p.nombre LIKE 'MERCA-SUR-%';
