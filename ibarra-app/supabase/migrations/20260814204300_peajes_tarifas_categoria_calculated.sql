-- F14-9: categoria_calculated (Patrón A, clase vehicular 0–10 opcional)
-- Anotación humana; no forma parte de la clave UNIQUE (peaje, estación, categoria, importe).
-- Recálculo / normalizar no tocan esta columna: valores existentes sobreviven.

ALTER TABLE public.tarifas_normalizadas
  ADD COLUMN IF NOT EXISTS categoria_calculated smallint NULL;

ALTER TABLE public.tarifas_normalizadas
  DROP CONSTRAINT IF EXISTS tarifas_normalizadas_categoria_calculated_chk;

ALTER TABLE public.tarifas_normalizadas
  ADD CONSTRAINT tarifas_normalizadas_categoria_calculated_chk
  CHECK (categoria_calculated IS NULL OR categoria_calculated BETWEEN 0 AND 10);

COMMENT ON COLUMN public.tarifas_normalizadas.categoria_calculated IS
  'F14-9 · Clase vehicular inferida por el analista en Patrón A (0–10). NULL = sin asignar. No es pasadas.categoria ni patentes.categoria (RN-15).';

-- -----------------------------------------------------------------------------
-- peajes_confirmar_status_tarifa: status + categoria_calculated opcional
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_confirmar_status_tarifa(
  p_asignaciones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_niveles integer := 0;
  v_pasadas integer := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF p_asignaciones IS NULL OR jsonb_typeof(p_asignaciones) <> 'array' THEN
    RAISE EXCEPTION 'p_asignaciones debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_asignaciones) = 0 THEN
    RETURN jsonb_build_object('niveles_confirmados', 0, 'pasadas_actualizadas', 0);
  END IF;

  WITH entrada AS (
    SELECT
      (a->>'tarifa_normalizada_id')::uuid AS id,
      upper(btrim(a->>'status_codigo'))   AS status_codigo,
      (a ? 'categoria_calculated')        AS has_categoria,
      CASE
        WHEN NOT (a ? 'categoria_calculated') THEN NULL::smallint
        WHEN a->>'categoria_calculated' IS NULL
          OR btrim(a->>'categoria_calculated') = '' THEN NULL::smallint
        ELSE (a->>'categoria_calculated')::smallint
      END AS categoria_calculated
    FROM jsonb_array_elements(p_asignaciones) AS a
  ),
  validada AS (
    SELECT e.id, e.status_codigo, e.has_categoria, e.categoria_calculated
    FROM entrada e
    WHERE e.id IS NOT NULL AND e.status_codigo IS NOT NULL
  ),
  confirmados AS (
    UPDATE public.tarifas_normalizadas tn
    SET diagnostico       = 'CONFIRMADO',
        status            = v.status_codigo,
        categoria_calculated = CASE
          WHEN v.has_categoria THEN v.categoria_calculated
          ELSE tn.categoria_calculated
        END,
        confirmado_manual = true,
        confirmado_por    = v_uid,
        confirmado_at     = now(),
        updated_at        = now()
    FROM validada v
    WHERE tn.id = v.id
    RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
  ),
  propagadas AS (
    UPDATE public.pasadas p
    SET tarifa_normalizada_id = c.id,
        tarifa_status = c.status
    FROM confirmados c
    WHERE p.estacion_id = c.estacion_id
      AND p.categoria IS NOT DISTINCT FROM c.categoria
      AND p.precio = c.importe
      AND (p.tarifa_normalizada_id IS DISTINCT FROM c.id
           OR p.tarifa_status IS DISTINCT FROM c.status)
    RETURNING p.id
  )
  SELECT
    (SELECT count(*) FROM confirmados),
    (SELECT count(*) FROM propagadas)
  INTO v_niveles, v_pasadas;

  IF v_niveles <> jsonb_array_length(p_asignaciones) THEN
    RAISE EXCEPTION 'Se recibieron % asignaciones pero solo % niveles existen',
      jsonb_array_length(p_asignaciones), v_niveles;
  END IF;

  RETURN jsonb_build_object(
    'niveles_confirmados', v_niveles,
    'pasadas_actualizadas', v_pasadas
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) IS
  'F14-2/F14-9 · Confirma status (y opcionalmente categoria_calculated 0–10) en N niveles y propaga pasadas.tarifa_status. Sin la clave categoria_calculated conserva el valor actual. Falla completa si algún id no existe.';

REVOKE ALL ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- peajes_listar_tarifas_normalizadas: incluye categoria_calculated
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifas_normalizadas(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'cases:desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_page      integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset    integer;
  v_sort_raw  text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'cases:desc'));
  v_sort      text := split_part(v_sort_raw, ':', 1);
  v_asc       boolean := split_part(v_sort_raw, ':', 2) = 'asc';
  v_rows  jsonb;
  v_total bigint;
  v_peaje_id uuid;
  v_peaje_ids uuid[];
  v_estacion_ids uuid[];
  v_categorias text[];
  v_sin_categoria boolean := false;
  v_status text[];
  v_diagnosticos text[];
  v_patron text;
  v_muestra boolean;
  v_confirmado boolean;
  v_q_estacion text;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  IF v_sort NOT IN (
    'cases', 'importe', 'multiplicador', 'desvio', 'hora_media',
    'estacion_nombre', 'categoria', 'status', 'diagnostico', 'updated_at'
  ) THEN
    v_sort := 'cases';
  END IF;

  v_peaje_id := NULLIF(p_filtros->>'peaje_id', '')::uuid;
  v_patron   := NULLIF(upper(btrim(COALESCE(p_filtros->>'patron', ''))), '');
  v_q_estacion := NULLIF(btrim(p_filtros->>'q_estacion'), '');

  IF p_filtros ? 'peaje_ids' AND jsonb_typeof(p_filtros->'peaje_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_peaje_ids
    FROM jsonb_array_elements_text(p_filtros->'peaje_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_peaje_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'muestra_confiable' AND jsonb_typeof(p_filtros->'muestra_confiable') = 'boolean' THEN
    v_muestra := (p_filtros->>'muestra_confiable')::boolean;
  ELSIF p_filtros ? 'solo_muestra_confiable' AND jsonb_typeof(p_filtros->'solo_muestra_confiable') = 'boolean' THEN
    v_muestra := (p_filtros->>'solo_muestra_confiable')::boolean;
  ELSIF p_filtros->>'solo_muestra_confiable' IN ('true', 'false') THEN
    v_muestra := (p_filtros->>'solo_muestra_confiable')::boolean;
  END IF;
  IF p_filtros ? 'confirmado_manual' AND jsonb_typeof(p_filtros->'confirmado_manual') = 'boolean' THEN
    v_confirmado := (p_filtros->>'confirmado_manual')::boolean;
  END IF;

  IF p_filtros ? 'estacion_ids' AND jsonb_typeof(p_filtros->'estacion_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filtros->'estacion_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'categorias' AND jsonb_typeof(p_filtros->'categorias') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_categorias
    FROM jsonb_array_elements_text(p_filtros->'categorias') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL AND value <> '__SIN_CATEGORIA__';
    v_sin_categoria := EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_filtros->'categorias') AS t(value)
      WHERE value = '__SIN_CATEGORIA__'
    );
  ELSE
    v_categorias := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'status' AND jsonb_typeof(p_filtros->'status') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_status
    FROM jsonb_array_elements_text(p_filtros->'status') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_status := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'diagnosticos' AND jsonb_typeof(p_filtros->'diagnosticos') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_diagnosticos
    FROM jsonb_array_elements_text(p_filtros->'diagnosticos') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_diagnosticos := ARRAY[]::text[];
  END IF;

  DROP TABLE IF EXISTS _tn_filtradas;
  CREATE TEMP TABLE _tn_filtradas ON COMMIT DROP AS
  SELECT
    tn.id,
    tn.peaje_id,
    pj.nombre        AS peaje_nombre,
    pj.empresa_id    AS empresa_id,
    emp.nombre       AS empresa_nombre,
    tn.estacion_id,
    est.nombre       AS estacion_nombre,
    tn.categoria,
    tn.categoria_calculated,
    tn.importe,
    tn.importe_base,
    tn.multiplicador,
    tn.cases,
    tn.desvio,
    tn.hora_min,
    tn.hora_max,
    tn.hora_media,
    tn.patron,
    tn.diagnostico,
    tn.status,
    cat.etiqueta   AS status_etiqueta,
    cat.color      AS status_color,
    cat.tipo_meta  AS status_tipo_meta,
    tn.muestra_confiable,
    tn.confirmado_manual,
    tn.confirmado_por,
    tn.confirmado_at,
    (
      SELECT count(DISTINCT f.importe)::integer
      FROM public.tarifas_normalizadas f
      WHERE f.estacion_id = tn.estacion_id
        AND f.categoria IS NOT DISTINCT FROM tn.categoria
    )              AS niveles_familia,
    tn.created_at,
    tn.updated_at
  FROM public.tarifas_normalizadas tn
  JOIN public.peajes     pj  ON pj.id = tn.peaje_id
  JOIN public.estaciones est ON est.id = tn.estacion_id
  LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
  LEFT JOIN public.tarifas_status_catalogo cat
         ON cat.peaje_id = tn.peaje_id AND cat.codigo = tn.status
  WHERE (v_peaje_id IS NULL OR tn.peaje_id = v_peaje_id)
    AND (cardinality(v_peaje_ids) = 0 OR tn.peaje_id = ANY (v_peaje_ids))
    AND (cardinality(v_estacion_ids) = 0 OR tn.estacion_id = ANY (v_estacion_ids))
    AND (
      (cardinality(v_categorias) = 0 AND NOT v_sin_categoria)
      OR tn.categoria = ANY (v_categorias)
      OR (v_sin_categoria AND tn.categoria IS NULL)
    )
    AND (cardinality(v_status) = 0 OR tn.status = ANY (v_status))
    AND (cardinality(v_diagnosticos) = 0 OR tn.diagnostico = ANY (v_diagnosticos))
    AND (v_patron IS NULL OR tn.patron = v_patron)
    AND (v_muestra IS NULL OR tn.muestra_confiable = v_muestra)
    AND (v_confirmado IS NULL OR tn.confirmado_manual = v_confirmado)
    AND (v_q_estacion IS NULL OR est.nombre ILIKE '%' || v_q_estacion || '%');

  SELECT count(*)::bigint INTO v_total FROM _tn_filtradas;

  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT f.*
    FROM _tn_filtradas f
    ORDER BY
      CASE WHEN v_asc     AND v_sort = 'cases'           THEN f.cases END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'cases'           THEN f.cases END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'importe'         THEN f.importe END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'importe'         THEN f.importe END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'multiplicador'   THEN f.multiplicador END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'multiplicador'   THEN f.multiplicador END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'desvio'          THEN f.desvio END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'desvio'          THEN f.desvio END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'hora_media'      THEN f.hora_media END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'hora_media'      THEN f.hora_media END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'estacion_nombre' THEN f.estacion_nombre END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'estacion_nombre' THEN f.estacion_nombre END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'categoria'       THEN f.categoria END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'categoria'       THEN f.categoria END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'status'          THEN f.status END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'status'          THEN f.status END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'diagnostico'     THEN f.diagnostico END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'diagnostico'     THEN f.diagnostico END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'updated_at'      THEN f.updated_at END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'updated_at'      THEN f.updated_at END DESC NULLS LAST,
      f.estacion_nombre ASC,
      f.importe ASC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text) IS
  'F14-2/F14-9 · Listado paginado/filtrado de niveles de tarifa (incluye categoria_calculated). p_sort usa formato campo:dir.';

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text)
  TO authenticated, service_role;
