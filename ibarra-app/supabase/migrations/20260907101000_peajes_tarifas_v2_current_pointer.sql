-- F14-16 Task 3: composite current-pointer FK, immutable tarifa_importe history,
-- and AFTER INSERT promotion. Does not alter tarifas_normalizadas.

-- -----------------------------------------------------------------------------
-- 1) Composite FK: (tarifas.id, current_tarifa_id) → tarifa_importe(tarifa_id, id)
-- MATCH SIMPLE: a NULL pointer is allowed during bootstrap. Unique (tarifa_id, id)
-- already exists from Task 2. A row cannot point at another tariff's amount.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tarifas_current_pointer_fkey'
      AND conrelid = 'public.tarifas'::regclass
  ) THEN
    ALTER TABLE public.tarifas
      ADD CONSTRAINT tarifas_current_pointer_fkey
      FOREIGN KEY (id, current_tarifa_id)
      REFERENCES public.tarifa_importe (tarifa_id, id)
      MATCH SIMPLE
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON CONSTRAINT tarifas_current_pointer_fkey ON public.tarifas IS
  'F14-16 · El puntero vigente debe pertenecer a la misma tarifas.id. NULL permitido (MATCH SIMPLE) hasta el primer INSERT.';

-- -----------------------------------------------------------------------------
-- 2) Immutable history: reject DELETE and updates to business columns.
-- Corrections append a new tarifa_importe row. Audit updated_at remains writable.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_trg_tarifa_importe_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: DELETE está prohibido. Corregir insertando una fila nueva (F14-16).'
      USING ERRCODE = '23514';
  END IF;

  IF (
       NEW.id,
       NEW.tarifa_id,
       NEW.importe,
       NEW.importe_base,
       NEW.desvio,
       NEW.hora_min,
       NEW.hora_max,
       NEW.hora_media,
       NEW.categoria_calculated,
       NEW.fecha_aparicion,
       NEW.tarifas_normalizadas_id,
       NEW.created_at
     ) IS DISTINCT FROM (
       OLD.id,
       OLD.tarifa_id,
       OLD.importe,
       OLD.importe_base,
       OLD.desvio,
       OLD.hora_min,
       OLD.hora_max,
       OLD.hora_media,
       OLD.categoria_calculated,
       OLD.fecha_aparicion,
       OLD.tarifas_normalizadas_id,
       OLD.created_at
     )
  THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: no se permite UPDATE de columnas de negocio. Corregir insertando una fila nueva (F14-16).'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.peajes_trg_tarifa_importe_immutable() IS
  'F14-16 · BEFORE UPDATE OR DELETE: bloquea DELETE y cambios de columnas de negocio en tarifa_importe.';

DROP TRIGGER IF EXISTS trg_tarifa_importe_immutable ON public.tarifa_importe;
CREATE TRIGGER trg_tarifa_importe_immutable
  BEFORE UPDATE OR DELETE ON public.tarifa_importe
  FOR EACH ROW
  EXECUTE FUNCTION public.peajes_trg_tarifa_importe_immutable();

REVOKE ALL ON FUNCTION public.peajes_trg_tarifa_importe_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_trg_tarifa_importe_immutable()
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Promotion: first INSERT fills a NULL pointer; later INSERTs promote only a
-- strictly later (fecha_aparicion, created_at, id) tuple. Copies fecha_aparicion
-- onto tarifas.fecha_actualizacion. Earlier tuples never demote.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_trg_tarifa_importe_promote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_id uuid;
  v_current_fecha timestamptz;
  v_current_created_at timestamptz;
  v_current_row_id uuid;
BEGIN
  SELECT t.current_tarifa_id
    INTO v_current_id
    FROM public.tarifas t
   WHERE t.id = NEW.tarifa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'tarifa_importe.tarifa_id % no existe en tarifas (F14-16).',
      NEW.tarifa_id
      USING ERRCODE = '23503';
  END IF;

  IF v_current_id IS NULL THEN
    UPDATE public.tarifas
       SET current_tarifa_id = NEW.id,
           fecha_actualizacion = NEW.fecha_aparicion
     WHERE id = NEW.tarifa_id;
    RETURN NEW;
  END IF;

  SELECT ti.fecha_aparicion, ti.created_at, ti.id
    INTO v_current_fecha, v_current_created_at, v_current_row_id
    FROM public.tarifa_importe ti
   WHERE ti.id = v_current_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'tarifas.current_tarifa_id % no existe en tarifa_importe (F14-16).',
      v_current_id
      USING ERRCODE = '23503';
  END IF;

  IF (NEW.fecha_aparicion, NEW.created_at, NEW.id)
       > (v_current_fecha, v_current_created_at, v_current_row_id)
  THEN
    UPDATE public.tarifas
       SET current_tarifa_id = NEW.id,
           fecha_actualizacion = NEW.fecha_aparicion
     WHERE id = NEW.tarifa_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.peajes_trg_tarifa_importe_promote() IS
  'F14-16 · AFTER INSERT: promociona current_tarifa_id solo si (fecha_aparicion, created_at, id) es estrictamente posterior.';

DROP TRIGGER IF EXISTS trg_tarifa_importe_promote ON public.tarifa_importe;
CREATE TRIGGER trg_tarifa_importe_promote
  AFTER INSERT ON public.tarifa_importe
  FOR EACH ROW
  EXECUTE FUNCTION public.peajes_trg_tarifa_importe_promote();

REVOKE ALL ON FUNCTION public.peajes_trg_tarifa_importe_promote() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_trg_tarifa_importe_promote()
  TO authenticated, service_role;
