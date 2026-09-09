-- pgTAP: F14-10 — tarifas_normalizadas.fecha_aparicion (backfill + trigger)
BEGIN;
SELECT plan(11);

SELECT has_column(
  'public',
  'tarifas_normalizadas',
  'fecha_aparicion',
  'F14-10 tarifas_normalizadas.fecha_aparicion existe'
);

SELECT has_function(
  'public',
  'peajes_actualizar_fecha_aparicion_tarifa',
  'F14-10 peajes_actualizar_fecha_aparicion_tarifa() existe'
);

SELECT has_trigger(
  'public',
  'pasadas',
  'trg_pasadas_fecha_aparicion',
  'F14-10 trg_pasadas_fecha_aparicion en pasadas'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('a1000000-aaaa-1111-1111-111111111111', 'Peaje fecha aparicion');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('b1000000-aaaa-1111-1111-111111111111', 'a1000000-aaaa-1111-1111-111111111111', 'ESTACION FA');

INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('c1000000-aaaa-1111-1111-111111111111', 'FAPAT1', 'FLOTA CAMIONES');

INSERT INTO public.pases (id, pase, patente_id) VALUES
  ('d1000000-aaaa-1111-1111-111111111111', 'FA-PASE', 'c1000000-aaaa-1111-1111-111111111111');

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  'f1000000-aaaa-1111-1111-111111111111',
  'FA-DOC-1', NULL, '__global__', DATE '2026-07-01', 'FC',
  3000, 0, 0, 3000, 0
);

INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  'e1000000-aaaa-1111-1111-111111111111',
  'a1000000-aaaa-1111-1111-111111111111',
  'b1000000-aaaa-1111-1111-111111111111',
  NULL, 1000, 1000, 0, 'A', 'REVISAR', 'PENDIENTE'
);

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000000-aaaa-1111-1111-111111111111'
  ),
  NULL,
  'F14-10 nivel nuevo nace con fecha_aparicion NULL'
);

-- Backfill: pasadas ya matcheadas con fechas mixtas; forzar NULL y reaplicar el UPDATE de la migración.
INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, tarifa_normalizada_id
) VALUES
  (
    '11000001-aaaa-1111-1111-111111111111',
    timestamptz '2026-07-10 12:00:00+00',
    'd1000000-aaaa-1111-1111-111111111111',
    'c1000000-aaaa-1111-1111-111111111111',
    'b1000000-aaaa-1111-1111-111111111111',
    'f1000000-aaaa-1111-1111-111111111111',
    1000, 0, 1, 1000,
    'e1000000-aaaa-1111-1111-111111111111'
  ),
  (
    '11000002-aaaa-1111-1111-111111111111',
    timestamptz '2026-07-03 08:30:00+00',
    'd1000000-aaaa-1111-1111-111111111111',
    'c1000000-aaaa-1111-1111-111111111111',
    'b1000000-aaaa-1111-1111-111111111111',
    'f1000000-aaaa-1111-1111-111111111111',
    1000, 0, 1, 1000,
    'e1000000-aaaa-1111-1111-111111111111'
  ),
  (
    '11000003-aaaa-1111-1111-111111111111',
    timestamptz '2026-07-20 18:00:00+00',
    'd1000000-aaaa-1111-1111-111111111111',
    'c1000000-aaaa-1111-1111-111111111111',
    'b1000000-aaaa-1111-1111-111111111111',
    'f1000000-aaaa-1111-1111-111111111111',
    1000, 0, 1, 1000,
    'e1000000-aaaa-1111-1111-111111111111'
  );

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000000-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-07-03 08:30:00+00',
  'F14-10 INSERT con tarifa_normalizada_id setea MIN(fecha_hora)'
);

UPDATE public.tarifas_normalizadas
SET fecha_aparicion = NULL
WHERE id = 'e1000000-aaaa-1111-1111-111111111111';

UPDATE public.tarifas_normalizadas tn
SET fecha_aparicion = sub.min_fecha_hora
FROM (
  SELECT tarifa_normalizada_id, min(fecha_hora) AS min_fecha_hora
  FROM public.pasadas
  WHERE tarifa_normalizada_id IS NOT NULL
  GROUP BY tarifa_normalizada_id
) sub
WHERE tn.id = sub.tarifa_normalizada_id
  AND tn.fecha_aparicion IS NULL
  AND tn.id = 'e1000000-aaaa-1111-1111-111111111111';

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000000-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-07-03 08:30:00+00',
  'F14-10 backfill restaura MIN(fecha_hora) de pasadas matcheadas'
);

-- Camino de producción: INSERT sin match, luego UPDATE tarifa_normalizada_id.
INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  'e1000001-aaaa-1111-1111-111111111111',
  'a1000000-aaaa-1111-1111-111111111111',
  'b1000000-aaaa-1111-1111-111111111111',
  'CAT-B', 2000, 2000, 0, 'B', 'REVISAR', 'PENDIENTE'
);

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria
) VALUES (
  '11000004-aaaa-1111-1111-111111111111',
  timestamptz '2026-06-15 10:00:00+00',
  'd1000000-aaaa-1111-1111-111111111111',
  'c1000000-aaaa-1111-1111-111111111111',
  'b1000000-aaaa-1111-1111-111111111111',
  'f1000000-aaaa-1111-1111-111111111111',
  2000, 0, 1, 2000, 'CAT-B'
);

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000001-aaaa-1111-1111-111111111111'
  ),
  NULL,
  'F14-10 INSERT sin tarifa_normalizada_id no toca fecha_aparicion'
);

UPDATE public.pasadas
SET tarifa_normalizada_id = 'e1000001-aaaa-1111-1111-111111111111'
WHERE id = '11000004-aaaa-1111-1111-111111111111';

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000001-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-06-15 10:00:00+00',
  'F14-10 UPDATE tarifa_normalizada_id setea fecha_aparicion'
);

-- Fecha posterior: no retrocede hacia adelante.
INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria, tarifa_normalizada_id
) VALUES (
  '11000005-aaaa-1111-1111-111111111111',
  timestamptz '2026-08-01 09:00:00+00',
  'd1000000-aaaa-1111-1111-111111111111',
  'c1000000-aaaa-1111-1111-111111111111',
  'b1000000-aaaa-1111-1111-111111111111',
  'f1000000-aaaa-1111-1111-111111111111',
  2000, 0, 1, 2000, 'CAT-B',
  'e1000001-aaaa-1111-1111-111111111111'
);

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000001-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-06-15 10:00:00+00',
  'F14-10 fecha_hora posterior no pisa fecha_aparicion'
);

-- Fecha más temprana: sí adelanta.
INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, categoria
) VALUES (
  '11000006-aaaa-1111-1111-111111111111',
  timestamptz '2026-05-01 06:00:00+00',
  'd1000000-aaaa-1111-1111-111111111111',
  'c1000000-aaaa-1111-1111-111111111111',
  'b1000000-aaaa-1111-1111-111111111111',
  'f1000000-aaaa-1111-1111-111111111111',
  2000, 0, 1, 2000, 'CAT-B'
);

UPDATE public.pasadas
SET tarifa_normalizada_id = 'e1000001-aaaa-1111-1111-111111111111'
WHERE id = '11000006-aaaa-1111-1111-111111111111';

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000001-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-05-01 06:00:00+00',
  'F14-10 fecha_hora más temprana adelanta fecha_aparicion'
);

-- Corrección de fecha_hora en una pasada ya matcheada.
UPDATE public.pasadas
SET fecha_hora = timestamptz '2026-04-20 04:00:00+00'
WHERE id = '11000006-aaaa-1111-1111-111111111111';

SELECT is(
  (
    SELECT fecha_aparicion
    FROM public.tarifas_normalizadas
    WHERE id = 'e1000001-aaaa-1111-1111-111111111111'
  ),
  timestamptz '2026-04-20 04:00:00+00',
  'F14-10 UPDATE fecha_hora más temprana adelanta fecha_aparicion'
);

SELECT * FROM finish();
ROLLBACK;
