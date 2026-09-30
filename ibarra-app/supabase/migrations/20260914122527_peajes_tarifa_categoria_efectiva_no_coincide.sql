-- Paso 9: categoria_efectiva matching, no_coincide_con_tarifario, historial acotado.

ALTER TABLE public.tarifa_importe
  ADD COLUMN IF NOT EXISTS no_coincide_con_tarifario boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tarifa_importe.no_coincide_con_tarifario IS
  'TRUE cuando el importe no matcheó el tarifario (camino REVISAR / input manual). Inmutable.';

CREATE OR REPLACE FUNCTION public.peajes_trg_tarifa_importe_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: DELETE está prohibido. Corregir insertando una fila nueva (F14-16).'
      USING ERRCODE = '23514';
  END IF;

  IF (
       NEW.id,
       NEW.tarifa_id,
       NEW.importe,
       NEW.importe_base,
       NEW.desvio,
       NEW.hora_min,
       NEW.hora_max,
       NEW.hora_media,
       NEW.categoria_calculated,
       NEW.cases,
       NEW.fecha_aparicion,
       NEW.diagnostico,
       NEW.fecha_vigencia_inicio,
       NEW.tarifas_normalizadas_id,
       NEW.created_at,
       NEW.no_coincide_con_tarifario
     ) IS DISTINCT FROM (
       OLD.id,
       OLD.tarifa_id,
       OLD.importe,
       OLD.importe_base,
       OLD.desvio,
       OLD.hora_min,
       OLD.hora_max,
       OLD.hora_media,
       OLD.categoria_calculated,
       OLD.cases,
       OLD.fecha_aparicion,
       OLD.diagnostico,
       OLD.fecha_vigencia_inicio,
       OLD.tarifas_normalizadas_id,
       OLD.created_at,
       OLD.no_coincide_con_tarifario
     )
  THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: no se permite UPDATE de columnas de negocio. Corregir insertando una fila nueva (F14-19).'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.fecha_vigencia_fin IS DISTINCT FROM OLD.fecha_vigencia_fin
     AND NOT (
       OLD.fecha_vigencia_fin IS NULL
       AND NEW.fecha_vigencia_fin IS NOT NULL
     )
  THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: fecha_vigencia_fin solo puede cerrarse una vez (NULL a fecha).'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.peajes_trg_tarifa_importe_immutable() IS
  'Mantiene inmutable tarifa_importe, incluido no_coincide_con_tarifario, y permite solo cerrar una vigencia una vez.';

DROP FUNCTION IF EXISTS public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint);

CREATE OR REPLACE FUNCTION public._peajes_aplicar_importe_guardado(
  p_tarifa_id uuid,
  p_importe numeric,
  p_cases integer,
  p_diagnostico text,
  p_fecha_inicio date,
  p_categoria_calculated smallint,
  p_no_coincide_con_tarifario boolean DEFAULT false
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
      diagnostico, fecha_vigencia_inicio, categoria_calculated,
      no_coincide_con_tarifario
    ) VALUES (
      p_tarifa_id, p_importe, p_cases, now(),
      'CONFIRMADO', p_fecha_inicio, p_categoria_calculated,
      COALESCE(p_no_coincide_con_tarifario, false)
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT
      v_new_id, v_current_id, v_prior_importe, v_prior_fin,
      p_fecha_inicio, NULL::date;
    RETURN;
  END IF;

  INSERT INTO public.tarifa_importe (
    tarifa_id, importe, cases, fecha_aparicion,
    diagnostico, categoria_calculated, no_coincide_con_tarifario
  ) VALUES (
    p_tarifa_id, p_importe, p_cases, now(),
    'REVISAR', p_categoria_calculated, COALESCE(p_no_coincide_con_tarifario, true)
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    v_new_id, v_current_id, v_prior_importe, v_prior_fin,
    NULL::date, NULL::date;
END;
$$;

COMMENT ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint, boolean) IS
  'Cierra el vigente y appendea CONFIRMADO, o appendea REVISAR. Persiste no_coincide_con_tarifario.';

REVOKE ALL ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_aplicar_importe_guardado(uuid, numeric, integer, text, date, smallint, boolean)
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
      v_tarifa_id, v_importe, 0, 'CONFIRMADO', v_fecha, NULL, false
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
  v_no_coincide boolean;
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
    v_no_coincide := COALESCE(
      (v_elem->>'no_coincide_con_tarifario')::boolean,
      (v_elem->>'noCoincideConTarifario')::boolean,
      v_action = 'MARK_REVIEW'
    );
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
       AND v_no_coincide IS NOT TRUE
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
          v_tarifa_id, v_importe, v_cases, 'REVISAR', NULL, v_cat_calc, true
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
          v_tarifa_id, v_importe, v_cases, 'CONFIRMADO', v_fecha, v_cat_calc, v_no_coincide
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
        'categoria_calculada', v_cat_calc,
        'no_coincide_con_tarifario', CASE
          WHEN v_accion = 'SIN_CAMBIO' THEN false
          ELSE v_no_coincide
        END
      )
    );
  END LOOP;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) IS
  'Guardado atómico CONFIRM_NEW / MARK_REVIEW. Persiste importe y no_coincide_con_tarifario; REVISAR no mueve el puntero.';

REVOKE ALL ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb)
  TO authenticated, service_role;

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
      NULLIF(upper(btrim(t.elem->>'unresolvedReason')), '') AS unresolved_reason,
      NULLIF(btrim(COALESCE(t.elem->>'fecha_pasada', t.elem->>'fechaPasada')), '')::date AS fecha_pasada,
      NULLIF(btrim(t.elem->>'precio_directo'), '')::numeric AS precio_directo,
      NULLIF(btrim(t.elem->>'precio_normalizado'), '')::numeric AS precio_normalizado
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS t(elem, ord)
  ),
  station_max AS (
    SELECT t.estacion_id, max(t.categoria)::smallint AS categoria_maxima
    FROM public.tarifas t
    WHERE t.enabled
    GROUP BY t.estacion_id
  ),
  base AS (
    SELECT i.*, e.peaje_id, sm.categoria_maxima,
      CASE
        WHEN i.categoria_proveedor IS NULL OR sm.categoria_maxima IS NULL THEN i.categoria_proveedor
        ELSE LEAST(i.categoria_proveedor, sm.categoria_maxima)
      END AS categoria_efectiva,
      CASE
        WHEN e.id IS NULL THEN 'CONTEXT_INCOMPLETE'
        WHEN i.categoria_proveedor IS NULL THEN 'CONTEXT_INCOMPLETE'
        ELSE NULL
      END AS early_codigo
    FROM input i
    LEFT JOIN public.estaciones e ON e.id = i.estacion_id
    LEFT JOIN station_max sm ON sm.estacion_id = i.estacion_id
  ),
  all_matches AS (
    SELECT b.*, m.*
    FROM base b
    LEFT JOIN LATERAL public._peajes_tarifas_matching_candidatos(
      b.estacion_id, b.categoria_efectiva, b.sentido_solicitado, b.status_solicitado,
      b.fecha_pasada, b.precio_directo, b.precio_normalizado
    ) m ON b.early_codigo IS NULL
     AND m.categoria IS NOT DISTINCT FROM b.categoria_efectiva
  ),
  hits AS (
    SELECT * FROM all_matches
    WHERE early_codigo IS NULL
      AND importe IS NOT NULL AND importe <> 0 AND precio_comparado IS NOT NULL
      AND diagnostico IS DISTINCT FROM 'REVISAR'
      AND abs(precio_comparado - importe) / importe <= 0.01
  ),
  identities AS (
    SELECT ord, count(DISTINCT tarifa_id) AS count_identities FROM hits GROUP BY ord
  ),
  picked AS (
    SELECT DISTINCT ON (ord) *
    FROM hits
    ORDER BY ord,
      CASE
        WHEN es_vigente AND compatible_validity THEN 0
        WHEN compatible_validity THEN 1
        WHEN es_vigente THEN 2
        ELSE 3
      END,
      tarifa_id, tarifa_importe_id
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
      AND abs(precio_comparado - importe) / importe <= 0.01
    GROUP BY ord
  ),
  decided AS (
    SELECT b.*,
      p.tarifa_id AS pick_tarifa_id,
      p.categoria AS pick_categoria,
      p.status AS pick_status,
      p.sentido AS pick_sentido,
      p.es_vigente AS pick_es_vigente,
      p.compatible_validity AS pick_compatible_validity,
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
        WHEN p.tarifa_id IS NOT NULL AND p.es_vigente AND p.compatible_validity
          AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'CURRENT_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND NOT (p.es_vigente AND p.compatible_validity)
          AND p.categoria IS DISTINCT FROM b.categoria_proveedor THEN 'HISTORICAL_CATEGORY_CORRECTION'
        WHEN p.tarifa_id IS NOT NULL AND p.es_vigente AND p.compatible_validity THEN 'CURRENT_TARIFF'
        WHEN p.tarifa_id IS NOT NULL THEN 'HISTORICAL_TARIFF_MATCH'
        WHEN b.unresolved_reason = 'CONFLICT' THEN 'DIRECTION_CONFLICT'
        WHEN b.sentido_solicitado IS NULL OR b.sentido_solicitado NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN 'DIRECTION_REQUIRED'
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
      'categoria_calculada', CASE
        WHEN d.codigo IN ('CURRENT_CATEGORY_CORRECTION', 'HISTORICAL_CATEGORY_CORRECTION') THEN d.pick_categoria
        WHEN d.count_identities = 1 AND d.pick_categoria IS DISTINCT FROM d.categoria_proveedor THEN d.pick_categoria
        ELSE NULL
      END,
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
  'Matching por categoria_efectiva + importe (1%). fecha_vigencia solo clasifica vigente vs histórico.';

REVOKE ALL ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.peajes_buscar_historial_importes(p_candidatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_ord integer := 0;
  v_estacion uuid;
  v_peaje uuid;
  v_importe numeric;
  v_categoria smallint;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un array JSON' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_candidatos) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_candidatos)
  LOOP
    v_ord := v_ord + 1;
    BEGIN
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_importe := (COALESCE(v_elem->>'importe', '0'))::numeric;
      v_categoria := NULLIF(btrim(COALESCE(v_elem->>'categoria', v_elem->>'categoria_efectiva', v_elem->>'categoriaEfectiva')), '')::smallint;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_candidatos contiene tipos invalidos' USING ERRCODE = '22023';
    END;
    IF v_estacion IS NULL OR v_importe IS NULL OR v_importe <= 0 THEN
      RAISE EXCEPTION 'p_candidatos incompleto o importe invalido' USING ERRCODE = '22023';
    END IF;

    IF v_categoria IS NULL THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'estacion_id', v_estacion,
        'importe_consultado', v_importe,
        'count_identities', 0,
        'matches', '[]'::jsonb
      ));
      CONTINUE;
    END IF;

    v_rows := v_rows || COALESCE((
      WITH hits AS (
        SELECT
          t.id AS tarifa_id,
          t.categoria,
          t.status,
          t.sentido,
          t.enabled,
          ti.importe,
          ti.fecha_vigencia_inicio,
          ti.fecha_vigencia_fin,
          ti.diagnostico,
          (ti.id IS NOT DISTINCT FROM t.current_tarifa_id) AS es_actual,
          ti.fecha_aparicion,
          ti.id AS tarifa_importe_id
        FROM public.estaciones e
        INNER JOIN public.tarifas t
          ON t.estacion_id = e.id
         AND t.enabled
         AND t.categoria = v_categoria
         AND (v_peaje IS NULL OR t.peaje_id = v_peaje)
        INNER JOIN public.tarifa_importe ti ON ti.tarifa_id = t.id
        WHERE e.id = v_estacion
          AND ti.importe > 0
          AND ti.diagnostico IS DISTINCT FROM 'REVISAR'
          AND abs(v_importe - ti.importe) / ti.importe <= 0.01
      ),
      counted AS (
        SELECT count(DISTINCT tarifa_id)::int AS count_identities FROM hits
      ),
      picked AS (
        SELECT DISTINCT ON (tarifa_id) *
        FROM hits
        ORDER BY tarifa_id, es_actual DESC, fecha_aparicion DESC, tarifa_importe_id DESC
      )
      SELECT jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'estacion_id', v_estacion,
        'importe_consultado', v_importe,
        'count_identities', COALESCE((SELECT count_identities FROM counted), 0),
        'matches', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'tarifa_id', s.tarifa_id,
            'categoria', s.categoria,
            'status', s.status,
            'sentido', s.sentido,
            'importe', s.importe
          ) ORDER BY s.categoria DESC, s.tarifa_id)
          FROM (
            SELECT DISTINCT ON (tarifa_id) tarifa_id, categoria, status, sentido, importe
            FROM hits
            ORDER BY tarifa_id, es_actual DESC, fecha_aparicion DESC, tarifa_importe_id DESC
          ) s
        ), '[]'::jsonb),
        'tarifa_id', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.tarifa_id END,
        'categoria', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.categoria END,
        'status', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.status END,
        'sentido', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.sentido END,
        'importe', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.importe END,
        'fecha_vigencia_inicio', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.fecha_vigencia_inicio END,
        'fecha_vigencia_fin', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.fecha_vigencia_fin END,
        'es_actual', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.es_actual END,
        'diagnostico', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.diagnostico END,
        'enabled', CASE WHEN (SELECT count_identities FROM counted) = 1 THEN p.enabled END
      )))
      FROM counted
      LEFT JOIN picked p ON (SELECT count_identities FROM counted) = 1
    ), jsonb_build_array(jsonb_build_object(
      'estacion_id', v_estacion,
      'importe_consultado', v_importe,
      'count_identities', 0,
      'matches', '[]'::jsonb
    )));
  END LOOP;

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_buscar_historial_importes(jsonb) IS
  'Paso 9 · Historial por peaje+estación+categoría efectiva+importe (1%). Sin filtro de fecha.';

REVOKE ALL ON FUNCTION public.peajes_buscar_historial_importes(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_buscar_historial_importes(jsonb) TO authenticated, service_role;
