-- 02c_minimal_bak_for_local_test.sql
-- Use when public.pasadas does not exist / is empty on local CLI.
-- Creates a minimal bak with only columns needed to test the categoria UPDATE.
-- Does NOT create or mutate public.pasadas.

DROP TABLE IF EXISTS public.pasadas_categoria_bak;

CREATE TABLE public.pasadas_categoria_bak (
  id uuid PRIMARY KEY,
  file_upload_name text,
  precio numeric,
  categoria text NULL
);

CREATE INDEX IF NOT EXISTS pasadas_categoria_bak_id_idx
  ON public.pasadas_categoria_bak (id);

COMMENT ON TABLE public.pasadas_categoria_bak IS
  'Minimal one-off test clone seeded from pasadas_rows.csv when local pasadas is absent.';
