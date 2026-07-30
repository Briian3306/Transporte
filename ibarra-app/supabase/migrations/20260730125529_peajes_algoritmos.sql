-- F01-4: algoritmos_combinados + algoritmo_combinado_pasos + catálogo de códigos

-- Catálogo interno de estrategias permitidas (RN-20): solo códigos, nunca código ejecutable
CREATE TABLE IF NOT EXISTS public.peajes_algoritmos_catalogo (
  codigo text PRIMARY KEY,
  descripcion text,
  activo boolean NOT NULL DEFAULT true
);

INSERT INTO public.peajes_algoritmos_catalogo (codigo, descripcion) VALUES
  ('COMBINAR_FECHA_HORA', 'Combina columnas FECHA y HORA en FECHA_HORA'),
  ('NORMALIZAR_PATENTE', 'Normaliza formato de patente'),
  ('TRIM', 'Elimina espacios'),
  ('UPPER', 'Convierte a mayúsculas'),
  ('LOWER', 'Convierte a minúsculas'),
  ('REPLACE', 'Reemplazo de texto'),
  ('PAD_LEFT', 'Rellena a la izquierda (p.ej. hora HHMMSS)'),
  ('CAST_NUMBER', 'Convierte a número'),
  ('CAST_DATE', 'Convierte a fecha/hora'),
  ('MAP_VALUE', 'Mapeo de valor a valor'),
  ('DEFAULT_VALUE', 'Valor por defecto si vacío'),
  ('SPLIT', 'Divide columna'),
  ('CONCAT', 'Concatena columnas')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.algoritmos_combinados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  -- text: empresa concreta o '__global__' (recurso global RN-23; contrato Agente 03)
  empresa_id text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT algoritmos_combinados_estado_chk CHECK (estado IN ('borrador', 'activa', 'inactiva')),
  -- F01-4 / §14.2
  CONSTRAINT algoritmos_combinados_nombre_empresa_uk UNIQUE (nombre, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_algoritmos_combinados_empresa ON public.algoritmos_combinados (empresa_id);
CREATE INDEX IF NOT EXISTS idx_algoritmos_combinados_estado ON public.algoritmos_combinados (estado);

COMMENT ON TABLE public.algoritmos_combinados IS 'Algoritmos combinados reutilizables (PRD §14.2)';

CREATE TABLE IF NOT EXISTS public.algoritmo_combinado_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  algoritmo_combinado_id uuid NOT NULL REFERENCES public.algoritmos_combinados (id) ON DELETE CASCADE,
  orden integer NOT NULL,
  algoritmo_codigo text NOT NULL REFERENCES public.peajes_algoritmos_catalogo (codigo) ON DELETE RESTRICT,
  parametros jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT algoritmo_combinado_pasos_orden_chk CHECK (orden >= 0),
  -- F01-4 / §14.2
  CONSTRAINT algoritmo_combinado_pasos_uk UNIQUE (algoritmo_combinado_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_algoritmo_combinado_pasos_alg ON public.algoritmo_combinado_pasos (algoritmo_combinado_id);
CREATE INDEX IF NOT EXISTS idx_algoritmo_combinado_pasos_codigo ON public.algoritmo_combinado_pasos (algoritmo_codigo);

COMMENT ON TABLE public.algoritmo_combinado_pasos IS 'Pasos de un algoritmo combinado; UK (algoritmo_combinado_id, orden)';

-- FK diferida desde configuraciones_plantilla (creada en migración anterior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configuraciones_plantilla_algoritmo_fk'
  ) THEN
    ALTER TABLE public.configuraciones_plantilla
      ADD CONSTRAINT configuraciones_plantilla_algoritmo_fk
      FOREIGN KEY (algoritmo_combinado_id)
      REFERENCES public.algoritmos_combinados (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_algoritmos_combinados_updated_at ON public.algoritmos_combinados;
CREATE TRIGGER trg_algoritmos_combinados_updated_at
  BEFORE UPDATE ON public.algoritmos_combinados
  FOR EACH ROW
  EXECUTE FUNCTION public.peajes_set_updated_at();

ALTER TABLE public.peajes_algoritmos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algoritmos_combinados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algoritmo_combinado_pasos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peajes_algoritmos_catalogo_authenticated_select ON public.peajes_algoritmos_catalogo;
CREATE POLICY peajes_algoritmos_catalogo_authenticated_select ON public.peajes_algoritmos_catalogo
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS algoritmos_combinados_authenticated_all ON public.algoritmos_combinados;
CREATE POLICY algoritmos_combinados_authenticated_all ON public.algoritmos_combinados
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS algoritmo_combinado_pasos_authenticated_all ON public.algoritmo_combinado_pasos;
CREATE POLICY algoritmo_combinado_pasos_authenticated_all ON public.algoritmo_combinado_pasos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.peajes_algoritmos_catalogo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.algoritmos_combinados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.algoritmo_combinado_pasos TO authenticated;
GRANT ALL ON public.peajes_algoritmos_catalogo TO service_role;
GRANT ALL ON public.algoritmos_combinados TO service_role;
GRANT ALL ON public.algoritmo_combinado_pasos TO service_role;
