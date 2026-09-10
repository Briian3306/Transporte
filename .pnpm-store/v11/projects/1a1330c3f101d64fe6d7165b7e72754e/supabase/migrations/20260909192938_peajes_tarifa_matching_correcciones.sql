-- F14-19 Task 3 + Task 4: atomic CONFIRM_NEW / MARK_REVIEW saves, then
-- validity-aware ordered matching and category correction.
-- Function signatures of peajes_guardar_refresco_tarifas(jsonb) and
-- peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) stay unchanged.
-- Detect keeps fail-closed direction: null/conflicting never becomes AMBAS.

DROP FUNCTION IF EXISTS public._peajes_append_tarifa_importe_confirmado(uuid, numeric, integer);

CREATE OR REPLACE FUNCTION public._peajes_aplicar_importe_guardado(
  p_tarifa_id uuid,
  p_importe numeric,
  p_cases integer,
  p_diagnostico text,
  p_fecha_inicio date,
  p_categoria_calculated smallint
)
RETURNS TABLE (
  new_id uuid,
  prior_id uuid,
  prior_importe numeric,
  prior_fin date,
  new_inicio date,
  new_fin date
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_id uuid;
  v_prior_importe numeric;
  v_prior_fin date;
  v_new_id uuid;
BEGIN
  SELECT t.current_tarifa_id
    INTO v_current_id
    FROM public.tarifas t
   WHERE t.id = p_tarifa_id;

  IF v_current_id IS NOT NULL THEN
    SELECT ti.importe, ti.fecha_vigencia_fin
      INTO v_prior_importe, v_prior_fin
      FROM public.tarifa_importe ti
     WHERE ti.id = v_current_id;
  END IF;

  IF p_diagnostico = 'CONFIRMADO' THEN
    IF v_current_id IS NOT NULL THEN
      UPDATE public.tarifa_importe
         SET fecha_vigencia_fin = p_fecha_inicio
       WHERE id = v_current_id
         AND fecha_vigencia_fin IS NULL;
      v_prior_fin := p_fecha_inicio;
    END IF;

    INSERT INTO public.tarifa_importe (
      tarifa_id, importe, cases, fecha_aparicion,
      diagnostico, fecha_vigencia_inicio, categoria_calculated
    ) VALUES (
      p_tarifa_id, p_importe, p_cases, now(),
      'CONFIRMADO', p_fecha_inicio, p_categoria_calculated
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT
      v_new_id, v_current_id, v_prior_importe, v_prior_fin,
      p_fecha_inicio, NULL::date;
    RETURN;
  END IF;

  INSERT INTO public.tarifa_importe (
    tarifa_id, importe, cases, fecha_aparicion,
    diagnostico, categoria_calculated
  ) VALUES (
    p_tarifa_id, p_importe, p_cases, now(),
    'REVISAR', p_categoria_calculated
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    v_new_id, v_current_id, v_prior_importe, v_prior_fin,
    NULL::date, NULL::date;
END;
$$;

COMMENT ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint) IS
  'F14-19 · Cierra el vigente y appendea CONFIRMADO, o appendea REVISAR sin tocar el puntero.';

REVOKE ALL ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint)
  TO authenticated, service_role;

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
  v_fecha date;
  v_tarifa_id uuid;
  v_current_id uuid;
  v_cur_inicio date;
  v_n integer := 0;
  v_lock_id uuid;
  v_est_peaje uuid;
BEGIN
  IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido USING ERRCODE = '22023';
  END IF;
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un array JSON' USING ERRCODE = '22023';
  END IF;

  SELECT e.peaje_id INTO v_est_peaje FROM public.estaciones e WHERE e.id = p_estacion_id;
  IF v_est_peaje IS NULL OR v_est_peaje IS DISTINCT FROM p_peaje_id THEN
    RAISE EXCEPTION 'la estacion no pertenece al peaje indicado';
  END IF;

  FOR v_cambio IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    BEGIN
      v_categoria := (v_cambio->>'categoria')::smallint;
      v_importe := (v_cambio->>'importe')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos' USING ERRCODE = '22023';
    END;
    v_status := upper(btrim(v_cambio->>'status'));
    BEGIN
      v_fecha := NULLIF(btrim(COALESCE(
        v_cambio->>'fecha_vigencia_inicio',
        v_cambio->>'fechaVigenciaInicio'
      )), '')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'fecha_vigencia_inicio es obligatorio para CONFIRM_NEW';
    END;

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
    IF v_fecha IS NULL THEN
      RAISE EXCEPTION 'fecha_vigencia_inicio es obligatorio para CONFIRM_NEW';
    END IF;
  END LOOP;

  FOR v_lock_id IN
    SELECT t.id
    FROM public.tarifas t
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.sentido = v_sentido
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_cambios) c
        WHERE (c->>'categoria')::smallint = t.categoria
          AND upper(btrim(c->>'status')) = t.status
      )
    ORDER BY t.peaje_id, t.estacion_id, t.sentido, t.categoria, t.status
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  FOR v_cambio IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    v_categoria := (v_cambio->>'categoria')::smallint;
    v_status := upper(btrim(v_cambio->>'status'));
    v_fecha := NULLIF(btrim(COALESCE(
      v_cambio->>'fecha_vigencia_inicio',
      v_cambio->>'fechaVigenciaInicio'
    )), '')::date;

    SELECT t.id, t.current_tarifa_id
      INTO v_tarifa_id, v_current_id
      FROM public.tarifas t
     WHERE t.peaje_id = p_peaje_id
       AND t.estacion_id = p_estacion_id
       AND t.status = v_status
       AND t.categoria = v_categoria
       AND t.sentido = v_sentido;

    IF v_tarifa_id IS NOT NULL THEN
      IF v_current_id IS NOT NULL THEN
        SELECT ti.fecha_vigencia_inicio
          INTO v_cur_inicio
          FROM public.tarifa_importe ti
         WHERE ti.id = v_current_id;
        IF v_cur_inicio IS NOT NULL AND v_fecha <= v_cur_inicio THEN
          RAISE EXCEPTION 'la vigencia nueva se superpone o inicia antes del vigente';
        END IF;
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.tarifa_importe ti
        WHERE ti.tarifa_id = v_tarifa_id
          AND ti.diagnostico = 'CONFIRMADO'
          AND ti.fecha_vigencia_inicio IS NOT NULL
          AND ti.id IS DISTINCT FROM v_current_id
          AND daterange(
                ti.fecha_vigencia_inicio,
                COALESCE(ti.fecha_vigencia_fin, 'infinity'::date),
                '[)'
              ) && daterange(v_fecha, 'infinity'::date, '[)')
      ) THEN
        RAISE EXCEPTION 'la vigencia nueva se superpone o inicia antes del vigente';
      END IF;
    END IF;
  END LOOP;

  FOR v_cambio IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    v_categoria := (v_cambio->>'categoria')::smallint;
    v_status := upper(btrim(v_cambio->>'status'));
    v_importe := (v_cambio->>'importe')::numeric;
    v_fecha := NULLIF(btrim(COALESCE(
      v_cambio->>'fecha_vigencia_inicio',
      v_cambio->>'fechaVigenciaInicio'
    )), '')::date;

    SELECT t.id INTO v_tarifa_id
    FROM public.tarifas t
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.status = v_status
      AND t.categoria = v_categoria
      AND t.sentido = v_sentido;

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

    PERFORM public._peajes_aplicar_importe_guardado(
      v_tarifa_id, v_importe, 0, 'CONFIRMADO', v_fecha, NULL
    );

    UPDATE public.tarifas
       SET fecha_actualizacion = now()
     WHERE id = v_tarifa_id;

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('actualizadas', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_guardar_refresco_tarifas(
  p_cambios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_ord integer;
  v_action text;
  v_candidate text;
  v_peaje uuid;
  v_estacion uuid;
  v_sentido text;
  v_categoria smallint;
  v_cat_calc smallint;
  v_status text;
  v_importe numeric;
  v_cases integer;
  v_fecha date;
  v_iva boolean;
  v_iva_present boolean;
  v_key text;
  v_keys text[] := '{}';
  v_cand_keys text[] := '{}';
  v_est_peaje uuid;
  v_tarifa_id uuid;
  v_current_id uuid;
  v_current_importe numeric;
  v_cur_inicio date;
  v_flag boolean;
  v_was_new boolean;
  v_accion text;
  v_new_ti uuid;
  v_prior_fin date;
  v_new_inicio date;
  v_new_fin date;
  v_lock_id uuid;
  v_applied record;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un arreglo JSON';
  END IF;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_action := upper(btrim(COALESCE(v_elem->>'action', '')));
    v_candidate := NULLIF(btrim(COALESCE(v_elem->>'candidate_id', v_elem->>'candidateId')), '');
    BEGIN
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_cambios contiene UUID invalido';
    END;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    BEGIN
      v_cat_calc := COALESCE(
        (v_elem->>'categoria_calculada')::smallint,
        (v_elem->>'categoriaCalculada')::smallint
      );
      v_categoria := COALESCE(
        v_cat_calc,
        (v_elem->>'categoria')::smallint,
        (v_elem->>'categoriaProveedor')::smallint
      );
      v_importe := (COALESCE(v_elem->>'importe', ''))::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos';
    END;
    IF COALESCE(btrim(v_elem->>'cases'), '') = '' THEN
      v_cases := 0;
    ELSIF btrim(v_elem->>'cases') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'cases invalido: %', v_elem->>'cases' USING ERRCODE = '23514';
    ELSE
      v_cases := (v_elem->>'cases')::integer;
    END IF;
    v_iva_present := COALESCE(jsonb_typeof(COALESCE(
      v_elem->'requiere_normalizacion_iva',
      v_elem->'requiereNormalizacionIva'
    )) = 'boolean', false);
    v_iva := COALESCE(
      (v_elem->>'requiere_normalizacion_iva')::boolean,
      (v_elem->>'requiereNormalizacionIva')::boolean
    );
    BEGIN
      v_fecha := NULLIF(btrim(COALESCE(
        v_elem->>'fecha_vigencia_inicio',
        v_elem->>'fechaVigenciaInicio'
      )), '')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos';
    END;

    IF v_action NOT IN ('CONFIRM_NEW', 'MARK_REVIEW') THEN
      RAISE EXCEPTION 'accion invalida: %', COALESCE(v_elem->>'action', '');
    END IF;
    IF v_peaje IS NULL OR v_estacion IS NULL OR v_categoria IS NULL OR v_importe IS NULL THEN
      RAISE EXCEPTION 'p_cambios incompleto o tipos invalidos';
    END IF;
    IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
      RAISE EXCEPTION 'sentido invalido: %', COALESCE(v_elem->>'sentido', '');
    END IF;
    IF v_status NOT IN ('PICO', 'NO_PICO') THEN
      RAISE EXCEPTION 'status invalido: %', COALESCE(v_elem->>'status', '');
    END IF;
    IF v_categoria < 0 OR v_categoria > 10 THEN
      RAISE EXCEPTION 'categoria invalida: %', COALESCE(
        v_elem->>'categoria',
        v_elem->>'categoriaProveedor',
        v_elem->>'categoria_calculada',
        v_elem->>'categoriaCalculada'
      );
    END IF;
    IF v_cat_calc IS NOT NULL AND (v_cat_calc < 0 OR v_cat_calc > 10) THEN
      RAISE EXCEPTION 'categoria invalida: %', v_cat_calc;
    END IF;
    IF v_importe <= 0 THEN
      RAISE EXCEPTION 'importe debe ser > 0';
    END IF;
    IF v_action = 'CONFIRM_NEW' AND v_fecha IS NULL THEN
      RAISE EXCEPTION 'fecha_vigencia_inicio es obligatorio para CONFIRM_NEW';
    END IF;
    IF v_action = 'MARK_REVIEW' AND v_fecha IS NOT NULL THEN
      RAISE EXCEPTION 'fecha_vigencia_inicio no aplica a MARK_REVIEW';
    END IF;

    IF v_candidate IS NOT NULL THEN
      IF v_candidate = ANY (v_cand_keys) THEN
        RAISE EXCEPTION 'p_cambios contiene candidatos duplicados';
      END IF;
      v_cand_keys := array_append(v_cand_keys, v_candidate);
    END IF;

    v_key := v_peaje::text || '|' || v_estacion::text || '|' || v_sentido || '|'
      || v_categoria::text || '|' || v_status;
    IF v_key = ANY (v_keys) THEN
      RAISE EXCEPTION 'p_cambios contiene celdas duplicadas';
    END IF;
    v_keys := array_append(v_keys, v_key);

    SELECT e.peaje_id INTO v_est_peaje FROM public.estaciones e WHERE e.id = v_estacion;
    IF v_est_peaje IS NULL OR v_est_peaje IS DISTINCT FROM v_peaje THEN
      RAISE EXCEPTION 'la estacion no pertenece al peaje indicado';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.tarifas t
      WHERE t.peaje_id = v_peaje AND t.estacion_id = v_estacion
        AND t.sentido = v_sentido AND t.categoria = v_categoria AND t.status = v_status
    ) AND v_iva_present IS NOT TRUE THEN
      RAISE EXCEPTION 'requiere_normalizacion_iva es obligatorio para una identidad nueva';
    END IF;
  END LOOP;

  FOR v_lock_id IN
    SELECT t.id
    FROM public.tarifas t
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_cambios) e
      WHERE t.peaje_id = NULLIF(btrim(COALESCE(e->>'peaje_id', e->>'peajeId')), '')::uuid
        AND t.estacion_id = NULLIF(btrim(COALESCE(e->>'estacion_id', e->>'estacionId')), '')::uuid
        AND t.sentido = upper(btrim(COALESCE(e->>'sentido', '')))
        AND t.status = upper(btrim(COALESCE(e->>'status', '')))
        AND t.categoria = COALESCE(
          (e->>'categoria_calculada')::smallint,
          (e->>'categoriaCalculada')::smallint,
          (e->>'categoria')::smallint,
          (e->>'categoriaProveedor')::smallint
        )
    )
    ORDER BY t.peaje_id, t.estacion_id, t.sentido, t.categoria, t.status
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_action := upper(btrim(COALESCE(v_elem->>'action', '')));
    IF v_action <> 'CONFIRM_NEW' THEN
      CONTINUE;
    END IF;
    v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
    v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    v_cat_calc := COALESCE(
      (v_elem->>'categoria_calculada')::smallint,
      (v_elem->>'categoriaCalculada')::smallint
    );
    v_categoria := COALESCE(
      v_cat_calc,
      (v_elem->>'categoria')::smallint,
      (v_elem->>'categoriaProveedor')::smallint
    );
    v_fecha := NULLIF(btrim(COALESCE(
      v_elem->>'fecha_vigencia_inicio',
      v_elem->>'fechaVigenciaInicio'
    )), '')::date;

    SELECT t.id, t.current_tarifa_id
      INTO v_tarifa_id, v_current_id
      FROM public.tarifas t
     WHERE t.peaje_id = v_peaje AND t.estacion_id = v_estacion AND t.sentido = v_sentido
       AND t.categoria = v_categoria AND t.status = v_status;

    IF v_tarifa_id IS NULL THEN
      CONTINUE;
    END IF;

    v_cur_inicio := NULL;
    v_current_importe := NULL;
    v_importe := (v_elem->>'importe')::numeric;
    IF v_current_id IS NOT NULL THEN
      SELECT ti.fecha_vigencia_inicio, ti.importe
        INTO v_cur_inicio, v_current_importe
        FROM public.tarifa_importe ti
       WHERE ti.id = v_current_id;
      IF v_cur_inicio IS NOT NULL AND v_fecha <= v_cur_inicio THEN
        IF NOT (
          v_fecha = v_cur_inicio
          AND v_current_importe IS NOT NULL
          AND v_current_importe = v_importe
        ) THEN
          RAISE EXCEPTION 'la vigencia nueva se superpone o inicia antes del vigente';
        END IF;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.tarifa_importe ti
      WHERE ti.tarifa_id = v_tarifa_id
        AND ti.diagnostico = 'CONFIRMADO'
        AND ti.fecha_vigencia_inicio IS NOT NULL
        AND ti.id IS DISTINCT FROM v_current_id
        AND daterange(
              ti.fecha_vigencia_inicio,
              COALESCE(ti.fecha_vigencia_fin, 'infinity'::date),
              '[)'
            ) && daterange(v_fecha, 'infinity'::date, '[)')
    ) THEN
      RAISE EXCEPTION 'la vigencia nueva se superpone o inicia antes del vigente';
    END IF;
  END LOOP;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_action := upper(btrim(COALESCE(v_elem->>'action', '')));
    v_candidate := NULLIF(btrim(COALESCE(v_elem->>'candidate_id', v_elem->>'candidateId')), '');
    v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
    v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    v_cat_calc := COALESCE(
      (v_elem->>'categoria_calculada')::smallint,
      (v_elem->>'categoriaCalculada')::smallint
    );
    v_categoria := COALESCE(
      v_cat_calc,
      (v_elem->>'categoria')::smallint,
      (v_elem->>'categoriaProveedor')::smallint
    );
    v_importe := (v_elem->>'importe')::numeric;
    v_cases := COALESCE((v_elem->>'cases')::integer, 0);
    v_iva := COALESCE(
      (v_elem->>'requiere_normalizacion_iva')::boolean,
      (v_elem->>'requiereNormalizacionIva')::boolean
    );
    v_fecha := NULLIF(btrim(COALESCE(
      v_elem->>'fecha_vigencia_inicio',
      v_elem->>'fechaVigenciaInicio'
    )), '')::date;
    v_tarifa_id := NULL;
    v_current_id := NULL;
    v_flag := NULL;
    v_new_ti := NULL;
    v_current_importe := NULL;
    v_prior_fin := NULL;
    v_new_inicio := NULL;
    v_new_fin := NULL;

    SELECT t.id, t.current_tarifa_id, t.requiere_normalizacion_iva
    INTO v_tarifa_id, v_current_id, v_flag
    FROM public.tarifas t
    WHERE t.peaje_id = v_peaje AND t.estacion_id = v_estacion AND t.sentido = v_sentido
      AND t.categoria = v_categoria AND t.status = v_status;

    v_was_new := v_tarifa_id IS NULL;
    IF v_was_new THEN
      INSERT INTO public.tarifas (
        peaje_id, estacion_id, status, categoria, sentido,
        requiere_normalizacion_iva, current_tarifa_id, fecha_actualizacion
      ) VALUES (
        v_peaje, v_estacion, v_status, v_categoria, v_sentido, v_iva, NULL, now()
      ) RETURNING id INTO v_tarifa_id;
      v_current_id := NULL;
    END IF;

    v_cur_inicio := NULL;
    IF v_current_id IS NOT NULL THEN
      SELECT ti.importe, ti.fecha_vigencia_fin, ti.fecha_vigencia_inicio
        INTO v_current_importe, v_prior_fin, v_cur_inicio
        FROM public.tarifa_importe ti
       WHERE ti.id = v_current_id;
    END IF;

    IF v_action = 'CONFIRM_NEW'
       AND v_current_importe IS NOT NULL
       AND v_current_importe = v_importe
       AND (v_fecha IS NULL OR v_fecha IS NOT DISTINCT FROM v_cur_inicio)
    THEN
      v_accion := 'SIN_CAMBIO';
      v_new_ti := NULL;
    ELSIF v_action = 'MARK_REVIEW' THEN
      SELECT *
        INTO v_applied
        FROM public._peajes_aplicar_importe_guardado(
          v_tarifa_id, v_importe, v_cases, 'REVISAR', NULL, v_cat_calc
        );
      v_new_ti := v_applied.new_id;
      v_current_importe := v_applied.prior_importe;
      v_prior_fin := v_applied.prior_fin;
      v_new_inicio := v_applied.new_inicio;
      v_new_fin := v_applied.new_fin;
      v_accion := 'REVISAR';
    ELSE
      SELECT *
        INTO v_applied
        FROM public._peajes_aplicar_importe_guardado(
          v_tarifa_id, v_importe, v_cases, 'CONFIRMADO', v_fecha, v_cat_calc
        );
      v_new_ti := v_applied.new_id;
      v_current_importe := v_applied.prior_importe;
      v_prior_fin := v_applied.prior_fin;
      v_new_inicio := v_applied.new_inicio;
      v_new_fin := v_applied.new_fin;
      v_accion := CASE WHEN v_was_new THEN 'IDENTIDAD_CREADA' ELSE 'ACTUALIZADA' END;
      UPDATE public.tarifas
         SET fecha_actualizacion = now()
       WHERE id = v_tarifa_id;
    END IF;

    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object(
        'peaje_id', v_peaje,
        'estacion_id', v_estacion,
        'sentido', v_sentido,
        'categoria', v_categoria,
        'status', v_status,
        'tarifa_id', v_tarifa_id,
        'nueva', v_importe,
        'accion', v_accion,
        'anterior', v_current_importe,
        'tarifa_importe_id', v_new_ti,
        'candidate_id', v_candidate,
        'anterior_fin', v_prior_fin,
        'fecha_vigencia_inicio', v_new_inicio,
        'fecha_vigencia_fin', v_new_fin,
        'diagnostico', CASE
          WHEN v_accion = 'SIN_CAMBIO' THEN NULL
          WHEN v_action = 'MARK_REVIEW' THEN 'REVISAR'
          ELSE 'CONFIRMADO'
        END,
        'categoria_calculada', v_cat_calc
      )
    );
  END LOOP;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) IS
  'F14-19 · Guardado atómico CONFIRM_NEW / MARK_REVIEW. Cierra el vigente en el nuevo inicio; REVISAR no mueve el puntero.';

COMMENT ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) IS
  'F14-19 · Editor de ruta: append CONFIRMADO con fecha_vigencia_inicio explícita. Firma intacta.';

REVOKE ALL ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Task 4: validity-aware matching across categories.
-- -----------------------------------------------------------------------------
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
      WHEN p_fecha_pasada IS NULL THEN
        CASE WHEN ti.fecha_vigencia_inicio IS NOT NULL THEN 0 ELSE 1 END
      WHEN ti.fecha_vigencia_inicio IS NULL
        AND ti.fecha_vigencia_fin IS NULL THEN 1
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
      WHEN ti.fecha_vigencia_inicio IS NULL
        AND ti.fecha_vigencia_fin IS NULL THEN true
      WHEN ti.fecha_vigencia_inicio IS NOT NULL
        AND p_fecha_pasada >= ti.fecha_vigencia_inicio
        AND (ti.fecha_vigencia_fin IS NULL OR p_fecha_pasada < ti.fecha_vigencia_fin) THEN true
      ELSE false
    END
  FROM public.estaciones e
  INNER JOIN public.tarifas t
    ON t.peaje_id = e.peaje_id
   AND t.estacion_id = e.id
   AND (
     (p_sentido = 'AMBAS' AND t.sentido = 'AMBAS')
     OR (p_sentido IN ('IDA', 'VUELTA') AND t.sentido IN (p_sentido, 'AMBAS'))
   )
   AND (
     p_status IS NULL
     OR p_status NOT IN ('PICO', 'NO_PICO')
     OR t.status = p_status
   )
  INNER JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN t.requiere_normalizacion_iva THEN p_precio_normalizado
      ELSE p_precio_directo
    END AS precio_comparado
  ) v
  WHERE e.id = p_estacion_id;
$$;

COMMENT ON FUNCTION public._peajes_tarifas_matching_candidatos(uuid, smallint, text, text, date, numeric, numeric) IS
  'F14-19 · Relación privada de vigentes e historial en todas las categorías, con rangos de sentido/vigencia/error. No aplica IVA.';

REVOKE ALL ON FUNCTION public._peajes_tarifas_matching_candidatos(uuid, smallint, text, text, date, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_tarifas_matching_candidatos(uuid, smallint, text, text, date, numeric, numeric)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.peajes_detectar_refresco_tarifas(
  p_candidatos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_candidatos) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH input AS (
    SELECT
      t.ord,
      COALESCE(NULLIF(btrim(t.elem->>'id'), ''), (t.ord - 1)::text) AS id,
      NULLIF(btrim(t.elem->>'estacion_id'), '')::uuid AS estacion_id,
      CASE
        WHEN t.elem ? 'categoria_proveedor'
          AND t.elem->'categoria_proveedor' IS NOT NULL
          AND jsonb_typeof(t.elem->'categoria_proveedor') <> 'null' THEN
          CASE
            WHEN jsonb_typeof(t.elem->'categoria_proveedor') = 'number'
              AND (t.elem->>'categoria_proveedor') ~ '^[0-9]+(\.0+)?$'
              THEN trunc((t.elem->>'categoria_proveedor')::numeric)::smallint
            WHEN jsonb_typeof(t.elem->'categoria_proveedor') = 'string'
              AND btrim(t.elem->>'categoria_proveedor') ~ '^[0-9]+$'
              THEN btrim(t.elem->>'categoria_proveedor')::smallint
            ELSE NULL
          END
        WHEN t.elem->'categoria' IS NULL
          OR jsonb_typeof(t.elem->'categoria') = 'null' THEN NULL
        WHEN jsonb_typeof(t.elem->'categoria') = 'number'
          AND (t.elem->>'categoria') ~ '^[0-9]+(\.0+)?$'
          THEN trunc((t.elem->>'categoria')::numeric)::smallint
        WHEN jsonb_typeof(t.elem->'categoria') = 'string'
          AND btrim(t.elem->>'categoria') ~ '^[0-9]+$'
          THEN btrim(t.elem->>'categoria')::smallint
        ELSE NULL
      END AS categoria,
      NULLIF(upper(btrim(t.elem->>'status_solicitado')), '') AS status_in,
      NULLIF(upper(btrim(t.elem->>'sentido_solicitado')), '') AS sentido,
      NULLIF(upper(btrim(t.elem->>'unresolvedReason')), '') AS unresolved_reason,
      NULLIF(btrim(COALESCE(t.elem->>'fecha_pasada', t.elem->>'fechaPasada')), '')::date AS fecha_pasada,
      (t.elem->>'precio_directo')::numeric AS precio_directo,
      (t.elem->>'precio_normalizado')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  with_peaje AS (
    SELECT
      i.*,
      e.peaje_id,
      CASE
        WHEN i.sentido IS NULL OR i.sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
          CASE WHEN i.unresolved_reason = 'CONFLICT' THEN 'DIRECTION_CONFLICT' ELSE 'DIRECTION_REQUIRED' END
        WHEN i.categoria IS NULL OR e.peaje_id IS NULL THEN 'CONTEXT_INCOMPLETE'
        ELSE NULL
      END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
  ),
  montos AS (
    SELECT
      p.ord,
      p.id,
      p.peaje_id,
      p.estacion_id,
      p.categoria AS categoria_proveedor,
      p.status_in,
      p.sentido AS sentido_solicitado,
      p.early_codigo,
      c.tarifa_id,
      c.categoria,
      c.status,
      c.sentido,
      c.same_category,
      c.dir_rank,
      c.current_rank,
      c.validity_rank,
      c.diagnostico,
      c.error_relativo,
      c.requiere_normalizacion_iva,
      c.current_tarifa_id,
      c.tarifa_importe_id,
      c.importe,
      c.es_vigente,
      c.fecha_vigencia_inicio,
      c.fecha_vigencia_fin,
      c.precio_comparado,
      c.compatible_validity
    FROM with_peaje p
    LEFT JOIN LATERAL public._peajes_tarifas_matching_candidatos(
      p.estacion_id,
      p.categoria,
      p.sentido,
      CASE WHEN p.status_in IN ('PICO', 'NO_PICO') THEN p.status_in ELSE NULL END,
      p.fecha_pasada,
      p.precio_directo,
      p.precio_normalizado
    ) c ON p.early_codigo IS NULL
  ),
  amount_hits AS (
    SELECT m.*
    FROM montos m
    WHERE m.early_codigo IS NULL
      AND m.importe IS NOT NULL
      AND m.importe <> 0
      AND m.precio_comparado IS NOT NULL
      AND abs(m.precio_comparado - m.importe) / m.importe <= 0.01
  ),
  possible AS (
    SELECT
      h.ord,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'tarifa_id', h.tarifa_id,
            'tarifa_importe_id', h.tarifa_importe_id,
            'categoria', h.categoria,
            'status', h.status,
            'sentido', h.sentido,
            'importe', h.importe,
            'diagnostico', h.diagnostico,
            'fecha_vigencia_inicio', h.fecha_vigencia_inicio,
            'fecha_vigencia_fin', h.fecha_vigencia_fin,
            'es_actual', h.es_vigente,
            'error_relativo', h.error_relativo
          )
          ORDER BY h.same_category DESC, h.current_rank, h.validity_rank,
            h.categoria, h.status, h.sentido, h.tarifa_id, h.tarifa_importe_id
        ),
        '[]'::jsonb
      ) AS possible_matches
    FROM amount_hits h
    WHERE h.compatible_validity
    GROUP BY h.ord
  ),
  safe AS (
    SELECT a.*
    FROM amount_hits a
    WHERE a.compatible_validity
      AND a.diagnostico IS DISTINCT FROM 'REVISAR'
  ),
  best_dir AS (
    SELECT s.ord, min(s.dir_rank) AS dir_rank
    FROM safe s
    GROUP BY s.ord
  ),
  safe_dir AS (
    SELECT s.*
    FROM safe s
    INNER JOIN best_dir b ON b.ord = s.ord AND s.dir_rank = b.dir_rank
  ),
  buckets AS (
    SELECT
      s.ord,
      count(DISTINCT s.tarifa_id) FILTER (WHERE s.same_category AND s.current_rank = 0) AS n_same_cur,
      count(DISTINCT s.tarifa_id) FILTER (WHERE s.same_category AND s.current_rank = 1) AS n_same_hist,
      count(DISTINCT s.tarifa_id) FILTER (WHERE NOT s.same_category AND s.current_rank = 0) AS n_other_cur,
      count(DISTINCT s.tarifa_id) FILTER (WHERE NOT s.same_category AND s.current_rank = 1) AS n_other_hist,
      count(DISTINCT s.categoria) FILTER (WHERE s.current_rank = 0) AS n_cat_cur,
      count(DISTINCT s.status) FILTER (WHERE s.same_category AND s.current_rank = 0) AS n_status_same_cur,
      count(DISTINCT s.status) FILTER (WHERE s.same_category AND s.current_rank = 1) AS n_status_same_hist,
      count(DISTINCT s.status) FILTER (WHERE NOT s.same_category AND s.current_rank = 0) AS n_status_other_cur,
      count(DISTINCT s.status) FILTER (WHERE NOT s.same_category AND s.current_rank = 1) AS n_status_other_hist
    FROM safe_dir s
    GROUP BY s.ord
  ),
  pick_same_cur AS (
    SELECT DISTINCT ON (s.ord) s.*
    FROM safe_dir s
    WHERE s.same_category AND s.current_rank = 0
    ORDER BY s.ord, s.validity_rank, s.tarifa_id, s.tarifa_importe_id
  ),
  pick_same_hist AS (
    SELECT DISTINCT ON (s.ord) s.*
    FROM safe_dir s
    WHERE s.same_category AND s.current_rank = 1
    ORDER BY s.ord, s.validity_rank, s.tarifa_id, s.tarifa_importe_id
  ),
  pick_other_cur AS (
    SELECT DISTINCT ON (s.ord) s.*
    FROM safe_dir s
    WHERE NOT s.same_category AND s.current_rank = 0
    ORDER BY s.ord, s.validity_rank, s.tarifa_id, s.tarifa_importe_id
  ),
  pick_other_hist AS (
    SELECT DISTINCT ON (s.ord) s.*
    FROM safe_dir s
    WHERE NOT s.same_category AND s.current_rank = 1
    ORDER BY s.ord, s.validity_rank, s.tarifa_id, s.tarifa_importe_id
  ),
  coded AS (
    SELECT
      p.ord,
      p.id,
      p.peaje_id,
      p.estacion_id,
      p.categoria,
      p.status_in,
      p.sentido AS sentido_solicitado,
      p.early_codigo,
      COALESCE(pm.possible_matches, '[]'::jsonb) AS possible_matches,
      CASE
        WHEN p.early_codigo IS NOT NULL THEN p.early_codigo
        WHEN COALESCE(b.n_same_cur, 0) > 0 THEN
          CASE
            WHEN COALESCE(b.n_cat_cur, 0) > 1 THEN 'AMBIGUOUS_TARIFF_MATCH'
            WHEN b.n_same_cur > 1 THEN
              CASE
                WHEN (p.status_in IS NULL OR p.status_in NOT IN ('PICO', 'NO_PICO'))
                  AND COALESCE(b.n_status_same_cur, 0) > 1 THEN 'STATUS_AMBIGUOUS'
                ELSE 'AMBIGUOUS_TARIFF_MATCH'
              END
            ELSE 'CURRENT_TARIFF'
          END
        WHEN COALESCE(b.n_same_hist, 0) > 0 THEN
          CASE
            WHEN b.n_same_hist > 1 THEN
              CASE
                WHEN (p.status_in IS NULL OR p.status_in NOT IN ('PICO', 'NO_PICO'))
                  AND COALESCE(b.n_status_same_hist, 0) > 1 THEN 'STATUS_AMBIGUOUS'
                ELSE 'AMBIGUOUS_TARIFF_MATCH'
              END
            ELSE 'HISTORICAL_TARIFF_MATCH'
          END
        WHEN COALESCE(b.n_other_cur, 0) > 0 THEN
          CASE
            WHEN b.n_other_cur > 1 THEN
              CASE
                WHEN (p.status_in IS NULL OR p.status_in NOT IN ('PICO', 'NO_PICO'))
                  AND COALESCE(b.n_status_other_cur, 0) > 1
                  AND COALESCE(b.n_cat_cur, 0) <= 1 THEN 'STATUS_AMBIGUOUS'
                ELSE 'AMBIGUOUS_TARIFF_MATCH'
              END
            ELSE 'CURRENT_CATEGORY_CORRECTION'
          END
        WHEN COALESCE(b.n_other_hist, 0) > 0 THEN
          CASE
            WHEN b.n_other_hist > 1 THEN
              CASE
                WHEN (p.status_in IS NULL OR p.status_in NOT IN ('PICO', 'NO_PICO'))
                  AND COALESCE(b.n_status_other_hist, 0) > 1 THEN 'STATUS_AMBIGUOUS'
                ELSE 'AMBIGUOUS_TARIFF_MATCH'
              END
            ELSE 'HISTORICAL_CATEGORY_CORRECTION'
          END
        WHEN p.status_in IS NULL OR p.status_in NOT IN ('PICO', 'NO_PICO') THEN 'STATUS_REQUIRED'
        ELSE 'NEW_TARIFF'
      END AS codigo
    FROM with_peaje p
    LEFT JOIN buckets b ON b.ord = p.ord
    LEFT JOIN possible pm ON pm.ord = p.ord
  ),
  decided AS (
    SELECT
      c.*,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.tarifa_id
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.tarifa_id
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.tarifa_id
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.tarifa_id
        ELSE NULL
      END AS pick_tarifa_id,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.status
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.status
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.status
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.status
        ELSE NULL
      END AS pick_status,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.sentido
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.sentido
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.sentido
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.sentido
        ELSE NULL
      END AS pick_sentido,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.requiere_normalizacion_iva
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.requiere_normalizacion_iva
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.requiere_normalizacion_iva
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.requiere_normalizacion_iva
        ELSE NULL
      END AS pick_iva,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.tarifa_importe_id
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.tarifa_importe_id
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.tarifa_importe_id
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.tarifa_importe_id
        ELSE NULL
      END AS pick_ti,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.importe
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.importe
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.importe
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.importe
        ELSE NULL
      END AS pick_importe,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.categoria
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.categoria
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.categoria
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.categoria
        ELSE NULL
      END AS pick_categoria,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.diagnostico
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.diagnostico
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.diagnostico
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.diagnostico
        ELSE NULL
      END AS pick_diagnostico,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.fecha_vigencia_inicio
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.fecha_vigencia_inicio
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.fecha_vigencia_inicio
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.fecha_vigencia_inicio
        ELSE NULL
      END AS pick_inicio,
      CASE c.codigo
        WHEN 'CURRENT_TARIFF' THEN sc.fecha_vigencia_fin
        WHEN 'HISTORICAL_TARIFF_MATCH' THEN sh.fecha_vigencia_fin
        WHEN 'CURRENT_CATEGORY_CORRECTION' THEN oc.fecha_vigencia_fin
        WHEN 'HISTORICAL_CATEGORY_CORRECTION' THEN oh.fecha_vigencia_fin
        ELSE NULL
      END AS pick_fin
    FROM coded c
    LEFT JOIN pick_same_cur sc ON sc.ord = c.ord
    LEFT JOIN pick_same_hist sh ON sh.ord = c.ord
    LEFT JOIN pick_other_cur oc ON oc.ord = c.ord
    LEFT JOIN pick_other_hist oh ON oh.ord = c.ord
  )
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN d.codigo IN ('DIRECTION_REQUIRED', 'DIRECTION_CONFLICT') THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', d.codigo,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'categoria_proveedor', d.categoria,
            'sentido_solicitado', NULL,
            'sentido_aplicado', NULL,
            'precio_candidato', (
              SELECT i.precio_directo FROM input i WHERE i.ord = d.ord
            )
          )
        WHEN d.codigo = 'CONTEXT_INCOMPLETE' THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', 'CONTEXT_INCOMPLETE',
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'categoria_proveedor', d.categoria,
            'sentido_solicitado', d.sentido_solicitado
          )
        WHEN d.codigo = 'STATUS_AMBIGUOUS' THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', 'STATUS_AMBIGUOUS',
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'categoria_proveedor', d.categoria,
            'sentido_solicitado', d.sentido_solicitado,
            'candidatos_status', (
              SELECT COALESCE(jsonb_agg(q.s ORDER BY q.s), '[]'::jsonb)
              FROM (
                SELECT DISTINCT s.status AS s
                FROM safe_dir s
                WHERE s.ord = d.ord
              ) q
            ),
            'possible_matches', d.possible_matches
          )
        WHEN d.codigo IN ('AMBIGUOUS_TARIFF_MATCH', 'STATUS_REQUIRED', 'NEW_TARIFF') THEN
          jsonb_build_object(
            'id', d.id,
            'codigo', d.codigo,
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'categoria_proveedor', d.categoria,
            'categoria_calculada', NULL,
            'status', CASE WHEN d.codigo = 'NEW_TARIFF' THEN d.status_in ELSE NULL END,
            'sentido_solicitado', d.sentido_solicitado,
            'possible_matches', d.possible_matches
          )
        ELSE
          jsonb_build_object(
            'id', d.id,
            'codigo', d.codigo,
            'peaje_id', d.peaje_id,
            'estacion_id', d.estacion_id,
            'categoria', d.categoria,
            'categoria_proveedor', d.categoria,
            'categoria_calculada', CASE
              WHEN d.codigo IN ('CURRENT_CATEGORY_CORRECTION', 'HISTORICAL_CATEGORY_CORRECTION')
                THEN d.pick_categoria
              ELSE NULL
            END,
            'status', d.pick_status,
            'sentido_solicitado', d.sentido_solicitado,
            'sentido_aplicado', d.pick_sentido,
            'importe_actual', d.pick_importe,
            'tarifa_id', d.pick_tarifa_id,
            'tarifa_importe_id', d.pick_ti,
            'requiere_normalizacion_iva', d.pick_iva,
            'diagnostico', d.pick_diagnostico,
            'fecha_vigencia_inicio', d.pick_inicio,
            'fecha_vigencia_fin', d.pick_fin,
            'possible_matches', d.possible_matches
          )
      END
      ORDER BY d.ord
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM decided d;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) IS
  'F14-19 · Matching vigente/histórico/corrección de categoría con vigencia [inicio, fin) y tolerancia 1%. Fail-closed en sentido. Sin aritmética IVA.';

REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb)
  TO authenticated, service_role;
