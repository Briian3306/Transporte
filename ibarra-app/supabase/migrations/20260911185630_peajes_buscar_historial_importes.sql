-- Paso 9: amount-led history lookup. Highest matching category wins (refresh-tarifas-paso9.md).
CREATE OR REPLACE FUNCTION public.peajes_buscar_historial_importes(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_ord integer := 0;
  v_estacion uuid;
  v_peaje uuid;
  v_importe numeric;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un array JSON' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_candidatos) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_candidatos)
  LOOP
    v_ord := v_ord + 1;
    BEGIN
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_importe := (COALESCE(v_elem->>'importe', '0'))::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_candidatos contiene tipos invalidos' USING ERRCODE = '22023';
    END;
    IF v_estacion IS NULL OR v_importe IS NULL OR v_importe <= 0 THEN
      RAISE EXCEPTION 'p_candidatos incompleto o importe invalido' USING ERRCODE = '22023';
    END IF;

    v_rows := v_rows || COALESCE((
      WITH hits AS (
        SELECT
          t.id AS tarifa_id,
          t.categoria,
          t.status,
          t.sentido,
          t.enabled,
          ti.importe,
          ti.fecha_vigencia_inicio,
          ti.fecha_vigencia_fin,
          ti.diagnostico,
          (ti.id IS NOT DISTINCT FROM t.current_tarifa_id) AS es_actual,
          ti.fecha_aparicion,
          ti.id AS tarifa_importe_id
        FROM public.estaciones e
        INNER JOIN public.tarifas t
          ON t.estacion_id = e.id
         AND t.enabled
         AND (v_peaje IS NULL OR t.peaje_id = v_peaje)
        INNER JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
        WHERE e.id = v_estacion
          AND ti.importe > 0
          AND ti.diagnostico IS DISTINCT FROM 'REVISAR'
          AND abs(v_importe - ti.importe) / ti.importe <= 0.01
      ),
      highest AS (
        SELECT max(categoria) AS categoria FROM hits
      ),
      top_hits AS (
        SELECT h.*
        FROM hits h
        CROSS JOIN highest x
        WHERE x.categoria IS NOT NULL AND h.categoria = x.categoria
      ),
      counted AS (
        SELECT count(DISTINCT tarifa_id)::int AS count_identities FROM top_hits
      ),
      picked AS (
        SELECT DISTINCT ON (tarifa_id) *
        FROM top_hits
        ORDER BY tarifa_id, es_actual DESC, fecha_aparicion DESC, tarifa_importe_id DESC
      )
      SELECT jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'estacion_id', v_estacion,
        'importe_consultado', v_importe,
        'count_identities', COALESCE((SELECT count_identities FROM counted), 0),
        'matches', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'tarifa_id', s.tarifa_id,
            'categoria', s.categoria,
            'status', s.status,
            'sentido', s.sentido,
            'importe', s.importe
          ) ORDER BY s.categoria DESC, s.tarifa_id)
          FROM (
            SELECT DISTINCT ON (tarifa_id) tarifa_id, categoria, status, sentido, importe
            FROM top_hits
            ORDER BY tarifa_id, es_actual DESC, fecha_aparicion DESC, tarifa_importe_id DESC
          ) s
        ), '[]'::jsonb),
        'tarifa_id', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.tarifa_id END,
        'categoria', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.categoria END,
        'status', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.status END,
        'sentido', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.sentido END,
        'importe', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.importe END,
        'fecha_vigencia_inicio', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.fecha_vigencia_inicio END,
        'fecha_vigencia_fin', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.fecha_vigencia_fin END,
        'es_actual', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.es_actual END,
        'diagnostico', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.diagnostico END,
        'enabled', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.enabled END
      )))
      FROM counted
      LEFT JOIN picked p ON (SELECT count_identities FROM counted) = 1
    ), jsonb_build_array(jsonb_build_object(
      'estacion_id', v_estacion,
      'importe_consultado', v_importe,
      'count_identities', 0
    )));
  END LOOP;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_buscar_historial_importes(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_buscar_historial_importes(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_buscar_historial_importes(jsonb) IS
  'Paso 9 · Busca historial por estacion+importe (1%). Entre matches elige la categoria mayor; count_identities solo en esa categoria.';
