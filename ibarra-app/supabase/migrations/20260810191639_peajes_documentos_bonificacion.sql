-- Bonificación a nivel documento (cabecera de factura).
-- No viene del Excel: se carga manualmente en Paso 7.
-- Conciliación RN-13/17:
--   abs(Σ IMPORTE_NETO − (importe_sin_iva + bonificacion)) ≤ abs(importe_sin_iva) * 0.01

-- -----------------------------------------------------------------------------
-- 1) Columna en documentos
-- -----------------------------------------------------------------------------
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS bonificacion numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.documentos.bonificacion IS
  'Bonificación de cabecera del documento (manual, no del archivo). Σ neto − bonificacion ≈ subtotal.';

-- -----------------------------------------------------------------------------
-- 2) peajes_validar_factura_pasadas — compara suma vs (subtotal + bonificacion)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.peajes_validar_factura_pasadas(numeric, numeric[], numeric);

CREATE OR REPLACE FUNCTION public.peajes_validar_factura_pasadas(
  p_importe_sin_iva numeric,
  p_importes_neto numeric[],
  p_tolerancia numeric DEFAULT NULL,
  p_bonificacion numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tol numeric;
  v_suma numeric := 0;
  v_bonif numeric := COALESCE(p_bonificacion, 0);
  v_esperado numeric;
  v_diff numeric;
  v_ok boolean;
BEGIN
  IF p_importe_sin_iva IS NULL THEN
    RAISE EXCEPTION 'importe_sin_iva es obligatorio';
  END IF;

  v_esperado := p_importe_sin_iva + v_bonif;
  v_tol := COALESCE(p_tolerancia, abs(p_importe_sin_iva) * 0.01);

  IF p_importes_neto IS NOT NULL THEN
    SELECT COALESCE(SUM(x), 0) INTO v_suma FROM unnest(p_importes_neto) AS t(x);
  END IF;

  v_diff := abs(v_suma - v_esperado);
  v_ok := v_diff <= v_tol;

  RETURN jsonb_build_object(
    'suma_pasadas', v_suma,
    'importe_sin_iva', p_importe_sin_iva,
    'bonificacion', v_bonif,
    'esperado', v_esperado,
    'diferencia', v_diff,
    'tolerancia', v_tol,
    'dentro_tolerancia', v_ok,
    'valido', v_ok
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_validar_factura_pasadas(numeric, numeric[], numeric, numeric) IS
  'Valida Σ pasadas contra (subtotal + bonificación de documento); tolerancia default = 1% del subtotal.';

GRANT EXECUTE ON FUNCTION public.peajes_validar_factura_pasadas(numeric, numeric[], numeric, numeric)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) peajes_validar_documento_id — lee bonificacion de cabecera
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_validar_documento_id(
  p_documento_id uuid,
  p_tolerancia numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_importe numeric;
  v_bonif numeric;
  v_importes numeric[];
BEGIN
  SELECT d.importe_sin_iva, d.bonificacion
  INTO v_importe, v_bonif
  FROM public.documentos d
  WHERE d.id = p_documento_id;

  IF v_importe IS NULL THEN
    RAISE EXCEPTION 'Documento % no encontrado', p_documento_id;
  END IF;

  SELECT COALESCE(array_agg(p.importe_neto), ARRAY[]::numeric[])
  INTO v_importes
  FROM public.pasadas p
  WHERE p.documento_id = p_documento_id;

  RETURN public.peajes_validar_factura_pasadas(v_importe, v_importes, p_tolerancia, COALESCE(v_bonif, 0));
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) peajes_confirmar_carga — persiste y valida con bonificacion de cabecera
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_confirmar_carga(
  p_factura jsonb,
  p_pasadas jsonb,
  p_plantilla_id uuid DEFAULT NULL,
  p_parametros_efectivos jsonb DEFAULT '{}'::jsonb,
  p_algoritmos_efectivos jsonb DEFAULT '[]'::jsonb,
  p_errores jsonb DEFAULT '[]'::jsonb,
  p_nombre_archivo text DEFAULT NULL,
  p_tolerancia numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_documento_id uuid;
  v_pasada jsonb;
  v_pasada_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_precio numeric;
  v_bonif numeric;
  v_neto numeric;
  v_importes numeric[] := ARRAY[]::numeric[];
  v_validacion jsonb;
  v_dups jsonb;
  v_registro_id uuid;
  v_filas integer;
  v_rechazadas integer;
  v_user_id uuid := auth.uid();
  v_cuenta text := NULLIF(trim(COALESCE(p_factura->>'cuenta', '')), '');
  v_subtotal numeric;
  v_percepciones numeric;
  v_iva numeric;
  v_total numeric;
  v_bonificacion_doc numeric;
  v_tipo text := upper(COALESCE(NULLIF(trim(p_factura->>'tipo'), ''), 'FC'));
BEGIN
  IF p_factura IS NULL THEN
    RAISE EXCEPTION 'documento es obligatorio (RN-12)';
  END IF;
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'pasadas debe ser un arreglo JSON';
  END IF;
  IF v_tipo NOT IN ('FC', 'NC') THEN
    RAISE EXCEPTION 'tipo de documento inválido: % (use FC o NC)', v_tipo;
  END IF;

  v_subtotal := round((p_factura->>'importe_sin_iva')::numeric, 2);
  v_percepciones := round(COALESCE(NULLIF(p_factura->>'percepciones', '')::numeric, 0), 2);
  v_iva := round(COALESCE(NULLIF(p_factura->>'iva', '')::numeric, 0), 2);
  v_total := round((p_factura->>'importe_total')::numeric, 2);
  v_bonificacion_doc := round(COALESCE(NULLIF(p_factura->>'bonificacion', '')::numeric, 0), 2);

  IF v_subtotal IS NULL OR v_percepciones IS NULL OR v_iva IS NULL OR v_total IS NULL OR v_bonificacion_doc IS NULL THEN
    RAISE EXCEPTION 'Los importes declarados del documento deben ser numéricos';
  END IF;

  -- Normalizar signo según tipo (idempotente).
  IF v_tipo = 'NC' THEN
    v_subtotal := -abs(v_subtotal);
    v_percepciones := -abs(v_percepciones);
    v_iva := -abs(v_iva);
    v_total := -abs(v_total);
    v_bonificacion_doc := CASE WHEN v_bonificacion_doc = 0 THEN 0 ELSE -abs(v_bonificacion_doc) END;
  ELSE
    v_subtotal := abs(v_subtotal);
    v_percepciones := abs(v_percepciones);
    v_iva := abs(v_iva);
    v_total := abs(v_total);
    v_bonificacion_doc := abs(v_bonificacion_doc);
  END IF;

  v_filas := coalesce(jsonb_array_length(p_pasadas), 0);
  v_rechazadas := coalesce(jsonb_array_length(COALESCE(p_errores, '[]'::jsonb)), 0);
  v_dups := public.peajes_detectar_duplicados(p_pasadas);
  IF jsonb_array_length(v_dups) > 0 THEN
    RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups;
  END IF;

  v_documento_id := NULLIF(COALESCE(p_factura->>'id', p_factura->>'documento_id'), '')::uuid;
  IF v_documento_id IS NULL THEN
    INSERT INTO public.documentos (
      factura, cuenta, empresa_id, fecha_factura, tipo,
      importe_sin_iva, percepciones, iva, importe_total, bonificacion
    ) VALUES (
      p_factura->>'factura', v_cuenta, p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date, v_tipo,
      v_subtotal, v_percepciones, v_iva, v_total, v_bonificacion_doc
    ) RETURNING id INTO v_documento_id;
  ELSE
    UPDATE public.documentos
    SET factura = COALESCE(p_factura->>'factura', factura),
        cuenta = CASE WHEN p_factura ? 'cuenta' THEN v_cuenta ELSE cuenta END,
        fecha_factura = COALESCE((p_factura->>'fecha_factura')::date, fecha_factura),
        tipo = v_tipo,
        importe_sin_iva = v_subtotal,
        percepciones = v_percepciones,
        iva = v_iva,
        importe_total = v_total,
        bonificacion = v_bonificacion_doc
    WHERE id = v_documento_id;
  END IF;

  FOR v_pasada IN SELECT value FROM jsonb_array_elements(p_pasadas)
  LOOP
    v_precio := (v_pasada->>'precio')::numeric;
    v_bonif := COALESCE((v_pasada->>'bonificacion')::numeric, 0);
    IF v_tipo = 'NC' THEN
      v_precio := -abs(v_precio);
      v_bonif := CASE WHEN v_bonif = 0 THEN 0 ELSE -abs(v_bonif) END;
    ELSE
      v_precio := abs(v_precio);
      v_bonif := abs(v_bonif);
    END IF;
    v_neto := COALESCE(
      NULLIF(v_pasada->>'importe_neto', '')::numeric,
      public.peajes_calcular_importe_neto(v_precio, v_bonif)
    );
    IF v_tipo = 'NC' THEN
      v_neto := -abs(v_neto);
    ELSE
      v_neto := abs(v_neto);
    END IF;

    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, documento_id,
      precio, bonificacion, quantity, importe_neto, user_id, file_upload_name
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz,
      (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid,
      (v_pasada->>'estacion_id')::uuid,
      v_documento_id,
      v_precio, v_bonif,
      COALESCE((v_pasada->>'quantity')::integer, 1),
      v_neto, v_user_id, p_nombre_archivo
    ) RETURNING id INTO v_id;
    v_pasada_ids := array_append(v_pasada_ids, v_id);
    v_importes := array_append(v_importes, v_neto);
  END LOOP;

  v_validacion := public.peajes_validar_factura_pasadas(v_subtotal, v_importes, p_tolerancia, v_bonificacion_doc);
  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación de subtotal falló (RN-17): %', v_validacion;
  END IF;

  INSERT INTO public.registros_carga_peajes (
    plantilla_id, documento_id, parametros_efectivos, algoritmos_efectivos,
    filas_procesadas, filas_validas, filas_rechazadas, errores, nombre_archivo, user_id
  ) VALUES (
    p_plantilla_id, v_documento_id, COALESCE(p_parametros_efectivos, '{}'::jsonb),
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb), v_filas + v_rechazadas, v_filas,
    v_rechazadas, COALESCE(p_errores, '[]'::jsonb), p_nombre_archivo, v_user_id
  ) RETURNING id INTO v_registro_id;

  RETURN jsonb_build_object(
    'documento_id', v_documento_id,
    'factura_id', v_documento_id,
    'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id,
    'validacion', v_validacion
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric) IS
  'Confirma carga en documentos (FC|NC); persiste bonificacion de cabecera; valida Σ neto vs subtotal+bonificacion.';
