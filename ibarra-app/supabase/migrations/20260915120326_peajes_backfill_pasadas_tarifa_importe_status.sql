-- Backfill pasadas.tarifa_importe_id: lineage (IS NULL), LEAST+status,
-- IDA 1%, then IDA historical REVISAR/no_coincide without promoting current.
-- pwbi_pasadas: join v2 + COALESCE(tarifa_status) for PICO/NO_PICO.

CREATE OR REPLACE FUNCTION public.peajes_backfill_pasadas_tarifa_importe()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Pass 1: unique TN lineage. Never overwrite an existing v2 FK.
  UPDATE public.pasadas AS p
  SET tarifa_importe_id = u.tarifa_importe_id
  FROM (
    SELECT
      ti.tarifas_normalizadas_id AS tn_id,
      (array_agg(ti.id ORDER BY ti.id))[1] AS tarifa_importe_id
    FROM public.tarifa_importe AS ti
    WHERE ti.tarifas_normalizadas_id IS NOT NULL
    GROUP BY ti.tarifas_normalizadas_id
    HAVING count(*) = 1
  ) AS u
  WHERE p.tarifa_importe_id IS NULL
    AND p.tarifa_normalizada_id IS NOT NULL
    AND p.tarifa_normalizada_id = u.tn_id;

  -- Pass 2: unique tarifas identity (LEAST + PICO/NO_PICO + sentido).
  WITH max_cat AS (
    SELECT estacion_id, max(categoria)::smallint AS cat_max
    FROM public.tarifas
    WHERE enabled IS NOT FALSE
    GROUP BY estacion_id
  ),
  scored AS (
    SELECT
      p.id,
      p.estacion_id,
      e.peaje_id,
      p.sentido,
      p.precio,
      p.tarifa_status,
      CASE
        WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
          THEN btrim(p.categoria)::smallint
        ELSE tn.categoria_calculated
      END AS cat_recibida,
      CASE
        WHEN CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END IS NULL THEN NULL
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
    LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
    WHERE p.tarifa_importe_id IS NULL
      AND p.tarifa_status IN ('PICO', 'NO_PICO')
  ),
  ident AS (
    SELECT
      s.id AS pasada_id,
      t.id AS tarifa_id,
      t.current_tarifa_id,
      count(*) OVER (PARTITION BY s.id) AS n_ident
    FROM scored s
    JOIN public.tarifas t
      ON t.estacion_id = s.estacion_id
     AND t.peaje_id = s.peaje_id
     AND t.status = s.tarifa_status
     AND t.categoria = s.cat_efectiva
     AND t.enabled IS NOT FALSE
     AND (
       (s.sentido = 'AMBAS' AND t.sentido = 'AMBAS')
       OR (s.sentido IN ('IDA', 'VUELTA') AND t.sentido IN (s.sentido, 'AMBAS'))
     )
    WHERE s.cat_efectiva IS NOT NULL
  ),
  uniq AS (
    SELECT pasada_id, tarifa_id, current_tarifa_id
    FROM ident
    WHERE n_ident = 1
  ),
  pct AS (
    SELECT
      u.pasada_id,
      ti.id AS ti_id,
      count(*) OVER (PARTITION BY u.pasada_id) AS n_pct
    FROM uniq u
    JOIN scored s ON s.id = u.pasada_id
    JOIN public.tarifa_importe ti ON ti.tarifa_id = u.tarifa_id
    WHERE ti.importe > 0
      AND abs(ti.importe - s.precio) / ti.importe <= 0.01
  ),
  pick AS (
    SELECT
      u.pasada_id,
      COALESCE(
        (
          SELECT p.ti_id
          FROM pct p
          WHERE p.pasada_id = u.pasada_id
            AND p.n_pct = 1
          LIMIT 1
        ),
        u.current_tarifa_id,
        (
          SELECT ti.id
          FROM public.tarifa_importe ti
          WHERE ti.tarifa_id = u.tarifa_id
          ORDER BY ti.fecha_aparicion DESC, ti.created_at DESC, ti.id DESC
          LIMIT 1
        )
      ) AS ti_id
    FROM uniq u
  )
  UPDATE public.pasadas p
  SET tarifa_importe_id = pick.ti_id
  FROM pick
  WHERE p.id = pick.pasada_id
    AND p.tarifa_importe_id IS NULL
    AND pick.ti_id IS NOT NULL;

  -- Pass 3: leftover AMBAS → unique IDA + unique 1% amount.
  WITH max_cat AS (
    SELECT estacion_id, max(categoria)::smallint AS cat_max
    FROM public.tarifas
    WHERE enabled IS NOT FALSE
    GROUP BY estacion_id
  ),
  scored AS (
    SELECT
      p.id,
      p.estacion_id,
      e.peaje_id,
      p.precio,
      p.tarifa_status,
      CASE
        WHEN CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END IS NULL THEN NULL
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
    LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
    WHERE p.tarifa_importe_id IS NULL
      AND p.sentido = 'AMBAS'
      AND p.tarifa_status IN ('PICO', 'NO_PICO')
  ),
  leftover AS (
    SELECT s.*
    FROM scored s
    WHERE s.cat_efectiva IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.tarifas t
        WHERE t.estacion_id = s.estacion_id
          AND t.peaje_id = s.peaje_id
          AND t.status = s.tarifa_status
          AND t.categoria = s.cat_efectiva
          AND t.enabled IS NOT FALSE
          AND t.sentido = 'AMBAS'
      )
  ),
  ident AS (
    SELECT
      s.id AS pasada_id,
      t.id AS tarifa_id,
      count(*) OVER (PARTITION BY s.id) AS n_ident
    FROM leftover s
    JOIN public.tarifas t
      ON t.estacion_id = s.estacion_id
     AND t.peaje_id = s.peaje_id
     AND t.status = s.tarifa_status
     AND t.categoria = s.cat_efectiva
     AND t.enabled IS NOT FALSE
     AND t.sentido = 'IDA'
  ),
  uniq AS (
    SELECT pasada_id, tarifa_id
    FROM ident
    WHERE n_ident = 1
  ),
  pct AS (
    SELECT
      u.pasada_id,
      ti.id AS ti_id,
      count(*) OVER (PARTITION BY u.pasada_id) AS n_pct
    FROM uniq u
    JOIN leftover s ON s.id = u.pasada_id
    JOIN public.tarifa_importe ti ON ti.tarifa_id = u.tarifa_id
    WHERE ti.importe > 0
      AND abs(ti.importe - s.precio) / ti.importe <= 0.01
  )
  UPDATE public.pasadas p
  SET tarifa_importe_id = pct.ti_id
  FROM pct
  WHERE p.id = pct.pasada_id
    AND p.tarifa_importe_id IS NULL
    AND pct.n_pct = 1;

  -- Pass 4: remaining PICO/NO_PICO → IDA historical REVISAR (no current promote).
  WITH max_cat AS (
    SELECT estacion_id, max(categoria)::smallint AS cat_max
    FROM public.tarifas
    WHERE enabled IS NOT FALSE
    GROUP BY estacion_id
  ),
  scored AS (
    SELECT
      p.id,
      p.estacion_id,
      e.peaje_id,
      p.precio,
      p.tarifa_status,
      p.fecha_hora,
      CASE
        WHEN CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END IS NULL THEN NULL
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
    LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
    WHERE p.tarifa_importe_id IS NULL
      AND p.sentido = 'AMBAS'
      AND p.tarifa_status IN ('PICO', 'NO_PICO')
  ),
  leftover AS (
    SELECT s.*
    FROM scored s
    WHERE s.cat_efectiva IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.tarifas t
        WHERE t.estacion_id = s.estacion_id
          AND t.peaje_id = s.peaje_id
          AND t.status = s.tarifa_status
          AND t.categoria = s.cat_efectiva
          AND t.enabled IS NOT FALSE
          AND t.sentido = 'AMBAS'
      )
  ),
  clusters AS (
    SELECT
      estacion_id,
      peaje_id,
      tarifa_status,
      cat_efectiva,
      precio,
      count(*)::integer AS n,
      min(fecha_hora) AS min_ts
    FROM leftover
    GROUP BY 1, 2, 3, 4, 5
  )
  INSERT INTO public.tarifas (
    peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion, enabled
  )
  SELECT
    c.peaje_id,
    c.estacion_id,
    c.tarifa_status,
    c.cat_efectiva,
    'IDA',
    min(c.min_ts),
    true
  FROM clusters c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.tarifas t
    WHERE t.peaje_id = c.peaje_id
      AND t.estacion_id = c.estacion_id
      AND t.status = c.tarifa_status
      AND t.categoria = c.cat_efectiva
      AND t.sentido = 'IDA'
  )
  GROUP BY c.peaje_id, c.estacion_id, c.tarifa_status, c.cat_efectiva;

  INSERT INTO public.tarifa_importe (
    tarifa_id, importe, cases, fecha_aparicion, diagnostico,
    no_coincide_con_tarifario, categoria_calculated
  )
  SELECT
    t.id,
    c.precio,
    c.n,
    c.min_ts,
    'REVISAR',
    true,
    c.cat_efectiva
  FROM (
    SELECT
      p.estacion_id,
      e.peaje_id,
      p.tarifa_status,
      CASE
        WHEN CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END IS NULL THEN NULL
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
      END AS cat_efectiva,
      p.precio,
      count(*)::integer AS n,
      min(p.fecha_hora) AS min_ts
    FROM public.pasadas p
    JOIN public.estaciones e ON e.id = p.estacion_id
    LEFT JOIN public.tarifas_normalizadas tn ON tn.id = p.tarifa_normalizada_id
    LEFT JOIN (
      SELECT estacion_id, max(categoria)::smallint AS cat_max
      FROM public.tarifas
      WHERE enabled IS NOT FALSE
      GROUP BY estacion_id
    ) m ON m.estacion_id = p.estacion_id
    WHERE p.tarifa_importe_id IS NULL
      AND p.sentido = 'AMBAS'
      AND p.tarifa_status IN ('PICO', 'NO_PICO')
      AND NOT EXISTS (
        SELECT 1
        FROM public.tarifas t0
        WHERE t0.estacion_id = p.estacion_id
          AND t0.peaje_id = e.peaje_id
          AND t0.status = p.tarifa_status
          AND t0.categoria = CASE
            WHEN CASE
              WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
                THEN btrim(p.categoria)::smallint
              ELSE tn.categoria_calculated
            END IS NULL THEN NULL
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
          END
          AND t0.enabled IS NOT FALSE
          AND t0.sentido = 'AMBAS'
      )
    GROUP BY 1, 2, 3, 4, 5
  ) c
  JOIN public.tarifas t
    ON t.peaje_id = c.peaje_id
   AND t.estacion_id = c.estacion_id
   AND t.status = c.tarifa_status
   AND t.categoria = c.cat_efectiva
   AND t.sentido = 'IDA'
  WHERE c.cat_efectiva IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.tarifa_importe ti
      WHERE ti.tarifa_id = t.id
        AND ti.importe > 0
        AND abs(ti.importe - c.precio) / ti.importe <= 0.01
    );

  WITH max_cat AS (
    SELECT estacion_id, max(categoria)::smallint AS cat_max
    FROM public.tarifas
    WHERE enabled IS NOT FALSE
    GROUP BY estacion_id
  ),
  scored AS (
    SELECT
      p.id,
      p.estacion_id,
      e.peaje_id,
      p.precio,
      p.tarifa_status,
      CASE
        WHEN CASE
          WHEN btrim(COALESCE(p.categoria, '')) ~ '^[0-9]+$'
            THEN btrim(p.categoria)::smallint
          ELSE tn.categoria_calculated
        END IS NULL THEN NULL
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
    LEFT JOIN max_cat m ON m.estacion_id = p.estacion_id
    WHERE p.tarifa_importe_id IS NULL
      AND p.sentido = 'AMBAS'
      AND p.tarifa_status IN ('PICO', 'NO_PICO')
  )
  UPDATE public.pasadas p
  SET tarifa_importe_id = x.ti_id
  FROM (
    SELECT DISTINCT ON (s.id)
      s.id AS pasada_id,
      ti.id AS ti_id
    FROM scored s
    JOIN public.tarifas t
      ON t.estacion_id = s.estacion_id
     AND t.peaje_id = s.peaje_id
     AND t.status = s.tarifa_status
     AND t.categoria = s.cat_efectiva
     AND t.sentido = 'IDA'
    JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
    WHERE s.cat_efectiva IS NOT NULL
      AND ti.importe > 0
      AND abs(ti.importe - s.precio) / ti.importe <= 0.01
    ORDER BY s.id, ti.created_at DESC, ti.id DESC
  ) x
  WHERE p.id = x.pasada_id
    AND p.tarifa_importe_id IS NULL;
END;
$$;

COMMENT ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe() IS
  'Backfill pasadas.tarifa_importe_id: linaje 1:1 (solo NULL), LEAST+status, IDA 1%, insert IDA REVISAR/no_coincide sin promocionar current. No toca tarifa_normalizada_id.';

REVOKE ALL ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_backfill_pasadas_tarifa_importe()
  TO authenticated, service_role;

CREATE OR REPLACE VIEW public.pwbi_pasadas
WITH (security_invoker = false)
AS
SELECT
  p.id AS "Pasada_ID",
  p.fecha_hora,
  p.pase_id AS "Pase_ID",
  p.patente_id AS "Patente_ID",
  p.estacion_id AS "Estacion_ID",
  p.documento_id AS "Documento_ID",
  e.peaje_id AS "Peaje_ID",
  pj.empresa_id AS "Empresa_ID",
  p.precio,
  p.bonificacion,
  p.quantity,
  p.importe_neto,
  p.categoria AS "Categoria",
  CASE
    WHEN p.categoria IS NULL THEN t.categoria
    ELSE NULL::smallint
  END AS "Categoria_Calculated",
  p.categoria IS NULL AND t.categoria IS NOT NULL
    AS "Categoria_Calculated_Boolean",
  p.tarifa_normalizada_id AS "Tarifa_Normalizada_ID",
  COALESCE(
    t.status,
    CASE
      WHEN p.tarifa_status IN ('PICO', 'NO_PICO') THEN p.tarifa_status
    END
  ) AS "Tarifa_Status",
  p.created_at,
  p.user_id,
  p.file_upload_name,
  e.nombre AS "Estacion_Nombre",
  e.estado_geocodificacion AS "Estacion_Geocodificacion_Status",
  e.latitud AS "Estacion_Latitud",
  e.longitud AS "Estacion_Longitud",
  pj.nombre AS "Peaje_Nombre",
  emp.nombre AS "Empresa_Nombre",
  pt.patente AS "Patente",
  pt.categoria AS "Patente_Categoria",
  pt.tipo_trabajo AS "Patente_Tipo_Trabajo",
  pt.activa AS "Patente_Activa",
  pa.pase AS "Pase",
  d.factura AS "Documento_Numero",
  d.tipo AS "Documento_Tipo",
  d.cuenta AS "Documento_Cuenta",
  d.fecha_factura,
  d.importe_sin_iva AS "Documento_Importe_Sin_Iva",
  d.importe_total AS "Documento_Importe_Total"
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.documentos d ON d.id = p.documento_id
LEFT JOIN public.tarifa_importe ti ON ti.id = p.tarifa_importe_id
LEFT JOIN public.tarifas t ON t.id = ti.tarifa_id;

COMMENT ON VIEW public.pwbi_pasadas IS
  'Power BI: hecho pasadas. Tarifa_Status = tarifas.status vía tarifa_importe_id, o pasadas.tarifa_status PICO/NO_PICO. security_invoker=false.';

REVOKE ALL ON public.pwbi_pasadas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pwbi_pasadas TO anon, authenticated, service_role;

SELECT public.peajes_backfill_pasadas_tarifa_importe();

NOTIFY pgrst, 'reload schema';
