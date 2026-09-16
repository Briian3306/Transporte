-- Flag por ubicación: solo las marcadas como asignable pueden colgarse de un insumo.

ALTER TABLE public.deposito_ubicaciones
  ADD COLUMN IF NOT EXISTS asignable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deposito_ubicaciones.asignable IS
  'Si es true, la ubicación aparece en el selector de insumos. Por defecto solo las posiciones.';

UPDATE public.deposito_ubicaciones
SET asignable = true
WHERE tipo = 'posicion'
  AND asignable = false;

CREATE INDEX IF NOT EXISTS idx_deposito_ubicaciones_asignable
  ON public.deposito_ubicaciones (deposito_id)
  WHERE asignable = true AND activo = true;

CREATE OR REPLACE FUNCTION public.stock_validar_stock_ubicacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ubicacion public.deposito_ubicaciones%ROWTYPE;
BEGIN
  IF NEW.ubicacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ubicacion
  FROM public.deposito_ubicaciones
  WHERE id = NEW.ubicacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ubicación no existe';
  END IF;

  IF v_ubicacion.deposito_id <> NEW.deposito_id THEN
    RAISE EXCEPTION 'La ubicación no pertenece al depósito del stock';
  END IF;

  -- Solo valida asignable al cambiar la ubicación, para no bloquear otros updates
  -- ni desmarcar una ubicación que ya tenía insumos.
  IF TG_OP = 'INSERT' OR NEW.ubicacion_id IS DISTINCT FROM OLD.ubicacion_id THEN
    IF NOT v_ubicacion.asignable THEN
      RAISE EXCEPTION 'La ubicación % no está habilitada para asignar insumos', v_ubicacion.codigo;
    END IF;
    IF NOT v_ubicacion.activo THEN
      RAISE EXCEPTION 'La ubicación % está inactiva', v_ubicacion.codigo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
