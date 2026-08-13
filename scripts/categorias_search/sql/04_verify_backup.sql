-- 04_verify_backup.sql
-- Counts / samples on bak vs staging. Live pasadas checked only if it exists.

SELECT 'staging' AS src, count(*) AS n FROM public._stg_pasadas_categoria
UNION ALL
SELECT 'bak_total', count(*) FROM public.pasadas_categoria_bak
UNION ALL
SELECT 'bak_with_categoria', count(*) FROM public.pasadas_categoria_bak WHERE categoria IS NOT NULL
UNION ALL
SELECT 'bak_null_categoria', count(*) FROM public.pasadas_categoria_bak WHERE categoria IS NULL;

-- Sample filled rows
SELECT id, file_upload_name, precio, categoria
FROM public.pasadas_categoria_bak
WHERE categoria IS NOT NULL
ORDER BY file_upload_name, id
LIMIT 20;

-- ConsumosResumen should remain null on bak
SELECT file_upload_name, count(*) AS n, count(categoria) AS with_cat
FROM public.pasadas_categoria_bak
WHERE file_upload_name ILIKE 'ConsumosResumen%'
GROUP BY file_upload_name
ORDER BY 1;

-- Staging rows that did not land on bak
SELECT s.id, s.file_name, s.categoria AS stg_cat, p.categoria AS bak_cat
FROM public._stg_pasadas_categoria s
LEFT JOIN public.pasadas_categoria_bak p ON p.id = s.id
WHERE s.categoria IS NOT NULL
  AND NULLIF(trim(s.categoria), '') IS NOT NULL
  AND (p.id IS NULL OR p.categoria IS NULL)
LIMIT 50;
