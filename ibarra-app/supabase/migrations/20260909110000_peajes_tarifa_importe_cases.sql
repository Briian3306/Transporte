-- Preserve the observed pasadas count as an immutable tariff-history snapshot.
-- tarifas_normalizadas remains the audit source; tarifas carries no count.

ALTER TABLE public.tarifa_importe
  ADD COLUMN IF NOT EXISTS cases integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tarifa_importe_cases_chk'
      AND conrelid = 'public.tarifa_importe'::regclass
  ) THEN
    ALTER TABLE public.tarifa_importe
      ADD CONSTRAINT tarifa_importe_cases_chk CHECK (cases >= 0);
  END IF;
END $$;

-- The prior immutable trigger does not yet include cases, so this one-time
-- lineage-only snapshot can run without weakening immutable history.
UPDATE public.tarifa_importe AS ti
SET cases = tn.cases
FROM public.tarifas_normalizadas AS tn
WHERE tn.id = ti.tarifas_normalizadas_id;

COMMENT ON COLUMN public.tarifa_importe.cases IS
  'Immutable snapshot of the pasadas that evidenced this amount. 0 means catalogue-only or manual evidence.';

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
       NEW.tarifas_normalizadas_id,
       NEW.created_at
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
       OLD.tarifas_normalizadas_id,
       OLD.created_at
     )
  THEN
    RAISE EXCEPTION
      'tarifa_importe es historial inmutable: no se permite UPDATE de columnas de negocio. Corregir insertando una fila nueva (F14-16).'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

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

    INSERT INTO public.tarifa_importe (tarifa_id, importe, cases, fecha_aparicion)
    VALUES (v_tarifa_id, v_importe, 0, now());

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
  v_peaje uuid;
  v_estacion uuid;
  v_sentido text;
  v_categoria smallint;
  v_status text;
  v_importe numeric;
  v_cases integer;
  v_iva boolean;
  v_iva_present boolean;
  v_key text;
  v_keys text[] := '{}';
  v_est_peaje uuid;
  v_tarifa_id uuid;
  v_current_id uuid;
  v_current_importe numeric;
  v_flag boolean;
  v_was_new boolean;
  v_accion text;
  v_new_ti uuid;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un arreglo JSON';
  END IF;

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    BEGIN
      v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
      v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'p_cambios contiene UUID invalido';
    END;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    BEGIN
      v_categoria := (v_elem->>'categoria')::smallint;
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
    v_iva_present := COALESCE(jsonb_typeof(COALESCE(v_elem->'requiere_normalizacion_iva', v_elem->'requiereNormalizacionIva')) = 'boolean', false);
    v_iva := COALESCE((v_elem->>'requiere_normalizacion_iva')::boolean, (v_elem->>'requiereNormalizacionIva')::boolean);

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
      RAISE EXCEPTION 'categoria invalida: %', v_elem->>'categoria';
    END IF;
    IF v_importe <= 0 THEN
      RAISE EXCEPTION 'importe debe ser > 0';
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

  FOR v_elem, v_ord IN
    SELECT t.elem, t.ord
    FROM jsonb_array_elements(p_cambios) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_peaje := NULLIF(btrim(COALESCE(v_elem->>'peaje_id', v_elem->>'peajeId')), '')::uuid;
    v_estacion := NULLIF(btrim(COALESCE(v_elem->>'estacion_id', v_elem->>'estacionId')), '')::uuid;
    v_sentido := upper(btrim(COALESCE(v_elem->>'sentido', '')));
    v_status := upper(btrim(COALESCE(v_elem->>'status', '')));
    v_categoria := (v_elem->>'categoria')::smallint;
    v_importe := (v_elem->>'importe')::numeric;
    v_cases := COALESCE((v_elem->>'cases')::integer, 0);
    v_iva_present := COALESCE(jsonb_typeof(COALESCE(v_elem->'requiere_normalizacion_iva', v_elem->'requiereNormalizacionIva')) = 'boolean', false);
    v_iva := COALESCE((v_elem->>'requiere_normalizacion_iva')::boolean, (v_elem->>'requiereNormalizacionIva')::boolean);
    v_tarifa_id := NULL; v_current_id := NULL; v_flag := NULL; v_new_ti := NULL; v_current_importe := NULL;

    SELECT t.id, t.current_tarifa_id, t.requiere_normalizacion_iva
    INTO v_tarifa_id, v_current_id, v_flag
    FROM public.tarifas t
    WHERE t.peaje_id = v_peaje AND t.estacion_id = v_estacion AND t.sentido = v_sentido
      AND t.categoria = v_categoria AND t.status = v_status
    FOR UPDATE;

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

    IF v_current_id IS NOT NULL THEN
      SELECT ti.importe INTO v_current_importe FROM public.tarifa_importe ti WHERE ti.id = v_current_id;
    END IF;
    IF v_current_importe IS NOT NULL AND v_current_importe = v_importe THEN
      v_accion := 'SIN_CAMBIO'; v_new_ti := NULL;
    ELSE
      INSERT INTO public.tarifa_importe (tarifa_id, importe, cases, fecha_aparicion)
      VALUES (v_tarifa_id, v_importe, v_cases, now())
      RETURNING id INTO v_new_ti;
      v_accion := CASE WHEN v_was_new THEN 'IDENTIDAD_CREADA' ELSE 'ACTUALIZADA' END;
    END IF;

    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object(
        'peaje_id', v_peaje, 'estacion_id', v_estacion, 'sentido', v_sentido,
        'categoria', v_categoria, 'status', v_status, 'tarifa_id', v_tarifa_id,
        'nueva', v_importe, 'accion', v_accion,
        'anterior', v_current_importe, 'tarifa_importe_id', v_new_ti
      )
    );
  END LOOP;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.peajes_guardar_refresco_tarifas(jsonb) IS
  'F14-18 · Append transaccional de tarifa_importe; cases es snapshot de filas detectadas y omiso = 0.';
