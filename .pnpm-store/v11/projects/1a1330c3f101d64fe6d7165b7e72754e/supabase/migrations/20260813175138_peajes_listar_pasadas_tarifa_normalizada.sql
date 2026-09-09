-- F14-8: filtrar peajes_listar_pasadas por tarifa_normalizada_id (casos de un nivel).
-- Additive: same signature; optional jsonb key. Index idx_pasadas_tarifa_normalizada_id already exists.
-- Remote version ID DESARROLLO: 20260813175138 (MCP apply_migration).

CREATE OR REPLACE FUNCTION public.peajes_listar_pasadas(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'fecha_hora',
  p_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_sort text := lower(COALESCE(NULLIF(trim(p_sort), ''), 'fecha_hora'));
  v_asc boolean := lower(COALESCE(p_dir, 'desc')) = 'asc';
  v_rows jsonb;
  v_total bigint;
  v_fecha_desde timestamptz;
  v_fecha_hasta timestamptz;
  v_estacion_ids uuid[];
  v_patente_ids uuid[];
  v_empresa_ids text[];
  v_q_estacion text;
  v_q_patente text;
  v_q_empresa text;
  v_q_archivo text;
  v_tarifa_normalizada_id uuid;
BEGIN
  IF v_sort NOT IN (
    'fecha_hora', 'precio', 'importe_neto', 'created_at',
    'estacion_nombre', 'patente_codigo', 'empresa_nombre', 'file_upload_name'
  ) THEN
    v_sort := 'fecha_hora';
  END IF;

  v_fecha_desde := NULLIF(p_filters->>'fecha_desde', '')::timestamptz;
  v_fecha_hasta := NULLIF(p_filters->>'fecha_hasta', '')::timestamptz;
  v_tarifa_normalizada_id := NULLIF(p_filters->>'tarifa_normalizada_id', '')::uuid;

  IF p_filters ? 'estacion_ids' AND jsonb_typeof(p_filters->'estacion_ids') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
      INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filters->'estacion_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filters ? 'patente_ids' AND jsonb_typeof(p_filters->'patente_ids') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
      INTO v_patente_ids
    FROM jsonb_array_elements_text(p_filters->'patente_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_patente_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filters ? 'empresa_ids' AND jsonb_typeof(p_filters->'empresa_ids') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[])
      INTO v_empresa_ids
    FROM jsonb_array_elements_text(p_filters->'empresa_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_empresa_ids := ARRAY[]::text[];
  END IF;

  v_q_estacion := NULLIF(trim(p_filters->>'q_estacion'), '');
  v_q_patente := NULLIF(trim(p_filters->>'q_patente'), '');
  v_q_empresa := NULLIF(trim(p_filters->>'q_empresa'), '');
  v_q_archivo := NULLIF(trim(p_filters->>'q_archivo'), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.pasadas_gestion g
  WHERE (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
    AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
    AND (cardinality(v_estacion_ids) = 0 OR g.estacion_id = ANY (v_estacion_ids))
    AND (cardinality(v_patente_ids) = 0 OR g.patente_id = ANY (v_patente_ids))
    AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
    AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
    AND (v_q_patente IS NULL OR g.patente_codigo ILIKE '%' || v_q_patente || '%')
    AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
    AND (v_q_archivo IS NULL OR coalesce(g.file_upload_name, '') ILIKE '%' || v_q_archivo || '%')
    AND (v_tarifa_normalizada_id IS NULL OR g.tarifa_normalizada_id = v_tarifa_normalizada_id);

  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT g.*
    FROM public.pasadas_gestion g
    WHERE (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
      AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
      AND (cardinality(v_estacion_ids) = 0 OR g.estacion_id = ANY (v_estacion_ids))
      AND (cardinality(v_patente_ids) = 0 OR g.patente_id = ANY (v_patente_ids))
      AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
      AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
      AND (v_q_patente IS NULL OR g.patente_codigo ILIKE '%' || v_q_patente || '%')
      AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
      AND (v_q_archivo IS NULL OR coalesce(g.file_upload_name, '') ILIKE '%' || v_q_archivo || '%')
      AND (v_tarifa_normalizada_id IS NULL OR g.tarifa_normalizada_id = v_tarifa_normalizada_id)
    ORDER BY
      CASE WHEN v_asc AND v_sort = 'fecha_hora' THEN g.fecha_hora END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'fecha_hora' THEN g.fecha_hora END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'precio' THEN g.precio END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'precio' THEN g.precio END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'importe_neto' THEN g.importe_neto END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'importe_neto' THEN g.importe_neto END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'created_at' THEN g.created_at END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'created_at' THEN g.created_at END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'estacion_nombre' THEN g.estacion_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'estacion_nombre' THEN g.estacion_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'patente_codigo' THEN g.patente_codigo END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'patente_codigo' THEN g.patente_codigo END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'empresa_nombre' THEN g.empresa_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'empresa_nombre' THEN g.empresa_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'file_upload_name' THEN g.file_upload_name END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'file_upload_name' THEN g.file_upload_name END DESC NULLS LAST,
      g.fecha_hora DESC
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_listar_pasadas(jsonb, text, text, integer, integer) IS
  'Listado paginado/filtrado de pasadas desde pasadas_gestion. Filtros: fechas, estacion_ids, patente_ids, empresa_ids, q_*, tarifa_normalizada_id.';

GRANT EXECUTE ON FUNCTION public.peajes_listar_pasadas(jsonb, text, text, integer, integer)
  TO authenticated, service_role;
