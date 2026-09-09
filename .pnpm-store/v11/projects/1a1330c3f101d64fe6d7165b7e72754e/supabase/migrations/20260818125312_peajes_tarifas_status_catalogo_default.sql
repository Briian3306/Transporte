-- Default PICO / NO_PICO catalog for every peaje.
-- F14 capa 2: without these rows the auditoría select only offers universals
-- (PENDIENTE / POSIBLE_HORARIO) and trg_validar_status_tarifa rejects PICO.
-- Catalog was seeded ad-hoc for 9 peajes; Autovía del Mercosur (and others)
-- created later had zero rows.

CREATE OR REPLACE FUNCTION public.peajes_seed_status_catalogo_default(p_peaje_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_peaje_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.tarifas_status_catalogo (peaje_id, codigo, etiqueta, color, tipo_meta, orden)
  VALUES
    (p_peaje_id, 'NO_PICO', 'No Pico', '#22C55E', 'NO_PICO', 1),
    (p_peaje_id, 'PICO', 'Pico', '#EF4444', 'PICO', 2)
  ON CONFLICT (peaje_id, codigo) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.peajes_seed_status_catalogo_default(uuid) IS
  'F14 · Semilla idempotente PICO/NO_PICO en tarifas_status_catalogo para un peaje.';

CREATE OR REPLACE FUNCTION public.peajes_trg_seed_status_catalogo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.peajes_seed_status_catalogo_default(NEW.id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.peajes_trg_seed_status_catalogo() IS
  'F14 · AFTER INSERT peajes: catálogo PICO/NO_PICO por defecto.';

DROP TRIGGER IF EXISTS trg_peajes_seed_status_catalogo ON public.peajes;
CREATE TRIGGER trg_peajes_seed_status_catalogo
  AFTER INSERT ON public.peajes
  FOR EACH ROW
  EXECUTE FUNCTION public.peajes_trg_seed_status_catalogo();

REVOKE ALL ON FUNCTION public.peajes_seed_status_catalogo_default(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_seed_status_catalogo_default(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.peajes_trg_seed_status_catalogo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_trg_seed_status_catalogo()
  TO authenticated, service_role;

-- Backfill peajes that already exist (Mercosur, Andes, Sierras, …).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.peajes p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tarifas_status_catalogo c WHERE c.peaje_id = p.id
    )
  LOOP
    PERFORM public.peajes_seed_status_catalogo_default(r.id);
  END LOOP;
END;
$$;
