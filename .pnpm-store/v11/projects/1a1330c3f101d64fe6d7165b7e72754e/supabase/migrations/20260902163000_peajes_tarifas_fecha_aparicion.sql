-- F14-10: fecha_aparicion en tarifas_normalizadas.
-- Primera pasadas.fecha_hora vinculada al nivel; backfill histórico + trigger.
-- pwbi_tarifas: columna nueva al final (CREATE OR REPLACE VIEW).

-- -----------------------------------------------------------------------------
-- 1) Columna
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarifas_normalizadas
  ADD COLUMN IF NOT EXISTS fecha_aparicion timestamptz NULL;

COMMENT ON COLUMN public.tarifas_normalizadas.fecha_aparicion IS
  'F14-10 · Primera pasadas.fecha_hora vinculada a este nivel (MIN histórico). NULL = aún sin pasadas matcheadas. Nunca retrocede hacia adelante: solo se setea o se adelanta si llega una fecha más temprana.';

CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_fecha_aparicion
  ON public.tarifas_normalizadas (fecha_aparicion)
  WHERE fecha_aparicion IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Backfill desde pasadas ya matcheadas
-- -----------------------------------------------------------------------------
UPDATE public.tarifas_normalizadas tn
SET fecha_aparicion = sub.min_fecha_hora
FROM (
  SELECT tarifa_normalizada_id, min(fecha_hora) AS min_fecha_hora
  FROM public.pasadas
  WHERE tarifa_normalizada_id IS NOT NULL
  GROUP BY tarifa_normalizada_id
) sub
WHERE tn.id = sub.tarifa_normalizada_id
  AND tn.fecha_aparicion IS NULL;

-- -----------------------------------------------------------------------------
-- 3) Trigger: INSERT o UPDATE de tarifa_normalizada_id / fecha_hora
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_actualizar_fecha_aparicion_tarifa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tarifa_normalizada_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.tarifas_normalizadas tn
  SET fecha_aparicion = NEW.fecha_hora,
      updated_at = now()
  WHERE tn.id = NEW.tarifa_normalizada_id
    AND (tn.fecha_aparicion IS NULL OR tn.fecha_aparicion > NEW.fecha_hora);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.peajes_actualizar_fecha_aparicion_tarifa() IS
  'F14-10 · Mantiene tarifas_normalizadas.fecha_aparicion = MIN(pasadas.fecha_hora) del nivel. Dispara en INSERT/UPDATE de pasadas.tarifa_normalizada_id o fecha_hora. No pisa hacia fechas posteriores.';

DROP TRIGGER IF EXISTS trg_pasadas_fecha_aparicion ON public.pasadas;
CREATE TRIGGER trg_pasadas_fecha_aparicion
  AFTER INSERT OR UPDATE OF tarifa_normalizada_id, fecha_hora ON public.pasadas
  FOR EACH ROW EXECUTE FUNCTION public.peajes_actualizar_fecha_aparicion_tarifa();

-- -----------------------------------------------------------------------------
-- 4) Power BI: Fecha_Aparicion al final de pwbi_tarifas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pwbi_tarifas
WITH (security_invoker = false)
AS
SELECT
  tn.id AS "Tarifa_Normalizada_ID",
  tn.peaje_id AS "Peaje_ID",
  pj.nombre AS "Peaje_Nombre",
  tn.estacion_id AS "Estacion_ID",
  e.nombre AS "Estacion_Nombre",
  tn.categoria AS "Categoria",
  tn.categoria_calculated AS "Categoria_Calculated",
  tn.importe AS "Importe",
  tn.importe_base AS "Importe_Base",
  tn.cases AS "Cases",
  tn.multiplicador AS "Multiplicador",
  tn.desvio AS "Desvio",
  tn.hora_min AS "Hora_Min",
  tn.hora_max AS "Hora_Max",
  tn.hora_media AS "Hora_Media",
  tn.patron AS "Patron",
  tn.diagnostico AS "Diagnostico",
  tn.status AS "Status",
  tn.muestra_confiable AS "Muestra_Confiable",
  tn.confirmado_manual AS "Confirmado_Manual",
  tn.created_at,
  tn.fecha_aparicion AS "Fecha_Aparicion"
FROM public.tarifas_normalizadas tn
JOIN public.peajes pj ON pj.id = tn.peaje_id
JOIN public.estaciones e ON e.id = tn.estacion_id;

COMMENT ON VIEW public.pwbi_tarifas IS
  'Power BI / Data API: dimensión tarifas_normalizadas (Status PICO/NO_PICO; Hora_Min/Max/Media; Fecha_Aparicion). Sin Tipo_Meta. security_invoker=false.';

GRANT SELECT ON public.pwbi_tarifas TO anon, authenticated, service_role;
