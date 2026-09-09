-- F09: snapshot de mapeos y reconocimiento de estaciones por plantilla.
ALTER TABLE public.plantillas_configuracion
  ADD COLUMN IF NOT EXISTS mapeos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.plantilla_estaciones_reconocidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES public.plantillas_configuracion(id) ON DELETE CASCADE,
  estacion_id uuid NOT NULL REFERENCES public.estaciones(id) ON DELETE RESTRICT,
  valor_proveedor text NOT NULL,
  valor_normalizado text NOT NULL,
  origen text NOT NULL DEFAULT 'plantilla',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plantilla_estaciones_reconocidas_origen_chk CHECK (origen IN ('usuario', 'plantilla')),
  CONSTRAINT plantilla_estaciones_reconocidas_uk UNIQUE (plantilla_id, valor_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_plantilla_estaciones_reconocidas_plantilla
  ON public.plantilla_estaciones_reconocidas (plantilla_id);

ALTER TABLE public.plantilla_estaciones_reconocidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY plantilla_estaciones_reconocidas_authenticated_all
  ON public.plantilla_estaciones_reconocidas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantilla_estaciones_reconocidas TO authenticated;
GRANT ALL ON public.plantilla_estaciones_reconocidas TO service_role;

CREATE OR REPLACE FUNCTION public.peajes_guardar_plantilla_importacion(
  p_plantilla jsonb,
  p_configuraciones jsonb,
  p_mapeos jsonb DEFAULT NULL,
  p_estaciones_reconocidas jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_relacion jsonb;
BEGIN
  IF nullif(trim(p_plantilla->>'id'), '') IS NULL THEN
    INSERT INTO public.plantillas_configuracion (nombre, descripcion, empresa_id, estrategia_codigo, estado, mapeos)
    VALUES (
      p_plantilla->>'nombre',
      nullif(p_plantilla->>'descripcion', ''),
      coalesce(nullif(p_plantilla->>'empresa_id', ''), '__global__'),
      nullif(p_plantilla->>'estrategia_codigo', ''),
      coalesce(nullif(p_plantilla->>'estado', ''), 'borrador'),
      coalesce(p_mapeos, '[]'::jsonb)
    ) RETURNING id INTO v_id;
  ELSE
    v_id := (p_plantilla->>'id')::uuid;
    UPDATE public.plantillas_configuracion
    SET nombre = p_plantilla->>'nombre',
        descripcion = nullif(p_plantilla->>'descripcion', ''),
        empresa_id = coalesce(nullif(p_plantilla->>'empresa_id', ''), '__global__'),
        estrategia_codigo = nullif(p_plantilla->>'estrategia_codigo', ''),
        estado = coalesce(nullif(p_plantilla->>'estado', ''), 'borrador'),
        mapeos = coalesce(p_mapeos, mapeos)
    WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plantilla no encontrada: %', v_id; END IF;
  END IF;

  PERFORM public.peajes_sobrescribir_configuraciones_plantilla(v_id, coalesce(p_configuraciones, '[]'::jsonb));
  IF p_estaciones_reconocidas IS NOT NULL THEN
    DELETE FROM public.plantilla_estaciones_reconocidas WHERE plantilla_id = v_id;
    FOR v_relacion IN SELECT value FROM jsonb_array_elements(p_estaciones_reconocidas) LOOP
      INSERT INTO public.plantilla_estaciones_reconocidas
        (plantilla_id, estacion_id, valor_proveedor, valor_normalizado, origen)
      VALUES (
        v_id,
        (v_relacion->>'estacion_id')::uuid,
        v_relacion->>'valor_proveedor',
        coalesce(nullif(v_relacion->>'valor_normalizado', ''), upper(trim(v_relacion->>'valor_proveedor'))),
        coalesce(nullif(v_relacion->>'origen', ''), 'plantilla')
      );
    END LOOP;
  END IF;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_plantilla_importacion(jsonb, jsonb, jsonb, jsonb)
  TO authenticated, service_role;
