-- F14-1: columnas de tarifa en pasadas + índices.
-- NO agrega peaje_id (RN-05). No toca pasadas_duplicado_uk (RN-16).

ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS categoria text NULL,
  ADD COLUMN IF NOT EXISTS tarifa_normalizada_id uuid NULL
    REFERENCES public.tarifas_normalizadas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarifa_status text NOT NULL DEFAULT 'PENDIENTE';

COMMENT ON COLUMN public.pasadas.categoria IS
  'RN-15 · Categoría cruda del proveedor tal como vino en el archivo (Paso 5 del wizard). Sin FK, sin catálogo, sin normalizar a mayúsculas. NO confundir con patentes.categoria (TRANSPORTE|REMIS|OBRA|AUTO), que es interna y se expone como patente_categoria en pasadas_gestion.';
COMMENT ON COLUMN public.pasadas.tarifa_normalizada_id IS
  'F14-1 · Nivel de tarifa al que fue matcheada esta pasada. NULL = todavía sin clasificar.';
COMMENT ON COLUMN public.pasadas.tarifa_status IS
  'F14-1 · Copia desnormalizada de tarifas_normalizadas.status para filtrar y reportar sin join. Sin CHECK propio: el valor ya lo validó trg_validar_status_tarifa en la tabla origen.';

CREATE INDEX IF NOT EXISTS idx_pasadas_categoria
  ON public.pasadas (categoria)
  WHERE categoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pasadas_tarifa_normalizada_id
  ON public.pasadas (tarifa_normalizada_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_tarifa_status
  ON public.pasadas (tarifa_status);
CREATE INDEX IF NOT EXISTS idx_pasadas_pendiente_match
  ON public.pasadas (documento_id, estacion_id, precio)
  WHERE tarifa_normalizada_id IS NULL;
