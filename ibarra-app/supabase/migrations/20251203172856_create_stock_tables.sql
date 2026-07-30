-- Crear tabla de depósitos
CREATE TABLE IF NOT EXISTS depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  ubicacion VARCHAR(255),
  responsable VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de stock por depósito
CREATE TABLE IF NOT EXISTS stock_depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL,
  cantidad_actual DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_minima DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_maxima DECIMAL(10,2) NOT NULL DEFAULT 100,
  punto_reorden DECIMAL(10,2) NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deposito_id, insumo_id)
);

-- Crear tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  deposito_id UUID NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usuario_id VARCHAR(255),
  usuario_nombre VARCHAR(255),
  motivo TEXT NOT NULL,
  observaciones TEXT,
  
  -- Campos específicos para entradas
  proveedor VARCHAR(255),
  numero_factura VARCHAR(100),
  costo_unitario DECIMAL(10,2),
  costo_total DECIMAL(10,2),
  
  -- Campos específicos para salidas
  solicitante VARCHAR(255),
  recurso_tipo VARCHAR(50),
  recurso_id VARCHAR(255),
  recurso_nombre VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_stock_deposito ON stock_depositos(deposito_id);
CREATE INDEX IF NOT EXISTS idx_stock_insumo ON stock_depositos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_deposito ON movimientos_stock(deposito_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_stock(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_stock(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_insumo ON movimientos_stock(insumo_id);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers para actualizar updated_at
CREATE TRIGGER update_depositos_updated_at BEFORE UPDATE ON depositos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_depositos_updated_at BEFORE UPDATE ON stock_depositos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso (permitir todo por ahora, ajustar según necesidades)
CREATE POLICY "Permitir todo en depositos" ON depositos FOR ALL USING (true);
CREATE POLICY "Permitir todo en stock_depositos" ON stock_depositos FOR ALL USING (true);
CREATE POLICY "Permitir todo en movimientos_stock" ON movimientos_stock FOR ALL USING (true);;
