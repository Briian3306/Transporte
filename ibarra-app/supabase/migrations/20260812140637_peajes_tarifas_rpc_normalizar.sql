-- F14-2: peajes_normalizar_tarifas + peajes_recalcular_tarifas

CREATE OR REPLACE FUNCTION public.peajes_normalizar_tarifas(
  p_documento_id uuid
)
RETURNS TABLE (pasadas_matcheadas integer, grupos_nuevos integer)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_matcheadas integer := 0;
  v_extra integer := 0;
  v_nuevos integer := 0;
  v_tipo text;
BEGIN
  IF p_documento_id IS NULL THEN
    RAISE EXCEPTION 'p_documento_id es obligatorio';
  END IF;

  SELECT d.tipo INTO v_tipo FROM public.documentos d WHERE d.id = p_documento_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Documento % no encontrado', p_documento_id;
  END IF;

  -- Las NC guardan importes con signo negativo: no son niveles de tarifa.
  IF v_tipo <> 'FC' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- PASO 1 — camino rápido: terna (estación, categoría, importe) ya conocida.
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  FROM public.tarifas_normalizadas tn
  WHERE p.documento_id = p_documento_id
    AND p.tarifa_normalizada_id IS NULL
    AND tn.estacion_id = p.estacion_id
    AND tn.categoria IS NOT DISTINCT FROM p.categoria
    AND tn.importe = p.precio;
  GET DIAGNOSTICS v_matcheadas = ROW_COUNT;

  -- PASO 2 — alta acotada a pasadas sin match de ESTE documento.
  WITH nuevos_grupos AS (
    SELECT
      e.peaje_id                                   AS peaje_id,
      p.estacion_id                                AS estacion_id,
      p.categoria                                  AS categoria,
      p.precio                                     AS importe,
      count(*)::integer                            AS cases,
      stddev_pop(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS desvio,
      min(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_min,
      max(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_max,
      avg(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_media,
      CASE WHEN p.categoria IS NULL THEN 'A' ELSE 'B' END AS patron
    FROM public.pasadas p
    JOIN public.estaciones e ON e.id = p.estacion_id
    WHERE p.documento_id = p_documento_id
      AND p.tarifa_normalizada_id IS NULL
      AND p.precio > 0
    GROUP BY e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  insertados AS (
    INSERT INTO public.tarifas_normalizadas AS tn (
      peaje_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    SELECT
      ng.peaje_id, ng.estacion_id, ng.categoria, ng.importe,
      ng.importe,
      ng.cases, 1.0000,
      round(ng.desvio, 4), round(ng.hora_min, 2), round(ng.hora_max, 2), round(ng.hora_media, 2),
      ng.patron,
      CASE
        WHEN ng.cases < COALESCE(
               (SELECT tp.umbral_muestra_minima
                  FROM public.tarifas_parametros_peaje tp
                 WHERE tp.peaje_id = ng.peaje_id), 15)
        THEN 'MUESTRA_INSUFICIENTE'
        ELSE 'REVISAR'
      END,
      'PENDIENTE',
      ng.cases >= COALESCE(
        (SELECT tp.umbral_muestra_minima
           FROM public.tarifas_parametros_peaje tp
          WHERE tp.peaje_id = ng.peaje_id), 15)
    FROM nuevos_grupos ng
    ON CONFLICT (peaje_id, estacion_id, categoria, importe) DO UPDATE
      SET cases = tn.cases + EXCLUDED.cases,
          muestra_confiable = (tn.cases + EXCLUDED.cases) >= COALESCE(
            (SELECT tp.umbral_muestra_minima
               FROM public.tarifas_parametros_peaje tp
              WHERE tp.peaje_id = tn.peaje_id), 15),
          updated_at = now()
      WHERE tn.confirmado_manual = false
    RETURNING tn.id
  )
  SELECT count(*)::integer INTO v_nuevos FROM insertados;

  -- PASO 3 — re-match tras alta.
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  FROM public.tarifas_normalizadas tn
  WHERE p.documento_id = p_documento_id
    AND p.tarifa_normalizada_id IS NULL
    AND tn.estacion_id = p.estacion_id
    AND tn.categoria IS NOT DISTINCT FROM p.categoria
    AND tn.importe = p.precio;
  GET DIAGNOSTICS v_extra = ROW_COUNT;

  RETURN QUERY SELECT (v_matcheadas + v_extra), v_nuevos;
END;
$$;

COMMENT ON FUNCTION public.peajes_normalizar_tarifas(uuid) IS
  'F14-2 · Clasifica las pasadas de un documento recién confirmado. Camino rápido por terna conocida + alta acotada de niveles nuevos. Devuelve (pasadas_matcheadas, grupos_nuevos).';

REVOKE ALL ON FUNCTION public.peajes_normalizar_tarifas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_normalizar_tarifas(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- peajes_recalcular_tarifas — recálculo completo por peaje
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_recalcular_tarifas(
  p_peaje_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_umbral_muestra integer;
  v_umbral_dispersion numeric;
  v_actualizados integer := 0;
BEGIN
  IF p_peaje_id IS NULL THEN
    RAISE EXCEPTION 'p_peaje_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.peajes WHERE id = p_peaje_id) THEN
    RAISE EXCEPTION 'Peaje % no existe', p_peaje_id;
  END IF;

  SELECT tp.umbral_muestra_minima, tp.umbral_dispersion
    INTO v_umbral_muestra, v_umbral_dispersion
  FROM public.tarifas_parametros_peaje tp
  WHERE tp.peaje_id = p_peaje_id;

  v_umbral_muestra    := COALESCE(v_umbral_muestra, 15);
  v_umbral_dispersion := COALESCE(v_umbral_dispersion, 4.100);

  WITH agregado AS (
    SELECT
      e.peaje_id      AS peaje_id,
      p.estacion_id   AS estacion_id,
      p.categoria     AS categoria,
      p.precio        AS importe,
      count(*)::integer AS cases,
      stddev_pop(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS desvio,
      min(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_min,
      max(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_max,
      avg(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_media
    FROM public.pasadas p
    JOIN public.estaciones e ON e.id = p.estacion_id
    JOIN public.documentos d ON d.id = p.documento_id
    WHERE e.peaje_id = p_peaje_id
      AND d.tipo = 'FC'
      AND p.precio > 0
    GROUP BY e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  -- count(DISTINCT …) OVER (…) no está implementado en Postgres: se agrega por familia.
  familia_stats AS (
    SELECT
      a.peaje_id,
      a.estacion_id,
      a.categoria,
      min(a.importe) AS importe_base,
      count(*)::integer AS niveles_familia
    FROM agregado a
    GROUP BY a.peaje_id, a.estacion_id, a.categoria
  ),
  con_familia AS (
    SELECT
      a.*,
      f.importe_base,
      f.niveles_familia
    FROM agregado a
    JOIN familia_stats f
      ON f.peaje_id = a.peaje_id
     AND f.estacion_id = a.estacion_id
     AND f.categoria IS NOT DISTINCT FROM a.categoria
  ),
  clasificado AS (
    SELECT
      cf.*,
      round(cf.importe / NULLIF(cf.importe_base, 0), 4) AS multiplicador,
      CASE WHEN cf.categoria IS NULL THEN 'A' ELSE 'B' END AS patron,
      CASE
        WHEN cf.cases < v_umbral_muestra THEN 'MUESTRA_INSUFICIENTE'
        WHEN cf.niveles_familia = 1 THEN 'TARIFA_UNICA'
        WHEN cf.categoria IS NULL
             AND (cf.desvio IS NULL OR cf.desvio >= v_umbral_dispersion) THEN 'CATEGORIA'
        WHEN cf.desvio IS NOT NULL AND cf.desvio < v_umbral_dispersion THEN 'POSIBLE_HORARIO'
        ELSE 'REVISAR'
      END AS diagnostico_calculado
    FROM con_familia cf
  ),
  upsert AS (
    INSERT INTO public.tarifas_normalizadas AS tn (
      peaje_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    SELECT
      c.peaje_id, c.estacion_id, c.categoria, c.importe, c.importe_base,
      c.cases, c.multiplicador,
      round(c.desvio, 4), round(c.hora_min, 2), round(c.hora_max, 2), round(c.hora_media, 2),
      c.patron, c.diagnostico_calculado,
      CASE WHEN c.diagnostico_calculado = 'POSIBLE_HORARIO'
           THEN 'POSIBLE_HORARIO' ELSE 'PENDIENTE' END,
      c.cases >= v_umbral_muestra
    FROM clasificado c
    ON CONFLICT (peaje_id, estacion_id, categoria, importe) DO UPDATE
      SET cases             = EXCLUDED.cases,
          importe_base      = EXCLUDED.importe_base,
          multiplicador     = EXCLUDED.multiplicador,
          desvio            = EXCLUDED.desvio,
          hora_min          = EXCLUDED.hora_min,
          hora_max          = EXCLUDED.hora_max,
          hora_media        = EXCLUDED.hora_media,
          muestra_confiable = EXCLUDED.muestra_confiable,
          patron            = EXCLUDED.patron,
          diagnostico = CASE WHEN tn.confirmado_manual THEN tn.diagnostico ELSE EXCLUDED.diagnostico END,
          status      = CASE WHEN tn.confirmado_manual THEN tn.status      ELSE EXCLUDED.status      END,
          updated_at  = now()
    RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
  )
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = u.id,
      tarifa_status = u.status
  FROM upsert u
  WHERE p.estacion_id = u.estacion_id
    AND p.categoria IS NOT DISTINCT FROM u.categoria
    AND p.precio = u.importe
    AND (p.tarifa_normalizada_id IS DISTINCT FROM u.id
         OR p.tarifa_status IS DISTINCT FROM u.status);
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;

  RETURN v_actualizados;
END;
$$;

COMMENT ON FUNCTION public.peajes_recalcular_tarifas(uuid) IS
  'F14-2 · Recálculo completo de niveles de tarifa de un peaje: estadísticas, importe_base, multiplicador, diagnóstico y propagación a pasadas.tarifa_status. Disparo manual desde la UI (no hay pg_cron). Devuelve pasadas actualizadas.';

REVOKE ALL ON FUNCTION public.peajes_recalcular_tarifas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_recalcular_tarifas(uuid) TO authenticated, service_role;
