-- F08-1: auditoría en pasadas + vista de gestión + RPCs list/CRUD
-- No crea tablas nuevas: solo ALTER, VIEW y FUNCTION.

-- -----------------------------------------------------------------------------
-- Audit columns on existing tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_upload_name text;

ALTER TABLE public.registros_carga_peajes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pasadas_user_id ON public.pasadas (user_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_created_at ON public.pasadas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pasadas_file_upload_name ON public.pasadas (file_upload_name);
CREATE INDEX IF NOT EXISTS idx_registros_carga_user_id ON public.registros_carga_peajes (user_id);

COMMENT ON COLUMN public.pasadas.user_id IS 'Usuario autenticado que creó la pasada (auth.uid())';
COMMENT ON COLUMN public.pasadas.file_upload_name IS 'Nombre del archivo de carga (denormalizado desde la confirmación)';
COMMENT ON COLUMN public.registros_carga_peajes.user_id IS 'Usuario autenticado que confirmó la carga';

-- -----------------------------------------------------------------------------
-- peajes_confirmar_carga: populate user_id + file_upload_name
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
  v_user_id uuid := auth.uid();
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
      precio, bonificacion, quantity, importe_neto,
      user_id, file_upload_name
    ) VALUES (
      (v_pasada->>'fecha_hora')::timestamptz,
      (v_pasada->>'pase_id')::uuid,
      (v_pasada->>'patente_id')::uuid,
      (v_pasada->>'estacion_id')::uuid,
      v_factura_id,
      v_precio,
      v_bonif,
      COALESCE((v_pasada->>'quantity')::integer, 1),
      v_neto,
      v_user_id,
      p_nombre_archivo
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
    nombre_archivo,
    user_id
  ) VALUES (
    p_plantilla_id,
    v_factura_id,
    COALESCE(p_parametros_efectivos, '{}'::jsonb),
    COALESCE(p_algoritmos_efectivos, '[]'::jsonb),
    v_filas + v_rechazadas,
    v_filas,
    v_rechazadas,
    COALESCE(p_errores, '[]'::jsonb),
    p_nombre_archivo,
    v_user_id
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

GRANT EXECUTE ON FUNCTION public.peajes_confirmar_carga(jsonb, jsonb, uuid, jsonb, jsonb, jsonb, text, numeric)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Display VIEW for management UI (read-only joins)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pasadas_gestion
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.fecha_hora,
  p.pase_id,
  p.patente_id,
  p.estacion_id,
  p.factura_id,
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
  f.factura AS factura_numero,
  f.cuenta AS factura_cuenta,
  f.fecha_factura,
  f.importe_sin_iva AS factura_importe_sin_iva,
  f.importe_total AS factura_importe_total
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id
LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
JOIN public.patentes pt ON pt.id = p.patente_id
JOIN public.pases pa ON pa.id = p.pase_id
JOIN public.facturas f ON f.id = p.factura_id;

COMMENT ON VIEW public.pasadas_gestion IS
  'Vista de gestión de pasadas con joins de catálogo; badge estación se deriva de latitud/longitud en UI';

GRANT SELECT ON public.pasadas_gestion TO authenticated;
GRANT SELECT ON public.pasadas_gestion TO service_role;

-- Keep convenience view in sync with new pasadas columns (p.* expands at CREATE time).
-- CREATE OR REPLACE VIEW cannot rename/reorder columns when p.* gains user_id/file_upload_name
-- (Postgres maps old peaje_id slot → user_id and raises 42P16). Drop + recreate preserves
-- the public contract: pasadas columns + peaje_id + estacion_nombre + peaje_nombre.
DROP VIEW IF EXISTS public.pasadas_con_peaje;
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

GRANT SELECT ON public.pasadas_con_peaje TO authenticated;
GRANT SELECT ON public.pasadas_con_peaje TO service_role;

-- -----------------------------------------------------------------------------
-- List FUNCTION (server-side pagination + filters)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_listar_pasadas(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'fecha_hora',
  p_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_sort text := lower(COALESCE(NULLIF(trim(p_sort), ''), 'fecha_hora'));
  v_asc boolean := lower(COALESCE(p_dir, 'desc')) = 'asc';
  v_rows jsonb;
  v_total bigint;
  v_fecha_desde timestamptz;
  v_fecha_hasta timestamptz;
  v_estacion_ids uuid[];
  v_patente_ids uuid[];
  v_empresa_ids text[];
  v_q_estacion text;
  v_q_patente text;
  v_q_empresa text;
  v_q_archivo text;
BEGIN
  IF v_sort NOT IN (
    'fecha_hora', 'precio', 'importe_neto', 'created_at',
    'estacion_nombre', 'patente_codigo', 'empresa_nombre', 'file_upload_name'
  ) THEN
    v_sort := 'fecha_hora';
  END IF;

  v_fecha_desde := NULLIF(p_filters->>'fecha_desde', '')::timestamptz;
  v_fecha_hasta := NULLIF(p_filters->>'fecha_hasta', '')::timestamptz;

  IF p_filters ? 'estacion_ids' AND jsonb_typeof(p_filters->'estacion_ids') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
      INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filters->'estacion_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filters ? 'patente_ids' AND jsonb_typeof(p_filters->'patente_ids') = 'array' THEN
    SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
      INTO v_patente_ids
    FROM jsonb_array_elements_text(p_filters->'patente_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_patente_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filters ? 'empresa_ids' AND jsonb_typeof(p_filters->'empresa_ids') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[])
      INTO v_empresa_ids
    FROM jsonb_array_elements_text(p_filters->'empresa_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_empresa_ids := ARRAY[]::text[];
  END IF;

  v_q_estacion := NULLIF(trim(p_filters->>'q_estacion'), '');
  v_q_patente := NULLIF(trim(p_filters->>'q_patente'), '');
  v_q_empresa := NULLIF(trim(p_filters->>'q_empresa'), '');
  v_q_archivo := NULLIF(trim(p_filters->>'q_archivo'), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.pasadas_gestion g
  WHERE (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
    AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
    AND (cardinality(v_estacion_ids) = 0 OR g.estacion_id = ANY (v_estacion_ids))
    AND (cardinality(v_patente_ids) = 0 OR g.patente_id = ANY (v_patente_ids))
    AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
    AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
    AND (v_q_patente IS NULL OR g.patente_codigo ILIKE '%' || v_q_patente || '%')
    AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
    AND (v_q_archivo IS NULL OR coalesce(g.file_upload_name, '') ILIKE '%' || v_q_archivo || '%');

  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT g.*
    FROM public.pasadas_gestion g
    WHERE (v_fecha_desde IS NULL OR g.fecha_hora >= v_fecha_desde)
      AND (v_fecha_hasta IS NULL OR g.fecha_hora <= v_fecha_hasta)
      AND (cardinality(v_estacion_ids) = 0 OR g.estacion_id = ANY (v_estacion_ids))
      AND (cardinality(v_patente_ids) = 0 OR g.patente_id = ANY (v_patente_ids))
      AND (cardinality(v_empresa_ids) = 0 OR g.empresa_id = ANY (v_empresa_ids))
      AND (v_q_estacion IS NULL OR g.estacion_nombre ILIKE '%' || v_q_estacion || '%')
      AND (v_q_patente IS NULL OR g.patente_codigo ILIKE '%' || v_q_patente || '%')
      AND (v_q_empresa IS NULL OR coalesce(g.empresa_nombre, '') ILIKE '%' || v_q_empresa || '%')
      AND (v_q_archivo IS NULL OR coalesce(g.file_upload_name, '') ILIKE '%' || v_q_archivo || '%')
    ORDER BY
      CASE WHEN v_asc AND v_sort = 'fecha_hora' THEN g.fecha_hora END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'fecha_hora' THEN g.fecha_hora END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'precio' THEN g.precio END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'precio' THEN g.precio END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'importe_neto' THEN g.importe_neto END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'importe_neto' THEN g.importe_neto END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'created_at' THEN g.created_at END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'created_at' THEN g.created_at END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'estacion_nombre' THEN g.estacion_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'estacion_nombre' THEN g.estacion_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'patente_codigo' THEN g.patente_codigo END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'patente_codigo' THEN g.patente_codigo END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'empresa_nombre' THEN g.empresa_nombre END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'empresa_nombre' THEN g.empresa_nombre END DESC NULLS LAST,
      CASE WHEN v_asc AND v_sort = 'file_upload_name' THEN g.file_upload_name END ASC NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'file_upload_name' THEN g.file_upload_name END DESC NULLS LAST,
      g.fecha_hora DESC
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_listar_pasadas(jsonb, text, text, integer, integer) IS
  'Listado paginado/filtrado de pasadas desde la vista pasadas_gestion';

GRANT EXECUTE ON FUNCTION public.peajes_listar_pasadas(jsonb, text, text, integer, integer)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- CRUD FUNCTIONs (mutate base pasadas only)
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
BEGIN
  IF p_pasada IS NULL THEN
    RAISE EXCEPTION 'pasada es obligatoria';
  END IF;

  v_precio := (p_pasada->>'precio')::numeric;
  v_bonif := COALESCE((p_pasada->>'bonificacion')::numeric, 0);
  v_neto := public.peajes_calcular_importe_neto(v_precio, v_bonif);
  v_file := COALESCE(NULLIF(p_pasada->>'file_upload_name', ''), 'manual');

  INSERT INTO public.pasadas (
    fecha_hora, pase_id, patente_id, estacion_id, factura_id,
    precio, bonificacion, quantity, importe_neto,
    user_id, file_upload_name
  ) VALUES (
    (p_pasada->>'fecha_hora')::timestamptz,
    (p_pasada->>'pase_id')::uuid,
    (p_pasada->>'patente_id')::uuid,
    (p_pasada->>'estacion_id')::uuid,
    (p_pasada->>'factura_id')::uuid,
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

  UPDATE public.pasadas
  SET
    fecha_hora = COALESCE((p_patch->>'fecha_hora')::timestamptz, fecha_hora),
    pase_id = COALESCE((p_patch->>'pase_id')::uuid, pase_id),
    patente_id = COALESCE((p_patch->>'patente_id')::uuid, patente_id),
    estacion_id = COALESCE((p_patch->>'estacion_id')::uuid, estacion_id),
    factura_id = COALESCE((p_patch->>'factura_id')::uuid, factura_id),
    precio = v_precio,
    bonificacion = v_bonif,
    quantity = COALESCE((p_patch->>'quantity')::integer, quantity),
    importe_neto = v_neto
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_eliminar_pasada(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id es obligatorio';
  END IF;

  DELETE FROM public.pasadas WHERE id = p_id RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Pasada no encontrada: %', p_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'deleted', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_crear_pasada(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_actualizar_pasada(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_eliminar_pasada(uuid) TO authenticated, service_role;
