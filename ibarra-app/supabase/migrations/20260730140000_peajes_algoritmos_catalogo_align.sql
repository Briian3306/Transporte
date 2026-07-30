-- F05: alinear peajes_algoritmos_catalogo con StrategyRegistry (motor TS / PRD §7.4.2)
-- Códigos atómicos del frontend; COMBINAR_FECHA_HORA / NORMALIZAR_PATENTE son nombres
-- de algoritmos combinados (no códigos de paso), se desactivan en catálogo.

INSERT INTO public.peajes_algoritmos_catalogo (codigo, descripcion, activo) VALUES
  ('BORRAR_ESPACIOS', 'Elimina espacios al inicio y al final', true),
  ('ELIMINAR_GUIONES', 'Quita guiones del valor', true),
  ('CONVERTIR_MAYUSCULAS', 'Convierte el texto a mayúsculas', true),
  ('COMBINAR_COLUMNAS', 'Concatena columnas origen', true),
  ('FORMATEAR_FECHA_HORA', 'Combina FECHA + HORA en FECHA_HORA', true),
  ('CALCULAR_IMPORTE_NETO', 'PRECIO - BONIFICACION → IMPORTE_NETO', true),
  ('CONVERTIR_NUMERO', 'Convierte a número decimal', true),
  ('CONVERTIR_TEXTO', 'Convierte a texto y recorta espacios', true),
  ('ASIGNAR_VALOR', 'Asigna un valor constante', true),
  ('COPIAR_COLUMNA', 'Copia columna origen a destino', true)
ON CONFLICT (codigo) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true;

-- Desactivar códigos legacy que no existen en StrategyRegistry
UPDATE public.peajes_algoritmos_catalogo
SET activo = false
WHERE codigo IN (
  'TRIM', 'UPPER', 'LOWER', 'REPLACE', 'PAD_LEFT',
  'CAST_NUMBER', 'CAST_DATE', 'MAP_VALUE', 'DEFAULT_VALUE', 'SPLIT', 'CONCAT',
  'COMBINAR_FECHA_HORA', 'NORMALIZAR_PATENTE'
);
