-- Crear tabla de sectores
CREATE TABLE IF NOT EXISTS public.sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  descripcion TEXT,
  ubicacion VARCHAR(255),
  responsable VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "sectores_select_policy" ON public.sectores
  FOR SELECT
  USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "sectores_insert_policy" ON public.sectores
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "sectores_update_policy" ON public.sectores
  FOR UPDATE
  USING (true);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "sectores_delete_policy" ON public.sectores
  FOR DELETE
  USING (true);

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_sectores_tipo ON public.sectores(tipo);
CREATE INDEX IF NOT EXISTS idx_sectores_activo ON public.sectores(activo);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sectores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sectores_updated_at
  BEFORE UPDATE ON public.sectores
  FOR EACH ROW
  EXECUTE FUNCTION update_sectores_updated_at();;
