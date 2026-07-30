-- F01-2: facturas + pasadas (FK factura_id; estacion_id, sin peaje_id directo)

CREATE TABLE IF NOT EXISTS public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura text NOT NULL,
  cuenta text NOT NULL,
  empresa_id text NOT NULL,
  fecha_factura date NOT NULL,
  importe_sin_iva numeric(14, 2) NOT NULL,
  importe_total numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_importe_sin_iva_chk CHECK (importe_sin_iva >= 0),
  CONSTRAINT facturas_importe_total_chk CHECK (importe_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON public.facturas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas (fecha_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON public.facturas (factura);

COMMENT ON TABLE public.facturas IS 'Bill / factura asociada a una carga de pasadas (PRD §11.2)';

CREATE TABLE IF NOT EXISTS public.pasadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora timestamptz NOT NULL,
  pase_id uuid NOT NULL REFERENCES public.pases (id) ON DELETE RESTRICT,
  patente_id uuid NOT NULL REFERENCES public.patentes (id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES public.estaciones (id) ON DELETE RESTRICT,
  factura_id uuid NOT NULL REFERENCES public.facturas (id) ON DELETE RESTRICT,
  precio numeric(14, 2) NOT NULL,
  bonificacion numeric(14, 2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  importe_neto numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pasadas_precio_chk CHECK (precio >= 0),
  CONSTRAINT pasadas_bonificacion_chk CHECK (bonificacion >= 0),
  CONSTRAINT pasadas_bonificacion_lte_precio_chk CHECK (bonificacion <= precio),
  CONSTRAINT pasadas_quantity_chk CHECK (quantity >= 1),
  CONSTRAINT pasadas_importe_neto_chk CHECK (importe_neto = precio - bonificacion),
  -- RN-16 / RNF-10: clave de negocio anti-duplicados
  CONSTRAINT pasadas_duplicado_uk UNIQUE (pase_id, fecha_hora, estacion_id, patente_id)
);

CREATE INDEX IF NOT EXISTS idx_pasadas_factura_id ON public.pasadas (factura_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_estacion_id ON public.pasadas (estacion_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_pase_id ON public.pasadas (pase_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_patente_id ON public.pasadas (patente_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_fecha_hora ON public.pasadas (fecha_hora);

COMMENT ON TABLE public.pasadas IS 'Pasadas estandarizadas; peaje derivado vía estacion_id (RN-05)';
COMMENT ON COLUMN public.pasadas.estacion_id IS 'FK a estaciones; no se persiste peaje_id en pasada';
COMMENT ON COLUMN public.pasadas.factura_id IS 'FK técnica a facturas (§13.5)';

-- Vista de conveniencia: peaje derivado
CREATE OR REPLACE VIEW public.pasadas_con_peaje
WITH (security_invoker = true)
AS
SELECT
  p.*,
  e.peaje_id,
  e.nombre AS estacion_nombre,
  pj.nombre AS peaje_nombre
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id;

COMMENT ON VIEW public.pasadas_con_peaje IS 'Pasadas con peaje derivado vía estación';

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS facturas_authenticated_all ON public.facturas;
CREATE POLICY facturas_authenticated_all ON public.facturas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pasadas_authenticated_all ON public.pasadas;
CREATE POLICY pasadas_authenticated_all ON public.pasadas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pasadas TO authenticated;
GRANT SELECT ON public.pasadas_con_peaje TO authenticated;
GRANT ALL ON public.facturas TO service_role;
GRANT ALL ON public.pasadas TO service_role;
GRANT SELECT ON public.pasadas_con_peaje TO service_role;
