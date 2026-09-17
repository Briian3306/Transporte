-- Transferencias entre depósitos y baja lógica de insumos (is_active).

-- ---------------------------------------------------------------------------
-- stock_depositos.is_active (ya existe en DESARROLLO; no-op remoto)
-- ---------------------------------------------------------------------------

ALTER TABLE public.stock_depositos
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Movimientos: tipo transferencia + vínculo entre patas
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.movimientos_stock'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.movimientos_stock DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_tipo_check
  CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'transferencia'));

ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS transferencia_id uuid;

ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS deposito_contraparte_id uuid
    REFERENCES public.depositos(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS transferencia_sentido varchar(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.movimientos_stock'::regclass
      AND conname = 'movimientos_stock_transferencia_sentido_check'
  ) THEN
    ALTER TABLE public.movimientos_stock
      ADD CONSTRAINT movimientos_stock_transferencia_sentido_check
      CHECK (
        transferencia_sentido IS NULL
        OR transferencia_sentido IN ('origen', 'destino')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.movimientos_stock'::regclass
      AND conname = 'movimientos_stock_transferencia_completa_check'
  ) THEN
    ALTER TABLE public.movimientos_stock
      ADD CONSTRAINT movimientos_stock_transferencia_completa_check
      CHECK (
        tipo <> 'transferencia'
        OR (
          transferencia_id IS NOT NULL
          AND deposito_contraparte_id IS NOT NULL
          AND transferencia_sentido IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_stock_transferencia
  ON public.movimientos_stock (transferencia_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_stock_contraparte
  ON public.movimientos_stock (deposito_contraparte_id);

-- ---------------------------------------------------------------------------
-- Reactivar ítem inactivo cuando vuelve a ingresar cantidad
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_reactivar_si_ingresa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cantidad_actual > OLD.cantidad_actual THEN
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_reactivar_si_ingresa ON public.stock_depositos;
CREATE TRIGGER trg_stock_reactivar_si_ingresa
  BEFORE UPDATE OF cantidad_actual ON public.stock_depositos
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_reactivar_si_ingresa();

-- ---------------------------------------------------------------------------
-- RPC transferencia atómica
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_transferir(
  p_deposito_origen_id uuid,
  p_deposito_destino_id uuid,
  p_items jsonb,
  p_motivo text,
  p_observaciones text DEFAULT NULL,
  p_usuario_id text DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_transferencia_id uuid := gen_random_uuid();
  v_item record;
  v_origen public.stock_depositos%ROWTYPE;
  v_destino public.stock_depositos%ROWTYPE;
  v_origen_activo boolean;
  v_destino_activo boolean;
  v_motivo text;
BEGIN
  IF p_deposito_origen_id IS NULL OR p_deposito_destino_id IS NULL THEN
    RAISE EXCEPTION 'Origen y destino son obligatorios';
  END IF;

  IF p_deposito_origen_id = p_deposito_destino_id THEN
    RAISE EXCEPTION 'El depósito origen y destino deben ser distintos';
  END IF;

  SELECT activo INTO v_origen_activo
  FROM public.depositos
  WHERE id = p_deposito_origen_id;

  IF v_origen_activo IS NULL THEN
    RAISE EXCEPTION 'El depósito origen no existe';
  END IF;
  IF v_origen_activo IS NOT TRUE THEN
    RAISE EXCEPTION 'El depósito origen no está activo';
  END IF;

  SELECT activo INTO v_destino_activo
  FROM public.depositos
  WHERE id = p_deposito_destino_id;

  IF v_destino_activo IS NULL THEN
    RAISE EXCEPTION 'El depósito destino no existe';
  END IF;
  IF v_destino_activo IS NOT TRUE THEN
    RAISE EXCEPTION 'El depósito destino no está activo';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un insumo';
  END IF;

  v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'El motivo es obligatorio';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) e
    GROUP BY (e->>'insumo_id')::integer
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay insumos duplicados en la transferencia';
  END IF;

  FOR v_item IN
    SELECT
      (e->>'insumo_id')::integer AS insumo_id,
      (e->>'cantidad')::numeric AS cantidad
    FROM jsonb_array_elements(p_items) e
    ORDER BY 1
  LOOP
    IF v_item.insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada item debe tener insumo_id';
    END IF;
    IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    SELECT * INTO v_origen
    FROM public.stock_depositos
    WHERE deposito_id = p_deposito_origen_id
      AND insumo_id = v_item.insumo_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock no encontrado en el depósito origen para insumo %', v_item.insumo_id;
    END IF;

    IF COALESCE(v_origen.is_active, true) IS NOT TRUE THEN
      RAISE EXCEPTION 'El insumo no está activo en el depósito origen';
    END IF;

    IF v_origen.cantidad_actual < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para insumo %. Disponible: %',
        v_item.insumo_id, v_origen.cantidad_actual;
    END IF;

    UPDATE public.stock_depositos
    SET cantidad_actual = cantidad_actual - v_item.cantidad
    WHERE id = v_origen.id;

    SELECT * INTO v_destino
    FROM public.stock_depositos
    WHERE deposito_id = p_deposito_destino_id
      AND insumo_id = v_item.insumo_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.stock_depositos
      SET cantidad_actual = cantidad_actual + v_item.cantidad
      WHERE id = v_destino.id;

      SELECT * INTO v_destino
      FROM public.stock_depositos
      WHERE id = v_destino.id;
    ELSE
      INSERT INTO public.stock_depositos (
        deposito_id,
        insumo_id,
        cantidad_actual,
        cantidad_minima,
        cantidad_maxima,
        punto_reorden,
        is_active
      ) VALUES (
        p_deposito_destino_id,
        v_item.insumo_id,
        v_item.cantidad,
        v_origen.cantidad_minima,
        v_origen.cantidad_maxima,
        v_origen.punto_reorden,
        true
      )
      RETURNING * INTO v_destino;
    END IF;

    INSERT INTO public.movimientos_stock (
      tipo,
      deposito_id,
      insumo_id,
      cantidad,
      motivo,
      observaciones,
      usuario_id,
      usuario_nombre,
      transferencia_id,
      deposito_contraparte_id,
      ubicacion_id,
      transferencia_sentido
    ) VALUES
    (
      'transferencia',
      p_deposito_origen_id,
      v_item.insumo_id,
      v_item.cantidad,
      v_motivo,
      p_observaciones,
      p_usuario_id,
      p_usuario_nombre,
      v_transferencia_id,
      p_deposito_destino_id,
      v_origen.ubicacion_id,
      'origen'
    ),
    (
      'transferencia',
      p_deposito_destino_id,
      v_item.insumo_id,
      v_item.cantidad,
      v_motivo,
      p_observaciones,
      p_usuario_id,
      p_usuario_nombre,
      v_transferencia_id,
      p_deposito_origen_id,
      v_destino.ubicacion_id,
      'destino'
    );
  END LOOP;

  RETURN v_transferencia_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC baja lógica (solo cantidad 0)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_desactivar_insumo_deposito(
  p_stock_deposito_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock public.stock_depositos%ROWTYPE;
BEGIN
  IF p_stock_deposito_id IS NULL THEN
    RAISE EXCEPTION 'El ítem de stock es obligatorio';
  END IF;

  SELECT * INTO v_stock
  FROM public.stock_depositos
  WHERE id = p_stock_deposito_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El ítem de stock no existe';
  END IF;

  IF COALESCE(v_stock.is_active, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'El insumo ya está inactivo en este depósito';
  END IF;

  IF v_stock.cantidad_actual <> 0 THEN
    RAISE EXCEPTION 'Solo se puede quitar un insumo con cantidad 0. Hacé una salida o transferencia primero.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auditorias_stock_items i
    JOIN public.auditorias_stock a ON a.id = i.auditoria_id
    WHERE i.stock_deposito_id = p_stock_deposito_id
      AND a.estado = 'en_curso'
  ) THEN
    RAISE EXCEPTION 'No se puede quitar un insumo incluido en una auditoría en curso';
  END IF;

  UPDATE public.stock_depositos
  SET
    is_active = false,
    ubicacion_id = NULL
  WHERE id = p_stock_deposito_id;

  RETURN p_stock_deposito_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_transferir(uuid, uuid, jsonb, text, text, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_desactivar_insumo_deposito(uuid)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_iniciar_auditoria(uuid, text, uuid[], jsonb, text, text)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auditoría total: no snapshotear ítems dados de baja
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_iniciar_auditoria(
  p_deposito_id uuid,
  p_tipo text,
  p_stock_deposito_ids uuid[] DEFAULT NULL,
  p_criterio jsonb DEFAULT NULL,
  p_usuario_id text DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria_id uuid;
  v_config public.depositos_auditoria_config%ROWTYPE;
  v_ids uuid[];
BEGIN
  IF p_tipo NOT IN ('total', 'parcial') THEN
    RAISE EXCEPTION 'Tipo de auditoría inválido: %', p_tipo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.auditorias_stock
    WHERE deposito_id = p_deposito_id AND estado = 'en_curso'
  ) THEN
    RAISE EXCEPTION 'Ya hay una auditoría en curso para este depósito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.depositos WHERE id = p_deposito_id) THEN
    RAISE EXCEPTION 'El depósito no existe';
  END IF;

  SELECT * INTO v_config
  FROM public.depositos_auditoria_config
  WHERE deposito_id = p_deposito_id;

  IF p_tipo = 'total' THEN
    SELECT COALESCE(array_agg(sd.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.stock_depositos sd
    WHERE sd.deposito_id = p_deposito_id
      AND COALESCE(sd.is_active, true)
      AND (
        COALESCE(v_config.incluir_sin_stock, true)
        OR sd.cantidad_actual > 0
      );
  ELSE
    IF p_stock_deposito_ids IS NULL OR cardinality(p_stock_deposito_ids) = 0 THEN
      RAISE EXCEPTION 'Una auditoría parcial requiere al menos un item';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(p_stock_deposito_ids) AS sid(id)
      LEFT JOIN public.stock_depositos sd ON sd.id = sid.id
      WHERE sd.id IS NULL OR sd.deposito_id <> p_deposito_id
    ) THEN
      RAISE EXCEPTION 'Hay items que no pertenecen al depósito seleccionado';
    END IF;

    v_ids := p_stock_deposito_ids;
  END IF;

  INSERT INTO public.auditorias_stock (
    deposito_id,
    tipo,
    estado,
    fecha_programada,
    usuario_inicio_id,
    usuario_inicio_nombre,
    criterio_seleccion,
    periodicidad_snapshot
  )
  VALUES (
    p_deposito_id,
    p_tipo,
    'en_curso',
    v_config.proxima_fecha,
    p_usuario_id,
    p_usuario_nombre,
    CASE WHEN p_tipo = 'parcial' THEN p_criterio ELSE NULL END,
    v_config.periodicidad
  )
  RETURNING id INTO v_auditoria_id;

  IF v_ids IS NOT NULL AND cardinality(v_ids) > 0 THEN
    PERFORM public.stock_insertar_items_auditoria(v_auditoria_id, p_deposito_id, v_ids);
  ELSE
    PERFORM public.stock_refresh_auditoria_contadores(v_auditoria_id);
  END IF;

  RETURN v_auditoria_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Vistas del dashboard: excluir inactivos y contar transferencias
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_stock_dashboard_estadisticas
WITH (security_invoker = true) AS
WITH stock_agg AS (
  SELECT
    COUNT(DISTINCT insumo_id)::int AS total_insumos,
    COUNT(*) FILTER (WHERE cantidad_actual <= 0)::int AS items_criticos,
    COUNT(*) FILTER (
      WHERE cantidad_minima > 0
        AND cantidad_actual > 0
        AND cantidad_actual < cantidad_minima
    )::int AS items_bajo_minimo,
    COUNT(*) FILTER (
      WHERE cantidad_maxima > 0
        AND cantidad_actual > cantidad_maxima
    )::int AS items_sobre_maximo
  FROM public.stock_depositos
  WHERE COALESCE(is_active, true)
),
depositos_agg AS (
  SELECT COUNT(*)::int AS total_depositos
  FROM public.depositos
  WHERE activo IS TRUE
),
movimientos_agg AS (
  SELECT
    COUNT(*)::int AS movimientos_mes,
    COUNT(*) FILTER (WHERE tipo = 'entrada')::int AS entradas_mes,
    COUNT(*) FILTER (WHERE tipo = 'salida')::int AS salidas_mes,
    COUNT(*) FILTER (WHERE tipo = 'ajuste')::int AS ajustes_mes,
    COUNT(*) FILTER (WHERE tipo = 'transferencia')::int AS transferencias_mes
  FROM public.movimientos_stock
  WHERE fecha >= date_trunc('month', now())
),
ultimo_costo AS (
  SELECT DISTINCT ON (insumo_id)
    insumo_id,
    costo_unitario
  FROM public.movimientos_stock
  WHERE tipo = 'entrada'
    AND costo_unitario IS NOT NULL
    AND costo_unitario > 0
  ORDER BY insumo_id, fecha DESC
),
valor AS (
  SELECT COALESCE(SUM(s.cantidad_actual * COALESCE(c.costo_unitario, 0)), 0)::numeric(14, 2) AS valor_total
  FROM public.stock_depositos s
  LEFT JOIN ultimo_costo c ON c.insumo_id = s.insumo_id
  WHERE COALESCE(s.is_active, true)
)
SELECT
  stock_agg.total_insumos,
  depositos_agg.total_depositos,
  valor.valor_total,
  stock_agg.items_criticos,
  stock_agg.items_bajo_minimo,
  stock_agg.items_sobre_maximo,
  movimientos_agg.movimientos_mes,
  movimientos_agg.entradas_mes,
  movimientos_agg.salidas_mes,
  movimientos_agg.ajustes_mes,
  movimientos_agg.transferencias_mes
FROM stock_agg
CROSS JOIN depositos_agg
CROSS JOIN movimientos_agg
CROSS JOIN valor;

COMMENT ON VIEW public.v_stock_dashboard_estadisticas IS
  'Métricas del dashboard de stock (agregados + valor por último costo de entrada). security_invoker=true.';

CREATE OR REPLACE VIEW public.v_stock_alertas_por_deposito
WITH (security_invoker = true) AS
SELECT
  deposito_id,
  COUNT(*) FILTER (WHERE cantidad_actual <= 0)::int AS criticos,
  COUNT(*) FILTER (
    WHERE cantidad_minima > 0
      AND cantidad_actual > 0
      AND cantidad_actual < cantidad_minima
  )::int AS bajo_minimo,
  COUNT(*) FILTER (
    WHERE cantidad_maxima > 0
      AND cantidad_actual > cantidad_maxima
  )::int AS sobre_maximo,
  COUNT(*) FILTER (
    WHERE cantidad_actual <= 0
      OR (cantidad_minima > 0 AND cantidad_actual > 0 AND cantidad_actual < cantidad_minima)
      OR (cantidad_maxima > 0 AND cantidad_actual > cantidad_maxima)
  )::int AS total_alertas
FROM public.stock_depositos
WHERE COALESCE(is_active, true)
GROUP BY deposito_id;

COMMENT ON VIEW public.v_stock_alertas_por_deposito IS
  'Conteo de ítems críticos / bajo mínimo / sobre máximo por depósito. security_invoker=true.';

GRANT SELECT ON public.v_stock_dashboard_estadisticas TO anon, authenticated, service_role;
GRANT SELECT ON public.v_stock_alertas_por_deposito TO anon, authenticated, service_role;
