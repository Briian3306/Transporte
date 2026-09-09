-- F11: desglosa percepciones para que importe_total = importe_sin_iva + percepciones.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS percepciones numeric(14, 2);

-- Las facturas históricas conservan su total: la diferencia pasa a percepciones.
UPDATE public.facturas
SET percepciones = round(importe_total - importe_sin_iva, 2)
WHERE percepciones IS NULL;

ALTER TABLE public.facturas
  ALTER COLUMN percepciones SET DEFAULT 0,
  ALTER COLUMN percepciones SET NOT NULL;

ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_percepciones_chk,
  ADD CONSTRAINT facturas_percepciones_chk CHECK (percepciones >= 0),
  DROP CONSTRAINT IF EXISTS facturas_importes_desglosados_chk,
  ADD CONSTRAINT facturas_importes_desglosados_chk
    CHECK (importe_total = importe_sin_iva + percepciones);

COMMENT ON COLUMN public.facturas.percepciones IS
  'Percepciones declaradas en factura. El total debe ser importe_sin_iva + percepciones.';

-- La tolerancia de $5 aplica exclusivamente al contraste factura vs. pasadas.
CREATE OR REPLACE FUNCTION public.peajes_validar_factura_pasadas(
  p_importe_sin_iva numeric,
  p_importes_neto numeric[],
  p_tolerancia numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tol numeric := COALESCE(p_tolerancia, 5::numeric);
  v_suma numeric := 0;
  v_diff numeric;
  v_ok boolean;
BEGIN
  IF p_importe_sin_iva IS NULL THEN
    RAISE EXCEPTION 'importe_sin_iva es obligatorio';
  END IF;
  IF p_importes_neto IS NOT NULL THEN
    SELECT COALESCE(SUM(x), 0) INTO v_suma FROM unnest(p_importes_neto) AS t(x);
  END IF;
  v_diff := abs(v_suma - p_importe_sin_iva);
  v_ok := v_diff <= v_tol;
  RETURN jsonb_build_object(
    'suma_pasadas', v_suma,
    'importe_sin_iva', p_importe_sin_iva,
    'diferencia', v_diff,
    'tolerancia', v_tol,
    'dentro_tolerancia', v_ok,
    'valido', v_ok
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_validar_factura_pasadas(numeric, numeric[], numeric) IS
  'Valida suma de pasadas contra el neto de factura con tolerancia predeterminada de $5.';

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
  v_importe_neto numeric;
  v_percepciones numeric;
  v_importe_total numeric;
BEGIN
  IF p_factura IS NULL THEN
    RAISE EXCEPTION 'factura es obligatoria (RN-12)';
  END IF;
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'pasadas debe ser un arreglo JSON';
  END IF;

  v_importe_neto := round((p_factura->>'importe_sin_iva')::numeric, 2);
  v_importe_total := round((p_factura->>'importe_total')::numeric, 2);
  v_percepciones := round(COALESCE(
    NULLIF(p_factura->>'percepciones', '')::numeric,
    v_importe_total - v_importe_neto
  ), 2);

  IF v_importe_neto IS NULL OR v_importe_total IS NULL OR v_percepciones IS NULL
     OR v_importe_neto < 0 OR v_percepciones < 0
     OR v_importe_total <> v_importe_neto + v_percepciones THEN
    RAISE EXCEPTION 'Importes de factura inválidos: total debe ser neto + percepciones';
  END IF;

  v_filas := coalesce(jsonb_array_length(p_pasadas), 0);
  v_rechazadas := coalesce(jsonb_array_length(COALESCE(p_errores, '[]'::jsonb)), 0);
  v_dups := public.peajes_detectar_duplicados(p_pasadas);
  IF jsonb_array_length(v_dups) > 0 THEN
    RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups;
  END IF;

  v_factura_id := NULLIF(p_factura->>'id', '')::uuid;
  IF v_factura_id IS NULL THEN
    INSERT INTO public.facturas (
      factura, cuenta, empresa_id, fecha_factura, importe_sin_iva, percepciones, importe_total
    ) VALUES (
      p_factura->>'factura', v_cuenta, p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date, v_importe_neto, v_percepciones, v_importe_total
    ) RETURNING id INTO v_factura_id;
  ELSE
    UPDATE public.facturas
    SET factura = COALESCE(p_factura->>'factura', factura),
        cuenta = CASE WHEN p_factura ? 'cuenta' THEN v_cuenta ELSE cuenta END,
        fecha_factura = COALESCE((p_factura->>'fecha_factura')::date, fecha_factura),
        importe_sin_iva = v_importe_neto,
        percepciones = v_percepciones,
        importe_total = v_importe_total
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

  v_validacion := public.peajes_validar_factura_pasadas(v_importe_neto, v_importes, p_tolerancia);
  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación factura falló (RN-17): %', v_validacion;
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
    'factura_id', v_factura_id,
    'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id,
    'validacion', v_validacion
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric) IS
  'Confirma carga con factura desglosada: importe neto + percepciones = total.';

GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_validar_factura_pasadas(numeric, numeric[], numeric)
  TO authenticated, service_role;
