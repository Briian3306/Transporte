-- CONVERTIR_NUMERO_ARS: locale argentino (miles `.`, decimal `,`) p. ej. 19.985,09 → 19985.09
INSERT INTO public.peajes_algoritmos_catalogo (codigo, descripcion, activo) VALUES
  (
    'CONVERTIR_NUMERO_ARS',
    'Convierte número con formato argentino (miles con punto y decimal con coma)',
    true
  )
ON CONFLICT (codigo) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true;
