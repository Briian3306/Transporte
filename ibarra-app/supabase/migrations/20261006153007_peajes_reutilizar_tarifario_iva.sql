-- Expose the current tariff IVA flag so Paso 9 can copy its full identity to a new station.
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifas_actuales(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'estacion_nombre:asc'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_sort text := split_part(lower(coalesce(nullif(btrim(p_sort), ''), 'estacion_nombre:asc')), ':', 1);
  v_asc boolean := split_part(lower(coalesce(nullif(btrim(p_sort), ''), 'estacion_nombre:asc')), ':', 2) <> 'desc';
  v_enabled boolean;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF v_sort NOT IN ('estacion_nombre', 'peaje_nombre', 'categoria', 'importe', 'fecha_actualizacion', 'fecha_vigencia_inicio', 'status', 'sentido') THEN
    v_sort := 'estacion_nombre';
  END IF;
  v_enabled := CASE
    WHEN p_filtros ? 'enabled' AND jsonb_typeof(p_filtros->'enabled') = 'boolean' THEN (p_filtros->>'enabled')::boolean
    ELSE true
  END;
  DROP TABLE IF EXISTS _tf_list;
  CREATE TEMP TABLE _tf_list ON COMMIT DROP AS
  SELECT t.id AS tarifa_id, t.peaje_id, p.nombre AS peaje_nombre, t.estacion_id,
    e.nombre AS estacion_nombre, t.categoria, t.status, t.sentido, ti.importe,
    t.fecha_actualizacion, t.enabled, t.requiere_normalizacion_iva, t.current_tarifa_id AS current_tarifa_importe_id,
    ti.fecha_vigencia_inicio
  FROM public.tarifas t
  JOIN public.peajes p ON p.id = t.peaje_id
  JOIN public.estaciones e ON e.id = t.estacion_id
  LEFT JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
  WHERE (p_filtros->'enabled' IS NOT NULL AND jsonb_typeof(p_filtros->'enabled') = 'null' OR t.enabled = v_enabled)
    AND t.current_tarifa_id IS NOT NULL
    AND (NOT (p_filtros ? 'peaje_ids') OR t.peaje_id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_filtros->'peaje_ids')))
    AND (NOT (p_filtros ? 'estacion_ids') OR t.estacion_id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_filtros->'estacion_ids')))
    AND (NOT (p_filtros ? 'categorias') OR t.categoria IN (SELECT value::smallint FROM jsonb_array_elements_text(p_filtros->'categorias')))
    AND (NOT (p_filtros ? 'status') OR t.status IN (SELECT upper(value) FROM jsonb_array_elements_text(p_filtros->'status')))
    AND (NOT (p_filtros ? 'sentidos') OR t.sentido IN (SELECT upper(value) FROM jsonb_array_elements_text(p_filtros->'sentidos')))
    AND (nullif(btrim(p_filtros->>'q_estacion'), '') IS NULL OR e.nombre ILIKE '%' || btrim(p_filtros->>'q_estacion') || '%');
  SELECT count(*) INTO v_total FROM _tf_list;
  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT * FROM _tf_list
    ORDER BY
      CASE WHEN v_sort = 'estacion_nombre' AND v_asc THEN estacion_nombre END,
      CASE WHEN v_sort = 'estacion_nombre' AND NOT v_asc THEN estacion_nombre END DESC,
      CASE WHEN v_sort = 'peaje_nombre' AND v_asc THEN peaje_nombre END,
      CASE WHEN v_sort = 'peaje_nombre' AND NOT v_asc THEN peaje_nombre END DESC,
      CASE WHEN v_sort = 'categoria' AND v_asc THEN categoria END,
      CASE WHEN v_sort = 'categoria' AND NOT v_asc THEN categoria END DESC,
      CASE WHEN v_sort = 'importe' AND v_asc THEN importe END,
      CASE WHEN v_sort = 'importe' AND NOT v_asc THEN importe END DESC,
      CASE WHEN v_sort = 'fecha_vigencia_inicio' AND v_asc THEN fecha_vigencia_inicio END,
      CASE WHEN v_sort = 'fecha_vigencia_inicio' AND NOT v_asc THEN fecha_vigencia_inicio END DESC,
      CASE WHEN v_sort = 'status' AND v_asc THEN status END,
      CASE WHEN v_sort = 'status' AND NOT v_asc THEN status END DESC,
      CASE WHEN v_sort = 'sentido' AND v_asc THEN sentido END,
      CASE WHEN v_sort = 'sentido' AND NOT v_asc THEN sentido END DESC,
      tarifa_id
    OFFSET (v_page - 1) * v_size LIMIT v_size
  ) x;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'page', v_page, 'page_size', v_size);
END;
$$;
