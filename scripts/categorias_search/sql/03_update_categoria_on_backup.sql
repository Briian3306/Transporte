-- 03_update_categoria_on_backup.sql
-- TEST ONLY: updates pasadas_categoria_bak. Does NOT touch public.pasadas.

UPDATE public.pasadas_categoria_bak p
SET categoria = s.categoria
FROM public._stg_pasadas_categoria s
WHERE p.id = s.id
  AND s.categoria IS NOT NULL
  AND NULLIF(trim(s.categoria), '') IS NOT NULL
  AND p.categoria IS NULL
  AND p.file_upload_name IS NOT DISTINCT FROM s.file_name
  AND p.precio IS NOT DISTINCT FROM s.tarifa;
