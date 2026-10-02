-- Keep the existing status/direction safeguards while searching all enabled
-- categories. A conflicting direction stays unresolved even when its amount
-- happens to equal a tariff price.

CREATE OR REPLACE FUNCTION public._peajes_tarifas_matching_candidatos(
  p_estacion_id uuid, p_categoria smallint, p_sentido text, p_status text,
  p_fecha_pasada date, p_precio_directo numeric, p_precio_normalizado numeric
)
RETURNS TABLE (
  tarifa_id uuid, peaje_id uuid, estacion_id uuid, categoria smallint, status text,
  sentido text, same_category boolean, dir_rank integer, current_rank integer,
  validity_rank integer, diagnostico text, error_relativo numeric,
  requiere_normalizacion_iva boolean, current_tarifa_id uuid, tarifa_importe_id uuid,
  importe numeric, es_vigente boolean, fecha_vigencia_inicio date,
  fecha_vigencia_fin date, fecha_aparicion timestamptz, created_at timestamptz,
  precio_comparado numeric, compatible_validity boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.id, t.peaje_id, t.estacion_id, t.categoria, t.status, t.sentido,
    (t.categoria IS NOT DISTINCT FROM p_categoria),
    CASE WHEN t.sentido = p_sentido THEN 0 WHEN t.sentido = 'AMBAS' THEN 1 ELSE 2 END,
    CASE WHEN ti.id IS NOT DISTINCT FROM t.current_tarifa_id THEN 0 ELSE 1 END,
    CASE
      WHEN p_fecha_pasada IS NULL THEN CASE WHEN ti.fecha_vigencia_inicio IS NOT NULL THEN 0 ELSE 1 END
      WHEN ti.fecha_vigencia_inicio IS NULL AND ti.fecha_vigencia_fin IS NULL THEN 1
      WHEN ti.fecha_vigencia_inicio IS NOT NULL AND p_fecha_pasada >= ti.fecha_vigencia_inicio
        AND (ti.fecha_vigencia_fin IS NULL OR p_fecha_pasada < ti.fecha_vigencia_fin) THEN 0
      ELSE 2
    END,
    ti.diagnostico,
    CASE WHEN ti.importe IS NULL OR ti.importe = 0 OR v.precio_comparado IS NULL THEN NULL
      ELSE abs(v.precio_comparado - ti.importe) / ti.importe END,
    t.requiere_normalizacion_iva, t.current_tarifa_id, ti.id, ti.importe,
    (ti.id IS NOT DISTINCT FROM t.current_tarifa_id), ti.fecha_vigencia_inicio,
    ti.fecha_vigencia_fin, ti.fecha_aparicion, ti.created_at, v.precio_comparado,
    CASE
      WHEN p_fecha_pasada IS NULL THEN true
      WHEN ti.fecha_vigencia_inicio IS NULL AND ti.fecha_vigencia_fin IS NULL THEN true
      WHEN ti.fecha_vigencia_inicio IS NOT NULL AND p_fecha_pasada >= ti.fecha_vigencia_inicio
        AND (ti.fecha_vigencia_fin IS NULL OR p_fecha_pasada < ti.fecha_vigencia_fin) THEN true
      ELSE false
    END
  FROM public.estaciones e
  INNER JOIN public.tarifas t ON t.peaje_id = e.peaje_id AND t.estacion_id = e.id AND t.enabled
  INNER JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  CROSS JOIN LATERAL (
    SELECT CASE WHEN t.requiere_normalizacion_iva THEN p_precio_normalizado ELSE p_precio_directo END
      AS precio_comparado
  ) v
  WHERE e.id = p_estacion_id
    AND (p_status IS NULL OR p_status NOT IN ('PICO', 'NO_PICO') OR t.status = p_status)
    AND (
      p_sentido IS NULL
      OR (p_sentido = 'AMBAS' AND t.sentido = 'AMBAS')
      OR (p_sentido IN ('IDA', 'VUELTA') AND t.sentido IN (p_sentido, 'AMBAS'))
    );
$$;

CREATE OR REPLACE FUNCTION public.peajes_detectar_refresco_tarifas(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_candidatos jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;
  SELECT COALESCE(jsonb_agg(
    CASE WHEN upper(btrim(e.value->>'unresolvedReason')) = 'CONFLICT'
      THEN e.value || jsonb_build_object('precio_directo', NULL, 'precio_normalizado', NULL)
      ELSE e.value
    END ORDER BY e.ord
  ), '[]'::jsonb)
  INTO v_candidatos
  FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY e(value, ord);
  RETURN public._peajes_detectar_refresco_tarifas_precio(v_candidatos);
END;
$$;

REVOKE ALL ON FUNCTION public._peajes_tarifas_matching_candidatos(uuid, smallint, text, text, date, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_tarifas_matching_candidatos(uuid, smallint, text, text, date, numeric, numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.peajes_preparar_refresco_tarifas(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;
  IF jsonb_array_length(p_candidatos) = 0 THEN RETURN '[]'::jsonb; END IF;

  WITH input AS (
    SELECT t.ord,
      COALESCE(NULLIF(btrim(t.elem->>'id'), ''), (t.ord - 1)::text) AS id,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      COALESCE(NULLIF(upper(btrim(t.elem->>'sentido_solicitado')), ''), 'AMBAS') AS sentido
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  configs AS (
    SELECT DISTINCT ON (i.ord, t.id)
      i.ord, i.id, t.peaje_id, t.estacion_id, t.categoria, t.status, t.sentido,
      t.id AS tarifa_id, t.requiere_normalizacion_iva, t.current_tarifa_id,
      CASE WHEN t.sentido = i.sentido THEN 0 WHEN t.sentido = 'AMBAS' THEN 1 ELSE 2 END AS dir_rank
    FROM input i
    JOIN public.tarifas t ON t.estacion_id = i.estacion_id AND t.enabled
      AND (
        i.sentido = 'AMBAS' AND t.sentido = 'AMBAS'
        OR i.sentido IN ('IDA', 'VUELTA') AND t.sentido IN (i.sentido, 'AMBAS')
        OR i.sentido NOT IN ('AMBAS', 'IDA', 'VUELTA')
      )
    WHERE i.estacion_id IS NOT NULL
    ORDER BY i.ord, t.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cfg.id,
    'peaje_id', cfg.peaje_id,
    'estacion_id', cfg.estacion_id,
    'categoria', cfg.categoria,
    'status', cfg.status,
    'sentido', cfg.sentido,
    'tarifa_id', cfg.tarifa_id,
    'importe', ti.importe,
    'requiere_normalizacion_iva', cfg.requiere_normalizacion_iva
  ) ORDER BY cfg.ord, cfg.status, cfg.dir_rank, cfg.tarifa_id), '[]'::jsonb)
  INTO v_result
  FROM configs cfg
  LEFT JOIN public.tarifa_importe ti ON ti.id = cfg.current_tarifa_id;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) IS
  'Paso 9 prepares IVA flags for every enabled station identity, independent of provider category.';
REVOKE ALL ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) TO authenticated, service_role;
