-- F14-2: peajes_confirmar_status_tarifa, peajes_marcar_diagnostico_tarifa,
-- peajes_grupos_similares_tarifa

CREATE OR REPLACE FUNCTION public.peajes_confirmar_status_tarifa(
  p_asignaciones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_niveles integer := 0;
  v_pasadas integer := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF p_asignaciones IS NULL OR jsonb_typeof(p_asignaciones) <> 'array' THEN
    RAISE EXCEPTION 'p_asignaciones debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_asignaciones) = 0 THEN
    RETURN jsonb_build_object('niveles_confirmados', 0, 'pasadas_actualizadas', 0);
  END IF;

  WITH entrada AS (
    SELECT
      (a->>'tarifa_normalizada_id')::uuid AS id,
      upper(btrim(a->>'status_codigo'))   AS status_codigo
    FROM jsonb_array_elements(p_asignaciones) AS a
  ),
  validada AS (
    SELECT e.id, e.status_codigo
    FROM entrada e
    WHERE e.id IS NOT NULL AND e.status_codigo IS NOT NULL
  ),
  confirmados AS (
    UPDATE public.tarifas_normalizadas tn
    SET diagnostico       = 'CONFIRMADO',
        status            = v.status_codigo,
        confirmado_manual = true,
        confirmado_por    = v_uid,
        confirmado_at     = now(),
        updated_at        = now()
    FROM validada v
    WHERE tn.id = v.id
    RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
  ),
  propagadas AS (
    UPDATE public.pasadas p
    SET tarifa_normalizada_id = c.id,
        tarifa_status = c.status
    FROM confirmados c
    WHERE p.estacion_id = c.estacion_id
      AND p.categoria IS NOT DISTINCT FROM c.categoria
      AND p.precio = c.importe
      AND (p.tarifa_normalizada_id IS DISTINCT FROM c.id
           OR p.tarifa_status IS DISTINCT FROM c.status)
    RETURNING p.id
  )
  SELECT
    (SELECT count(*) FROM confirmados),
    (SELECT count(*) FROM propagadas)
  INTO v_niveles, v_pasadas;

  IF v_niveles <> jsonb_array_length(p_asignaciones) THEN
    RAISE EXCEPTION 'Se recibieron % asignaciones pero solo % niveles existen',
      jsonb_array_length(p_asignaciones), v_niveles;
  END IF;

  RETURN jsonb_build_object(
    'niveles_confirmados', v_niveles,
    'pasadas_actualizadas', v_pasadas
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) IS
  'F14-2 · Confirma la asignación de status a N niveles de una familia de tarifas y la propaga a pasadas.tarifa_status. Falla completa si algún id no existe.';

REVOKE ALL ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.peajes_marcar_diagnostico_tarifa(
  p_tarifa_normalizada_id uuid,
  p_diagnostico text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pasadas integer := 0;
  v_uid uuid := auth.uid();
  v_row public.tarifas_normalizadas%ROWTYPE;
BEGIN
  IF p_tarifa_normalizada_id IS NULL THEN
    RAISE EXCEPTION 'p_tarifa_normalizada_id es obligatorio';
  END IF;

  IF p_diagnostico IS NULL OR p_diagnostico NOT IN ('CATEGORIA', 'REVISAR') THEN
    RAISE EXCEPTION 'diagnóstico % no permitido en esta función (solo CATEGORIA | REVISAR)', p_diagnostico;
  END IF;

  UPDATE public.tarifas_normalizadas
  SET diagnostico       = p_diagnostico,
      status            = 'PENDIENTE',
      confirmado_manual = true,
      confirmado_por    = v_uid,
      confirmado_at     = now(),
      updated_at        = now()
  WHERE id = p_tarifa_normalizada_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nivel de tarifa % no encontrado', p_tarifa_normalizada_id;
  END IF;

  UPDATE public.pasadas p
  SET tarifa_status = 'PENDIENTE',
      tarifa_normalizada_id = v_row.id
  WHERE p.estacion_id = v_row.estacion_id
    AND p.categoria IS NOT DISTINCT FROM v_row.categoria
    AND p.precio = v_row.importe
    AND (p.tarifa_status IS DISTINCT FROM 'PENDIENTE'
         OR p.tarifa_normalizada_id IS DISTINCT FROM v_row.id);
  GET DIAGNOSTICS v_pasadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'tarifa_normalizada_id', v_row.id,
    'diagnostico', v_row.diagnostico,
    'pasadas_actualizadas', v_pasadas
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) IS
  'F14-2 · Marca un nivel de tarifa como CATEGORIA o REVISAR (acciones de un solo nivel del panel de comparación). Deja status en PENDIENTE y bloquea la sobreescritura automática.';

REVOKE ALL ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Limitación: ratio max/min solo describe familias de 2 niveles; UI deshabilita
-- bulk-apply cuando niveles > 2. Filtro c.niveles = o.niveles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_grupos_similares_tarifa(
  p_tarifa_normalizada_id uuid,
  p_tolerancia numeric DEFAULT 0.01
)
RETURNS TABLE (
  estacion_id uuid,
  estacion_nombre text,
  categoria text,
  ratio numeric,
  niveles integer,
  cases_total integer,
  importe_min numeric,
  importe_max numeric,
  pendientes integer,
  tarifa_ids uuid[]
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH ref AS (
    SELECT tn.peaje_id, tn.estacion_id, tn.categoria
    FROM public.tarifas_normalizadas tn
    WHERE tn.id = p_tarifa_normalizada_id
  ),
  objetivo AS (
    SELECT
      r.peaje_id,
      r.estacion_id,
      r.categoria,
      max(tn.importe) / NULLIF(min(tn.importe), 0) AS ratio,
      count(DISTINCT tn.importe)::integer          AS niveles
    FROM ref r
    JOIN public.tarifas_normalizadas tn
      ON tn.peaje_id = r.peaje_id
     AND tn.estacion_id = r.estacion_id
     AND tn.categoria IS NOT DISTINCT FROM r.categoria
    GROUP BY r.peaje_id, r.estacion_id, r.categoria
  ),
  candidatos AS (
    SELECT
      tn.estacion_id,
      tn.categoria,
      max(tn.importe) / NULLIF(min(tn.importe), 0) AS ratio,
      count(DISTINCT tn.importe)::integer          AS niveles,
      sum(tn.cases)::integer                       AS cases_total,
      min(tn.importe)                              AS importe_min,
      max(tn.importe)                              AS importe_max,
      count(*) FILTER (WHERE tn.status = 'PENDIENTE')::integer AS pendientes,
      array_agg(tn.id ORDER BY tn.importe ASC)     AS tarifa_ids
    FROM public.tarifas_normalizadas tn
    JOIN objetivo o ON o.peaje_id = tn.peaje_id
    WHERE tn.confirmado_manual = false
      AND tn.diagnostico = 'POSIBLE_HORARIO'
      AND NOT (tn.estacion_id = o.estacion_id
               AND tn.categoria IS NOT DISTINCT FROM o.categoria)
    GROUP BY tn.estacion_id, tn.categoria
    HAVING count(DISTINCT tn.importe) >= 2
  )
  SELECT
    c.estacion_id,
    est.nombre AS estacion_nombre,
    c.categoria,
    round(c.ratio, 4) AS ratio,
    c.niveles,
    c.cases_total,
    c.importe_min,
    c.importe_max,
    c.pendientes,
    c.tarifa_ids
  FROM candidatos c
  JOIN objetivo o ON true
  JOIN public.estaciones est ON est.id = c.estacion_id
  WHERE o.ratio IS NOT NULL
    AND abs(c.ratio - o.ratio) <= p_tolerancia * o.ratio
    AND c.niveles = o.niveles
  ORDER BY c.cases_total DESC;
$$;

COMMENT ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) IS
  'F14-2 · Familias de otras estaciones del mismo peaje con el mismo ratio max/min. Incluye tarifa_ids ordenados por importe para bulk-apply. Solo válido para familias de 2 niveles.';

REVOKE ALL ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) TO authenticated, service_role;
