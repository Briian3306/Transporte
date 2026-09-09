-- URL pública de tarifas por empresa/concesión.
-- La pantalla de auditoría usa peajes.empresa_id → empresas.tarifa_url.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tarifa_url text;

COMMENT ON COLUMN public.empresas.tarifa_url IS
  'URL pública de la tabla de tarifas de la empresa/concesión. Nullable; si está presente debe ser http(s).';

ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_tarifa_url_http_chk;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tarifa_url_http_chk
  CHECK (
    tarifa_url IS NULL
    OR tarifa_url ~* '^https?://[^[:space:]]+$'
  );

UPDATE public.empresas
SET tarifa_url = 'https://www.ausa.com.ar/sections/tarifas.html'
WHERE upper(btrim(nombre)) = 'AUSA'
  AND tarifa_url IS NULL;
