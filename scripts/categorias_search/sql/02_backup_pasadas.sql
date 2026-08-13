-- 02_backup_pasadas.sql
-- Clone live pasadas into a backup/test table. NEVER mutate public.pasadas here.

DROP TABLE IF EXISTS public.pasadas_categoria_bak;

CREATE TABLE public.pasadas_categoria_bak AS
TABLE public.pasadas;

CREATE INDEX IF NOT EXISTS pasadas_categoria_bak_id_idx
  ON public.pasadas_categoria_bak (id);

CREATE INDEX IF NOT EXISTS pasadas_categoria_bak_file_idx
  ON public.pasadas_categoria_bak (file_upload_name);

COMMENT ON TABLE public.pasadas_categoria_bak IS
  'One-off test clone for categorias_search backfill. Safe to DROP after verify.';
