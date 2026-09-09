-- F16-1: auditoría de reconocimiento de estaciones
-- Listado, casos por fingerprint, transición de estado, preview y corrección.

CREATE OR REPLACE FUNCTION public.peajes_normalizar_codigo_estacion(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN v ~ '^[0-9]+$' THEN (v::bigint)::text
    ELSE v
  END
  FROM (
    SELECT regexp_replace(
      translate(upper(btrim(coalesce(p_valor, ''))),
        'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ',
        'AEIOUUNAEIOUAEIOUAEIOU'
      ),
      '\s+', ' ', 'g'
    ) AS v
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.peajes_fingerprint_caso_estacion(
  p_empresa_id text,
  p_peaje_id uuid,
  p_tipo text,
  p_codigos text[],
  p_algoritmo_version text DEFAULT 'v1'
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat_ws(
    '|',
    coalesce(p_empresa_id, ''),
    coalesce(p_peaje_id::text, ''),
    coalesce(p_tipo, ''),
    coalesce(
      (
        SELECT string_agg(c, ',' ORDER BY c)
        FROM (
          SELECT DISTINCT public.peajes_normalizar_codigo_estacion(x) AS c
          FROM unnest(coalesce(p_codigos, ARRAY[]::text[])) AS x
          WHERE public.peajes_normalizar_codigo_estacion(x) <> ''
        ) d
      ),
      ''
    ),
    coalesce(nullif(btrim(p_algoritmo_version), ''), 'v1')
  );
$$;

CREATE TABLE IF NOT EXISTS public.auditoria_estaciones_casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  empresa_id text NOT NULL,
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE CASCADE,
  estacion_id uuid REFERENCES public.estaciones (id) ON DELETE SET NULL,
  tipo text NOT NULL,
  algoritmo_version text NOT NULL DEFAULT 'v1',
  estado text NOT NULL DEFAULT 'PENDIENTE',
  observacion text,
  preview jsonb,
  correccion jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  CONSTRAINT auditoria_estaciones_casos_tipo_chk CHECK (tipo IN (
    'CODIGO_REPETIDO_ENTRE_ESTACIONES',
    'SECUENCIA_NUMERICA_CON_SALTO',
    'SECUENCIA_NUMERICA_INVERTIDA',
    'ALIAS_DIFERENTE_CATALOGO'
  )),
  CONSTRAINT auditoria_estaciones_casos_estado_chk CHECK (estado IN (
    'PENDIENTE', 'VALIDADO', 'DESCARTADO', 'REQUIERE_CORRECCION', 'CORREGIDO'
  ))
);

CREATE INDEX IF NOT EXISTS idx_auditoria_estaciones_casos_peaje
  ON public.auditoria_estaciones_casos (peaje_id, estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_estaciones_casos_estacion
  ON public.auditoria_estaciones_casos (estacion_id);

COMMENT ON TABLE public.auditoria_estaciones_casos IS
  'Decisiones de auditoría de estaciones por fingerprint estable (F16).';

ALTER TABLE public.auditoria_estaciones_casos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_estaciones_casos_authenticated ON public.auditoria_estaciones_casos;
CREATE POLICY auditoria_estaciones_casos_authenticated
  ON public.auditoria_estaciones_casos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria_estaciones_casos TO authenticated;

CREATE OR REPLACE FUNCTION public.peajes_auditoria_estaciones_universo()
RETURNS TABLE (
  empresa_id text,
  peaje_id uuid,
  estacion_id uuid,
  empresa_nombre text,
  peaje_nombre text,
  estacion_nombre text,
  codigo_proveedor text,
  codigo_normalizado text,
  fuente text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    p.empresa_id,
    e.peaje_id,
    e.id,
    coalesce(emp.nombre, p.empresa_id),
    p.nombre,
    e.nombre,
    codigo,
    public.peajes_normalizar_codigo_estacion(codigo),
    'catalogo'::text
  FROM public.estaciones e
  JOIN public.peajes p ON p.id = e.peaje_id
  LEFT JOIN public.empresas emp ON emp.id::text = p.empresa_id
  CROSS JOIN LATERAL unnest(coalesce(e.codigos_proveedor, ARRAY[]::text[])) AS codigo
  WHERE public.peajes_normalizar_codigo_estacion(codigo) <> ''
  UNION ALL
  SELECT
    a.empresa_id,
    e.peaje_id,
    e.id,
    coalesce(emp.nombre, a.empresa_id),
    p.nombre,
    e.nombre,
    a.valor_proveedor,
    public.peajes_normalizar_codigo_estacion(a.valor_proveedor),
    'alias'::text
  FROM public.estaciones_alias_proveedor a
  JOIN public.estaciones e ON e.id = a.estacion_id
  JOIN public.peajes p ON p.id = e.peaje_id
  LEFT JOIN public.empresas emp ON emp.id::text = a.empresa_id
  WHERE public.peajes_normalizar_codigo_estacion(a.valor_proveedor) <> '';
$$;

CREATE OR REPLACE FUNCTION public.peajes_listar_auditoria_estaciones(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'estacion_nombre:asc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset integer;
  v_sort_raw text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'estacion_nombre:asc'));
  v_sort text := split_part(v_sort_raw, ':', 1);
  v_asc boolean := split_part(v_sort_raw, ':', 2) <> 'desc';
  v_rows jsonb;
  v_total bigint;
BEGIN
  v_offset := (v_page - 1) * v_page_size;
  IF v_sort NOT IN (
    'estacion_nombre', 'peaje_nombre', 'empresa_nombre', 'estado', 'movimientos_afectados', 'codigo_proveedor'
  ) THEN
    v_sort := 'estacion_nombre';
  END IF;

  DROP TABLE IF EXISTS tmp_ae_codes;
  CREATE TEMP TABLE tmp_ae_codes ON COMMIT DROP AS
  SELECT * FROM public.peajes_auditoria_estaciones_universo();

  DROP TABLE IF EXISTS tmp_ae_seq;
  CREATE TEMP TABLE tmp_ae_seq ON COMMIT DROP AS
  WITH nums AS (
    SELECT DISTINCT
      empresa_id,
      peaje_id,
      codigo_normalizado::bigint AS n
    FROM tmp_ae_codes
    WHERE codigo_normalizado ~ '^[0-9]+$'
  ),
  ranked AS (
    SELECT
      empresa_id,
      peaje_id,
      n,
      lead(n) OVER (PARTITION BY empresa_id, peaje_id ORDER BY n) AS next_n,
      count(*) OVER (PARTITION BY empresa_id, peaje_id) AS cnt
    FROM nums
  ),
  stats AS (
    SELECT
      empresa_id,
      peaje_id,
      min(n) AS minimo,
      max(n) AS maximo,
      max(cnt) AS cnt,
      count(*) FILTER (WHERE next_n IS NOT NULL AND next_n - n = 1) AS step1,
      count(*) FILTER (WHERE next_n IS NOT NULL) AS steps
    FROM ranked
    GROUP BY empresa_id, peaje_id
  )
  SELECT
    s.empresa_id,
    s.peaje_id,
    s.minimo,
    s.maximo,
    ARRAY(
      SELECT g
      FROM generate_series(s.minimo, s.maximo) g
      WHERE NOT EXISTS (
        SELECT 1 FROM nums n
        WHERE n.empresa_id = s.empresa_id AND n.peaje_id = s.peaje_id AND n.n = g
      )
    ) AS faltantes,
    (s.cnt >= 3 AND s.steps > 0 AND s.step1 * 2 > s.steps) AS perfil
  FROM stats s;

  DROP TABLE IF EXISTS tmp_ae_rows;
  CREATE TEMP TABLE tmp_ae_rows ON COMMIT DROP AS
  WITH agg AS (
    SELECT
      c.empresa_id,
      c.peaje_id,
      c.estacion_id,
      max(c.empresa_nombre) AS empresa_nombre,
      max(c.peaje_nombre) AS peaje_nombre,
      max(c.estacion_nombre) AS estacion_nombre,
      min(c.codigo_proveedor) AS codigo_proveedor,
      min(c.codigo_normalizado) AS codigo_normalizado,
      array_agg(DISTINCT c.fuente ORDER BY c.fuente) AS fuentes,
      array_agg(DISTINCT c.codigo_proveedor ORDER BY c.codigo_proveedor) AS codigos_estacion
    FROM tmp_ae_codes c
    GROUP BY c.empresa_id, c.peaje_id, c.estacion_id
  ),
  dup AS (
    SELECT empresa_id, peaje_id, codigo_normalizado, count(DISTINCT estacion_id) AS estaciones_mismo_codigo
    FROM tmp_ae_codes
    GROUP BY empresa_id, peaje_id, codigo_normalizado
  ),
  hall AS (
    SELECT
      a.*,
      (
        SELECT coalesce(max(d.estaciones_mismo_codigo), 1)
        FROM tmp_ae_codes t
        JOIN dup d ON d.empresa_id = t.empresa_id AND d.peaje_id = t.peaje_id AND d.codigo_normalizado = t.codigo_normalizado
        WHERE t.estacion_id = a.estacion_id
      ) AS estaciones_mismo_codigo,
      s.minimo,
      s.maximo,
      s.faltantes,
      s.perfil,
      (
        SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::text[])
        FROM (
          SELECT 'CODIGO_REPETIDO_ENTRE_ESTACIONES'::text AS x
          WHERE EXISTS (
            SELECT 1 FROM tmp_ae_codes t
            JOIN dup d ON d.empresa_id = t.empresa_id AND d.peaje_id = t.peaje_id AND d.codigo_normalizado = t.codigo_normalizado
            WHERE t.estacion_id = a.estacion_id AND d.estaciones_mismo_codigo > 1
          )
          UNION ALL
          SELECT 'SECUENCIA_NUMERICA_CON_SALTO'
          WHERE coalesce(s.perfil, false) AND coalesce(array_length(s.faltantes, 1), 0) > 0
          UNION ALL
          SELECT 'ALIAS_DIFERENTE_CATALOGO'
          WHERE EXISTS (
            SELECT 1
            FROM tmp_ae_codes t
            WHERE t.estacion_id = a.estacion_id
              AND t.fuente = 'alias'
              AND NOT EXISTS (
                SELECT 1 FROM tmp_ae_codes c2
                WHERE c2.estacion_id = t.estacion_id
                  AND c2.fuente = 'catalogo'
                  AND c2.codigo_normalizado = t.codigo_normalizado
              )
          )
        ) z
      ) AS hallazgos
    FROM agg a
    LEFT JOIN tmp_ae_seq s ON s.empresa_id = a.empresa_id AND s.peaje_id = a.peaje_id
  )
  SELECT
    h.*,
    (
      SELECT count(*)::int FROM public.pasadas pas WHERE pas.estacion_id = h.estacion_id
    ) AS movimientos_afectados,
    CASE
      WHEN 'SECUENCIA_NUMERICA_CON_SALTO' = ANY (h.hallazgos)
        OR 'SECUENCIA_NUMERICA_INVERTIDA' = ANY (h.hallazgos)
      THEN public.peajes_fingerprint_caso_estacion(
        h.empresa_id,
        h.peaje_id,
        CASE WHEN 'SECUENCIA_NUMERICA_INVERTIDA' = ANY (h.hallazgos)
          THEN 'SECUENCIA_NUMERICA_INVERTIDA' ELSE 'SECUENCIA_NUMERICA_CON_SALTO' END,
        (
          SELECT array_agg(DISTINCT t.codigo_normalizado)
          FROM tmp_ae_codes t
          WHERE t.empresa_id = h.empresa_id AND t.peaje_id = h.peaje_id
            AND t.codigo_normalizado ~ '^[0-9]+$'
        )
      )
      WHEN 'CODIGO_REPETIDO_ENTRE_ESTACIONES' = ANY (h.hallazgos)
      THEN public.peajes_fingerprint_caso_estacion(
        h.empresa_id, h.peaje_id, 'CODIGO_REPETIDO_ENTRE_ESTACIONES', h.codigos_estacion
      )
      WHEN 'ALIAS_DIFERENTE_CATALOGO' = ANY (h.hallazgos)
      THEN public.peajes_fingerprint_caso_estacion(
        h.empresa_id, h.peaje_id, 'ALIAS_DIFERENTE_CATALOGO', h.codigos_estacion
      )
      ELSE public.peajes_fingerprint_caso_estacion(
        h.empresa_id, h.peaje_id, 'SECUENCIA_NUMERICA_CON_SALTO', h.codigos_estacion
      )
    END AS fingerprint
  FROM hall h;

  ALTER TABLE tmp_ae_rows ADD COLUMN caso_id uuid;
  ALTER TABLE tmp_ae_rows ADD COLUMN estado text;
  ALTER TABLE tmp_ae_rows ADD COLUMN observacion text;

  UPDATE tmp_ae_rows r
  SET
    caso_id = c.id,
    estado = c.estado,
    observacion = c.observacion
  FROM public.auditoria_estaciones_casos c
  WHERE c.fingerprint = r.fingerprint;

  UPDATE tmp_ae_rows SET estado = 'PENDIENTE' WHERE estado IS NULL;

  DROP TABLE IF EXISTS tmp_ae_filtered;
  CREATE TEMP TABLE tmp_ae_filtered ON COMMIT DROP AS
  SELECT * FROM tmp_ae_rows r
  WHERE (
    NOT (p_filtros ? 'empresa_ids')
    OR jsonb_typeof(p_filtros->'empresa_ids') <> 'array'
    OR r.empresa_id IN (SELECT jsonb_array_elements_text(p_filtros->'empresa_ids'))
  )
  AND (
    NOT (p_filtros ? 'peaje_ids')
    OR jsonb_typeof(p_filtros->'peaje_ids') <> 'array'
    OR r.peaje_id::text IN (SELECT jsonb_array_elements_text(p_filtros->'peaje_ids'))
  )
  AND (
    NOT (p_filtros ? 'estacion_ids')
    OR jsonb_typeof(p_filtros->'estacion_ids') <> 'array'
    OR r.estacion_id::text IN (SELECT jsonb_array_elements_text(p_filtros->'estacion_ids'))
  )
  AND (
    NOT (p_filtros ? 'estados')
    OR jsonb_typeof(p_filtros->'estados') <> 'array'
    OR r.estado IN (SELECT jsonb_array_elements_text(p_filtros->'estados'))
  )
  AND (
    NOT (p_filtros ? 'hallazgos')
    OR jsonb_typeof(p_filtros->'hallazgos') <> 'array'
    OR r.hallazgos && (
      SELECT coalesce(array_agg(value), ARRAY[]::text[])
      FROM jsonb_array_elements_text(p_filtros->'hallazgos') AS t(value)
    )
  )
  AND (
    NULLIF(btrim(p_filtros->>'q'), '') IS NULL
    OR r.estacion_nombre ILIKE '%' || btrim(p_filtros->>'q') || '%'
    OR r.peaje_nombre ILIKE '%' || btrim(p_filtros->>'q') || '%'
    OR r.codigo_proveedor ILIKE '%' || btrim(p_filtros->>'q') || '%'
  );

  SELECT count(*) INTO v_total FROM tmp_ae_filtered;

  EXECUTE format(
    $q$
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY %s), '[]'::jsonb)
    FROM (
      SELECT
        empresa_id, peaje_id, estacion_id, empresa_nombre, peaje_nombre, estacion_nombre,
        codigo_proveedor, codigo_normalizado, fuentes, codigos_estacion,
        estaciones_mismo_codigo,
        CASE WHEN perfil THEN jsonb_build_object('minimo', minimo, 'maximo', maximo, 'faltantes', to_jsonb(faltantes)) ELSE NULL END AS secuencia_esperada,
        hallazgos, caso_id, estado, observacion, movimientos_afectados, fingerprint
      FROM tmp_ae_filtered
      ORDER BY %s
      OFFSET %s LIMIT %s
    ) x
    $q$,
    CASE v_sort
      WHEN 'peaje_nombre' THEN format('peaje_nombre %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'empresa_nombre' THEN format('empresa_nombre %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'estado' THEN format('estado %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'movimientos_afectados' THEN format('movimientos_afectados %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'codigo_proveedor' THEN format('codigo_proveedor %s', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      ELSE format('estacion_nombre %s', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
    END,
    CASE v_sort
      WHEN 'peaje_nombre' THEN format('peaje_nombre %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'empresa_nombre' THEN format('empresa_nombre %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'estado' THEN format('estado %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'movimientos_afectados' THEN format('movimientos_afectados %s, estacion_nombre asc', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      WHEN 'codigo_proveedor' THEN format('codigo_proveedor %s', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
      ELSE format('estacion_nombre %s', CASE WHEN v_asc THEN 'asc' ELSE 'desc' END)
    END,
    v_offset,
    v_page_size
  ) INTO v_rows;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_transicionar_caso_estacion(
  p_fingerprint text,
  p_estado text,
  p_observacion text DEFAULT NULL,
  p_empresa_id text DEFAULT NULL,
  p_peaje_id uuid DEFAULT NULL,
  p_estacion_id uuid DEFAULT NULL,
  p_tipo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caso public.auditoria_estaciones_casos;
  v_from text;
BEGIN
  IF p_estado NOT IN ('PENDIENTE', 'VALIDADO', 'DESCARTADO', 'REQUIERE_CORRECCION', 'CORREGIDO') THEN
    RAISE EXCEPTION 'estado de caso desconocido: %', p_estado;
  END IF;

  SELECT * INTO v_caso FROM public.auditoria_estaciones_casos WHERE fingerprint = p_fingerprint;
  v_from := coalesce(v_caso.estado, 'PENDIENTE');

  IF v_from = p_estado THEN
    NULL;
  ELSIF NOT (
    (v_from = 'PENDIENTE' AND p_estado IN ('VALIDADO', 'DESCARTADO', 'REQUIERE_CORRECCION'))
    OR (v_from = 'REQUIERE_CORRECCION' AND p_estado IN ('CORREGIDO', 'PENDIENTE', 'DESCARTADO'))
  ) THEN
    RAISE EXCEPTION 'transición no permitida: % → %', v_from, p_estado;
  END IF;

  IF v_caso.id IS NULL THEN
    INSERT INTO public.auditoria_estaciones_casos (
      fingerprint, empresa_id, peaje_id, estacion_id, tipo, estado, observacion
    ) VALUES (
      p_fingerprint,
      coalesce(p_empresa_id, ''),
      p_peaje_id,
      p_estacion_id,
      coalesce(p_tipo, 'SECUENCIA_NUMERICA_CON_SALTO'),
      p_estado,
      p_observacion
    )
    RETURNING * INTO v_caso;
  ELSE
    UPDATE public.auditoria_estaciones_casos
    SET estado = p_estado,
        observacion = p_observacion,
        updated_at = now(),
        resolved_at = CASE WHEN p_estado IN ('VALIDADO', 'DESCARTADO', 'CORREGIDO') THEN now() ELSE resolved_at END,
        resolved_by = CASE WHEN p_estado IN ('VALIDADO', 'DESCARTADO', 'CORREGIDO') THEN auth.uid() ELSE resolved_by END
    WHERE id = v_caso.id
    RETURNING * INTO v_caso;
  END IF;

  RETURN jsonb_build_object('caso_id', v_caso.id, 'estado', v_caso.estado);
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_previsualizar_correccion_estacion(
  p_caso_id uuid,
  p_estacion_destino_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caso public.auditoria_estaciones_casos;
  v_pasadas jsonb;
  v_hash text;
BEGIN
  SELECT * INTO v_caso FROM public.auditoria_estaciones_casos WHERE id = p_caso_id;
  IF v_caso.id IS NULL THEN
    RAISE EXCEPTION 'caso inexistente';
  END IF;
  IF v_caso.estado <> 'REQUIERE_CORRECCION' THEN
    RAISE EXCEPTION 'el caso debe estar en REQUIERE_CORRECCION';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pas.id,
    'fecha_hora', pas.fecha_hora,
    'estacion_id', pas.estacion_id
  ) ORDER BY pas.fecha_hora DESC), '[]'::jsonb)
  INTO v_pasadas
  FROM public.pasadas pas
  WHERE pas.estacion_id = v_caso.estacion_id;

  v_hash := md5(coalesce(v_pasadas::text, '') || p_estacion_destino_id::text);

  UPDATE public.auditoria_estaciones_casos
  SET preview = jsonb_build_object(
    'hash', v_hash,
    'estacion_destino_id', p_estacion_destino_id,
    'pasadas', v_pasadas
  ),
  updated_at = now()
  WHERE id = v_caso.id;

  RETURN jsonb_build_object(
    'caso_id', v_caso.id,
    'preview_hash', v_hash,
    'estacion_origen_id', v_caso.estacion_id,
    'estacion_destino_id', p_estacion_destino_id,
    'alias_ajustes', '[]'::jsonb,
    'catalogo_ajustes', '[]'::jsonb,
    'pasadas', v_pasadas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_corregir_caso_estacion(
  p_caso_id uuid,
  p_estacion_destino_id uuid,
  p_modalidad text,
  p_preview_hash text,
  p_observacion text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caso public.auditoria_estaciones_casos;
  v_ids uuid[];
  v_antes jsonb;
BEGIN
  IF p_preview_hash IS NULL OR btrim(p_preview_hash) = '' THEN
    RAISE EXCEPTION 'se requiere previsualización y confirmación';
  END IF;
  IF p_modalidad NOT IN ('SOLO_FUTUROS', 'FUTUROS_E_HISTORICOS') THEN
    RAISE EXCEPTION 'modalidad inválida';
  END IF;

  SELECT * INTO v_caso FROM public.auditoria_estaciones_casos WHERE id = p_caso_id FOR UPDATE;
  IF v_caso.id IS NULL THEN
    RAISE EXCEPTION 'caso inexistente';
  END IF;
  IF v_caso.estado <> 'REQUIERE_CORRECCION' THEN
    RAISE EXCEPTION 'el caso debe estar en REQUIERE_CORRECCION';
  END IF;
  IF v_caso.preview IS NULL OR v_caso.preview->>'hash' IS DISTINCT FROM p_preview_hash THEN
    RAISE EXCEPTION 'el preview cambió o no fue confirmado';
  END IF;
  IF (v_caso.preview->>'estacion_destino_id')::uuid IS DISTINCT FROM p_estacion_destino_id THEN
    RAISE EXCEPTION 'el preview cambió o no fue confirmado';
  END IF;

  SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[])
  INTO v_ids
  FROM jsonb_array_elements_text(coalesce(v_caso.preview->'pasadas', '[]'::jsonb)) AS t(x);

  -- preview stores objects; extract ids
  SELECT coalesce(array_agg((elem->>'id')::uuid), ARRAY[]::uuid[])
  INTO v_ids
  FROM jsonb_array_elements(coalesce(v_caso.preview->'pasadas', '[]'::jsonb)) elem;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', pas.id, 'estacion_id', pas.estacion_id)), '[]'::jsonb)
  INTO v_antes
  FROM public.pasadas pas
  WHERE pas.id = ANY (v_ids);

  IF p_modalidad = 'FUTUROS_E_HISTORICOS' THEN
    UPDATE public.pasadas
    SET estacion_id = p_estacion_destino_id
    WHERE id = ANY (v_ids);
  END IF;

  IF v_caso.estacion_id IS NOT NULL AND p_estacion_destino_id IS NOT NULL THEN
    UPDATE public.estaciones dest
    SET codigos_proveedor = (
      SELECT coalesce(array_agg(DISTINCT c), ARRAY[]::text[])
      FROM (
        SELECT unnest(coalesce(dest.codigos_proveedor, ARRAY[]::text[])) AS c
        UNION
        SELECT unnest(coalesce(orig.codigos_proveedor, ARRAY[]::text[]))
        FROM public.estaciones orig
        WHERE orig.id = v_caso.estacion_id
      ) s
    )
    WHERE dest.id = p_estacion_destino_id;
  END IF;

  UPDATE public.auditoria_estaciones_casos
  SET estado = 'CORREGIDO',
      observacion = coalesce(p_observacion, observacion),
      correccion = jsonb_build_object(
        'modalidad', p_modalidad,
        'antes', v_antes,
        'estacion_destino_id', p_estacion_destino_id,
        'pasada_ids', to_jsonb(v_ids)
      ),
      updated_at = now(),
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = v_caso.id;

  RETURN jsonb_build_object('caso_id', v_caso.id, 'estado', 'CORREGIDO');
END;
$$;

GRANT EXECUTE ON FUNCTION public.peajes_normalizar_codigo_estacion(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.peajes_fingerprint_caso_estacion(text, uuid, text, text[], text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.peajes_auditoria_estaciones_universo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peajes_listar_auditoria_estaciones(jsonb, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peajes_transicionar_caso_estacion(text, text, text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peajes_previsualizar_correccion_estacion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peajes_corregir_caso_estacion(uuid, uuid, text, text, text) TO authenticated;
