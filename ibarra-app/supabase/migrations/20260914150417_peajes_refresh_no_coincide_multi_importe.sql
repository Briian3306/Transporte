-- Leftover no_coincide: varios importes en la misma celda se appendean como historial CONFIRMADO.
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
  v_no_coincide_keys text[] := '{}';
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

    v_no_coincide := COALESCE(
      (v_elem->>'no_coincide_con_tarifario')::boolean,
      (v_elem->>'noCoincideConTarifario')::boolean,
      false
    );
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
      IF NOT (
        v_action = 'CONFIRM_NEW'
        AND v_no_coincide IS TRUE
        AND v_key = ANY (v_no_coincide_keys)
      ) THEN
        RAISE EXCEPTION 'p_cambios contiene celdas duplicadas';
      END IF;
    ELSE
      v_keys := array_append(v_keys, v_key);
      IF v_no_coincide IS TRUE THEN
        v_no_coincide_keys := array_append(v_no_coincide_keys, v_key);
      END IF;
    END IF;

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
       AND v_no_coincide IS TRUE
       AND v_cur_inicio IS NOT NULL
       AND v_fecha IS NOT NULL
       AND v_fecha <= v_cur_inicio
    THEN
      v_fecha := v_cur_inicio + 1;
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
