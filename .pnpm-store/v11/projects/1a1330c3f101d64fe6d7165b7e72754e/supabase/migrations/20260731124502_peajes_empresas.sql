-- Catálogo empresas (PRD §14 EMPRESA)
-- Relación lógica con peajes / facturas / plantillas / algoritmos vía empresa_id (text).
-- Se mantiene text (no FK uuid) para admitir el marcador RN-23 '__global__'.

CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_nombre_uk UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON public.empresas (nombre);

COMMENT ON TABLE public.empresas IS
  'Catálogo de empresas/proveedores (PRD §14 EMPRESA). Referenciada lógicamente por peajes.empresa_id, facturas.empresa_id, plantillas_configuracion.empresa_id y algoritmos_combinados.empresa_id (text = id::text o ''__global__'').';
COMMENT ON COLUMN public.empresas.nombre IS 'Nombre de la empresa';
COMMENT ON COLUMN public.empresas.descripcion IS 'Descripción opcional';

COMMENT ON COLUMN public.peajes.empresa_id IS
  'Referencia lógica a empresas.id::text, o marcador global ''__global__'' (RN-23)';
COMMENT ON COLUMN public.facturas.empresa_id IS
  'Referencia lógica a empresas.id::text, o marcador global ''__global__'' (RN-23)';
COMMENT ON COLUMN public.plantillas_configuracion.empresa_id IS
  'Referencia lógica a empresas.id::text, o marcador global ''__global__'' (RN-23)';
COMMENT ON COLUMN public.algoritmos_combinados.empresa_id IS
  'Referencia lógica a empresas.id::text, o marcador global ''__global__'' (RN-23)';

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_authenticated_all ON public.empresas;
CREATE POLICY empresas_authenticated_all ON public.empresas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
