-- Fail closed at the RPC boundary as well as in the Paso 9 extractor.
-- The previous functions remain available under private legacy names so the
-- existing resolver signatures and matching semantics are preserved.

ALTER FUNCTION public.peajes_preparar_refresco_tarifas(jsonb)
  RENAME TO peajes_preparar_refresco_tarifas_legacy;
ALTER FUNCTION public.peajes_detectar_refresco_tarifas(jsonb)
  RENAME TO peajes_detectar_refresco_tarifas_legacy;

CREATE OR REPLACE FUNCTION public.peajes_preparar_refresco_tarifas(p_candidatos jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_resueltos jsonb;
  v_pendientes jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    INTO v_resueltos
  FROM jsonb_array_elements(p_candidatos) AS x(value)
  WHERE upper(nullif(btrim(value->>'sentido_solicitado'), '')) IN ('IDA', 'VUELTA', 'AMBAS');
  SELECT COALESCE(jsonb_agg(value || jsonb_build_object(
      'status', null,
      'sentido', null,
      'tarifa_id', null,
      'importe', null,
      'requiere_normalizacion_iva', null,
      'codigo', CASE WHEN upper(value->>'unresolvedReason') = 'CONFLICT'
        THEN 'DIRECTION_CONFLICT' ELSE 'DIRECTION_REQUIRED' END
    )), '[]'::jsonb)
    INTO v_pendientes
  FROM jsonb_array_elements(p_candidatos) AS x(value)
  WHERE COALESCE(upper(nullif(btrim(value->>'sentido_solicitado'), '')), '') NOT IN ('IDA', 'VUELTA', 'AMBAS');
  IF jsonb_array_length(v_resueltos) = 0 THEN RETURN v_pendientes; END IF;
  RETURN (
    SELECT jsonb_agg(value ORDER BY ord)
    FROM (
      SELECT 1 AS ord, value FROM jsonb_array_elements(public.peajes_preparar_refresco_tarifas_legacy(v_resueltos)) AS r(value)
      UNION ALL
      SELECT 2 AS ord, value FROM jsonb_array_elements(v_pendientes) AS p(value)
    ) ordered
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_detectar_refresco_tarifas(p_candidatos jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_resueltos jsonb;
  v_pendientes jsonb;
BEGIN
  IF p_candidatos IS NULL OR jsonb_typeof(p_candidatos) <> 'array' THEN
    RAISE EXCEPTION 'p_candidatos debe ser un arreglo JSON';
  END IF;
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    INTO v_resueltos
  FROM jsonb_array_elements(p_candidatos) AS x(value)
  WHERE upper(nullif(btrim(value->>'sentido_solicitado'), '')) IN ('IDA', 'VUELTA', 'AMBAS');
  SELECT COALESCE(jsonb_agg(value || jsonb_build_object(
      'codigo', CASE WHEN upper(value->>'unresolvedReason') = 'CONFLICT'
        THEN 'DIRECTION_CONFLICT' ELSE 'DIRECTION_REQUIRED' END,
      'sentido_solicitado', NULL,
      'sentido_aplicado', NULL,
      'precio_candidato', value->>'precio_directo'
    )), '[]'::jsonb)
    INTO v_pendientes
  FROM jsonb_array_elements(p_candidatos) AS x(value)
  WHERE COALESCE(upper(nullif(btrim(value->>'sentido_solicitado'), '')), '') NOT IN ('IDA', 'VUELTA', 'AMBAS');
  IF jsonb_array_length(v_resueltos) = 0 THEN RETURN v_pendientes; END IF;
  RETURN (
    SELECT jsonb_agg(value ORDER BY ord)
    FROM (
      SELECT 1 AS ord, value FROM jsonb_array_elements(public.peajes_detectar_refresco_tarifas_legacy(v_resueltos)) AS r(value)
      UNION ALL
      SELECT 2 AS ord, value FROM jsonb_array_elements(v_pendientes) AS p(value)
    ) ordered
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_preparar_refresco_tarifas(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) TO authenticated, service_role;
