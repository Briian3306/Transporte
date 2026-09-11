-- Paso 9 follow-up · Review-only identities have no current amount and must not appear
-- in the active Tarifario list.  MARK_REVIEW still persists its evidence in
-- tarifa_importe, without promoting the pointer.
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifas_actuales(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'estacion_nombre:asc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_sort_raw text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'estacion_nombre:asc'));
  v_sort text := split_part(v_sort_raw, ':', 1);
  v_asc boolean := split_part(v_sort_raw, ':', 2) <> 'desc';
  v_peaje_ids uuid[];
  v_estacion_ids uuid[];
  v_categorias smallint[];
  v_status text[];
  v_sentidos text[];
  v_q text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF v_sort NOT IN (
    'estacion_nombre', 'peaje_nombre', 'categoria', 'importe',
    'fecha_actualizacion', 'status', 'sentido'
  ) THEN
    v_sort := 'estacion_nombre';
  END IF;

  IF p_filtros ? 'peaje_ids' AND jsonb_typeof(p_filtros->'peaje_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_peaje_ids
    FROM jsonb_array_elements_text(p_filtros->'peaje_ids') t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_peaje_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'estacion_ids' AND jsonb_typeof(p_filtros->'estacion_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filtros->'estacion_ids') t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'categorias' AND jsonb_typeof(p_filtros->'categorias') = 'array' THEN
    SELECT COALESCE(array_agg(value::smallint), ARRAY[]::smallint[]) INTO v_categorias
    FROM jsonb_array_elements_text(p_filtros->'categorias') t(value)
    WHERE value ~ '^[0-9]+$';
  ELSE
    v_categorias := ARRAY[]::smallint[];
  END IF;

  IF p_filtros ? 'status' AND jsonb_typeof(p_filtros->'status') = 'array' THEN
    SELECT COALESCE(array_agg(upper(value)), ARRAY[]::text[]) INTO v_status
    FROM jsonb_array_elements_text(p_filtros->'status') t(value)
    WHERE upper(value) IN ('PICO', 'NO_PICO');
  ELSE
    v_status := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'sentidos' AND jsonb_typeof(p_filtros->'sentidos') = 'array' THEN
    SELECT COALESCE(array_agg(upper(value)), ARRAY[]::text[]) INTO v_sentidos
    FROM jsonb_array_elements_text(p_filtros->'sentidos') t(value)
    WHERE upper(value) IN ('IDA', 'VUELTA', 'AMBAS');
  ELSE
    v_sentidos := ARRAY[]::text[];
  END IF;

  v_q := NULLIF(btrim(p_filtros->>'q_estacion'), '');

  DROP TABLE IF EXISTS _tf_list;
  CREATE TEMP TABLE _tf_list ON COMMIT DROP AS
  SELECT
    t.id AS tarifa_id,
    t.peaje_id,
    p.nombre AS peaje_nombre,
    t.estacion_id,
    e.nombre AS estacion_nombre,
    t.categoria,
    t.status,
    t.sentido,
    ti.importe,
    t.fecha_actualizacion,
    t.current_tarifa_id AS current_tarifa_importe_id
  FROM public.tarifas t
  JOIN public.peajes p ON p.id = t.peaje_id
  JOIN public.estaciones e ON e.id = t.estacion_id
  JOIN public.tarifa_importe ti
    ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
  WHERE t.current_tarifa_id IS NOT NULL
    AND (cardinality(v_peaje_ids) = 0 OR t.peaje_id = ANY (v_peaje_ids))
    AND (cardinality(v_estacion_ids) = 0 OR t.estacion_id = ANY (v_estacion_ids))
    AND (cardinality(v_categorias) = 0 OR t.categoria = ANY (v_categorias))
    AND (cardinality(v_status) = 0 OR t.status = ANY (v_status))
    AND (cardinality(v_sentidos) = 0 OR t.sentido = ANY (v_sentidos))
    AND (v_q IS NULL OR e.nombre ILIKE '%' || v_q || '%');

  SELECT count(*) INTO v_total FROM _tf_list;

  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT *
    FROM _tf_list
    ORDER BY
      CASE WHEN v_sort = 'estacion_nombre' AND v_asc THEN estacion_nombre END ASC,
      CASE WHEN v_sort = 'estacion_nombre' AND NOT v_asc THEN estacion_nombre END DESC,
      CASE WHEN v_sort = 'peaje_nombre' AND v_asc THEN peaje_nombre END ASC,
      CASE WHEN v_sort = 'peaje_nombre' AND NOT v_asc THEN peaje_nombre END DESC,
      CASE WHEN v_sort = 'categoria' AND v_asc THEN categoria END ASC,
      CASE WHEN v_sort = 'categoria' AND NOT v_asc THEN categoria END DESC,
      CASE WHEN v_sort = 'importe' AND v_asc THEN importe END ASC NULLS LAST,
      CASE WHEN v_sort = 'importe' AND NOT v_asc THEN importe END DESC NULLS LAST,
      CASE WHEN v_sort = 'fecha_actualizacion' AND v_asc THEN fecha_actualizacion END ASC,
      CASE WHEN v_sort = 'fecha_actualizacion' AND NOT v_asc THEN fecha_actualizacion END DESC,
      CASE WHEN v_sort = 'status' AND v_asc THEN status END ASC,
      CASE WHEN v_sort = 'status' AND NOT v_asc THEN status END DESC,
      CASE WHEN v_sort = 'sentido' AND v_asc THEN sentido END ASC,
      CASE WHEN v_sort = 'sentido' AND NOT v_asc THEN sentido END DESC,
      tarifa_id
    OFFSET (v_page - 1) * v_page_size
    LIMIT v_page_size
  ) x;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) IS
  'Paso 9 · Lists active tariff identities only; review-only rows have no current_tarifa_id.';
