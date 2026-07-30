-- F01-5..F01-9: RPCs transaccionales + auditoría de carga
-- Tolerancia monetaria MVP: 0.01 (centavo). Documentada en docs/08-sql/peajes.

CREATE SCHEMA IF NOT EXISTS peajes_private;

-- -----------------------------------------------------------------------------
-- F01-9: tabla de auditoría de cargas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registros_carga_peajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid REFERENCES public.plantillas_configuracion (id) ON DELETE SET NULL,
  factura_id uuid NOT NULL REFERENCES public.facturas (id) ON DELETE RESTRICT,
  parametros_efectivos jsonb DEFAULT '{}'::jsonb,
  algoritmos_efectivos jsonb DEFAULT '[]'::jsonb,
  filas_procesadas integer NOT NULL DEFAULT 0,
  filas_validas integer NOT NULL DEFAULT 0,
  filas_rechazadas integer NOT NULL DEFAULT 0,
  errores jsonb DEFAULT '[]'::jsonb,
  nombre_archivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registros_carga_filas_chk CHECK (
    filas_procesadas >= 0
    AND filas_validas >= 0
    AND filas_rechazadas >= 0
    AND filas_procesadas = filas_validas + filas_rechazadas
  )
);

CREATE INDEX IF NOT EXISTS idx_registros_carga_factura ON public.registros_carga_peajes (factura_id);
CREATE INDEX IF NOT EXISTS idx_registros_carga_plantilla ON public.registros_carga_peajes (plantilla_id);
CREATE INDEX IF NOT EXISTS idx_registros_carga_created ON public.registros_carga_peajes (created_at);

COMMENT ON TABLE public.registros_carga_peajes IS 'Auditoría de carga confirmada (RF-26 / RF-32 / RNF-05)';

ALTER TABLE public.registros_carga_peajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registros_carga_peajes_authenticated_all ON public.registros_carga_peajes;
CREATE POLICY registros_carga_peajes_authenticated_all ON public.registros_carga_peajes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_carga_peajes TO authenticated;
GRANT ALL ON public.registros_carga_peajes TO service_role;

-- -----------------------------------------------------------------------------
-- Constantes / helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_tolerancia_importe()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 0.01::numeric;
$$;

COMMENT ON FUNCTION public.peajes_tolerancia_importe() IS 'Tolerancia MVP RN-13/RN-17 (centavo)';

-- F01-5 / RN-10: cálculo importe neto
CREATE OR REPLACE FUNCTION public.peajes_calcular_importe_neto(
  p_precio numeric,
  p_bonificacion numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  IF p_precio < 0 THEN
    RAISE EXCEPTION 'PRECIO debe ser >= 0 (RN-08)';
  END IF;
  IF p_bonificacion < 0 THEN
    RAISE EXCEPTION 'BONIFICACION debe ser >= 0 (RN-09)';
  END IF;
  IF p_bonificacion > p_precio THEN
    RAISE EXCEPTION 'BONIFICACION no puede superar PRECIO (RN-09)';
  END IF;
  RETURN p_precio - p_bonificacion;
END;
$$;

-- F01-5 / RN-11 / RN-13 / RN-17: validar factura vs suma de importes netos
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
  v_tol numeric := COALESCE(p_tolerancia, public.peajes_tolerancia_importe());
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

-- Validar factura ya persistida (suma desde tabla pasadas)
CREATE OR REPLACE FUNCTION public.peajes_validar_factura_id(
  p_factura_id uuid,
  p_tolerancia numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_importe numeric;
  v_importes numeric[];
BEGIN
  SELECT f.importe_sin_iva INTO v_importe
  FROM public.facturas f
  WHERE f.id = p_factura_id;

  IF v_importe IS NULL THEN
    RAISE EXCEPTION 'Factura % no encontrada', p_factura_id;
  END IF;

  SELECT COALESCE(array_agg(p.importe_neto), ARRAY[]::numeric[])
  INTO v_importes
  FROM public.pasadas p
  WHERE p.factura_id = p_factura_id;

  RETURN public.peajes_validar_factura_pasadas(v_importe, v_importes, p_tolerancia);
END;
$$;

-- -----------------------------------------------------------------------------
-- F01-6: detección de duplicados (batch + contra BD)
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
  v_exists boolean;
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
        'fila', v_idx,
        'columna', 'CLAVE_DUPLICADO',
        'valor', v_row,
        'motivo', 'Faltan campos de clave PASE_ID+FECHA_HORA+ESTACION_ID+PATENTE_ID'
      ));
      CONTINUE;
    END IF;

    v_key := v_pase_id::text || '|' || v_fecha::text || '|' || v_estacion_id::text || '|' || v_patente_id::text;

    IF v_key = ANY (v_keys) THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx,
        'columna', 'CLAVE_DUPLICADO',
        'valor', v_key,
        'motivo', 'Duplicado dentro del lote (RN-16)'
      ));
      CONTINUE;
    END IF;

    v_keys := array_append(v_keys, v_key);

    SELECT EXISTS (
      SELECT 1
      FROM public.pasadas p
      WHERE p.pase_id = v_pase_id
        AND p.fecha_hora = v_fecha
        AND p.estacion_id = v_estacion_id
        AND p.patente_id = v_patente_id
    ) INTO v_exists;

    IF v_exists THEN
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx,
        'columna', 'CLAVE_DUPLICADO',
        'valor', v_key,
        'motivo', 'Ya existe una pasada con la misma clave de negocio (RN-16 / RNF-10)'
      ));
    END IF;
  END LOOP;

  RETURN v_errores;
END;
$$;

-- -----------------------------------------------------------------------------
-- F01-7: sobrescritura transaccional de configuraciones de plantilla
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_sobrescribir_configuraciones_plantilla(
  p_plantilla_id uuid,
  p_configuraciones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_cfg jsonb;
  v_inserted jsonb := '[]'::jsonb;
  v_id uuid;
  v_seen text[] := ARRAY[]::text[];
  v_key text;
  v_orden integer;
  v_nombre text;
BEGIN
  IF p_plantilla_id IS NULL THEN
    RAISE EXCEPTION 'plantilla_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.plantillas_configuracion WHERE id = p_plantilla_id) THEN
    RAISE EXCEPTION 'Plantilla % no existe', p_plantilla_id;
  END IF;

  IF p_configuraciones IS NULL OR jsonb_typeof(p_configuraciones) <> 'array' THEN
    RAISE EXCEPTION 'p_configuraciones debe ser un arreglo JSON';
  END IF;

  -- Validar definición completa antes de borrar (RN-19 / RN-25)
  FOR v_cfg IN SELECT value FROM jsonb_array_elements(p_configuraciones)
  LOOP
    v_nombre := v_cfg->>'nombre_columna';
    v_orden := (v_cfg->>'orden')::integer;

    IF v_nombre IS NULL OR v_orden IS NULL THEN
      RAISE EXCEPTION 'Cada configuración requiere nombre_columna y orden';
    END IF;

    IF v_cfg->>'tipo' IS NULL OR v_cfg->>'tipo' NOT IN ('transformacion', 'mapeo', 'validacion') THEN
      RAISE EXCEPTION 'tipo inválido en configuración de columna %', v_nombre;
    END IF;

    v_key := v_nombre || '|' || v_orden::text;
    IF v_key = ANY (v_seen) THEN
      RAISE EXCEPTION 'Orden duplicado para columna % (orden=%) — RN-18', v_nombre, v_orden;
    END IF;
    v_seen := array_append(v_seen, v_key);

    IF v_cfg ? 'algoritmo_combinado_id'
       AND NULLIF(v_cfg->>'algoritmo_combinado_id', '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.algoritmos_combinados a
         WHERE a.id = (v_cfg->>'algoritmo_combinado_id')::uuid
       ) THEN
      RAISE EXCEPTION 'algoritmo_combinado_id inexistente: %', v_cfg->>'algoritmo_combinado_id';
    END IF;
  END LOOP;

  DELETE FROM public.configuraciones_plantilla WHERE plantilla_id = p_plantilla_id;

  FOR v_cfg IN SELECT value FROM jsonb_array_elements(p_configuraciones)
  LOOP
    INSERT INTO public.configuraciones_plantilla (
      plantilla_id,
      nombre_columna,
      columna_destino,
      orden,
      tipo,
      algoritmo_combinado_id,
      configuracion,
      obligatoria
    ) VALUES (
      p_plantilla_id,
      v_cfg->>'nombre_columna',
      NULLIF(v_cfg->>'columna_destino', ''),
      (v_cfg->>'orden')::integer,
      v_cfg->>'tipo',
      NULLIF(v_cfg->>'algoritmo_combinado_id', '')::uuid,
      COALESCE(v_cfg->'configuracion', '{}'::jsonb),
      COALESCE((v_cfg->>'obligatoria')::boolean, false)
    )
    RETURNING id INTO v_id;

    v_inserted := v_inserted || jsonb_build_array(
      (SELECT to_jsonb(c) FROM public.configuraciones_plantilla c WHERE c.id = v_id)
    );
  END LOOP;

  UPDATE public.plantillas_configuracion
  SET updated_at = now()
  WHERE id = p_plantilla_id;

  RETURN v_inserted;
EXCEPTION
  WHEN OTHERS THEN
    -- Propagar error: la transacción del caller hace rollback (no deja estado parcial)
    RAISE;
END;
$$;

-- -----------------------------------------------------------------------------
-- F01-8: expansión / validación de algoritmo combinado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_validar_algoritmo_combinado(
  p_pasos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_paso jsonb;
  v_seen int[] := ARRAY[]::int[];
  v_orden integer;
  v_codigo text;
BEGIN
  IF p_pasos IS NULL OR jsonb_typeof(p_pasos) <> 'array' THEN
    RAISE EXCEPTION 'p_pasos debe ser un arreglo JSON';
  END IF;

  FOR v_paso IN SELECT value FROM jsonb_array_elements(p_pasos)
  LOOP
    v_orden := (v_paso->>'orden')::integer;
    v_codigo := v_paso->>'algoritmo_codigo';

    IF v_orden IS NULL THEN
      RAISE EXCEPTION 'Cada paso requiere orden';
    END IF;

    IF v_orden = ANY (v_seen) THEN
      RAISE EXCEPTION 'Orden duplicado dentro del algoritmo: % (RN-18)', v_orden;
    END IF;
    v_seen := array_append(v_seen, v_orden);

    IF v_codigo IS NULL OR btrim(v_codigo) = '' THEN
      RAISE EXCEPTION 'algoritmo_codigo es obligatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.peajes_algoritmos_catalogo c
      WHERE c.codigo = v_codigo AND c.activo = true
    ) THEN
      RAISE EXCEPTION 'algoritmo_codigo inexistente o inactivo: % (RN-20)', v_codigo;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('valido', true, 'cantidad_pasos', coalesce(jsonb_array_length(p_pasos), 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_expandir_algoritmo(
  p_algoritmo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_pasos jsonb;
  v_validacion jsonb;
BEGIN
  IF p_algoritmo_id IS NULL THEN
    RAISE EXCEPTION 'algoritmo_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.algoritmos_combinados WHERE id = p_algoritmo_id) THEN
    RAISE EXCEPTION 'Algoritmo combinado % no existe', p_algoritmo_id;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.orden), '[]'::jsonb)
  INTO v_pasos
  FROM public.algoritmo_combinado_pasos p
  WHERE p.algoritmo_combinado_id = p_algoritmo_id;

  v_validacion := public.peajes_validar_algoritmo_combinado(v_pasos);

  RETURN jsonb_build_object(
    'algoritmo_id', p_algoritmo_id,
    'pasos', v_pasos,
    'validacion', v_validacion
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_guardar_algoritmo_combinado(
  p_algoritmo jsonb,
  p_pasos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id uuid;
  v_pasos_out jsonb;
BEGIN
  PERFORM public.peajes_validar_algoritmo_combinado(p_pasos);

  v_id := NULLIF(p_algoritmo->>'id', '')::uuid;

  IF v_id IS NULL THEN
    INSERT INTO public.algoritmos_combinados (nombre, descripcion, empresa_id, estado)
    VALUES (
      p_algoritmo->>'nombre',
      NULLIF(p_algoritmo->>'descripcion', ''),
      p_algoritmo->>'empresa_id',
      COALESCE(NULLIF(p_algoritmo->>'estado', ''), 'borrador')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.algoritmos_combinados
    SET
      nombre = COALESCE(p_algoritmo->>'nombre', nombre),
      descripcion = COALESCE(NULLIF(p_algoritmo->>'descripcion', ''), descripcion),
      estado = COALESCE(NULLIF(p_algoritmo->>'estado', ''), estado),
      updated_at = now()
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Algoritmo % no existe', v_id;
    END IF;

    DELETE FROM public.algoritmo_combinado_pasos WHERE algoritmo_combinado_id = v_id;
  END IF;

  INSERT INTO public.algoritmo_combinado_pasos (algoritmo_combinado_id, orden, algoritmo_codigo, parametros)
  SELECT
    v_id,
    (value->>'orden')::integer,
    value->>'algoritmo_codigo',
    COALESCE(value->'parametros', '{}'::jsonb)
  FROM jsonb_array_elements(p_pasos);

  RETURN public.peajes_expandir_algoritmo(v_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- F01-9 + confirmación de carga (factura + pasadas + auditoría en una TX)
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
BEGIN
  IF p_factura IS NULL THEN
    RAISE EXCEPTION 'factura es obligatoria (RN-12)';
  END IF;

  IF p_pasadas IS NULL OR jsonb_typeof(p_pasadas) <> 'array' THEN
    RAISE EXCEPTION 'pasadas debe ser un arreglo JSON';
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
      factura, cuenta, empresa_id, fecha_factura, importe_sin_iva, importe_total
    ) VALUES (
      p_factura->>'factura',
      p_factura->>'cuenta',
      p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date,
      (p_factura->>'importe_sin_iva')::numeric,
      (p_factura->>'importe_total')::numeric
    )
    RETURNING id INTO v_factura_id;
  ELSE
    UPDATE public.facturas
    SET
      factura = COALESCE(p_factura->>'factura', factura),
      cuenta = COALESCE(p_factura->>'cuenta', cuenta),
      fecha_factura = COALESCE((p_factura->>'fecha_factura')::date, fecha_factura),
      importe_sin_iva = COALESCE((p_factura->>'importe_sin_iva')::numeric, importe_sin_iva),
      importe_total = COALESCE((p_factura->>'importe_total')::numeric, importe_total)
    WHERE id = v_factura_id;
  END IF;

  FOR v_pasada IN SELECT value FROM jsonb_array_elements(p_pasadas)
  LOOP
    v_precio := (v_pasada->>'precio')::numeric;
    v_bonif := COALESCE((v_pasada->>'bonificacion')::numeric, 0);
    v_neto := public.peajes_calcular_importe_neto(v_precio, v_bonif);

    IF v_pasada ? 'importe_neto'
       AND NULLIF(v_pasada->>'importe_neto', '') IS NOT NULL
       AND abs((v_pasada->>'importe_neto')::numeric - v_neto) > public.peajes_tolerancia_importe() THEN
      RAISE EXCEPTION 'IMPORTE_NETO inconsistente con PRECIO-BONIFICACION (RN-11) en fila %', v_pasada;
    END IF;

    INSERT INTO public.pasadas (
      fecha_hora, pase_id, patente_id, estacion_id, factura_id,
      precio, bonificacion, quantity, importe_neto
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz,
      (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid,
      (v_pasada->>'estacion_id')::uuid,
      v_factura_id,
      v_precio,
      v_bonif,
      COALESCE((v_pasada->>'quantity')::integer, 1),
      v_neto
    )
    RETURNING id INTO v_id;

    v_pasada_ids := array_append(v_pasada_ids, v_id);
    v_importes := array_append(v_importes, v_neto);
  END LOOP;

  v_validacion := public.peajes_validar_factura_pasadas(
    (SELECT importe_sin_iva FROM public.facturas WHERE id = v_factura_id),
    v_importes,
    p_tolerancia
  );

  IF NOT (v_validacion->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validación factura falló (RN-17): %', v_validacion;
  END IF;

  INSERT INTO public.registros_carga_peajes (
    plantilla_id,
    factura_id,
    parametros_efectivos,
    algoritmos_efectivos,
    filas_procesadas,
    filas_validas,
    filas_rechazadas,
    errores,
    nombre_archivo
  ) VALUES (
    p_plantilla_id,
    v_factura_id,
    COALESCE(p_parametros_efectivos, '{}'::jsonb),
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb),
    v_filas + v_rechazadas,
    v_filas,
    v_rechazadas,
    COALESCE(p_errores, '[]'::jsonb),
    p_nombre_archivo
  )
  RETURNING id INTO v_registro_id;

  RETURN jsonb_build_object(
    'factura_id', v_factura_id,
    'pasada_ids', to_jsonb(v_pasada_ids),
    'registro_id', v_registro_id,
    'validacion', v_validacion
  );
END;
$$;

-- Grants RPC
GRANT EXECUTE ON FUNCTION public.peajes_tolerancia_importe() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_calcular_importe_neto(numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_validar_factura_pasadas(numeric, numeric[], numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_validar_factura_id(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_duplicados(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_sobrescribir_configuraciones_plantilla(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_validar_algoritmo_combinado(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_expandir_algoritmo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_algoritmo_combinado(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric) TO authenticated, service_role;
