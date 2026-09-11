-- F14-20: price-led refresh matching. Provider category/status/direction are
-- evidence only; a unique station-price tariff is the authoritative identity.

CREATE OR REPLACE FUNCTION public._peajes_tarifas_matching_candidatos(
  p_estacion_id uuid,
  p_categoria smallint,
  p_sentido text,
  p_status text,
  p_fecha_pasada date,
  p_precio_directo numeric,
  p_precio_normalizado numeric
)
RETURNS TABLE (
  tarifa_id uuid,
  peaje_id uuid,
  estacion_id uuid,
  categoria smallint,
  status text,
  sentido text,
  same_category boolean,
  dir_rank integer,
  current_rank integer,
  validity_rank integer,
  diagnostico text,
  error_relativo numeric,
  requiere_normalizacion_iva boolean,
  current_tarifa_id uuid,
  tarifa_importe_id uuid,
  importe numeric,
  es_vigente boolean,
  fecha_vigencia_inicio date,
  fecha_vigencia_fin date,
  fecha_aparicion timestamptz,
  created_at timestamptz,
  precio_comparado numeric,
  compatible_validity boolean
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
    t.categoria,
    t.status,
    t.sentido,
    (t.categoria IS NOT DISTINCT FROM p_categoria),
    CASE
      WHEN t.sentido = p_sentido THEN 0
      WHEN t.sentido = 'AMBAS' THEN 1
      ELSE 2
    END,
    CASE WHEN ti.id IS NOT DISTINCT FROM t.current_tarifa_id THEN 0 ELSE 1 END,
    CASE
      WHEN p_fecha_pasada IS NULL THEN CASE WHEN ti.fecha_vigencia_inicio IS NOT NULL THEN 0 ELSE 1 END
      WHEN ti.fecha_vigencia_inicio IS NULL AND ti.fecha_vigencia_fin IS NULL THEN 1
      WHEN ti.fecha_vigencia_inicio IS NOT NULL
        AND p_fecha_pasada >= ti.fecha_vigencia_inicio
        AND (ti.fecha_vigencia_fin IS NULL OR p_fecha_pasada < ti.fecha_vigencia_fin) THEN 0
      ELSE 2
    END,
    ti.diagnostico,
    CASE
      WHEN ti.importe IS NULL OR ti.importe = 0 OR v.precio_comparado IS NULL THEN NULL
      ELSE abs(v.precio_comparado - ti.importe) / ti.importe
    END,
    t.requiere_normalizacion_iva,
    t.current_tarifa_id,
    ti.id,
    ti.importe,
    (ti.id IS NOT DISTINCT FROM t.current_tarifa_id),
    ti.fecha_vigencia_inicio,
    ti.fecha_vigencia_fin,
    ti.fecha_aparicion,
    ti.created_at,
    v.precio_comparado,
    CASE
      WHEN p_fecha_pasada IS NULL THEN true
      WHEN ti.fecha_vigencia_inicio IS NULL AND ti.fecha_vigencia_fin IS NULL THEN true
      WHEN ti.fecha_vigencia_inicio IS NOT NULL
        AND p_fecha_pasada >= ti.fecha_vigencia_inicio
        AND (ti.fecha_vigencia_fin IS NULL OR p_fecha_pasada < ti.fecha_vigencia_fin) THEN true
      ELSE false
    END
  FROM public.estaciones e
  INNER JOIN public.tarifas t ON t.peaje_id = e.peaje_id AND t.estacion_id = e.id
  INNER JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  CROSS JOIN LATERAL (
    SELECT CASE WHEN t.requiere_normalizacion_iva THEN p_precio_normalizado ELSE p_precio_directo END
      AS precio_comparado
  ) v
  WHERE e.id = p_estacion_id;
$$;

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
      NULLIF(btrim(COALESCE(t.elem->>'fecha_pasada', t.elem->>'fechaPasada')), '')::date AS fecha_pasada,
      NULLIF(btrim(t.elem->>'precio_directo'), '')::numeric AS precio_directo,
      NULLIF(btrim(t.elem->>'precio_normalizado'), '')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  base AS (
    SELECT i.*, e.peaje_id,
      CASE WHEN e.id IS NULL THEN 'CONTEXT_INCOMPLETE' ELSE NULL END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
  ),
  all_matches AS (
    SELECT b.*, m.*
    FROM base b
    LEFT JOIN LATERAL public._peajes_tarifas_matching_candidatos(
      b.estacion_id, b.categoria_proveedor, b.sentido_solicitado, b.status_solicitado,
      b.fecha_pasada, b.precio_directo, b.precio_normalizado
    ) m ON b.early_codigo IS NULL
  ),
  hits AS (
    SELECT * FROM all_matches
    WHERE early_codigo IS NULL
      AND importe IS NOT NULL AND importe <> 0 AND precio_comparado IS NOT NULL
      AND compatible_validity AND diagnostico IS DISTINCT FROM 'REVISAR'
      AND abs(precio_comparado - importe) / importe <= 0.01
  ),
  highest AS (
    SELECT ord, max(categoria) AS categoria FROM hits GROUP BY ord
  ),
  top_hits AS (
    SELECT h.* FROM hits h JOIN highest x USING (ord) WHERE h.categoria = x.categoria
  ),
  identities AS (
    SELECT ord, count(DISTINCT tarifa_id) AS count_identities FROM top_hits GROUP BY ord
  ),
  picked AS (
    SELECT DISTINCT ON (ord) * FROM top_hits
    ORDER BY ord, current_rank, validity_rank, tarifa_id, tarifa_importe_id
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
      AND compatible_validity AND abs(precio_comparado - importe) / importe <= 0.01
    GROUP BY ord
  ),
  decided AS (
    SELECT b.*,
      p.tarifa_id AS pick_tarifa_id,
      p.categoria AS pick_categoria,
      p.status AS pick_status,
      p.sentido AS pick_sentido,
      p.current_rank AS pick_current_rank,
      p.tarifa_importe_id AS pick_tarifa_importe_id,
      p.importe AS pick_importe,
      p.requiere_normalizacion_iva AS pick_requiere_normalizacion_iva,
      p.diagnostico AS pick_diagnostico,
      p.fecha_vigencia_inicio AS pick_fecha_vigencia_inicio,
      p.fecha_vigencia_fin AS pick_fecha_vigencia_fin,
      COALESCE(i.count_identities, 0) AS count_identities,
      COALESCE(o.matches, '[]'::jsonb) AS possible_matches,
      CASE
        WHEN b.early_codigo IS NOT NULL THEN b.early_codigo
        WHEN COALESCE(i.count_identities, 0) > 1 THEN 'AMBIGUOUS_TARIFF_MATCH'
        WHEN p.tarifa_id IS NOT NULL AND p.current_rank = 0 AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'CURRENT_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND p.current_rank = 1 AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'HISTORICAL_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND p.current_rank = 0 THEN 'CURRENT_TARIFF'
        WHEN p.tarifa_id IS NOT NULL THEN 'HISTORICAL_TARIFF_MATCH'
        WHEN b.sentido_solicitado IS NULL OR b.sentido_solicitado NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN 'DIRECTION_REQUIRED'
        WHEN b.categoria_proveedor IS NULL THEN 'CONTEXT_INCOMPLETE'
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
      'categoria_calculada', CASE WHEN d.codigo IN ('CURRENT_CATEGORY_CORRECTION', 'HISTORICAL_CATEGORY_CORRECTION') THEN d.pick_categoria END,
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

CREATE OR REPLACE FUNCTION public.peajes_detectar_refresco_tarifas(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;
  RETURN public._peajes_detectar_refresco_tarifas_precio(p_candidatos);
END;
$$;

COMMENT ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) IS
  'F14-20 · Station-price matching is authoritative, chooses the highest compatible category, and reuses its full tariff identity.';

REVOKE ALL ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) TO authenticated, service_role;
