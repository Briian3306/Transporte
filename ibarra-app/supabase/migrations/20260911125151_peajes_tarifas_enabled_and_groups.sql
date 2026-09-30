-- F14-21: explicit two-state tariff availability and grouped tarifario writes.
-- This migration is additive and keeps historical tarifa_importe/pasada rows intact.

ALTER TABLE public.tarifas
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

UPDATE public.tarifas SET enabled = true WHERE enabled IS NULL;

CREATE INDEX IF NOT EXISTS idx_tarifas_enabled_context
  ON public.tarifas (peaje_id, estacion_id, sentido, categoria, status)
  WHERE enabled;

COMMENT ON COLUMN public.tarifas.enabled IS
  'F14-21 · Current availability only. Disabled identities are historical and never participate in matching.';

CREATE OR REPLACE FUNCTION public._peajes_rechazar_importe_tarifa_deshabilitada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tarifas t WHERE t.id = NEW.tarifa_id AND NOT t.enabled) THEN
    RAISE EXCEPTION 'la identidad de tarifa esta deshabilitada; habilitala antes de guardar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_peajes_rechazar_importe_tarifa_deshabilitada ON public.tarifa_importe;
CREATE TRIGGER trg_peajes_rechazar_importe_tarifa_deshabilitada
  BEFORE INSERT ON public.tarifa_importe
  FOR EACH ROW EXECUTE FUNCTION public._peajes_rechazar_importe_tarifa_deshabilitada();

-- Existing matcher helper: disabled identities are not candidates.
CREATE OR REPLACE FUNCTION public._peajes_tarifas_montos_candidatos(
  p_estacion_id uuid,
  p_categoria smallint,
  p_sentido text,
  p_status text
)
RETURNS TABLE (
  tarifa_id uuid, peaje_id uuid, estacion_id uuid, status text, sentido text,
  dir_rank integer, requiere_normalizacion_iva boolean, current_tarifa_id uuid,
  tarifa_importe_id uuid, importe numeric, es_vigente boolean,
  fecha_aparicion timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.id, t.peaje_id, t.estacion_id, t.status, t.sentido,
    CASE WHEN t.sentido = p_sentido THEN 0 WHEN t.sentido = 'AMBAS' THEN 1 ELSE 2 END,
    t.requiere_normalizacion_iva, t.current_tarifa_id, ti.id, ti.importe,
    (ti.id IS NOT DISTINCT FROM t.current_tarifa_id), ti.fecha_aparicion, ti.created_at
  FROM public.estaciones e
  INNER JOIN public.tarifas t
    ON t.peaje_id = e.peaje_id AND t.estacion_id = e.id AND t.enabled
   AND t.categoria = p_categoria
   AND ((p_sentido = 'AMBAS' AND t.sentido = 'AMBAS')
     OR (p_sentido IN ('IDA', 'VUELTA') AND t.sentido IN (p_sentido, 'AMBAS')))
   AND (p_status IS NULL OR p_status NOT IN ('PICO', 'NO_PICO') OR t.status = p_status)
  LEFT JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  WHERE e.id = p_estacion_id;
$$;

-- Price-led matcher from F14-20 with the same contract and an explicit enabled predicate.
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
  WHERE e.id = p_estacion_id;
$$;

-- Editor payload now exposes the exact two-state value for every identity.
CREATE OR REPLACE FUNCTION public.peajes_obtener_tarifario_editor(
  p_peaje_id uuid, p_estacion_id uuid, p_sentido text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
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
    SELECT t.id AS tarifa_id, t.categoria, t.status,
      t.current_tarifa_id AS current_tarifa_importe_id, ti.importe,
      t.fecha_actualizacion, t.enabled
    FROM public.tarifas t
    LEFT JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
    WHERE t.peaje_id = p_peaje_id AND t.estacion_id = p_estacion_id AND t.sentido = v_sentido
  ) x;
  RETURN jsonb_build_object(
    'context', jsonb_build_object('peaje_id', p_peaje_id,
      'peaje_nombre', COALESCE(v_peaje_nombre, p_peaje_id::text),
      'estacion_id', p_estacion_id,
      'estacion_nombre', COALESCE(v_estacion_nombre, p_estacion_id::text),
      'sentido', v_sentido),
    'existentes', v_existentes
  );
END;
$$;

-- Immediate state changes. Missing identities are intentionally ignored.
CREATE OR REPLACE FUNCTION public.peajes_actualizar_estado_categorias(p_cambios jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_change jsonb;
  v_peaje uuid;
  v_estacion uuid;
  v_sentido text;
  v_categoria smallint;
  v_enabled boolean;
  v_key text;
  v_keys text[] := '{}';
  v_lock uuid;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un array JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    BEGIN
      v_peaje := NULLIF(btrim(v_change->>'peaje_id'), '')::uuid;
      v_estacion := NULLIF(btrim(v_change->>'estacion_id'), '')::uuid;
      v_categoria := (v_change->>'categoria')::smallint;
      v_enabled := (v_change->>'enabled')::boolean;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_cambios contiene tipos invalidos' USING ERRCODE = '22023';
    END;
    v_sentido := upper(btrim(v_change->>'sentido'));
    IF v_peaje IS NULL OR v_estacion IS NULL OR v_categoria IS NULL OR v_enabled IS NULL
      OR v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') OR v_categoria NOT BETWEEN 0 AND 10 THEN
      RAISE EXCEPTION 'operacion de estado invalida' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.estaciones e WHERE e.id = v_estacion AND e.peaje_id = v_peaje) THEN
      RAISE EXCEPTION 'la estacion no pertenece al peaje indicado';
    END IF;
    v_key := v_peaje::text || '|' || v_estacion::text || '|' || v_sentido || '|' || v_categoria::text;
    IF v_key = ANY(v_keys) THEN RAISE EXCEPTION 'p_cambios contiene categorias duplicadas'; END IF;
    v_keys := array_append(v_keys, v_key);
  END LOOP;

  FOR v_lock IN
    SELECT t.id FROM public.tarifas t
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_cambios) c
      WHERE t.peaje_id = (c->>'peaje_id')::uuid AND t.estacion_id = (c->>'estacion_id')::uuid
        AND t.sentido = upper(btrim(c->>'sentido')) AND t.categoria = (c->>'categoria')::smallint
    )
    ORDER BY t.peaje_id, t.estacion_id, t.sentido, t.categoria, t.status, t.id
    FOR UPDATE
  LOOP NULL; END LOOP;

  FOR v_change IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    UPDATE public.tarifas t
      SET enabled = (v_change->>'enabled')::boolean, updated_at = now()
    WHERE t.peaje_id = (v_change->>'peaje_id')::uuid
      AND t.estacion_id = (v_change->>'estacion_id')::uuid
      AND t.sentido = upper(btrim(v_change->>'sentido'))
      AND t.categoria = (v_change->>'categoria')::smallint;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('tarifa_id', t.id, 'enabled', t.enabled)), '[]'::jsonb)
      INTO v_rows
    FROM public.tarifas t
    WHERE t.peaje_id = (v_change->>'peaje_id')::uuid
      AND t.estacion_id = (v_change->>'estacion_id')::uuid
      AND t.sentido = upper(btrim(v_change->>'sentido'))
      AND t.categoria = (v_change->>'categoria')::smallint;
    v_rows := v_rows || '[]'::jsonb;
  END LOOP;
  -- Return one flattened row per existing identity, preserving the no-insert rule.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tarifa_id', t.id, 'enabled', t.enabled) ORDER BY t.id), '[]'::jsonb)
    INTO v_rows
  FROM public.tarifas t
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_cambios) c
    WHERE t.peaje_id = (c->>'peaje_id')::uuid AND t.estacion_id = (c->>'estacion_id')::uuid
      AND t.sentido = upper(btrim(c->>'sentido')) AND t.categoria = (c->>'categoria')::smallint
  );
  RETURN v_rows;
END;
$$;

-- Flattened grouped manual save. Validation happens before any mutation; the existing
-- append-only single-station RPC performs the validity/history rules in one transaction.
CREATE OR REPLACE FUNCTION public.peajes_guardar_tarifario_grupos(p_cambios jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_change jsonb;
  v_key text;
  v_keys text[] := '{}';
  v_peaje uuid;
  v_estacion uuid;
  v_sentido text;
  v_status text;
  v_categoria smallint;
  v_importe numeric;
  v_fecha date;
  v_result jsonb;
  v_count integer := 0;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un array JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    BEGIN
      v_peaje := NULLIF(btrim(v_change->>'peaje_id'), '')::uuid;
      v_estacion := NULLIF(btrim(v_change->>'estacion_id'), '')::uuid;
      v_categoria := (v_change->>'categoria')::smallint;
      v_importe := (v_change->>'importe')::numeric;
      v_fecha := NULLIF(btrim(v_change->>'fecha_vigencia_inicio'), '')::date;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format THEN
      RAISE EXCEPTION 'p_cambios contiene tipos invalidos' USING ERRCODE = '22023';
    END;
    v_sentido := upper(btrim(v_change->>'sentido'));
    v_status := upper(btrim(v_change->>'status'));
    IF v_peaje IS NULL OR v_estacion IS NULL OR v_categoria NOT BETWEEN 0 AND 10
      OR v_importe IS NULL OR v_importe <= 0 OR v_fecha IS NULL
      OR v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') OR v_status NOT IN ('PICO', 'NO_PICO') THEN
      RAISE EXCEPTION 'cambio de tarifario invalido' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.estaciones e WHERE e.id = v_estacion AND e.peaje_id = v_peaje) THEN
      RAISE EXCEPTION 'la estacion no pertenece al peaje indicado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.tarifas t WHERE t.peaje_id = v_peaje AND t.estacion_id = v_estacion
        AND t.sentido = v_sentido AND t.categoria = v_categoria AND t.status = v_status AND NOT t.enabled
    ) THEN
      RAISE EXCEPTION 'la identidad de tarifa esta deshabilitada; habilitala antes de guardar';
    END IF;
    v_key := v_peaje::text || '|' || v_estacion::text || '|' || v_sentido || '|' || v_categoria::text || '|' || v_status;
    IF v_key = ANY(v_keys) THEN RAISE EXCEPTION 'p_cambios contiene celdas duplicadas'; END IF;
    v_keys := array_append(v_keys, v_key);
  END LOOP;

  FOR v_change IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    v_result := public.peajes_guardar_tarifas_actuales(
      (v_change->>'peaje_id')::uuid,
      (v_change->>'estacion_id')::uuid,
      upper(btrim(v_change->>'sentido')),
      jsonb_build_array(v_change)
    );
    v_count := v_count + COALESCE((v_result->>'actualizadas')::integer, 0);
  END LOOP;
  RETURN jsonb_build_object('actualizadas', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_actualizar_estado_categorias(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_actualizar_estado_categorias(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.peajes_guardar_tarifario_grupos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_tarifario_grupos(jsonb) TO authenticated, service_role;

-- Current list defaults to enabled rows, but explicitly supports enabled=false or all.
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
    t.fecha_actualizacion, t.enabled, t.current_tarifa_id AS current_tarifa_importe_id,
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

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) TO authenticated, service_role;
