-- F10: estrategias atómicas para IVA opcional y operaciones numéricas declarativas.
INSERT INTO public.peajes_algoritmos_catalogo (codigo, descripcion, activo) VALUES
  ('ELIMINAR_IVA', 'Divide el importe por 1.21 y redondea a dos decimales', true),
  ('OPERAR_NUMERO', 'Suma, resta, multiplica o divide por un valor fijo', true)
ON CONFLICT (codigo) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true;
