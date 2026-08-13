-- 02b_load_bak_from_export.sql
-- Use when local public.pasadas is empty: build bak skeleton from pasadas structure,
-- then load ids via app/export. Prefer 02_backup_pasadas.sql when pasadas has rows.
--
-- Example (psql), after creating empty bak with same columns:
--   CREATE TABLE public.pasadas_categoria_bak (LIKE public.pasadas INCLUDING ALL);
--   -- then insert minimal columns from a CSV load of pasadas_rows into a temp table
--   -- and INSERT INTO bak SELECT ... This file is documentation + optional helper.

CREATE TABLE IF NOT EXISTS public.pasadas_categoria_bak (
  LIKE public.pasadas INCLUDING DEFAULTS INCLUDING CONSTRAINTS
);

-- If bak already exists from 02, do nothing destructive here.
SELECT
  (SELECT count(*) FROM public.pasadas) AS pasadas_count,
  (SELECT count(*) FROM public.pasadas_categoria_bak) AS bak_count;
