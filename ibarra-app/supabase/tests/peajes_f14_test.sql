-- pgTAP: F14-1 / F14-2 — auditoría tarifaria (casos B del Apéndice D, síntesis CLI)
BEGIN;
SELECT plan(46);

-- -----------------------------------------------------------------------------
-- Seed catálogos
-- -----------------------------------------------------------------------------
INSERT INTO public.peajes (id, nombre) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Peaje F14'),
  ('a2222222-2222-2222-2222-222222222222', 'Peaje F14 B');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'ESTACION BASE'),
  ('b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'ESTACION UNICA'),
  ('b3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'ESTACION HORARIO'),
  ('b4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'ESTACION UNA'),
  ('b5555555-5555-5555-5555-555555555555', 'a2222222-2222-2222-2222-222222222222', 'ESTACION BASE'); -- homónima otro peaje

INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'F14PAT', 'FLOTA CAMIONES');
INSERT INTO public.pases (id, pase, patente_id) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'F14-PASE', 'c1111111-1111-1111-1111-111111111111');

INSERT INTO public.tarifas_status_catalogo (peaje_id, codigo, etiqueta, color, tipo_meta, orden)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'NO_PICO', 'No Pico', '#22C55E', 'NO_PICO', 1),
  ('a1111111-1111-1111-1111-111111111111', 'PICO', 'Pico', '#EF4444', 'PICO', 2)
ON CONFLICT (peaje_id, codigo) DO NOTHING;

-- Schema checks
SELECT has_table('public', 'tarifas_normalizadas', 'F14-1 tarifas_normalizadas existe');
SELECT has_table('public', 'tarifas_parametros_peaje', 'F14-1 tarifas_parametros_peaje existe');
SELECT has_table('public', 'tarifas_status_catalogo', 'F14-1 tarifas_status_catalogo existe');
SELECT has_column('public', 'pasadas', 'categoria', 'F14-1 pasadas.categoria');
SELECT has_column('public', 'pasadas', 'tarifa_normalizada_id', 'F14-1 pasadas.tarifa_normalizada_id');
SELECT has_column('public', 'pasadas', 'tarifa_status', 'F14-1 pasadas.tarifa_status');
SELECT hasnt_column('public', 'pasadas', 'peaje_id', 'F14-1 RN-05: pasadas sin peaje_id');
SELECT has_column('public', 'tarifas_normalizadas', 'categoria_calculated', 'F14-9 categoria_calculated existe');

-- B-06: UNIQUE NULLS NOT DISTINCT
SELECT throws_ok(
  $$
  INSERT INTO public.tarifas_normalizadas (
    peaje_id, estacion_id, categoria, importe, importe_base, cases, patron, diagnostico
  ) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', NULL, 100, 100, 1, 'A', 'REVISAR'),
    ('a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', NULL, 100, 100, 1, 'A', 'REVISAR')
  $$,
  '23505',
  NULL,
  'B-06 unique nulls not distinct rechaza duplicado (categoria NULL)'
);

-- B-07 / B-08: trigger status
INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base, cases, patron, diagnostico, status
) VALUES (
  'e1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'b1111111-1111-1111-1111-111111111111',
  NULL, 200, 200, 20, 'A', 'REVISAR', 'PENDIENTE'
);

SELECT lives_ok(
  $$UPDATE public.tarifas_normalizadas SET status = 'POSIBLE_HORARIO'
     WHERE id = 'e1111111-1111-1111-1111-111111111111'$$,
  'B-08 acepta universal POSIBLE_HORARIO'
);

SELECT lives_ok(
  $$UPDATE public.tarifas_normalizadas SET status = 'PENDIENTE'
     WHERE id = 'e1111111-1111-1111-1111-111111111111'$$,
  'B-08 acepta universal PENDIENTE'
);

SELECT throws_ok(
  $$UPDATE public.tarifas_normalizadas SET status = 'PICO_MANANA'
     WHERE id = 'e1111111-1111-1111-1111-111111111111'$$,
  '23514',
  NULL,
  'B-07 rechaza status fuera del catálogo'
);

SELECT lives_ok(
  $$UPDATE public.tarifas_normalizadas SET status = 'PICO'
     WHERE id = 'e1111111-1111-1111-1111-111111111111'$$,
  'B-08 acepta PICO del catálogo del peaje'
);

SELECT throws_ok(
  $$UPDATE public.tarifas_normalizadas SET categoria_calculated = 11
     WHERE id = 'e1111111-1111-1111-1111-111111111111'$$,
  '23514',
  NULL,
  'F14-9 rechaza categoria_calculated 11'
);

-- Helper: documento + N pasadas a un precio/hora
CREATE OR REPLACE FUNCTION peajes_private.f14_seed_pasadas(
  p_doc uuid,
  p_estacion uuid,
  p_precio numeric,
  p_n integer,
  p_hora_base integer,
  p_hora_span integer
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  i integer;
  v_offset integer := abs(hashtext(p_doc::text)) % 100000;
BEGIN
  INSERT INTO public.documentos (
    id, factura, cuenta, empresa_id, fecha_factura, tipo,
    importe_sin_iva, percepciones, iva, importe_total, bonificacion
  ) VALUES (
    p_doc, 'F14-' || left(p_doc::text, 8), NULL, '__global__', CURRENT_DATE, 'FC',
    p_precio * p_n, 0, 0, p_precio * p_n, 0
  )
  ON CONFLICT (id) DO NOTHING;

  FOR i IN 0..(p_n - 1) LOOP
    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, documento_id,
      precio, bonificacion, quantity, importe_neto
    ) VALUES (
      (
        timestamp '2026-07-01 00:00:00' +
        make_interval(
          days => (v_offset + i) / 86400,
          hours => p_hora_base + (i % greatest(p_hora_span, 1)),
          mins => (i + v_offset) % 60,
          secs => (i + v_offset) % 50
        )
      ) AT TIME ZONE 'UTC',
      'd1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      p_estacion,
      p_doc,
      p_precio, 0, 1, p_precio
    );
  END LOOP;
END;
$$;

-- B-01: 14 pasadas → MUESTRA_INSUFICIENTE
SELECT peajes_private.f14_seed_pasadas(
  'f0111111-1111-1111-1111-111111111111',
  'b1111111-1111-1111-1111-111111111111',
  1500, 14, 0, 24
);
-- segundo nivel para que no sea TARIFA_UNICA
SELECT peajes_private.f14_seed_pasadas(
  'f0111112-1111-1111-1111-111111111112',
  'b1111111-1111-1111-1111-111111111111',
  3000, 14, 0, 24
);

SELECT is(
  public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111') >= 0,
  true,
  'B-01 recalcular corre'
);

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b1111111-1111-1111-1111-111111111111' AND importe = 1500
  ),
  'MUESTRA_INSUFICIENTE',
  'B-01 14 casos → MUESTRA_INSUFICIENTE'
);

-- B-02: tarifa única 40 pasadas
SELECT peajes_private.f14_seed_pasadas(
  'f0211111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  5361.29, 40, 0, 24
);
SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b2222222-2222-2222-2222-222222222222' AND importe = 5361.29
  ),
  'TARIFA_UNICA',
  'B-02 un solo nivel → TARIFA_UNICA'
);

SELECT is(
  (
    SELECT multiplicador FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b2222222-2222-2222-2222-222222222222' AND importe = 5361.29
  ),
  1.0000,
  'B-02 multiplicador = 1'
);

-- B-05: 1 pasada → MUESTRA_INSUFICIENTE (nunca POSIBLE_HORARIO)
SELECT peajes_private.f14_seed_pasadas(
  'f0511111-1111-1111-1111-111111111111',
  'b4444444-4444-4444-4444-444444444444',
  999, 1, 17, 1
);
SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b4444444-4444-4444-4444-444444444444' AND importe = 999
  ),
  'MUESTRA_INSUFICIENTE',
  'B-05 una pasada → MUESTRA_INSUFICIENTE'
);

SELECT isnt(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b4444444-4444-4444-4444-444444444444' AND importe = 999
  ),
  'POSIBLE_HORARIO',
  'B-05 una pasada nunca POSIBLE_HORARIO'
);

-- B-04: base dispersa + caro concentrado 17-19h
DELETE FROM public.pasadas WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333';
DELETE FROM public.documentos WHERE id IN (
  'f0411111-1111-1111-1111-111111111111',
  'f0411112-1111-1111-1111-111111111112'
);
SELECT peajes_private.f14_seed_pasadas(
  'f0411111-1111-1111-1111-111111111111',
  'b3333333-3333-3333-3333-333333333333',
  1000, 20, 0, 24
);
SELECT peajes_private.f14_seed_pasadas(
  'f0411112-1111-1111-1111-111111111112',
  'b3333333-3333-3333-3333-333333333333',
  1200, 20, 17, 3
);
SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');

SELECT is(
  (
    SELECT diagnostico FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  'POSIBLE_HORARIO',
  'B-04 nivel caro concentrado → POSIBLE_HORARIO'
);

-- B-12: pin UTC — pasada 02:30Z → hora 2
SELECT ok(
  (
    SELECT abs(
      extract(hour FROM ('2026-07-01 02:30:00+00'::timestamptz AT TIME ZONE 'UTC'))
      + extract(minute FROM ('2026-07-01 02:30:00+00'::timestamptz AT TIME ZONE 'UTC')) / 60.0
      - 2.5
    ) < 0.001
  ),
  'B-12 extract AT TIME ZONE UTC pinnea hora de pared'
);

-- B-09 / B-15 / B-16: confirmar status y protección manual
UPDATE public.tarifas_normalizadas
SET confirmado_manual = false, status = 'PENDIENTE', diagnostico = 'POSIBLE_HORARIO'
WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200;

SELECT is(
  (
    public.peajes_confirmar_status_tarifa(
      jsonb_build_array(
        jsonb_build_object(
          'tarifa_normalizada_id',
          (SELECT id FROM public.tarifas_normalizadas
           WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200),
          'status_codigo', 'PICO'
        )
      )
    )->>'niveles_confirmados'
  )::integer,
  1,
  'B-15 confirma 1 nivel'
);

SELECT is(
  (
    SELECT count(*)::integer FROM public.pasadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333'
      AND precio = 1200
      AND tarifa_status = 'PICO'
  ),
  20,
  'B-15 propaga PICO a pasadas del nivel'
);

SELECT is(
  (
    public.peajes_confirmar_status_tarifa(
      jsonb_build_array(
        jsonb_build_object(
          'tarifa_normalizada_id',
          (SELECT id FROM public.tarifas_normalizadas
           WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200),
          'status_codigo', 'NO_PICO'
        )
      )
    )->>'niveles_confirmados'
  )::integer,
  1,
  'B-16 reconfirma a NO_PICO'
);

SELECT is(
  (
    SELECT tarifa_status FROM public.pasadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND precio = 1200
    LIMIT 1
  ),
  'NO_PICO',
  'B-16 pasadas.tarifa_status = NO_PICO'
);

-- B-09: confirmado_manual no se pisa en diagnóstico/status
SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');
SELECT is(
  (
    SELECT status FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  'NO_PICO',
  'B-09 recalcular no pisa status confirmado'
);

SELECT is(
  (
    SELECT confirmado_manual FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  true,
  'B-09 confirmado_manual permanece true'
);

-- B-10: idempotencia normalizar
SELECT is(
  (SELECT pasadas_matcheadas FROM public.peajes_normalizar_tarifas('f0411112-1111-1111-1111-111111111112')),
  (SELECT pasadas_matcheadas FROM public.peajes_normalizar_tarifas('f0411112-1111-1111-1111-111111111112')),
  'B-10 segunda normalización idempotente (mismo matcheadas)'
);

-- B-11: NC no genera niveles
INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  'f1111111-1111-1111-1111-111111111111', 'NC-1', NULL, '__global__', CURRENT_DATE, 'NC',
  -500, 0, 0, -500, 0
);
INSERT INTO public.pasadas (
  fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto
) VALUES (
  '2026-07-02 12:00:00+00',
  'd1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  'f1111111-1111-1111-1111-111111111111',
  -500, 0, 1, -500
);
SELECT is(
  (SELECT pasadas_matcheadas FROM public.peajes_normalizar_tarifas('f1111111-1111-1111-1111-111111111111')),
  0,
  'B-11 NC → normalizar retorna 0'
);
SELECT is(
  (
    SELECT count(*)::integer FROM public.tarifas_normalizadas
    WHERE importe = 500 OR importe = -500
  ),
  0,
  'B-11 NC no crea nivel con importe ±500'
);

-- B-13: estaciones homónimas separadas por peaje
SELECT peajes_private.f14_seed_pasadas(
  'f1311111-1111-1111-1111-111111111111',
  'b5555555-5555-5555-5555-555555555555',
  1500, 20, 0, 24
);
SELECT public.peajes_recalcular_tarifas('a2222222-2222-2222-2222-222222222222');
SELECT is(
  (
    SELECT count(DISTINCT peaje_id)::integer FROM public.tarifas_normalizadas
    WHERE estacion_id IN (
      'b1111111-1111-1111-1111-111111111111',
      'b5555555-5555-5555-5555-555555555555'
    )
  ) >= 2,
  true,
  'B-13 familias separadas por peaje_id'
);

-- Listar + marcar diagnóstico
SELECT ok(
  (public.peajes_listar_tarifas_normalizadas(
    jsonb_build_object('peaje_id', 'a1111111-1111-1111-1111-111111111111'),
    1, 10, 'cases:desc'
  )->>'total')::int >= 1,
  'listar tarifas_normalizadas retorna total'
);

SELECT is(
  (
    public.peajes_marcar_diagnostico_tarifa(
      (SELECT id FROM public.tarifas_normalizadas
       WHERE estacion_id = 'b2222222-2222-2222-2222-222222222222' AND importe = 5361.29),
      'CATEGORIA'
    )->>'diagnostico'
  ),
  'CATEGORIA',
  'marcar_diagnostico CATEGORIA'
);

-- Recalcular borra nivel MUESTRA_INSUFICIENTE sin pasadas FC (fantasma post-move).
INSERT INTO public.tarifas_normalizadas (
  peaje_id, estacion_id, categoria, importe, importe_base, cases, patron, diagnostico, status
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  '7', 23536.62, 23536.62, 5, 'B', 'MUESTRA_INSUFICIENTE', 'PENDIENTE'
);
SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');
SELECT is(
  (
    SELECT count(*)::integer FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b2222222-2222-2222-2222-222222222222'
      AND importe = 23536.62
      AND categoria = '7'
  ),
  0,
  'recalcular borra MUESTRA_INSUFICIENTE sin pasadas FC'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b2222222-2222-2222-2222-222222222222'
      AND importe = 5361.29
  ),
  'recalcular conserva nivel con pasadas FC'
);

-- F14-9: categoria_calculated opcional en confirmar; recalc no la pisa
SELECT is(
  (
    public.peajes_confirmar_status_tarifa(
      jsonb_build_array(
        jsonb_build_object(
          'tarifa_normalizada_id',
          (SELECT id FROM public.tarifas_normalizadas
           WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200),
          'status_codigo', 'NO_PICO',
          'categoria_calculated', 5
        )
      )
    )->>'niveles_confirmados'
  )::integer,
  1,
  'F14-9 confirma con categoria_calculated 5'
);

SELECT is(
  (
    SELECT categoria_calculated FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  5::smallint,
  'F14-9 persiste categoria_calculated 5'
);

SELECT is(
  (
    public.peajes_confirmar_status_tarifa(
      jsonb_build_array(
        jsonb_build_object(
          'tarifa_normalizada_id',
          (SELECT id FROM public.tarifas_normalizadas
           WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200),
          'status_codigo', 'PICO'
        )
      )
    )->>'niveles_confirmados'
  )::integer,
  1,
  'F14-9 confirma sin clave categoria_calculated'
);

SELECT is(
  (
    SELECT categoria_calculated FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  5::smallint,
  'F14-9 ausente la clave no borra categoria_calculated'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.peajes_listar_tarifas_normalizadas(
        jsonb_build_object('peaje_id', 'a1111111-1111-1111-1111-111111111111'),
        1, 100, 'cases:desc'
      )->'rows'
    ) r
    WHERE (r->>'categoria_calculated')::int = 5
  ),
  'F14-9 listar incluye categoria_calculated'
);

SELECT public.peajes_recalcular_tarifas('a1111111-1111-1111-1111-111111111111');
SELECT is(
  (
    SELECT categoria_calculated FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b3333333-3333-3333-3333-333333333333' AND importe = 1200
  ),
  5::smallint,
  'F14-9 recalcular no pisa categoria_calculated'
);

-- -----------------------------------------------------------------------------
-- F14-2 hook: peajes_confirmar_carga dispara peajes_normalizar_tarifas
-- (sin segundo RPC). Firma pública intacta. NC → (0,0), sin nivel.
-- -----------------------------------------------------------------------------
SELECT lives_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'F14-HOOK-FC',
        'cuenta', 'C-HOOK',
        'empresa_id', '66666666-6666-6666-6666-666666666666',
        'fecha_factura', '2026-08-21',
        'importe_sin_iva', 500,
        'percepciones', 0,
        'iva', 0,
        'importe_total', 500
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-08-21T08:00:00Z',
          'pase_id', 'd1111111-1111-1111-1111-111111111111',
          'patente_id', 'c1111111-1111-1111-1111-111111111111',
          'estacion_id', 'b1111111-1111-1111-1111-111111111111',
          'precio', 500,
          'bonificacion', 0,
          'quantity', 1,
          'importe_neto', 500
        )
      ),
      NULL,
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'f14-hook-fc.xlsx'
    )$$,
  'F14-2 hook: confirmar_carga FC ok (firma pública)'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.pasadas p
    JOIN public.documentos d ON d.id = p.documento_id
    JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id
    WHERE d.factura = 'F14-HOOK-FC'
      AND p.precio = 500
      AND tn.importe = 500
      AND tn.estacion_id = 'b1111111-1111-1111-1111-111111111111'
  ),
  'F14-2 hook: confirmar_carga llama peajes_normalizar_tarifas (pasada matcheada)'
);

SELECT lives_ok(
  $$SELECT public.peajes_confirmar_carga(
      jsonb_build_object(
        'factura', 'F14-HOOK-NC',
        'cuenta', 'C-HOOK-NC',
        'empresa_id', '66666666-6666-6666-6666-666666666666',
        'fecha_factura', '2026-08-21',
        'tipo', 'NC',
        'importe_sin_iva', 400,
        'percepciones', 0,
        'iva', 0,
        'importe_total', 400
      ),
      jsonb_build_array(
        jsonb_build_object(
          'fecha_hora', '2026-08-21T09:00:00Z',
          'pase_id', 'd1111111-1111-1111-1111-111111111111',
          'patente_id', 'c1111111-1111-1111-1111-111111111111',
          'estacion_id', 'b1111111-1111-1111-1111-111111111111',
          'precio', 400,
          'bonificacion', 0,
          'quantity', 1,
          'importe_neto', 400
        )
      ),
      NULL,
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'f14-hook-nc.xlsx'
    )$$,
  'F14-2 hook: confirmar_carga NC ok'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tarifas_normalizadas
    WHERE estacion_id = 'b1111111-1111-1111-1111-111111111111'
      AND importe = 400
  ),
  0,
  'F14-2 hook: NC no crea nivel tarifario'
);

SELECT * FROM finish();
ROLLBACK;
