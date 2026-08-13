-- FILTRAR_COLUMNA: conserva filas cuyo valor de columna coincide con parametros.valor
-- (número o texto; pads numéricos equivalentes, p. ej. 1 ≡ 0001)
INSERT INTO public.peajes_algoritmos_catalogo (codigo, descripcion, activo) VALUES
  (
    'FILTRAR_COLUMNA',
    'Conserva solo filas cuyo valor de columna coincide con el parámetro valor (número o texto; pads numéricos equivalentes)',
    true
  )
ON CONFLICT (codigo) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true;
