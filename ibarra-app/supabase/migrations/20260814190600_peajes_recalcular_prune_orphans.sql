-- Recalcular: borrar niveles del peaje que ya no tienen pasadas FC (p. ej. estación
-- movida). Sin esto, DOCK SUD / cat 7 / 23536.62 queda MUESTRA_INSUFICIENTE fantasma.

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

  -- Foto completa: quitar niveles sin pasadas FC (MUESTRA_INSUFICIENTE fantasma
  -- tras mover estación). FK pasadas.tarifa_normalizada_id ON DELETE SET NULL.
  DELETE FROM public.tarifas_normalizadas tn
  WHERE tn.peaje_id = p_peaje_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.pasadas p
      JOIN public.documentos d ON d.id = p.documento_id
      WHERE p.estacion_id = tn.estacion_id
        AND p.categoria IS NOT DISTINCT FROM tn.categoria
        AND p.precio = tn.importe
        AND d.tipo = 'FC'
        AND p.precio > 0
    );

  RETURN v_actualizados;
END;
$$;

COMMENT ON FUNCTION public.peajes_recalcular_tarifas(uuid) IS
  'F14-2 · Recálculo completo de un peaje: estadísticas, diagnóstico, match a pasadas, y DELETE de niveles sin pasadas FC. No pisa confirmado_manual. Devuelve pasadas actualizadas.';

REVOKE ALL ON FUNCTION public.peajes_recalcular_tarifas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_recalcular_tarifas(uuid) TO authenticated, service_role;
