-- F11: tolerancia factura vs suma pasadas = ±1% del subtotal (importe_sin_iva).
-- p_tolerancia explícito sigue siendo override absoluto (p. ej. tests F01-5).

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
  v_tol numeric;
  v_suma numeric := 0;
  v_diff numeric;
  v_ok boolean;
BEGIN
  IF p_importe_sin_iva IS NULL THEN
    RAISE EXCEPTION 'importe_sin_iva es obligatorio';
  END IF;

  v_tol := COALESCE(p_tolerancia, abs(p_importe_sin_iva) * 0.01);

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
  'Valida suma de pasadas contra el subtotal de factura; tolerancia por defecto = 1% del subtotal.';
