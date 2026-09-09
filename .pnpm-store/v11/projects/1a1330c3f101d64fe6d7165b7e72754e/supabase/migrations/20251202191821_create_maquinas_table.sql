-- Crear tabla de máquinas
CREATE TABLE IF NOT EXISTS public.maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  modelo VARCHAR(255) NOT NULL,
  numero_serie VARCHAR(255) UNIQUE,
  estado VARCHAR(50) NOT NULL DEFAULT 'activa',
  descripcion TEXT,
  ubicacion VARCHAR(255),
  fecha_adquisicion DATE,
  fecha_ultimo_mantenimiento DATE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "maquinas_select_policy" ON public.maquinas
  FOR SELECT
  USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "maquinas_insert_policy" ON public.maquinas
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "maquinas_update_policy" ON public.maquinas
  FOR UPDATE
  USING (true);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "maquinas_delete_policy" ON public.maquinas
  FOR DELETE
  USING (true);

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_maquinas_estado ON public.maquinas(estado);
CREATE INDEX IF NOT EXISTS idx_maquinas_activo ON public.maquinas(activo);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_maquinas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maquinas_updated_at
  BEFORE UPDATE ON public.maquinas
  FOR EACH ROW
  EXECUTE FUNCTION update_maquinas_updated_at();;
