-- F14-17 Tarifario RPCs. No DDL. Uses F14-16 tarifas + tarifa_importe.

-- -----------------------------------------------------------------------------
-- 1) List current prices only
-- -----------------------------------------------------------------------------
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
  LEFT JOIN public.tarifa_importe ti
    ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
  WHERE (cardinality(v_peaje_ids) = 0 OR t.peaje_id = ANY (v_peaje_ids))
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

-- -----------------------------------------------------------------------------
-- 2) Editor for one peaje + estacion + sentido
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_obtener_tarifario_editor(
  p_peaje_id uuid,
  p_estacion_id uuid,
  p_sentido text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sentido text := upper(btrim(p_sentido));
  v_peaje_nombre text;
  v_estacion_nombre text;
  v_existentes jsonb;
BEGIN
  IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido USING ERRCODE = '22023';
  END IF;

  SELECT nombre INTO v_peaje_nombre FROM public.peajes WHERE id = p_peaje_id;
  SELECT nombre INTO v_estacion_nombre FROM public.estaciones WHERE id = p_estacion_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.categoria, x.status), '[]'::jsonb)
    INTO v_existentes
  FROM (
    SELECT
      t.id AS tarifa_id,
      t.categoria,
      t.status,
      t.current_tarifa_id AS current_tarifa_importe_id,
      ti.importe,
      t.fecha_actualizacion
    FROM public.tarifas t
    LEFT JOIN public.tarifa_importe ti
      ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.sentido = v_sentido
  ) x;

  RETURN jsonb_build_object(
    'context', jsonb_build_object(
      'peaje_id', p_peaje_id,
      'peaje_nombre', COALESCE(v_peaje_nombre, p_peaje_id::text),
      'estacion_id', p_estacion_id,
      'estacion_nombre', COALESCE(v_estacion_nombre, p_estacion_id::text),
      'sentido', v_sentido
    ),
    'existentes', v_existentes
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Bulk save: insert tarifas if missing, append tarifa_importe
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_guardar_tarifas_actuales(
  p_peaje_id uuid,
  p_estacion_id uuid,
  p_sentido text,
  p_cambios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sentido text := upper(btrim(p_sentido));
  v_cambio jsonb;
  v_categoria smallint;
  v_status text;
  v_importe numeric;
  v_tarifa_id uuid;
  v_n integer := 0;
BEGIN
  IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido USING ERRCODE = '22023';
  END IF;
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un array JSON' USING ERRCODE = '22023';
  END IF;

  FOR v_cambio IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    v_categoria := (v_cambio->>'categoria')::smallint;
    v_status := upper(btrim(v_cambio->>'status'));
    v_importe := (v_cambio->>'importe')::numeric;

    IF v_categoria IS NULL OR v_categoria < 0 OR v_categoria > 10 THEN
      RAISE EXCEPTION 'categoria invalida: %', v_cambio->>'categoria' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('PICO', 'NO_PICO') THEN
      RAISE EXCEPTION 'status invalido: %', v_cambio->>'status' USING ERRCODE = '22023';
    END IF;
    IF v_importe IS NULL OR v_importe <= 0 THEN
      RAISE EXCEPTION 'importe debe ser > 0 (F14-16 tarifa_importe_importe_chk)'
        USING ERRCODE = '23514';
    END IF;

    SELECT t.id INTO v_tarifa_id
    FROM public.tarifas t
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.status = v_status
      AND t.categoria = v_categoria
      AND t.sentido = v_sentido
    FOR UPDATE;

    IF v_tarifa_id IS NULL THEN
      INSERT INTO public.tarifas (
        peaje_id, estacion_id, status, categoria, sentido,
        requiere_normalizacion_iva, current_tarifa_id, fecha_actualizacion
      ) VALUES (
        p_peaje_id, p_estacion_id, v_status, v_categoria, v_sentido,
        false, NULL, now()
      )
      RETURNING id INTO v_tarifa_id;
    END IF;

    INSERT INTO public.tarifa_importe (tarifa_id, importe, fecha_aparicion)
    VALUES (v_tarifa_id, v_importe, now());

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('actualizadas', v_n);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) History for one tarifas.id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifa_historial(p_tarifa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_rows jsonb;
BEGIN
  SELECT current_tarifa_id INTO v_current
  FROM public.tarifas
  WHERE id = p_tarifa_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.fecha_aparicion DESC, x.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      ti.id,
      ti.importe,
      ti.fecha_aparicion,
      (ti.id IS NOT DISTINCT FROM v_current) AS es_actual
    FROM public.tarifa_importe ti
    WHERE ti.tarifa_id = p_tarifa_id
  ) x;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_listar_tarifa_historial(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifa_historial(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) IS
  'F14-17 · Lista precios vigentes (current_tarifa_id), no todo el historial.';
COMMENT ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text) IS
  'F14-17 · Identidades de un peaje+estacion+sentido. existentes=[] es exito.';
COMMENT ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) IS
  'F14-17 · Append tarifa_importe; el trigger promociona current. Crea tarifas si falta.';
COMMENT ON FUNCTION public.peajes_listar_tarifa_historial(uuid) IS
  'F14-17 · Historial de una tarifas.id con es_actual.';
