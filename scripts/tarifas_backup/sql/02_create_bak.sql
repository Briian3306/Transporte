-- Laboratory clone tables only. Never DROP/TRUNCATE live pasadas or tarifas_normalizadas.

DROP TABLE IF EXISTS public.pasadas_tarifas_bak;
DROP TABLE IF EXISTS public.tarifas_normalizadas_bak;
DROP TABLE IF EXISTS public.tarifas_status_catalogo_bak;

CREATE TABLE public.tarifas_normalizadas_bak (
  LIKE public.tarifas_normalizadas INCLUDING DEFAULTS
);

CREATE TABLE public.pasadas_tarifas_bak (
  LIKE public.pasadas INCLUDING DEFAULTS
);

CREATE TABLE public.tarifas_status_catalogo_bak (
  LIKE public.tarifas_status_catalogo INCLUDING DEFAULTS
);

CREATE INDEX IF NOT EXISTS pasadas_tarifas_bak_id_idx
  ON public.pasadas_tarifas_bak (id);
CREATE INDEX IF NOT EXISTS pasadas_tarifas_bak_tarifa_idx
  ON public.pasadas_tarifas_bak (tarifa_normalizada_id);
CREATE INDEX IF NOT EXISTS tarifas_normalizadas_bak_id_idx
  ON public.tarifas_normalizadas_bak (id);

REVOKE ALL ON TABLE public.pasadas_tarifas_bak FROM anon, authenticated;
REVOKE ALL ON TABLE public.tarifas_status_catalogo_bak FROM anon, authenticated;
REVOKE ALL ON TABLE public.tarifas_normalizadas_bak FROM anon, authenticated;

COMMENT ON TABLE public.pasadas_tarifas_bak IS
  'Snapshot de laboratorio (tarifas_backup). DROP seguro; no es public.pasadas.';
COMMENT ON TABLE public.tarifas_normalizadas_bak IS
  'Snapshot de laboratorio (tarifas_backup). DROP seguro; no es public.tarifas_normalizadas.';
COMMENT ON TABLE public.tarifas_status_catalogo_bak IS
  'Snapshot de laboratorio (tarifas_backup). DROP seguro.';
