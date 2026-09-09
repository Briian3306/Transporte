-- Peaje + estaciones seed para AUTOVIA DEL MERCOSUR (empresa 37ab9246-…).
-- Evita que Paso 6, sin peajes de la empresa, caiga al catálogo global y
-- auto-matchee AUBASA (codigo 0001 → DOCK SUD).

INSERT INTO public.peajes (nombre, ubicacion, descripcion, empresa_id)
SELECT
  'Autovía del Mercosur',
  'Zárate',
  'Corredor Autovía del Mercosur (Telepase / MERCOSUR)',
  '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
WHERE EXISTS (
  SELECT 1 FROM public.empresas e WHERE e.id::text = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
)
AND NOT EXISTS (
  SELECT 1 FROM public.peajes p
  WHERE p.empresa_id = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
    AND lower(p.nombre) LIKE 'autov_a del mercosur'
);

WITH peaje AS (
  SELECT p.id
  FROM public.peajes p
  WHERE p.empresa_id = '37ab9246-a07a-40b5-b62d-7a8b8e7782db'
    AND lower(p.nombre) LIKE 'autov_a del mercosur'
  ORDER BY p.created_at
  LIMIT 1
),
seed(nombre, codigo, codigo_corto) AS (
  VALUES
    ('Estación 0001', '0001', '1'),
    ('Estación 0002', '0002', '2'),
    ('Estación 0003', '0003', '3'),
    ('Estación 0004', '0004', '4')
)
INSERT INTO public.estaciones (peaje_id, nombre, ubicacion, descripcion, codigos_proveedor)
SELECT
  peaje.id,
  seed.nombre,
  'Zárate',
  'Seed MERCOSUR Telepase; renombrar en Catálogos si corresponde',
  ARRAY[seed.codigo, seed.codigo_corto]
FROM peaje
CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.estaciones est
  WHERE est.peaje_id = peaje.id
    AND seed.codigo = ANY (COALESCE(est.codigos_proveedor, ARRAY[]::text[]))
);
