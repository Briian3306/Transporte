-- Match Paso 9 against tariff prices first. Provider category is preserved as
-- source data but cannot hide an enabled identity with the same price.

CREATE OR REPLACE FUNCTION public._peajes_detectar_refresco_tarifas_precio(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH input AS (
    SELECT
      t.ord,
      COALESCE(NULLIF(btrim(t.elem->>'id'), ''), (t.ord - 1)::text) AS id,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      NULLIF(btrim(COALESCE(t.elem->>'categoria_proveedor', t.elem->>'categoria')), '')::smallint AS categoria_proveedor,
      NULLIF(upper(btrim(t.elem->>'status_solicitado')), '') AS status_solicitado,
      NULLIF(upper(btrim(t.elem->>'sentido_solicitado')), '') AS sentido_solicitado,
      NULLIF(upper(btrim(t.elem->>'unresolvedReason')), '') AS unresolved_reason,
      NULLIF(btrim(COALESCE(t.elem->>'fecha_pasada', t.elem->>'fechaPasada')), '')::date AS fecha_pasada,
      NULLIF(btrim(t.elem->>'precio_directo'), '')::numeric AS precio_directo,
      NULLIF(btrim(t.elem->>'precio_normalizado'), '')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  station_max AS (
    SELECT t.estacion_id, max(t.categoria)::smallint AS categoria_maxima
    FROM public.tarifas t
    WHERE t.enabled
    GROUP BY t.estacion_id
  ),
  base AS (
    SELECT i.*, e.peaje_id, sm.categoria_maxima,
      CASE
        WHEN i.categoria_proveedor IS NULL OR sm.categoria_maxima IS NULL THEN i.categoria_proveedor
        ELSE LEAST(i.categoria_proveedor, sm.categoria_maxima)
      END AS categoria_efectiva,
      CASE WHEN e.id IS NULL THEN 'CONTEXT_INCOMPLETE' ELSE NULL END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
    LEFT JOIN station_max sm ON sm.estacion_id = i.estacion_id
  ),
  all_matches AS (
    SELECT b.*, m.*
    FROM base b
    LEFT JOIN LATERAL public._peajes_tarifas_matching_candidatos(
      b.estacion_id, b.categoria_efectiva, b.sentido_solicitado, b.status_solicitado,
      b.fecha_pasada, b.precio_directo, b.precio_normalizado
    ) m ON b.early_codigo IS NULL
  ),
  hits AS (
    SELECT * FROM all_matches
    WHERE early_codigo IS NULL
      AND importe IS NOT NULL AND importe <> 0 AND precio_comparado IS NOT NULL
      AND ((es_vigente AND compatible_validity) OR categoria IS NOT DISTINCT FROM categoria_efectiva)
      AND diagnostico IS DISTINCT FROM 'REVISAR'
      AND (status_solicitado IS NULL OR status_solicitado NOT IN ('PICO', 'NO_PICO') OR status = status_solicitado)
      AND (
        sentido_solicitado IS NULL
        OR (sentido_solicitado = 'AMBAS' AND sentido = 'AMBAS')
        OR (sentido_solicitado IN ('IDA', 'VUELTA') AND sentido IN (sentido_solicitado, 'AMBAS'))
      )
      AND abs(precio_comparado - importe) / importe <= 0.01
  ),
  identities AS (
    SELECT ord, count(DISTINCT tarifa_id) AS count_identities FROM hits GROUP BY ord
  ),
  picked AS (
    SELECT DISTINCT ON (ord) *
    FROM hits
    ORDER BY ord,
      CASE
        WHEN es_vigente AND compatible_validity THEN 0
        WHEN compatible_validity THEN 1
        WHEN es_vigente THEN 2
        ELSE 3
      END,
      tarifa_id, tarifa_importe_id
  ),
  possible AS (
    SELECT ord, jsonb_agg(jsonb_build_object(
      'tarifa_id', tarifa_id, 'tarifa_importe_id', tarifa_importe_id,
      'categoria', categoria, 'status', status, 'sentido', sentido, 'importe', importe,
      'diagnostico', diagnostico, 'fecha_vigencia_inicio', fecha_vigencia_inicio,
      'fecha_vigencia_fin', fecha_vigencia_fin, 'es_actual', es_vigente,
      'error_relativo', error_relativo
    ) ORDER BY categoria DESC, current_rank, validity_rank, tarifa_id, tarifa_importe_id) AS matches
    FROM all_matches
    WHERE early_codigo IS NULL AND importe IS NOT NULL AND importe <> 0 AND precio_comparado IS NOT NULL
      AND ((es_vigente AND compatible_validity) OR categoria IS NOT DISTINCT FROM categoria_efectiva)
      AND diagnostico IS DISTINCT FROM 'REVISAR'
      AND (status_solicitado IS NULL OR status_solicitado NOT IN ('PICO', 'NO_PICO') OR status = status_solicitado)
      AND (
        sentido_solicitado IS NULL
        OR (sentido_solicitado = 'AMBAS' AND sentido = 'AMBAS')
        OR (sentido_solicitado IN ('IDA', 'VUELTA') AND sentido IN (sentido_solicitado, 'AMBAS'))
      )
      AND abs(precio_comparado - importe) / importe <= 0.01
    GROUP BY ord
  ),
  decided AS (
    SELECT b.*,
      p.tarifa_id AS pick_tarifa_id,
      p.categoria AS pick_categoria,
      p.status AS pick_status,
      p.sentido AS pick_sentido,
      p.es_vigente AS pick_es_vigente,
      p.compatible_validity AS pick_compatible_validity,
      p.tarifa_importe_id AS pick_tarifa_importe_id,
      p.importe AS pick_importe,
      p.requiere_normalizacion_iva AS pick_requiere_normalizacion_iva,
      p.diagnostico AS pick_diagnostico,
      p.fecha_vigencia_inicio AS pick_fecha_vigencia_inicio,
      p.fecha_vigencia_fin AS pick_fecha_vigencia_fin,
      COALESCE(i.count_identities, 0) AS count_identities,
      COALESCE(o.matches, '[]'::jsonb) AS possible_matches,
      CASE
        WHEN b.unresolved_reason = 'CONFLICT' THEN 'DIRECTION_CONFLICT'
        WHEN b.early_codigo IS NOT NULL THEN b.early_codigo
        WHEN COALESCE(i.count_identities, 0) > 1 THEN 'AMBIGUOUS_TARIFF_MATCH'
        WHEN p.tarifa_id IS NOT NULL AND p.es_vigente AND p.compatible_validity
          AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'CURRENT_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND NOT (p.es_vigente AND p.compatible_validity)
          AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'HISTORICAL_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND p.es_vigente AND p.compatible_validity THEN 'CURRENT_TARIFF'
        WHEN p.tarifa_id IS NOT NULL THEN 'HISTORICAL_TARIFF_MATCH'
        WHEN b.categoria_proveedor IS NULL THEN 'CONTEXT_INCOMPLETE'
        WHEN b.sentido_solicitado IS NULL OR b.sentido_solicitado NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN 'DIRECTION_REQUIRED'
        WHEN b.status_solicitado IS NULL OR b.status_solicitado NOT IN ('PICO', 'NO_PICO') THEN 'STATUS_REQUIRED'
        ELSE 'NEW_TARIFF'
      END AS codigo
    FROM base b
    LEFT JOIN picked p USING (ord)
    LEFT JOIN identities i USING (ord)
    LEFT JOIN possible o USING (ord)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', d.id, 'codigo', d.codigo, 'peaje_id', d.peaje_id, 'estacion_id', d.estacion_id,
      'categoria', d.categoria_proveedor, 'categoria_proveedor', d.categoria_proveedor,
      'categoria_calculada', CASE
        WHEN d.count_identities = 1 AND d.pick_categoria IS DISTINCT FROM d.categoria_proveedor
          THEN d.pick_categoria
        ELSE NULL
      END,
      'status', CASE WHEN d.count_identities = 1 THEN d.pick_status WHEN d.codigo = 'NEW_TARIFF' THEN d.status_solicitado END,
      'sentido_solicitado', d.sentido_solicitado,
      'sentido_aplicado', CASE WHEN d.count_identities = 1 THEN d.pick_sentido END,
      'importe_actual', CASE WHEN d.count_identities = 1 THEN d.pick_importe END,
      'tarifa_id', CASE WHEN d.count_identities = 1 THEN d.pick_tarifa_id END,
      'tarifa_importe_id', CASE WHEN d.count_identities = 1 THEN d.pick_tarifa_importe_id END,
      'requiere_normalizacion_iva', CASE WHEN d.count_identities = 1 THEN d.pick_requiere_normalizacion_iva END,
      'diagnostico', CASE WHEN d.count_identities = 1 THEN d.pick_diagnostico END,
      'fecha_vigencia_inicio', CASE WHEN d.count_identities = 1 THEN d.pick_fecha_vigencia_inicio END,
      'fecha_vigencia_fin', CASE WHEN d.count_identities = 1 THEN d.pick_fecha_vigencia_fin END,
      'possible_matches', d.possible_matches
    )) ORDER BY d.ord), '[]'::jsonb)
  FROM decided d;
$$;

COMMENT ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) IS
  'Paso 9 matches enabled tariff identities by price across categories; provider category is retained as source metadata.';

CREATE OR REPLACE FUNCTION public.peajes_buscar_historial_importes(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_estacion uuid;
  v_peaje uuid;
  v_importe numeric;
  v_categoria smallint;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un array JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_candidatos)
  LOOP
    BEGIN
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_importe := (COALESCE(v_elem->>'importe', '0'))::numeric;
      v_categoria := NULLIF(btrim(COALESCE(v_elem->>'categoria', v_elem->>'categoria_efectiva', v_elem->>'categoriaEfectiva')), '')::smallint;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_candidatos contiene tipos invalidos' USING ERRCODE = '22023';
    END;
    IF v_estacion IS NULL OR v_importe IS NULL OR v_importe <= 0 THEN
      RAISE EXCEPTION 'p_candidatos incompleto o importe invalido' USING ERRCODE = '22023';
    END IF;
    IF v_categoria IS NULL THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'estacion_id', v_estacion, 'importe_consultado', v_importe,
        'count_identities', 0, 'matches', '[]'::jsonb
      ));
      CONTINUE;
    END IF;
    v_rows := v_rows || jsonb_build_array((
      WITH hits AS (
        SELECT t.id AS tarifa_id, t.categoria, t.status, t.sentido, t.enabled,
          ti.importe, ti.fecha_vigencia_inicio, ti.fecha_vigencia_fin, ti.diagnostico,
          (ti.id IS NOT DISTINCT FROM t.current_tarifa_id) AS es_actual,
          ti.fecha_aparicion, ti.id AS tarifa_importe_id
        FROM public.estaciones e
        JOIN public.tarifas t ON t.estacion_id = e.id AND t.enabled
          AND (v_peaje IS NULL OR t.peaje_id = v_peaje)
        JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
        WHERE e.id = v_estacion AND t.categoria = v_categoria AND ti.importe > 0
          AND ti.diagnostico IS DISTINCT FROM 'REVISAR'
          AND abs(v_importe - ti.importe) / ti.importe <= 0.01
      ),
      identities AS (
        SELECT count(DISTINCT tarifa_id)::int AS count_identities FROM hits
      ),
      picked AS (
        SELECT DISTINCT ON (tarifa_id) * FROM hits
        ORDER BY tarifa_id, es_actual DESC, fecha_aparicion DESC, tarifa_importe_id DESC
      )
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'estacion_id', v_estacion,
        'importe_consultado', v_importe,
        'count_identities', (SELECT count_identities FROM identities),
        'matches', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'tarifa_id', p.tarifa_id, 'categoria', p.categoria, 'status', p.status,
          'sentido', p.sentido, 'importe', p.importe
        ) ORDER BY p.categoria DESC, p.tarifa_id) FROM picked p), '[]'::jsonb),
        'tarifa_id', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT tarifa_id FROM picked LIMIT 1) END,
        'categoria', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT categoria FROM picked LIMIT 1) END,
        'status', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT status FROM picked LIMIT 1) END,
        'sentido', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT sentido FROM picked LIMIT 1) END,
        'importe', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT importe FROM picked LIMIT 1) END,
        'fecha_vigencia_inicio', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT fecha_vigencia_inicio FROM picked LIMIT 1) END,
        'fecha_vigencia_fin', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT fecha_vigencia_fin FROM picked LIMIT 1) END,
        'es_actual', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT es_actual FROM picked LIMIT 1) END,
        'diagnostico', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT diagnostico FROM picked LIMIT 1) END,
        'enabled', CASE WHEN (SELECT count_identities FROM identities) = 1 THEN (SELECT enabled FROM picked LIMIT 1) END
      )) FROM identities
    ));
  END LOOP;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_buscar_historial_importes(jsonb) IS
  'Paso 9 amount-led history lookup: unique enabled tariff identity within the effective category and 1%.';
REVOKE ALL ON FUNCTION public.peajes_buscar_historial_importes(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_buscar_historial_importes(jsonb) TO authenticated, service_role;
