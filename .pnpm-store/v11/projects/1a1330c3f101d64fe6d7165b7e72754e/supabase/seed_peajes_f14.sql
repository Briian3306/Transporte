-- CLI-only F14 fixture for /peajes/auditoria-tarifas after db reset.
-- Synthetic Pattern A rows (categoria NULL). Does not copy DESARROLLO or CSV example rows.

SET search_path = public, extensions, pg_catalog;

INSERT INTO public.peajes (id, nombre, descripcion, empresa_id)
VALUES (
  'a0f14000-0000-4000-8000-000000000001',
  'CLI Auditoría tarifas',
  'Seed local F14 (Supabase CLI)',
  '__global__'
)
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

INSERT INTO public.estaciones (id, peaje_id, nombre, descripcion, codigos_proveedor)
VALUES
  (
    'a0f14000-0000-4000-8000-000000000011',
    'a0f14000-0000-4000-8000-000000000001',
    'CLI ESTACION PICO',
    'Dos precios: base dispersa + recargo concentrado',
    ARRAY['CLI-PICO']
  ),
  (
    'a0f14000-0000-4000-8000-000000000012',
    'a0f14000-0000-4000-8000-000000000001',
    'CLI ESTACION CATEGORIA',
    'Dos precios con hora dispersa (variación por clase)',
    ARRAY['CLI-CAT']
  )
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    peaje_id = EXCLUDED.peaje_id;

INSERT INTO public.patentes (id, patente, categoria)
VALUES (
  'a0f14000-0000-4000-8000-000000000021',
  'CLIF14',
  'FLOTA CAMIONES'
)
ON CONFLICT (patente) DO UPDATE
SET categoria = EXCLUDED.categoria;

INSERT INTO public.pases (id, pase, patente_id)
VALUES (
  'a0f14000-0000-4000-8000-000000000022',
  'CLI-F14-PASE',
  'a0f14000-0000-4000-8000-000000000021'
)
ON CONFLICT (pase) DO UPDATE
SET patente_id = EXCLUDED.patente_id;

INSERT INTO public.tarifas_parametros_peaje (
  peaje_id, umbral_muestra_minima, umbral_dispersion, auto_confirmar_horario
) VALUES (
  'a0f14000-0000-4000-8000-000000000001', 15, 4.100, false
)
ON CONFLICT (peaje_id) DO UPDATE
SET umbral_muestra_minima = 15,
    umbral_dispersion = 4.100,
    auto_confirmar_horario = false,
    updated_at = now();

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  'a0f14000-0000-4000-8000-000000000031',
  'CLI-F14-0001',
  'CLI',
  '__global__',
  DATE '2026-07-01',
  'FC',
  180000, 0, 0, 180000, 0
)
ON CONFLICT (id) DO NOTHING;

-- Wipe previous seed pasadas for this documento so reset/re-seed stays idempotent.
DELETE FROM public.pasadas
WHERE documento_id = 'a0f14000-0000-4000-8000-000000000031';

-- 20× 1500 spread hours (CATEGORIA) + 20× 3000 clustered 08:00 (POSIBLE_HORARIO)
INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  file_upload_name, user_id
)
SELECT
  (timestamp '2026-07-01 00:00:00' + make_interval(hours => (g % 24), mins => g))
    AT TIME ZONE 'UTC',
  'a0f14000-0000-4000-8000-000000000022',
  'a0f14000-0000-4000-8000-000000000021',
  'a0f14000-0000-4000-8000-000000000011',
  'a0f14000-0000-4000-8000-000000000031',
  1500, 0, 1, 1500, NULL,
  'CLI-F14-SEED.xlsx',
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993'
FROM generate_series(0, 19) AS g;

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  file_upload_name, user_id
)
SELECT
  (timestamp '2026-07-02 08:00:00' + make_interval(mins => g))
    AT TIME ZONE 'UTC',
  'a0f14000-0000-4000-8000-000000000022',
  'a0f14000-0000-4000-8000-000000000021',
  'a0f14000-0000-4000-8000-000000000011',
  'a0f14000-0000-4000-8000-000000000031',
  3000, 0, 1, 3000, NULL,
  'CLI-F14-SEED.xlsx',
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993'
FROM generate_series(0, 19) AS g;

-- Same two prices, both hour-spread → CATEGORIA
INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  file_upload_name, user_id
)
SELECT
  (timestamp '2026-07-03 00:00:00' + make_interval(hours => (g % 24), mins => g + 3))
    AT TIME ZONE 'UTC',
  'a0f14000-0000-4000-8000-000000000022',
  'a0f14000-0000-4000-8000-000000000021',
  'a0f14000-0000-4000-8000-000000000012',
  'a0f14000-0000-4000-8000-000000000031',
  1500, 0, 1, 1500, NULL,
  'CLI-F14-SEED.xlsx',
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993'
FROM generate_series(0, 19) AS g;

INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria,
  file_upload_name, user_id
)
SELECT
  (timestamp '2026-07-04 00:00:00' + make_interval(hours => ((g + 7) % 24), mins => g + 11))
    AT TIME ZONE 'UTC',
  'a0f14000-0000-4000-8000-000000000022',
  'a0f14000-0000-4000-8000-000000000021',
  'a0f14000-0000-4000-8000-000000000012',
  'a0f14000-0000-4000-8000-000000000031',
  3000, 0, 1, 3000, NULL,
  'CLI-F14-SEED.xlsx',
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993'
FROM generate_series(0, 19) AS g;

SELECT public.peajes_recalcular_tarifas('a0f14000-0000-4000-8000-000000000001');

