-- F13: facturas → documentos (FC|NC), FK documento_id, importes firmados para NC.
-- Preserva filas existentes; tipo default FC.

-- -----------------------------------------------------------------------------
-- 1) Drop views that depend on facturas / factura_id column names
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.pasadas_gestion;
DROP VIEW IF EXISTS public.pasadas_con_peaje;

-- -----------------------------------------------------------------------------
-- 2) Rename table + add tipo
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.facturas RENAME TO documentos;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'FC';

UPDATE public.documentos SET tipo = 'FC' WHERE tipo IS NULL OR trim(tipo) = '';

ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_tipo_chk,
  ADD CONSTRAINT documentos_tipo_chk CHECK (tipo IN ('FC', 'NC'));

-- Rename indexes / constraints / policies from facturas_* → documentos_*
ALTER INDEX IF EXISTS idx_facturas_empresa_id RENAME TO idx_documentos_empresa_id;
ALTER INDEX IF EXISTS idx_facturas_fecha RENAME TO idx_documentos_fecha;
ALTER INDEX IF EXISTS idx_facturas_numero RENAME TO idx_documentos_numero;

ALTER TABLE public.documentos RENAME CONSTRAINT facturas_pkey TO documentos_pkey;
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS facturas_importe_sin_iva_chk;
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS facturas_importe_total_chk;
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS facturas_iva_chk;
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS facturas_percepciones_chk;
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS facturas_importes_desglosados_chk;

DROP POLICY IF EXISTS facturas_authenticated_all ON public.documentos;
CREATE POLICY documentos_authenticated_all ON public.documentos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.documentos IS
  'Documento de peajes (FC factura / NC nota de crédito) asociado a una carga de pasadas';
COMMENT ON COLUMN public.documentos.tipo IS 'Tipo de documento: FC (factura) o NC (nota de crédito)';
COMMENT ON COLUMN public.documentos.factura IS 'Número de documento (FACTURA en Excel / formulario)';
COMMENT ON COLUMN public.documentos.importe_sin_iva IS
  'Subtotal declarado; contrastado con la suma de pasadas. Negativo cuando tipo=NC.';
COMMENT ON COLUMN public.documentos.percepciones IS
  'Percepciones declaradas. Negativo cuando tipo=NC.';
COMMENT ON COLUMN public.documentos.iva IS
  'IVA declarado. Negativo cuando tipo=NC.';
COMMENT ON COLUMN public.documentos.importe_total IS
  'Total declarado; no se recalcula. Negativo cuando tipo=NC.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Rename FKs factura_id → documento_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.pasadas DROP CONSTRAINT IF EXISTS pasadas_factura_id_fkey;
ALTER TABLE public.pasadas RENAME COLUMN factura_id TO documento_id;
ALTER TABLE public.pasadas
  ADD CONSTRAINT pasadas_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos (id) ON DELETE RESTRICT;

ALTER INDEX IF EXISTS idx_pasadas_factura_id RENAME TO idx_pasadas_documento_id;

ALTER TABLE public.registros_carga_peajes DROP CONSTRAINT IF EXISTS registros_carga_peajes_factura_id_fkey;
ALTER TABLE public.registros_carga_peajes RENAME COLUMN factura_id TO documento_id;
ALTER TABLE public.registros_carga_peajes
  ADD CONSTRAINT registros_carga_peajes_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos (id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.pasadas.documento_id IS 'FK técnica a documentos';
COMMENT ON COLUMN public.registros_carga_peajes.documento_id IS 'FK técnica a documentos';

-- -----------------------------------------------------------------------------
-- 4) Relax monetary CHECKs for signed NC values
-- -----------------------------------------------------------------------------
ALTER TABLE public.pasadas DROP CONSTRAINT IF EXISTS pasadas_precio_chk;
ALTER TABLE public.pasadas DROP CONSTRAINT IF EXISTS pasadas_bonificacion_chk;
ALTER TABLE public.pasadas DROP CONSTRAINT IF EXISTS pasadas_bonificacion_lte_precio_chk;
ALTER TABLE public.pasadas DROP CONSTRAINT IF EXISTS pasadas_importe_neto_chk;

ALTER TABLE public.pasadas
  ADD CONSTRAINT pasadas_bonificacion_abs_lte_precio_chk
  CHECK (abs(bonificacion) <= abs(precio));

-- -----------------------------------------------------------------------------
-- 5) Views
-- -----------------------------------------------------------------------------
CREATE VIEW public.pasadas_con_peaje
WITH (security_invoker = true)
AS
SELECT
  p.*,
  e.peaje_id,
  e.nombre AS estacion_nombre,
  pj.nombre AS peaje_nombre
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id;

COMMENT ON VIEW public.pasadas_con_peaje IS 'Pasadas con peaje derivado vía estación';
GRANT SELECT ON public.pasadas_con_peaje TO authenticated, service_role;

CREATE VIEW public.pasadas_gestion
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.fecha_hora,
  p.pase_id,
  p.patente_id,
  p.estacion_id,
  p.documento_id,
  p.precio,
  p.bonificacion,
  p.quantity,
  p.importe_neto,
  p.created_at,
  p.user_id,
  p.file_upload_name,
  e.nombre AS estacion_nombre,
  e.latitud AS estacion_latitud,
  e.longitud AS estacion_longitud,
  e.peaje_id,
  pj.nombre AS peaje_nombre,
  pj.empresa_id,
  emp.nombre AS empresa_nombre,
  pt.patente AS patente_codigo,
  pt.categoria AS patente_categoria,
  pa.pase AS pase_codigo,
  d.factura AS documento_numero,
  d.factura AS factura_numero,
  d.cuenta AS documento_cuenta,
  d.cuenta AS factura_cuenta,
  d.tipo AS documento_tipo,
  d.fecha_factura,
  d.importe_sin_iva AS documento_importe_sin_iva,
  d.importe_sin_iva AS factura_importe_sin_iva,
  d.importe_total AS documento_importe_total,
  d.importe_total AS factura_importe_total
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.documentos d ON d.id = p.documento_id;

COMMENT ON VIEW public.pasadas_gestion IS
  'Vista de gestión de pasadas con joins de catálogo; documento_* preferido, factura_* alias de compatibilidad';
GRANT SELECT ON public.pasadas_gestion TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) peajes_calcular_importe_neto — allow signed NC
-- -----------------------------------------------------------------------------
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
  IF abs(p_bonificacion) > abs(p_precio) THEN
    RAISE EXCEPTION 'BONIFICACION no puede superar PRECIO en valor absoluto (RN-09)';
  END IF;
  IF p_precio > 0 AND p_bonificacion < 0 THEN
    RAISE EXCEPTION 'BONIFICACION debe ser >= 0 cuando PRECIO es positivo (RN-09)';
  END IF;
  IF p_precio < 0 AND p_bonificacion > 0 THEN
    RAISE EXCEPTION 'BONIFICACION debe ser <= 0 cuando PRECIO es negativo (NC)';
  END IF;
  RETURN p_precio - p_bonificacion;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) peajes_validar_documento_id (+ alias factura)
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
  v_importes numeric[];
BEGIN
  SELECT d.importe_sin_iva INTO v_importe
  FROM public.documentos d
  WHERE d.id = p_documento_id;

  IF v_importe IS NULL THEN
    RAISE EXCEPTION 'Documento % no encontrado', p_documento_id;
  END IF;

  SELECT COALESCE(array_agg(p.importe_neto), ARRAY[]::numeric[])
  INTO v_importes
  FROM public.pasadas p
  WHERE p.documento_id = p_documento_id;

  RETURN public.peajes_validar_factura_pasadas(v_importe, v_importes, p_tolerancia);
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_validar_factura_id(
  p_factura_id uuid,
  p_tolerancia numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN public.peajes_validar_documento_id(p_factura_id, p_tolerancia);
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_validar_documento_id(uuid, numeric)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_validar_factura_id(uuid, numeric)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) peajes_confirmar_carga — documentos + tipo + importes firmados NC
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

  IF v_subtotal IS NULL OR v_percepciones IS NULL OR v_iva IS NULL OR v_total IS NULL THEN
    RAISE EXCEPTION 'Los importes declarados del documento deben ser numéricos';
  END IF;

  -- Normalizar signo según tipo (idempotente).
  IF v_tipo = 'NC' THEN
    v_subtotal := -abs(v_subtotal);
    v_percepciones := -abs(v_percepciones);
    v_iva := -abs(v_iva);
    v_total := -abs(v_total);
  ELSE
    v_subtotal := abs(v_subtotal);
    v_percepciones := abs(v_percepciones);
    v_iva := abs(v_iva);
    v_total := abs(v_total);
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
      importe_sin_iva, percepciones, iva, importe_total
    ) VALUES (
      p_factura->>'factura', v_cuenta, p_factura->>'empresa_id',
      (p_factura->>'fecha_factura')::date, v_tipo,
      v_subtotal, v_percepciones, v_iva, v_total
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
        importe_total = v_total
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

  v_validacion := public.peajes_validar_factura_pasadas(v_subtotal, v_importes, p_tolerancia);
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
  'Confirma carga en documentos (FC|NC); normaliza signos NC; valida subtotal contra pasadas.';
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9) CRUD pasadas — documento_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_crear_pasada(p_pasada jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_precio numeric;
  v_bonif numeric;
  v_neto numeric;
  v_row public.pasadas%ROWTYPE;
  v_file text;
  v_documento_id uuid;
BEGIN
  IF p_pasada IS NULL THEN
    RAISE EXCEPTION 'pasada es obligatoria';
  END IF;

  v_precio := (p_pasada->>'precio')::numeric;
  v_bonif := COALESCE((p_pasada->>'bonificacion')::numeric, 0);
  v_neto := public.peajes_calcular_importe_neto(v_precio, v_bonif);
  v_file := COALESCE(NULLIF(p_pasada->>'file_upload_name', ''), 'manual');
  v_documento_id := COALESCE(
    NULLIF(p_pasada->>'documento_id', '')::uuid,
    NULLIF(p_pasada->>'factura_id', '')::uuid
  );

  INSERT INTO public.pasadas (
    fecha_hora, pase_id, patente_id, estacion_id, documento_id,
    precio, bonificacion, quantity, importe_neto,
    user_id, file_upload_name
  ) VALUES (
    (p_pasada->>'fecha_hora')::timestamptz,
    (p_pasada->>'pase_id')::uuid,
    (p_pasada->>'patente_id')::uuid,
    (p_pasada->>'estacion_id')::uuid,
    v_documento_id,
    v_precio,
    v_bonif,
    COALESCE((p_pasada->>'quantity')::integer, 1),
    v_neto,
    auth.uid(),
    v_file
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_actualizar_pasada(p_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row public.pasadas%ROWTYPE;
  v_precio numeric;
  v_bonif numeric;
  v_neto numeric;
  v_documento_id uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id es obligatorio';
  END IF;

  SELECT * INTO v_row FROM public.pasadas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasada no encontrada: %', p_id;
  END IF;

  v_precio := COALESCE((p_patch->>'precio')::numeric, v_row.precio);
  v_bonif := COALESCE((p_patch->>'bonificacion')::numeric, v_row.bonificacion);
  v_neto := public.peajes_calcular_importe_neto(v_precio, v_bonif);
  v_documento_id := COALESCE(
    NULLIF(p_patch->>'documento_id', '')::uuid,
    NULLIF(p_patch->>'factura_id', '')::uuid,
    v_row.documento_id
  );

  UPDATE public.pasadas
  SET
    fecha_hora = COALESCE((p_patch->>'fecha_hora')::timestamptz, fecha_hora),
    pase_id = COALESCE((p_patch->>'pase_id')::uuid, pase_id),
    patente_id = COALESCE((p_patch->>'patente_id')::uuid, patente_id),
    estacion_id = COALESCE((p_patch->>'estacion_id')::uuid, estacion_id),
    documento_id = v_documento_id,
    precio = v_precio,
    bonificacion = v_bonif,
    quantity = COALESCE((p_patch->>'quantity')::integer, quantity),
    importe_neto = v_neto
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_crear_pasada(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_actualizar_pasada(uuid, jsonb) TO authenticated, service_role;
