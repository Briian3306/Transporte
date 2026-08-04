-- F12: la factura captura sus importes declarados; solo el subtotal se contrasta con pasadas.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS iva numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_importes_desglosados_chk,
  DROP CONSTRAINT IF EXISTS facturas_iva_chk,
  ADD CONSTRAINT facturas_iva_chk CHECK (iva >= 0);

COMMENT ON COLUMN public.facturas.importe_sin_iva IS
  'Subtotal declarado en la factura; es el único importe contrastado con la suma de pasadas.';
COMMENT ON COLUMN public.facturas.percepciones IS
  'Suma de percepciones declarada en la factura. RAE se ignora en este desglose.';
COMMENT ON COLUMN public.facturas.iva IS
  'IVA declarado en la factura.';
COMMENT ON COLUMN public.facturas.importe_total IS
  'Total declarado en la factura; no se recalcula ni se contrasta contra pasadas.';

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
  v_factura_id uuid;
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
BEGIN
  IF p_factura IS NULL THEN RAISE EXCEPTION 'factura es obligatoria (RN-12)'; END IF;
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'pasadas debe ser un arreglo JSON';
  END IF;

  v_subtotal := round((p_factura->>'importe_sin_iva')::numeric, 2);
  v_percepciones := round(COALESCE(NULLIF(p_factura->>'percepciones', '')::numeric, 0), 2);
  v_iva := round(COALESCE(NULLIF(p_factura->>'iva', '')::numeric, 0), 2);
  v_total := round((p_factura->>'importe_total')::numeric, 2);
  IF v_subtotal IS NULL OR v_percepciones IS NULL OR v_iva IS NULL OR v_total IS NULL
     OR v_subtotal < 0 OR v_percepciones < 0 OR v_iva < 0 OR v_total < 0 THEN
    RAISE EXCEPTION 'Los importes declarados de factura deben ser numéricos y no negativos';
  END IF;

  v_filas := coalesce(jsonb_array_length(p_pasadas), 0);
  v_rechazadas := coalesce(jsonb_array_length(COALESCE(p_errores, '[]'::jsonb)), 0);
  v_dups := public.peajes_detectar_duplicados(p_pasadas);
  IF jsonb_array_length(v_dups) > 0 THEN RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups; END IF;

  v_factura_id := NULLIF(p_factura->>'id', '')::uuid;
  IF v_factura_id IS NULL THEN
    INSERT INTO public.facturas (
      factura, cuenta, empresa_id, fecha_factura, importe_sin_iva, percepciones, iva, importe_total
    ) VALUES (
      p_factura->>'factura', v_cuenta, p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date, v_subtotal, v_percepciones, v_iva, v_total
    ) RETURNING id INTO v_factura_id;
  ELSE
    UPDATE public.facturas
    SET factura = COALESCE(p_factura->>'factura', factura),
        cuenta = CASE WHEN p_factura ? 'cuenta' THEN v_cuenta ELSE cuenta END,
        fecha_factura = COALESCE((p_factura->>'fecha_factura')::date, fecha_factura),
        importe_sin_iva = v_subtotal, percepciones = v_percepciones, iva = v_iva, importe_total = v_total
    WHERE id = v_factura_id;
  END IF;

  FOR v_pasada IN SELECT value FROM jsonb_array_elements(p_pasadas)
  LOOP
    v_precio := (v_pasada->>'precio')::numeric;
    v_bonif := COALESCE((v_pasada->>'bonificacion')::numeric, 0);
    v_neto := public.peajes_calcular_importe_neto(v_precio, v_bonif);
    IF v_pasada ? 'importe_neto' AND NULLIF(v_pasada->>'importe_neto', '') IS NOT NULL
       AND abs((v_pasada->>'importe_neto')::numeric - v_neto) > public.peajes_tolerancia_importe() THEN
      RAISE EXCEPTION 'IMPORTE_NETO inconsistente con PRECIO-BONIFICACION (RN-11) en fila %', v_pasada;
    END IF;
    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, factura_id,
      precio, bonificacion, quantity, importe_neto, user_id, file_upload_name
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz, (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid, (v_pasada->>'estacion_id')::uuid, v_factura_id,
      v_precio, v_bonif, COALESCE((v_pasada->>'quantity')::integer, 1), v_neto,
      v_user_id, p_nombre_archivo
    ) RETURNING id INTO v_id;
    v_pasada_ids := array_append(v_pasada_ids, v_id);
    v_importes := array_append(v_importes, v_neto);
  END LOOP;

  v_validacion := public.peajes_validar_factura_pasadas(v_subtotal, v_importes, p_tolerancia);
  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación de subtotal falló (RN-17): %', v_validacion;
  END IF;

  INSERT INTO public.registros_carga_peajes (
    plantilla_id, factura_id, parametros_efectivos, algoritmos_efectivos,
    filas_procesadas, filas_validas, filas_rechazadas, errores, nombre_archivo, user_id
  ) VALUES (
    p_plantilla_id, v_factura_id, COALESCE(p_parametros_efectivos, '{}'::jsonb),
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb), v_filas + v_rechazadas, v_filas,
    v_rechazadas, COALESCE(p_errores, '[]'::jsonb), p_nombre_archivo, v_user_id
  ) RETURNING id INTO v_registro_id;

  RETURN jsonb_build_object(
    'factura_id', v_factura_id, 'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id, 'validacion', v_validacion
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric) IS
  'Confirma carga y conserva subtotal, percepciones, IVA y total; solo valida subtotal contra pasadas.';
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric)
  TO authenticated, service_role;
