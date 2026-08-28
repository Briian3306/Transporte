-- F18-2: permitir insertar pasadas duplicadas con consentimiento explícito.
-- La detección RN-16 (peajes_detectar_duplicados) corre SIEMPRE.
-- Unicidad física: índice único parcial WHERE duplicado = false.

ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS duplicado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pasadas.duplicado IS
  'TRUE si la fila se insertó con consentimiento (Subir igualmente). La clave RN-16 sigue detectándose; el índice único solo cubre duplicado = false.';

ALTER TABLE public.pasadas
  DROP CONSTRAINT IF EXISTS pasadas_duplicado_uk;

DROP INDEX IF EXISTS public.pasadas_duplicado_uk;

CREATE UNIQUE INDEX pasadas_duplicado_uk
  ON public.pasadas (pase_id, fecha_hora, estacion_id, patente_id)
  WHERE duplicado = false;

-- -----------------------------------------------------------------------------
-- peajes_detectar_duplicados: nombres de catálogo + archivo + flag duplicado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_detectar_duplicados(
  p_pasadas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_errores jsonb := '[]'::jsonb;
  v_row jsonb;
  v_idx integer := 0;
  v_keys text[] := ARRAY[]::text[];
  v_key text;
  v_pase_id uuid;
  v_patente_id uuid;
  v_estacion_id uuid;
  v_fecha timestamptz;
  v_existing public.pasadas%ROWTYPE;
  v_patente_nombre text;
  v_pase_nombre text;
BEGIN
  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'p_pasadas debe ser un arreglo JSON';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_pasadas)
  LOOP
    v_idx := v_idx + 1;
    v_pase_id := NULLIF(v_row->>'pase_id', '')::uuid;
    v_patente_id := NULLIF(v_row->>'patente_id', '')::uuid;
    v_estacion_id := NULLIF(v_row->>'estacion_id', '')::uuid;
    v_fecha := NULLIF(v_row->>'fecha_hora', '')::timestamptz;
    v_patente_nombre := NULL;
    v_pase_nombre := NULL;

    IF v_pase_id IS NULL OR v_patente_id IS NULL OR v_estacion_id IS NULL OR v_fecha IS NULL THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_row,
        'motivo', 'Faltan campos de clave PASE_ID+FECHA_HORA+ESTACION_ID+PATENTE_ID',
        'duplicado', false
      ));
      CONTINUE;
    END IF;

    SELECT p.patente INTO v_patente_nombre FROM public.patentes p WHERE p.id = v_patente_id;
    SELECT s.pase INTO v_pase_nombre FROM public.pases s WHERE s.id = v_pase_id;

    v_key := v_pase_id::text || '|' || v_fecha::text || '|' || v_estacion_id::text || '|' || v_patente_id::text;

    IF v_key = ANY (v_keys) THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_key,
        'motivo', 'Duplicado dentro del lote (RN-16)',
        'pasada', v_pase_id, 'patente', v_patente_id,
        'pase_nombre', v_pase_nombre, 'patente_nombre', v_patente_nombre,
        'fecha_hora', v_fecha, 'fecha_hora_repetida', v_fecha,
        'valor_repetido', NULLIF(v_row->>'importe_neto', '')::numeric,
        'file_upload_name', NULL,
        'duplicado', true
      ));
      CONTINUE;
    END IF;

    v_keys := array_append(v_keys, v_key);

    SELECT p.* INTO v_existing
    FROM public.pasadas p
    WHERE p.pase_id = v_pase_id
      AND p.fecha_hora = v_fecha
      AND p.estacion_id = v_estacion_id
      AND p.patente_id = v_patente_id
    ORDER BY p.duplicado ASC, p.created_at ASC
    LIMIT 1;

    IF FOUND THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_key,
        'motivo', 'Ya existe una pasada con la misma clave de negocio (RN-16 / RNF-10)',
        'pasada', v_pase_id, 'patente', v_patente_id,
        'pase_nombre', v_pase_nombre, 'patente_nombre', v_patente_nombre,
        'fecha_hora', v_fecha, 'fecha_hora_repetida', v_existing.fecha_hora,
        'valor_repetido', v_existing.importe_neto,
        'file_upload_name', v_existing.file_upload_name,
        'duplicado', true
      ));
    END IF;
  END LOOP;

  RETURN v_errores;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_detectar_duplicados(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_detectar_duplicados(jsonb) IS
  'Detecta clave RN-16 en el lote y contra pasadas (incluye filas ya marcadas duplicado=true). Devuelve nombres de catálogo, file_upload_name existente y duplicado=true en coincidencias reales.';

-- -----------------------------------------------------------------------------
-- peajes_confirmar_carga: p_permitir_duplicados (default false)
-- Firma nueva: hay que DROP la sobrecarga de 8 argumentos.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric);

CREATE OR REPLACE FUNCTION public.peajes_confirmar_carga(
  p_factura jsonb,
  p_pasadas jsonb,
  p_plantilla_id uuid DEFAULT NULL,
  p_parametros_efectivos jsonb DEFAULT '{}'::jsonb,
  p_algoritmos_efectivos jsonb DEFAULT '[]'::jsonb,
  p_errores jsonb DEFAULT '[]'::jsonb,
  p_nombre_archivo text DEFAULT NULL,
  p_tolerancia numeric DEFAULT NULL,
  p_permitir_duplicados boolean DEFAULT false
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
  v_categoria text;
  v_idx integer := 0;
  v_err jsonb;
  v_bloqueantes jsonb := '[]'::jsonb;
  v_permitidos jsonb := '[]'::jsonb;
  v_dup_filas integer[] := ARRAY[]::integer[];
  v_es_dup boolean;
  v_params jsonb;
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

  -- La detección de claves duplicadas corre siempre.
  v_dups := public.peajes_detectar_duplicados(p_pasadas);
  FOR v_err IN SELECT value FROM jsonb_array_elements(COALESCE(v_dups, '[]'::jsonb))
  LOOP
    IF COALESCE((v_err->>'duplicado')::boolean, false) THEN
      v_permitidos := v_permitidos || jsonb_build_array(v_err);
      v_dup_filas := array_append(v_dup_filas, (v_err->>'fila')::integer);
    ELSE
      v_bloqueantes := v_bloqueantes || jsonb_build_array(v_err);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_bloqueantes) > 0 THEN
    RAISE EXCEPTION 'Hay pasadas duplicadas: %', v_dups;
  END IF;
  IF jsonb_array_length(v_permitidos) > 0 AND NOT COALESCE(p_permitir_duplicados, false) THEN
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
    v_idx := v_idx + 1;
    v_es_dup := v_idx = ANY (v_dup_filas);
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

    v_categoria := NULLIF(btrim(COALESCE(v_pasada->>'categoria', '')), '');

    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, documento_id,
      precio, bonificacion, quantity, importe_neto, user_id, file_upload_name,
      categoria, duplicado
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz,
      (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid,
      (v_pasada->>'estacion_id')::uuid,
      v_documento_id,
      v_precio, v_bonif,
      COALESCE((v_pasada->>'quantity')::integer, 1),
      v_neto, v_user_id, p_nombre_archivo,
      v_categoria,
      v_es_dup
    ) RETURNING id INTO v_id;
    v_pasada_ids := array_append(v_pasada_ids, v_id);
    v_importes := array_append(v_importes, v_neto);
  END LOOP;

  v_validacion := public.peajes_validar_factura_pasadas(v_subtotal, v_importes, p_tolerancia, v_bonificacion_doc);
  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación de subtotal falló (RN-17): %', v_validacion;
  END IF;

  v_params := COALESCE(p_parametros_efectivos, '{}'::jsonb);
  IF COALESCE(p_permitir_duplicados, false) AND jsonb_array_length(v_permitidos) > 0 THEN
    v_params := v_params || jsonb_build_object(
      'duplicados_permitidos', jsonb_array_length(v_permitidos),
      'duplicados_detectados', v_permitidos
    );
  END IF;

  INSERT INTO public.registros_carga_peajes (
    plantilla_id, documento_id, parametros_efectivos, algoritmos_efectivos,
    filas_procesadas, filas_validas, filas_rechazadas, errores, nombre_archivo, user_id
  ) VALUES (
    p_plantilla_id, v_documento_id, v_params,
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb), v_filas + v_rechazadas, v_filas,
    v_rechazadas, COALESCE(p_errores, '[]'::jsonb), p_nombre_archivo, v_user_id
  ) RETURNING id INTO v_registro_id;

  BEGIN
    PERFORM * FROM public.peajes_normalizar_tarifas(v_documento_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'peajes_normalizar_tarifas(%) diferida: %', v_documento_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'documento_id', v_documento_id,
    'factura_id', v_documento_id,
    'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id,
    'validacion', v_validacion,
    'duplicados_permitidos', COALESCE(jsonb_array_length(v_permitidos), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric, boolean) IS
  'Confirma carga en documentos (FC|NC). Detecta duplicados RN-16 siempre. p_permitir_duplicados=false (default) bloquea; true inserta coincidencias con pasadas.duplicado=true. Hook F14-2: peajes_normalizar_tarifas.';

REVOKE ALL ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric, boolean)
  TO authenticated, service_role;
