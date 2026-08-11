-- F08-2: listado agregado de estaciones PENDING (sin lat/lng) con pasadas asociadas.
-- SECURITY INVOKER: respeta RLS de la vista pasadas_gestion / tablas base.

CREATE OR REPLACE FUNCTION public.peajes_listar_estaciones_pendientes(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'cantidad_pasadas',
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
  v_sort text := lower(COALESCE(NULLIF(trim(p_sort), ''), 'cantidad_pasadas'));
  v_asc boolean := lower(COALESCE(p_dir, 'desc')) = 'asc';
  v_rows jsonb;
  v_total bigint;
  v_fecha_desde timestamptz;
  v_fecha_hasta timestamptz;
  v_empresa_ids text[];
  v_q_estacion text;
  v_q_empresa text;
BEGIN
  IF v_sort NOT IN (
    'estacion_nombre', 'empresa_nombre', 'fecha_desde', 'fecha_hasta',
    'cantidad_pasadas', 'total_importe'
  ) THEN
    v_sort := 'cantidad_pasadas';
  END IF;

  v_fecha_desde := NULLIF(p_filters->>'fecha_desde', '')::timestamptz;
  v_fecha_hasta := NULLIF(p_filters->>'fecha_hasta', '')::timestamptz;

  IF p_filters ? 'empresa_ids' AND jsonb_typeof(p_filters->'empresa_ids') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[])
      INTO v_empresa_ids
    FROM jsonb_array_elements_text(p_filters->'empresa_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_empresa_ids := ARRAY[]::text[];
  END IF;

  v_q_estacion := NULLIF(trim(p_filters->>'q_estacion'), '');
  v_q_empresa := NULLIF(trim(p_filters->>'q_empresa'), '');

  WITH filtered AS (
    SELECT g.*
    FROM public.pasadas_gestion g
    WHERE (g.estacion_latitud IS NULL OR g.estacion_longitud IS NULL)
      AND (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
      AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
      AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
      AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
      AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
  ),
  agg AS (
    SELECT
      f.estacion_id,
      min(f.estacion_nombre) AS estacion_nombre,
      (min(f.peaje_id::text))::uuid AS peaje_id,
      min(f.peaje_nombre) AS peaje_nombre,
      min(f.empresa_id) AS empresa_id,
      min(f.empresa_nombre) AS empresa_nombre,
      min(f.fecha_hora) AS fecha_desde,
      max(f.fecha_hora) AS fecha_hasta,
      count(*)::bigint AS cantidad_pasadas,
      coalesce(sum(f.importe_neto), 0)::numeric AS total_importe
    FROM filtered f
    GROUP BY f.estacion_id
  ),
  enriched AS (
    SELECT
      a.estacion_id,
      a.estacion_nombre,
      a.peaje_id,
      a.peaje_nombre,
      a.empresa_id,
      a.empresa_nombre,
      a.fecha_desde,
      a.fecha_hasta,
      a.cantidad_pasadas,
      a.total_importe,
      e.ubicacion,
      e.camino,
      e.latitud AS estacion_latitud,
      e.longitud AS estacion_longitud
    FROM agg a
    JOIN public.estaciones e ON e.id = a.estacion_id
  )
  SELECT count(*)::bigint INTO v_total FROM enriched;

  WITH filtered AS (
    SELECT g.*
    FROM public.pasadas_gestion g
    WHERE (g.estacion_latitud IS NULL OR g.estacion_longitud IS NULL)
      AND (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
      AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
      AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
      AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
      AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
  ),
  agg AS (
    SELECT
      f.estacion_id,
      min(f.estacion_nombre) AS estacion_nombre,
      (min(f.peaje_id::text))::uuid AS peaje_id,
      min(f.peaje_nombre) AS peaje_nombre,
      min(f.empresa_id) AS empresa_id,
      min(f.empresa_nombre) AS empresa_nombre,
      min(f.fecha_hora) AS fecha_desde,
      max(f.fecha_hora) AS fecha_hasta,
      count(*)::bigint AS cantidad_pasadas,
      coalesce(sum(f.importe_neto), 0)::numeric AS total_importe
    FROM filtered f
    GROUP BY f.estacion_id
  ),
  enriched AS (
    SELECT
      a.estacion_id,
      a.estacion_nombre,
      a.peaje_id,
      a.peaje_nombre,
      a.empresa_id,
      a.empresa_nombre,
      a.fecha_desde,
      a.fecha_hasta,
      a.cantidad_pasadas,
      a.total_importe,
      e.ubicacion,
      e.camino,
      e.latitud AS estacion_latitud,
      e.longitud AS estacion_longitud
    FROM agg a
    JOIN public.estaciones e ON e.id = a.estacion_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT en.*
    FROM enriched en
    ORDER BY
      CASE WHEN v_asc AND v_sort = 'estacion_nombre' THEN en.estacion_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'estacion_nombre' THEN en.estacion_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'empresa_nombre' THEN en.empresa_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'empresa_nombre' THEN en.empresa_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'fecha_desde' THEN en.fecha_desde END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'fecha_desde' THEN en.fecha_desde END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'fecha_hasta' THEN en.fecha_hasta END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'fecha_hasta' THEN en.fecha_hasta END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'cantidad_pasadas' THEN en.cantidad_pasadas END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'cantidad_pasadas' THEN en.cantidad_pasadas END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'total_importe' THEN en.total_importe END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'total_importe' THEN en.total_importe END DESC NULLS LAST,
      en.cantidad_pasadas DESC,
      en.estacion_nombre ASC
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_listar_estaciones_pendientes(jsonb, text, text, integer, integer) IS
  'Listado paginado de estaciones sin coordenadas (PENDING) con cantidad y total de pasadas asociadas';

REVOKE ALL ON FUNCTION public.peajes_listar_estaciones_pendientes(jsonb, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_listar_estaciones_pendientes(jsonb, text, text, integer, integer)
  TO authenticated, service_role;
