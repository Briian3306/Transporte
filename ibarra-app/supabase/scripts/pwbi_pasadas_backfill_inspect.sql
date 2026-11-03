-- Inspection only (no UPDATE). Run in DESARROLLO SQL editor before
-- peajes_backfill_pasadas_tarifa_importe(). Postgres 17 has no min(uuid).
-- A) buckets  B) leftover AMBAS vs IDA + 1% price.

-- A) Buckets
WITH linaje AS (
  SELECT
    tarifas_normalizadas_id AS tn_id,
    (array_agg(id ORDER BY id))[1] AS ti_id
  FROM public.tarifa_importe
  WHERE tarifas_normalizadas_id IS NOT NULL
  GROUP BY tarifas_normalizadas_id
  HAVING count(*) = 1
),
max_cat AS (
  SELECT estacion_id, max(categoria)::smallint AS cat_max
  FROM public.tarifas
  WHERE enabled IS NOT FALSE
  GROUP BY estacion_id
),
base AS (
  SELECT
    p.id,
    p.estacion_id,
    e.peaje_id,
    p.categoria,
    p.tarifa_status,
    p.sentido,
    p.precio,
    l.ti_id AS linaje_ti_id,
    CASE
      WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
        THEN btrim(p.categoria)::smallint
      ELSE tn.categoria_calculated
    END AS cat_recibida,
    m.cat_max,
    CASE
      WHEN (
        CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END
      ) IS NULL THEN NULL
      WHEN m.cat_max IS NULL THEN
        CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END
      ELSE LEAST(
        CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END,
        m.cat_max
      )
    END AS cat_efectiva
  FROM public.pasadas p
  JOIN public.estaciones e ON e.id = p.estacion_id
  LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id
  LEFT JOIN linaje l ON l.tn_id = p.tarifa_normalizada_id
  LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
  WHERE p.tarifa_importe_id IS NULL
),
dim AS (
  SELECT b.id, count(DISTINCT t.id) AS n_tarifas
  FROM base b
  JOIN public.tarifas t
    ON t.estacion_id = b.estacion_id
   AND t.peaje_id = b.peaje_id
   AND t.status = b.tarifa_status
   AND t.categoria = b.cat_efectiva
   AND t.enabled IS NOT FALSE
   AND (
     (b.sentido = 'AMBAS' AND t.sentido = 'AMBAS')
     OR (b.sentido IN ('IDA', 'VUELTA') AND t.sentido IN (b.sentido, 'AMBAS'))
   )
  WHERE b.linaje_ti_id IS NULL
    AND b.tarifa_status IN ('PICO', 'NO_PICO')
    AND b.cat_efectiva IS NOT NULL
  GROUP BY b.id
)
SELECT
  CASE
    WHEN b.linaje_ti_id IS NOT NULL THEN 'linaje'
    WHEN d.n_tarifas = 1 THEN 'least_status_unico'
    WHEN d.n_tarifas > 1 THEN 'ambiguo'
    WHEN d.n_tarifas = 0 THEN 'sin_catalogo_ambas'
    ELSE 'sin_datos'
  END AS bucket,
  b.tarifa_status,
  count(*) AS n
FROM base b
LEFT JOIN dim d ON d.id = b.id
GROUP BY 1, 2
ORDER BY 1, 2;

-- B) Leftover AMBAS vs IDA + precio (run separately from A).
-- hits_ida_1pct = 1 → pass 3. = 0 → pass 4 (insert IDA histórico no_coincide).
WITH linaje AS (
  SELECT tarifas_normalizadas_id AS tn_id
  FROM public.tarifa_importe
  WHERE tarifas_normalizadas_id IS NOT NULL
  GROUP BY tarifas_normalizadas_id
  HAVING count(*) = 1
),
max_cat AS (
  SELECT estacion_id, max(categoria)::smallint AS cat_max
  FROM public.tarifas
  WHERE enabled IS NOT FALSE
  GROUP BY estacion_id
),
base AS (
  SELECT
    p.id,
    p.estacion_id,
    e.peaje_id,
    pj.nombre AS peaje,
    e.nombre AS estacion,
    p.categoria,
    p.tarifa_status,
    p.precio,
    CASE
      WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
        THEN btrim(p.categoria)::smallint
      ELSE tn.categoria_calculated
    END AS cat_recibida,
    m.cat_max,
    CASE
      WHEN (
        CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END
      ) IS NULL OR m.cat_max IS NULL THEN NULL
      ELSE LEAST(
        CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END,
        m.cat_max
      )
    END AS cat_efectiva
  FROM public.pasadas p
  JOIN public.estaciones e ON e.id = p.estacion_id
  JOIN public.peajes pj ON pj.id = e.peaje_id
  LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id
  LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
  WHERE p.tarifa_importe_id IS NULL
    AND p.sentido = 'AMBAS'
    AND p.tarifa_status IN ('PICO', 'NO_PICO')
    AND NOT EXISTS (
      SELECT 1 FROM linaje l WHERE l.tn_id = p.tarifa_normalizada_id
    )
),
leftover AS (
  SELECT b.*
  FROM base b
  WHERE b.cat_efectiva IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.tarifas t
      WHERE t.estacion_id = b.estacion_id
        AND t.peaje_id = b.peaje_id
        AND t.status = b.tarifa_status
        AND t.categoria = b.cat_efectiva
        AND t.enabled IS NOT FALSE
        AND t.sentido = 'AMBAS'
    )
),
ida_hits AS (
  SELECT
    s.id,
    count(ti.id) AS n_ida_1pct
  FROM leftover s
  JOIN public.tarifas t
    ON t.estacion_id = s.estacion_id
   AND t.peaje_id = s.peaje_id
   AND t.status = s.tarifa_status
   AND t.categoria = s.cat_efectiva
   AND t.enabled IS NOT FALSE
   AND t.sentido = 'IDA'
  JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  WHERE abs(ti.importe - s.precio) / NULLIF(ti.importe, 0) <= 0.01
  GROUP BY s.id
)
SELECT
  s.peaje,
  s.estacion,
  s.tarifa_status,
  s.categoria,
  s.cat_efectiva,
  round(s.precio, 2) AS precio_pasada,
  round(ti_cur.importe, 2) AS importe_ida_current,
  CASE
    WHEN ti_cur.importe IS NULL OR ti_cur.importe = 0 THEN NULL
    ELSE round(abs(s.precio - ti_cur.importe) / ti_cur.importe, 4)
  END AS error_vs_current_ida,
  COALESCE(h.n_ida_1pct, 0) AS hits_ida_1pct,
  count(*) AS n
FROM leftover s
LEFT JOIN public.tarifas t_ida
  ON t_ida.estacion_id = s.estacion_id
 AND t_ida.peaje_id = s.peaje_id
 AND t_ida.status = s.tarifa_status
 AND t_ida.categoria = s.cat_efectiva
 AND t_ida.enabled IS NOT FALSE
 AND t_ida.sentido = 'IDA'
LEFT JOIN public.tarifa_importe ti_cur ON ti_cur.id = t_ida.current_tarifa_id
LEFT JOIN ida_hits h ON h.id = s.id
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
ORDER BY n DESC, s.peaje, s.estacion;
