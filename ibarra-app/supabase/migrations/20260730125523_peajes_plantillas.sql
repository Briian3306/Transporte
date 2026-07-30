-- F01-3: plantillas_configuracion + configuraciones_plantilla (≠ checklists)

CREATE TABLE IF NOT EXISTS public.plantillas_configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  -- text: empresa concreta o '__global__' (recurso global RN-23; contrato Agente 03)
  empresa_id text NOT NULL,
  estrategia_codigo text,
  estado text NOT NULL DEFAULT 'borrador',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_configuracion_estado_chk CHECK (estado IN ('borrador', 'activa', 'inactiva')),
  CONSTRAINT plantillas_configuracion_nombre_empresa_uk UNIQUE (nombre, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_plantillas_configuracion_empresa ON public.plantillas_configuracion (empresa_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_configuracion_estado ON public.plantillas_configuracion (estado);

COMMENT ON TABLE public.plantillas_configuracion IS 'Plantillas de transformación Peajes (PRD §14.2); no checklist_templates';

CREATE TABLE IF NOT EXISTS public.configuraciones_plantilla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES public.plantillas_configuracion (id) ON DELETE CASCADE,
  nombre_columna text NOT NULL,
  columna_destino text,
  orden integer NOT NULL,
  tipo text NOT NULL,
  algoritmo_combinado_id uuid,
  configuracion jsonb DEFAULT '{}'::jsonb,
  obligatoria boolean NOT NULL DEFAULT false,
  CONSTRAINT configuraciones_plantilla_tipo_chk CHECK (tipo IN ('transformacion', 'mapeo', 'validacion')),
  CONSTRAINT configuraciones_plantilla_orden_chk CHECK (orden >= 0),
  -- F01-3 / §14.2
  CONSTRAINT configuraciones_plantilla_uk UNIQUE (plantilla_id, nombre_columna, orden)
);

CREATE INDEX IF NOT EXISTS idx_configuraciones_plantilla_plantilla ON public.configuraciones_plantilla (plantilla_id);
CREATE INDEX IF NOT EXISTS idx_configuraciones_plantilla_algoritmo ON public.configuraciones_plantilla (algoritmo_combinado_id);
CREATE INDEX IF NOT EXISTS idx_configuraciones_plantilla_orden ON public.configuraciones_plantilla (plantilla_id, orden);

COMMENT ON TABLE public.configuraciones_plantilla IS 'Pasos/config de una plantilla Peajes; UK (plantilla_id, nombre_columna, orden)';

CREATE OR REPLACE FUNCTION public.peajes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plantillas_configuracion_updated_at ON public.plantillas_configuracion;
CREATE TRIGGER trg_plantillas_configuracion_updated_at
  BEFORE UPDATE ON public.plantillas_configuracion
  FOR EACH ROW
  EXECUTE FUNCTION public.peajes_set_updated_at();

ALTER TABLE public.plantillas_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuraciones_plantilla ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plantillas_configuracion_authenticated_all ON public.plantillas_configuracion;
CREATE POLICY plantillas_configuracion_authenticated_all ON public.plantillas_configuracion
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS configuraciones_plantilla_authenticated_all ON public.configuraciones_plantilla;
CREATE POLICY configuraciones_plantilla_authenticated_all ON public.configuraciones_plantilla
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_configuracion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuraciones_plantilla TO authenticated;
GRANT ALL ON public.plantillas_configuracion TO service_role;
GRANT ALL ON public.configuraciones_plantilla TO service_role;
