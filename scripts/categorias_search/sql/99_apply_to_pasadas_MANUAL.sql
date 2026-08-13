-- 99_apply_to_pasadas_MANUAL.sql
-- ============================================================================
-- DO NOT RUN in the agent session / automated recovery toolkit.
-- Run ONLY after reviewing update_categoria_pasadas.csv and bak verify evidence,
-- and ONLY when the user explicitly requests production apply.
-- ============================================================================

UPDATE public.pasadas p
SET categoria = s.categoria
FROM public._stg_pasadas_categoria s
WHERE p.id = s.id
  AND s.categoria IS NOT NULL
  AND NULLIF(trim(s.categoria), '') IS NOT NULL
  AND p.categoria IS NULL
  AND p.file_upload_name IS NOT DISTINCT FROM s.file_name
  AND p.precio IS NOT DISTINCT FROM s.tarifa;
