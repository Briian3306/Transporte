-- F14-18 Task 3: shared direction/current/history helper + batch prepare/detect.
-- Rewrites F14-16 public matchers to use the helper. Signatures and result codes
-- of peajes_resolver_tarifas_actuales / peajes_validar_tarifas_actuales stay intact.
-- SQL never applies IVA arithmetic (/ 1.21).

-- -----------------------------------------------------------------------------
-- Helper: matching tarifas + tarifa_importe rows for a resolver context.
-- Direction: IDA/VUELTA exact first, then AMBAS. Requested AMBAS matches only AMBAS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._peajes_tarifas_montos_candidatos(
  p_estacion_id uuid,
  p_categoria smallint,
  p_sentido text,
  p_status text
)
RETURNS TABLE (
  tarifa_id uuid,
  peaje_id uuid,
  estacion_id uuid,
  status text,
  sentido text,
  dir_rank integer,
  requiere_normalizacion_iva boolean,
  current_tarifa_id uuid,
  tarifa_importe_id uuid,
  importe numeric,
  es_vigente boolean,
  fecha_aparicion timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.peaje_id,
    t.estacion_id,
    t.status,
    t.sentido,
    CASE
      WHEN t.sentido = p_sentido THEN 0
      WHEN t.sentido = 'AMBAS' THEN 1
      ELSE 2
    END,
    t.requiere_normalizacion_iva,
    t.current_tarifa_id,
    ti.id,
    ti.importe,
    (ti.id IS NOT DISTINCT FROM t.current_tarifa_id),
    ti.fecha_aparicion,
    ti.created_at
  FROM public.estaciones e
  INNER JOIN public.tarifas t
    ON t.peaje_id = e.peaje_id
   AND t.estacion_id = e.id
   AND t.categoria = p_categoria
   AND (
     (p_sentido = 'AMBAS' AND t.sentido = 'AMBAS')
     OR (p_sentido IN ('IDA', 'VUELTA') AND t.sentido IN (p_sentido, 'AMBAS'))
   )
   AND (
     p_status IS NULL
     OR p_status NOT IN ('PICO', 'NO_PICO')
     OR t.status = p_status
   )
  LEFT JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  WHERE e.id = p_estacion_id;
$$;

COMMENT ON FUNCTION public._peajes_tarifas_montos_candidatos(uuid, smallint, text, text) IS
  'F14-18 · Relación privada de identidades y montos (vigente + historial) con precedencia de sentido. No aplica IVA.';

REVOKE ALL ON FUNCTION public._peajes_tarifas_montos_candidatos(uuid, smallint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_tarifas_montos_candidatos(uuid, smallint, text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- F14-16 resolver rewritten onto the helper. Public signature unchanged.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_resolver_tarifas_actuales(
  p_pasadas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'p_pasadas debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_pasadas) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH input AS (
    SELECT
      t.ord,
      COALESCE((t.elem->>'idx')::integer, (t.ord - 1)::integer) AS idx,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      CASE
        WHEN t.elem->'categoria' IS NULL
          OR jsonb_typeof(t.elem->'categoria') = 'null' THEN NULL
        WHEN jsonb_typeof(t.elem->'categoria') = 'number'
          AND (t.elem->>'categoria') ~ '^[0-9]+(\.0+)?$'
          THEN trunc((t.elem->>'categoria')::numeric)::smallint
        WHEN jsonb_typeof(t.elem->'categoria') = 'string'
          AND btrim(t.elem->>'categoria') ~ '^[0-9]+$'
          THEN btrim(t.elem->>'categoria')::smallint
        ELSE NULL
      END AS categoria,
      NULLIF(upper(btrim(t.elem->>'status')), '') AS status_in,
      COALESCE(NULLIF(upper(btrim(t.elem->>'sentido')), ''), 'AMBAS') AS sentido
    FROM jsonb_array_elements(p_pasadas) WITH ORDINALITY AS t(elem, ord)
  ),
  with_peaje AS (
    SELECT
      i.*,
      e.peaje_id,
      CASE
        WHEN i.categoria IS NULL THEN 'CATEGORIA_PENDIENTE'
        WHEN e.peaje_id IS NULL THEN 'SIN_TARIFA'
        ELSE NULL
      END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
  ),
  dir_candidates AS (
    SELECT DISTINCT ON (p.ord, c.tarifa_id)
      p.ord,
      c.tarifa_id,
      c.status,
      c.sentido,
      c.current_tarifa_id,
      c.requiere_normalizacion_iva,
      c.dir_rank
    FROM with_peaje p
    INNER JOIN LATERAL public._peajes_tarifas_montos_candidatos(
      p.estacion_id,
      p.categoria,
      p.sentido,
      NULL
    ) c ON TRUE
    WHERE p.early_codigo IS NULL
    ORDER BY p.ord, c.tarifa_id
  ),
  status_counts AS (
    SELECT
      ord,
      count(DISTINCT status)::integer AS n_status,
      min(status) AS only_status
    FROM dir_candidates
    GROUP BY ord
  ),
  status_resolved AS (
    SELECT
      p.ord,
      p.idx,
      p.peaje_id,
      CASE
        WHEN p.status_in IN ('PICO', 'NO_PICO') THEN p.status_in
        ELSE sc.only_status
      END AS status_res,
      CASE
        WHEN p.early_codigo IS NOT NULL THEN p.early_codigo
        WHEN p.status_in IN ('PICO', 'NO_PICO') THEN NULL
        WHEN COALESCE(sc.n_status, 0) > 1 THEN 'ESTADO_AMBIGUO'
        ELSE NULL
      END AS codigo_mid
    FROM with_peaje p
    LEFT JOIN status_counts sc ON sc.ord = p.ord
  ),
  picked AS (
    SELECT DISTINCT ON (sr.ord)
      sr.ord,
      sr.idx,
      sr.peaje_id,
      sr.codigo_mid,
      dc.tarifa_id,
      dc.sentido AS sentido_aplicado,
      dc.current_tarifa_id,
      dc.requiere_normalizacion_iva
    FROM status_resolved sr
    LEFT JOIN dir_candidates dc
      ON dc.ord = sr.ord
     AND sr.codigo_mid IS NULL
     AND dc.status = sr.status_res
    ORDER BY sr.ord, dc.dir_rank NULLS LAST, dc.tarifa_id
  ),
  with_importe AS (
    SELECT
      p.ord,
      p.idx,
      p.peaje_id,
      p.codigo_mid,
      p.tarifa_id,
      p.sentido_aplicado,
      p.current_tarifa_id,
      p.requiere_normalizacion_iva,
      ti.importe
    FROM picked p
    LEFT JOIN public.tarifa_importe ti ON ti.id = p.current_tarifa_id
  )
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN w.codigo_mid IS NOT NULL THEN
          jsonb_build_object(
            'idx', w.idx,
            'codigo', w.codigo_mid
          )
        WHEN w.tarifa_id IS NULL THEN
          jsonb_build_object(
            'idx', w.idx,
            'codigo', 'SIN_TARIFA'
          )
        ELSE
          jsonb_build_object(
            'idx', w.idx,
            'tarifa_id', w.tarifa_id,
            'current_tarifa_id', w.current_tarifa_id,
            'importe', w.importe,
            'peaje_id', w.peaje_id,
            'sentido_aplicado', w.sentido_aplicado,
            'requiere_normalizacion_iva', w.requiere_normalizacion_iva
          )
      END
      ORDER BY w.ord
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM with_importe w;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- F14-16 validator rewritten so history matching uses the helper.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_validar_tarifas_actuales(
  p_pasadas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'p_pasadas debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_pasadas) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH input AS (
    SELECT
      t.ord,
      COALESCE((t.elem->>'idx')::integer, (t.ord - 1)::integer) AS idx,
      NULLIF(btrim(t.elem->>'tarifa_id'), '')::uuid AS tarifa_id,
      NULLIF(btrim(t.elem->>'current_tarifa_id'), '')::uuid AS current_tarifa_id,
      (t.elem->>'importe')::numeric AS importe,
      COALESCE((t.elem->>'requiere_normalizacion_iva')::boolean, false)
        AS requiere_normalizacion_iva,
      (t.elem->>'precio_directo')::numeric AS precio_directo,
      (t.elem->>'precio_normalizado')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_pasadas) WITH ORDINALITY AS t(elem, ord)
  ),
  compared AS (
    SELECT
      i.*,
      CASE
        WHEN i.requiere_normalizacion_iva THEN i.precio_normalizado
        ELSE i.precio_directo
      END AS precio_comparado
    FROM input i
  ),
  current_match AS (
    SELECT
      c.*,
      CASE
        WHEN c.importe IS NOT NULL
          AND c.importe <> 0
          AND c.precio_comparado IS NOT NULL
          AND abs(c.precio_comparado - c.importe) / c.importe <= 0.01
        THEN true
        ELSE false
      END AS is_al_dia,
      CASE
        WHEN c.importe IS NOT NULL
          AND c.importe <> 0
          AND c.precio_comparado IS NOT NULL
        THEN abs(c.precio_comparado - c.importe) / c.importe
        ELSE NULL
      END AS error_relativo
    FROM compared c
  ),
  hist_match AS (
    SELECT DISTINCT ON (cm.ord)
      cm.ord,
      c.tarifa_importe_id AS hist_id
    FROM current_match cm
    INNER JOIN public.tarifas t ON t.id = cm.tarifa_id
    INNER JOIN LATERAL public._peajes_tarifas_montos_candidatos(
      t.estacion_id,
      t.categoria,
      t.sentido,
      t.status
    ) c ON c.tarifa_id = cm.tarifa_id
    WHERE NOT cm.is_al_dia
      AND c.es_vigente IS NOT TRUE
      AND cm.precio_comparado IS NOT NULL
      AND c.importe IS NOT NULL
      AND c.importe <> 0
      AND abs(cm.precio_comparado - c.importe) / c.importe <= 0.01
    ORDER BY cm.ord, c.fecha_aparicion DESC, c.created_at DESC, c.tarifa_importe_id DESC
  )
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN cm.is_al_dia THEN
          jsonb_build_object(
            'idx', cm.idx,
            'codigo', 'AL_DIA',
            'tarifa_importe_id', cm.current_tarifa_id,
            'importe', cm.importe,
            'precio_comparado', cm.precio_comparado,
            'error_relativo', cm.error_relativo
          )
        WHEN h.hist_id IS NOT NULL THEN
          jsonb_build_object(
            'idx', cm.idx,
            'codigo', 'HISTORICA',
            'tarifa_importe_id', h.hist_id,
            'importe', cm.importe,
            'precio_comparado', cm.precio_comparado,
            'error_relativo', cm.error_relativo
          )
        ELSE
          jsonb_build_object(
            'idx', cm.idx,
            'codigo', 'DESFASADO',
            'importe', cm.importe,
            'precio_comparado', cm.precio_comparado,
            'error_relativo', cm.error_relativo
          )
      END
      ORDER BY cm.ord
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM current_match cm
  LEFT JOIN hist_match h ON h.ord = cm.ord;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- peajes_preparar_refresco_tarifas — identities + IVA flags, no price compare.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_preparar_refresco_tarifas(
  p_candidatos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_candidatos) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH input AS (
    SELECT
      t.ord,
      COALESCE(NULLIF(btrim(t.elem->>'id'), ''), (t.ord - 1)::text) AS id,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      CASE
        WHEN t.elem->'categoria' IS NULL
          OR jsonb_typeof(t.elem->'categoria') = 'null' THEN NULL
        WHEN jsonb_typeof(t.elem->'categoria') = 'number'
          AND (t.elem->>'categoria') ~ '^[0-9]+(\.0+)?$'
          THEN trunc((t.elem->>'categoria')::numeric)::smallint
        WHEN jsonb_typeof(t.elem->'categoria') = 'string'
          AND btrim(t.elem->>'categoria') ~ '^[0-9]+$'
          THEN btrim(t.elem->>'categoria')::smallint
        ELSE NULL
      END AS categoria,
      COALESCE(NULLIF(upper(btrim(t.elem->>'sentido_solicitado')), ''), 'AMBAS') AS sentido
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  configs AS (
    SELECT DISTINCT ON (i.ord, c.tarifa_id)
      i.ord,
      i.id,
      c.peaje_id,
      c.estacion_id,
      i.categoria,
      c.status,
      c.sentido,
      c.tarifa_id,
      c.requiere_normalizacion_iva,
      c.current_tarifa_id,
      c.dir_rank
    FROM input i
    INNER JOIN LATERAL public._peajes_tarifas_montos_candidatos(
      i.estacion_id,
      i.categoria,
      i.sentido,
      NULL
    ) c ON TRUE
    WHERE i.categoria IS NOT NULL
      AND i.estacion_id IS NOT NULL
    ORDER BY i.ord, c.tarifa_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cfg.id,
        'peaje_id', cfg.peaje_id,
        'estacion_id', cfg.estacion_id,
        'categoria', cfg.categoria,
        'status', cfg.status,
        'sentido', cfg.sentido,
        'tarifa_id', cfg.tarifa_id,
        'importe', ti.importe,
        'requiere_normalizacion_iva', cfg.requiere_normalizacion_iva
      )
      ORDER BY cfg.ord, cfg.status, cfg.dir_rank, cfg.tarifa_id
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM configs cfg
  LEFT JOIN public.tarifa_importe ti ON ti.id = cfg.current_tarifa_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) IS
  'F14-18 · Devuelve identidades PICO/NO_PICO elegibles y su flag IVA. No compara importes.';

REVOKE ALL ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- peajes_detectar_refresco_tarifas — current before history, inclusive 1%.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_detectar_refresco_tarifas(
  p_candidatos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_candidatos) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH input AS (
    SELECT
      t.ord,
      COALESCE(NULLIF(btrim(t.elem->>'id'), ''), (t.ord - 1)::text) AS id,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      CASE
        WHEN t.elem->'categoria' IS NULL
          OR jsonb_typeof(t.elem->'categoria') = 'null' THEN NULL
        WHEN jsonb_typeof(t.elem->'categoria') = 'number'
          AND (t.elem->>'categoria') ~ '^[0-9]+(\.0+)?$'
          THEN trunc((t.elem->>'categoria')::numeric)::smallint
        WHEN jsonb_typeof(t.elem->'categoria') = 'string'
          AND btrim(t.elem->>'categoria') ~ '^[0-9]+$'
          THEN btrim(t.elem->>'categoria')::smallint
        ELSE NULL
      END AS categoria,
      NULLIF(upper(btrim(t.elem->>'status_solicitado')), '') AS status_in,
      COALESCE(NULLIF(upper(btrim(t.elem->>'sentido_solicitado')), ''), 'AMBAS') AS sentido,
      (t.elem->>'precio_directo')::numeric AS precio_directo,
      (t.elem->>'precio_normalizado')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  with_peaje AS (
    SELECT
      i.*,
      e.peaje_id,
      CASE
        WHEN i.categoria IS NULL OR e.peaje_id IS NULL THEN 'CONTEXT_INCOMPLETE'
        ELSE NULL
      END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
  ),
  montos AS (
    SELECT
      p.ord,
      p.id,
      p.peaje_id,
      p.estacion_id,
      p.categoria,
      p.status_in,
      p.sentido AS sentido_solicitado,
      p.early_codigo,
      c.tarifa_id,
      c.status,
      c.sentido,
      c.dir_rank,
      c.requiere_normalizacion_iva,
      c.current_tarifa_id,
      c.tarifa_importe_id,
      c.importe,
      c.es_vigente,
      c.fecha_aparicion,
      c.created_at,
      CASE
        WHEN c.requiere_normalizacion_iva THEN p.precio_normalizado
        ELSE p.precio_directo
      END AS precio_comparado
    FROM with_peaje p
    LEFT JOIN LATERAL public._peajes_tarifas_montos_candidatos(
      p.estacion_id,
      p.categoria,
      p.sentido,
      CASE WHEN p.status_in IN ('PICO', 'NO_PICO') THEN p.status_in ELSE NULL END
    ) c ON p.early_codigo IS NULL
  ),
  hits AS (
    SELECT m.*
    FROM montos m
    WHERE m.early_codigo IS NULL
      AND m.importe IS NOT NULL
      AND m.importe <> 0
      AND m.precio_comparado IS NOT NULL
      AND abs(m.precio_comparado - m.importe) / m.importe <= 0.01
  ),
  status_hit_counts AS (
    SELECT
      ord,
      count(DISTINCT status)::integer AS n_status,
      min(status) AS only_status
    FROM hits
    GROUP BY ord
  ),
  current_pick AS (
    SELECT DISTINCT ON (h.ord)
      h.ord,
      h.tarifa_id,
      h.status,
      h.sentido,
      h.dir_rank,
      h.requiere_normalizacion_iva,
      h.current_tarifa_id,
      h.tarifa_importe_id,
      h.importe
    FROM hits h
    WHERE h.es_vigente IS TRUE
    ORDER BY h.ord, h.dir_rank, h.tarifa_id
  ),
  hist_pick AS (
    SELECT DISTINCT ON (h.ord)
      h.ord,
      h.tarifa_id,
      h.status,
      h.sentido,
      h.dir_rank,
      h.requiere_normalizacion_iva,
      h.current_tarifa_id,
      h.tarifa_importe_id,
      h.importe
    FROM hits h
    WHERE h.es_vigente IS NOT TRUE
    ORDER BY h.ord, h.dir_rank, h.fecha_aparicion DESC, h.created_at DESC, h.tarifa_importe_id DESC
  ),
  decided AS (
    SELECT
      p.ord,
      p.id,
      p.peaje_id,
      p.estacion_id,
      p.categoria,
      p.status_in,
      p.sentido AS sentido_solicitado,
      p.early_codigo,
      sh.n_status,
      sh.only_status,
      cp.tarifa_id AS cur_tarifa_id,
      cp.status AS cur_status,
      cp.sentido AS cur_sentido,
      cp.requiere_normalizacion_iva AS cur_iva,
      cp.tarifa_importe_id AS cur_ti,
      cp.importe AS cur_importe,
      hp.tarifa_id AS hist_tarifa_id,
      hp.status AS hist_status,
      hp.sentido AS hist_sentido,
      hp.requiere_normalizacion_iva AS hist_iva,
      hp.tarifa_importe_id AS hist_ti,
      hp.importe AS hist_importe
    FROM with_peaje p
    LEFT JOIN status_hit_counts sh ON sh.ord = p.ord
    LEFT JOIN current_pick cp ON cp.ord = p.ord
    LEFT JOIN hist_pick hp ON hp.ord = p.ord
  )
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN d.early_codigo IS NOT NULL THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', 'CONTEXT_INCOMPLETE',
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'sentido_solicitado', d.sentido_solicitado
          )
        WHEN d.status_in IS NULL OR d.status_in NOT IN ('PICO', 'NO_PICO') THEN
          CASE
            WHEN COALESCE(d.n_status, 0) > 1 THEN
              jsonb_build_object(
                'id', d.id,
                'codigo', 'STATUS_AMBIGUOUS',
                'peaje_id', d.peaje_id,
                'estacion_id', d.estacion_id,
                'categoria', d.categoria,
                'sentido_solicitado', d.sentido_solicitado,
                'candidatos_status', (
                  SELECT COALESCE(jsonb_agg(q.s ORDER BY q.s), '[]'::jsonb)
                  FROM (
                    SELECT DISTINCT h.status AS s
                    FROM hits h
                    WHERE h.ord = d.ord
                  ) q
                )
              )
            WHEN COALESCE(d.n_status, 0) = 1 AND d.cur_tarifa_id IS NOT NULL THEN
              jsonb_build_object(
                'id', d.id,
                'codigo', 'CURRENT_TARIFF',
                'peaje_id', d.peaje_id,
                'estacion_id', d.estacion_id,
                'categoria', d.categoria,
                'status', d.cur_status,
                'sentido_solicitado', d.sentido_solicitado,
                'sentido_aplicado', d.cur_sentido,
                'importe_actual', d.cur_importe,
                'tarifa_id', d.cur_tarifa_id,
                'tarifa_importe_id', d.cur_ti,
                'requiere_normalizacion_iva', d.cur_iva
              )
            WHEN COALESCE(d.n_status, 0) = 1 AND d.hist_tarifa_id IS NOT NULL THEN
              jsonb_build_object(
                'id', d.id,
                'codigo', 'HISTORICAL_TARIFF_MATCH',
                'peaje_id', d.peaje_id,
                'estacion_id', d.estacion_id,
                'categoria', d.categoria,
                'status', d.hist_status,
                'sentido_solicitado', d.sentido_solicitado,
                'sentido_aplicado', d.hist_sentido,
                'importe_actual', d.hist_importe,
                'tarifa_id', d.hist_tarifa_id,
                'tarifa_importe_id', d.hist_ti,
                'requiere_normalizacion_iva', d.hist_iva
              )
            ELSE
              jsonb_build_object(
                'id', d.id,
                'codigo', 'STATUS_REQUIRED',
                'peaje_id', d.peaje_id,
                'estacion_id', d.estacion_id,
                'categoria', d.categoria,
                'sentido_solicitado', d.sentido_solicitado
              )
          END
        WHEN d.cur_tarifa_id IS NOT NULL THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', 'CURRENT_TARIFF',
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'status', d.cur_status,
            'sentido_solicitado', d.sentido_solicitado,
            'sentido_aplicado', d.cur_sentido,
            'importe_actual', d.cur_importe,
            'tarifa_id', d.cur_tarifa_id,
            'tarifa_importe_id', d.cur_ti,
            'requiere_normalizacion_iva', d.cur_iva
          )
        WHEN d.hist_tarifa_id IS NOT NULL THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', 'HISTORICAL_TARIFF_MATCH',
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'status', d.hist_status,
            'sentido_solicitado', d.sentido_solicitado,
            'sentido_aplicado', d.hist_sentido,
            'importe_actual', d.hist_importe,
            'tarifa_id', d.hist_tarifa_id,
            'tarifa_importe_id', d.hist_ti,
            'requiere_normalizacion_iva', d.hist_iva
          )
        ELSE
          jsonb_build_object(
            'id', d.id,
            'codigo', 'NEW_TARIFF',
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'status', d.status_in,
            'sentido_solicitado', d.sentido_solicitado
          )
      END
      ORDER BY d.ord
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM decided d;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) IS
  'F14-18 · Clasifica candidatos contra vigente e historial con tolerancia inclusiva 1%. Elige precio_normalizado solo si el flag IVA es true.';

REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- peajes_guardar_refresco_tarifas — one transaction, immutable append.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_guardar_refresco_tarifas(
  p_cambios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_ord integer;
  v_peaje uuid;
  v_estacion uuid;
  v_sentido text;
  v_categoria smallint;
  v_status text;
  v_importe numeric;
  v_iva boolean;
  v_iva_present boolean;
  v_key text;
  v_keys text[] := '{}';
  v_est_peaje uuid;
  v_tarifa_id uuid;
  v_current_id uuid;
  v_current_importe numeric;
  v_flag boolean;
  v_was_new boolean;
  v_accion text;
  v_new_ti uuid;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un arreglo JSON';
  END IF;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    BEGIN
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'p_cambios contiene UUID invalido';
    END;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    BEGIN
      v_categoria := (v_elem->>'categoria')::smallint;
      v_importe := (COALESCE(v_elem->>'importe', ''))::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos';
    END;
    v_iva_present := COALESCE(
      jsonb_typeof(
        COALESCE(v_elem->'requiere_normalizacion_iva', v_elem->'requiereNormalizacionIva')
      ) = 'boolean',
      false
    );
    v_iva := COALESCE(
      (v_elem->>'requiere_normalizacion_iva')::boolean,
      (v_elem->>'requiereNormalizacionIva')::boolean
    );

    IF v_peaje IS NULL OR v_estacion IS NULL OR v_categoria IS NULL OR v_importe IS NULL THEN
      RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos';
    END IF;
    IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
      RAISE EXCEPTION 'sentido invalido: %', COALESCE(v_elem->>'sentido', '');
    END IF;
    IF v_status NOT IN ('PICO', 'NO_PICO') THEN
      RAISE EXCEPTION 'status invalido: %', COALESCE(v_elem->>'status', '');
    END IF;
    IF v_categoria < 0 OR v_categoria > 10 THEN
      RAISE EXCEPTION 'categoria invalida: %', v_elem->>'categoria';
    END IF;
    IF v_importe <= 0 THEN
      RAISE EXCEPTION 'importe debe ser > 0';
    END IF;

    v_key := v_peaje::text || '|' || v_estacion::text || '|' || v_sentido || '|'
      || v_categoria::text || '|' || v_status;
    IF v_key = ANY (v_keys) THEN
      RAISE EXCEPTION 'p_cambios contiene celdas duplicadas';
    END IF;
    v_keys := array_append(v_keys, v_key);

    SELECT e.peaje_id INTO v_est_peaje
    FROM public.estaciones e
    WHERE e.id = v_estacion;
    IF v_est_peaje IS NULL OR v_est_peaje IS DISTINCT FROM v_peaje THEN
      RAISE EXCEPTION 'la estacion no pertenece al peaje indicado';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.tarifas t
      WHERE t.peaje_id = v_peaje
        AND t.estacion_id = v_estacion
        AND t.sentido = v_sentido
        AND t.categoria = v_categoria
        AND t.status = v_status
    ) AND v_iva_present IS NOT TRUE THEN
      RAISE EXCEPTION 'requiere_normalizacion_iva es obligatorio para una identidad nueva';
    END IF;
  END LOOP;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
    v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    v_categoria := (v_elem->>'categoria')::smallint;
    v_importe := (v_elem->>'importe')::numeric;
    v_iva_present := COALESCE(
      jsonb_typeof(
        COALESCE(v_elem->'requiere_normalizacion_iva', v_elem->'requiereNormalizacionIva')
      ) = 'boolean',
      false
    );
    v_iva := COALESCE(
      (v_elem->>'requiere_normalizacion_iva')::boolean,
      (v_elem->>'requiereNormalizacionIva')::boolean
    );

    v_tarifa_id := NULL;
    v_current_id := NULL;
    v_flag := NULL;
    v_new_ti := NULL;
    v_current_importe := NULL;

    SELECT t.id, t.current_tarifa_id, t.requiere_normalizacion_iva
    INTO v_tarifa_id, v_current_id, v_flag
    FROM public.tarifas t
    WHERE t.peaje_id = v_peaje
      AND t.estacion_id = v_estacion
      AND t.sentido = v_sentido
      AND t.categoria = v_categoria
      AND t.status = v_status
    FOR UPDATE;

    v_was_new := v_tarifa_id IS NULL;
    IF v_was_new THEN
      IF v_iva_present IS NOT TRUE THEN
        RAISE EXCEPTION 'requiere_normalizacion_iva es obligatorio para una identidad nueva';
      END IF;
      INSERT INTO public.tarifas (
        peaje_id, estacion_id, status, categoria, sentido,
        requiere_normalizacion_iva, current_tarifa_id, fecha_actualizacion
      ) VALUES (
        v_peaje, v_estacion, v_status, v_categoria, v_sentido,
        v_iva, NULL, now()
      )
      RETURNING id INTO v_tarifa_id;
      v_current_id := NULL;
    END IF;

    v_current_importe := NULL;
    IF v_current_id IS NOT NULL THEN
      SELECT ti.importe INTO v_current_importe
      FROM public.tarifa_importe ti
      WHERE ti.id = v_current_id;
    END IF;

    IF v_current_importe IS NOT NULL AND v_current_importe = v_importe THEN
      v_accion := 'SIN_CAMBIO';
      v_new_ti := NULL;
    ELSE
      INSERT INTO public.tarifa_importe (tarifa_id, importe, fecha_aparicion)
      VALUES (v_tarifa_id, v_importe, now())
      RETURNING id INTO v_new_ti;
      v_accion := CASE WHEN v_was_new THEN 'IDENTIDAD_CREADA' ELSE 'ACTUALIZADA' END;
    END IF;

    -- jsonb_build_object omits SQL NULL; keep explicit JSON nulls for anterior / tarifa_importe_id.
    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object(
        'peaje_id', v_peaje,
        'estacion_id', v_estacion,
        'sentido', v_sentido,
        'categoria', v_categoria,
        'status', v_status,
        'tarifa_id', v_tarifa_id,
        'nueva', v_importe,
        'accion', v_accion
      ) || jsonb_build_object(
        'anterior', to_jsonb(v_current_importe),
        'tarifa_importe_id', to_jsonb(v_new_ti)
      )
    );
  END LOOP;

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) IS
  'F14-18 · Append transaccional de tarifa_importe / alta de identidad. fecha_aparicion = now(). No muta historial ni el flag IVA existente.';

REVOKE ALL ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Additive: persist pasadas.sentido from confirmar payload (default AMBAS).
-- Public signature of peajes_confirmar_carga is unchanged.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_confirmar_carga(
  p_factura jsonb,
  p_pasadas jsonb,
  p_plantilla_id uuid DEFAULT NULL,
  p_parametros_efectivos jsonb DEFAULT '{}'::jsonb,
  p_algoritmos_efectivos jsonb DEFAULT '[]'::jsonb,
  p_errores jsonb DEFAULT '[]'::jsonb,
  p_nombre_archivo text DEFAULT NULL,
  p_tolerancia numeric DEFAULT NULL,
  p_permitir_duplicados boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_documento_id uuid;
  v_pasada jsonb;
  v_pasada_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_precio numeric;
  v_bonif numeric;
  v_neto numeric;
  v_importes numeric[] := ARRAY[]::numeric[];
  v_validacion jsonb;
  v_dups jsonb;
  v_registro_id uuid;
  v_filas integer;
  v_rechazadas integer;
  v_user_id uuid := auth.uid();
  v_cuenta text := NULLIF(trim(COALESCE(p_factura->>'cuenta', '')), '');
  v_subtotal numeric;
  v_percepciones numeric;
  v_iva numeric;
  v_total numeric;
  v_bonificacion_doc numeric;
  v_tipo text := upper(COALESCE(NULLIF(trim(p_factura->>'tipo'), ''), 'FC'));
  v_categoria text;
  v_sentido text;
  v_idx integer := 0;
  v_err jsonb;
  v_bloqueantes jsonb := '[]'::jsonb;
  v_permitidos jsonb := '[]'::jsonb;
  v_dup_filas integer[] := ARRAY[]::integer[];
  v_es_dup boolean;
  v_params jsonb;
BEGIN
  IF p_factura IS NULL THEN
    RAISE EXCEPTION 'documento es obligatorio (RN-12)';
  END IF;
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'pasadas debe ser un arreglo JSON';
  END IF;
  IF v_tipo NOT IN ('FC', 'NC') THEN
    RAISE EXCEPTION 'tipo de documento inválido: % (use FC o NC)', v_tipo;
  END IF;

  v_subtotal := round((p_factura->>'importe_sin_iva')::numeric, 2);
  v_percepciones := round(COALESCE(NULLIF(p_factura->>'percepciones', '')::numeric, 0), 2);
  v_iva := round(COALESCE(NULLIF(p_factura->>'iva', '')::numeric, 0), 2);
  v_total := round((p_factura->>'importe_total')::numeric, 2);
  v_bonificacion_doc := round(COALESCE(NULLIF(p_factura->>'bonificacion', '')::numeric, 0), 2);

  IF v_subtotal IS NULL OR v_percepciones IS NULL OR v_iva IS NULL OR v_total IS NULL OR v_bonificacion_doc IS NULL THEN
    RAISE EXCEPTION 'Los importes declarados del documento deben ser numéricos';
  END IF;

  IF v_tipo = 'NC' THEN
    v_subtotal := -abs(v_subtotal);
    v_percepciones := -abs(v_percepciones);
    v_iva := -abs(v_iva);
    v_total := -abs(v_total);
    v_bonificacion_doc := CASE WHEN v_bonificacion_doc = 0 THEN 0 ELSE -abs(v_bonificacion_doc) END;
  ELSE
    v_subtotal := abs(v_subtotal);
    v_percepciones := abs(v_percepciones);
    v_iva := abs(v_iva);
    v_total := abs(v_total);
    v_bonificacion_doc := abs(v_bonificacion_doc);
  END IF;

  v_filas := coalesce(jsonb_array_length(p_pasadas), 0);
  v_rechazadas := coalesce(jsonb_array_length(COALESCE(p_errores, '[]'::jsonb)), 0);

  v_dups := public.peajes_detectar_duplicados(p_pasadas);
  FOR v_err IN SELECT value FROM jsonb_array_elements(COALESCE(v_dups, '[]'::jsonb))
  LOOP
    IF COALESCE((v_err->>'duplicado')::boolean, false) THEN
      v_permitidos := v_permitidos || jsonb_build_array(v_err);
      v_dup_filas := array_append(v_dup_filas, (v_err->>'fila')::integer);
    ELSE
      v_bloqueantes := v_bloqueantes || jsonb_build_array(v_err);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_bloqueantes) > 0 THEN
    RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups;
  END IF;
  IF jsonb_array_length(v_permitidos) > 0 AND NOT COALESCE(p_permitir_duplicados, false) THEN
    RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups;
  END IF;

  v_documento_id := NULLIF(COALESCE(p_factura->>'id', p_factura->>'documento_id'), '')::uuid;
  IF v_documento_id IS NULL THEN
    INSERT INTO public.documentos (
      factura, cuenta, empresa_id, fecha_factura, tipo,
      importe_sin_iva, percepciones, iva, importe_total, bonificacion
    ) VALUES (
      p_factura->>'factura', v_cuenta, p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date, v_tipo,
      v_subtotal, v_percepciones, v_iva, v_total, v_bonificacion_doc
    ) RETURNING id INTO v_documento_id;
  ELSE
    UPDATE public.documentos
    SET factura = COALESCE(p_factura->>'factura', factura),
        cuenta = CASE WHEN p_factura ? 'cuenta' THEN v_cuenta ELSE cuenta END,
        fecha_factura = COALESCE((p_factura->>'fecha_factura')::date, fecha_factura),
        tipo = v_tipo,
        importe_sin_iva = v_subtotal,
        percepciones = v_percepciones,
        iva = v_iva,
        importe_total = v_total,
        bonificacion = v_bonificacion_doc
    WHERE id = v_documento_id;
  END IF;

  FOR v_pasada IN SELECT value FROM jsonb_array_elements(p_pasadas)
  LOOP
    v_idx := v_idx + 1;
    v_es_dup := v_idx = ANY (v_dup_filas);
    v_precio := (v_pasada->>'precio')::numeric;
    v_bonif := COALESCE((v_pasada->>'bonificacion')::numeric, 0);
    IF v_tipo = 'NC' THEN
      v_precio := -abs(v_precio);
      v_bonif := CASE WHEN v_bonif = 0 THEN 0 ELSE -abs(v_bonif) END;
    ELSE
      v_precio := abs(v_precio);
      v_bonif := abs(v_bonif);
    END IF;
    v_neto := COALESCE(
      NULLIF(v_pasada->>'importe_neto', '')::numeric,
      public.peajes_calcular_importe_neto(v_precio, v_bonif)
    );
    IF v_tipo = 'NC' THEN
      v_neto := -abs(v_neto);
    ELSE
      v_neto := abs(v_neto);
    END IF;

    v_categoria := NULLIF(btrim(COALESCE(v_pasada->>'categoria', '')), '');
    v_sentido := upper(btrim(COALESCE(v_pasada->>'sentido', '')));
    IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
      v_sentido := 'AMBAS';
    END IF;

    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, documento_id,
      precio, bonificacion, quantity, importe_neto, user_id, file_upload_name,
      categoria, duplicado, sentido
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz,
      (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid,
      (v_pasada->>'estacion_id')::uuid,
      v_documento_id,
      v_precio, v_bonif,
      COALESCE((v_pasada->>'quantity')::integer, 1),
      v_neto, v_user_id, p_nombre_archivo,
      v_categoria,
      v_es_dup,
      v_sentido
    ) RETURNING id INTO v_id;
    v_pasada_ids := array_append(v_pasada_ids, v_id);
    v_importes := array_append(v_importes, v_neto);
  END LOOP;

  v_validacion := public.peajes_validar_factura_pasadas(v_subtotal, v_importes, p_tolerancia, v_bonificacion_doc);
  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación de subtotal falló (RN-17): %', v_validacion;
  END IF;

  v_params := COALESCE(p_parametros_efectivos, '{}'::jsonb);
  IF COALESCE(p_permitir_duplicados, false) AND jsonb_array_length(v_permitidos) > 0 THEN
    v_params := v_params || jsonb_build_object(
      'duplicados_permitidos', jsonb_array_length(v_permitidos),
      'duplicados_detectados', v_permitidos
    );
  END IF;

  INSERT INTO public.registros_carga_peajes (
    plantilla_id, documento_id, parametros_efectivos, algoritmos_efectivos,
    filas_procesadas, filas_validas, filas_rechazadas, errores, nombre_archivo, user_id
  ) VALUES (
    p_plantilla_id, v_documento_id, v_params,
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb), v_filas + v_rechazadas, v_filas,
    v_rechazadas, COALESCE(p_errores, '[]'::jsonb), p_nombre_archivo, v_user_id
  ) RETURNING id INTO v_registro_id;

  BEGIN
    PERFORM * FROM public.peajes_normalizar_tarifas(v_documento_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'peajes_normalizar_tarifas(%) diferida: %', v_documento_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'documento_id', v_documento_id,
    'factura_id', v_documento_id,
    'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id,
    'validacion', v_validacion,
    'duplicados_permitidos', COALESCE(jsonb_array_length(v_permitidos), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric, boolean) IS
  'Confirma carga en documentos (FC|NC). Detecta duplicados RN-16. Persiste sentido (IDA|VUELTA|AMBAS, default AMBAS). Hook F14-2: peajes_normalizar_tarifas.';

