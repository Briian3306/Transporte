-- Enrich duplicate validation with the imported and persisted values used by the UI.
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

    IF v_pase_id IS NULL OR v_patente_id IS NULL OR v_estacion_id IS NULL OR v_fecha IS NULL THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_row,
        'motivo', 'Faltan campos de clave PASE_ID+FECHA_HORA+ESTACION_ID+PATENTE_ID'
      ));
      CONTINUE;
    END IF;

    v_key := v_pase_id::text || '|' || v_fecha::text || '|' || v_estacion_id::text || '|' || v_patente_id::text;

    IF v_key = ANY (v_keys) THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_key,
        'motivo', 'Duplicado dentro del lote (RN-16)',
        'pasada', v_pase_id, 'patente', v_patente_id,
        'fecha_hora', v_fecha, 'fecha_hora_repetida', v_fecha,
        'valor_repetido', NULLIF(v_row->>'importe_neto', '')::numeric
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
    LIMIT 1;

    IF FOUND THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'columna', 'CLAVE_DUPLICADO', 'valor', v_key,
        'motivo', 'Ya existe una pasada con la misma clave de negocio (RN-16 / RNF-10)',
        'pasada', v_pase_id, 'patente', v_patente_id,
        'fecha_hora', v_fecha, 'fecha_hora_repetida', v_existing.fecha_hora,
        'valor_repetido', v_existing.importe_neto
      ));
    END IF;
  END LOOP;

  RETURN v_errores;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_detectar_duplicados(jsonb) TO authenticated, service_role;
