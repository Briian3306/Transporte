-- Ubicaciones jerárquicas por depósito y auditorías de inventario (total / parcial).

-- ---------------------------------------------------------------------------
-- Ubicaciones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deposito_ubicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.deposito_ubicaciones(id) ON DELETE CASCADE,
  tipo varchar(20) NOT NULL CHECK (tipo IN ('zona', 'pasillo', 'estante', 'posicion')),
  codigo varchar(30) NOT NULL,
  nombre varchar(255) NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  reglas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.deposito_ubicaciones.reglas IS
  'Contrato futuro (sin lógica en esta versión): capacidad_maxima, categorias_permitidas, categorias_excluidas, exclusividad, incompatibilidades.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_deposito_ubicaciones_codigo
  ON public.deposito_ubicaciones (
    deposito_id,
    (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    codigo
  );

CREATE INDEX IF NOT EXISTS idx_deposito_ubicaciones_deposito
  ON public.deposito_ubicaciones (deposito_id);

CREATE INDEX IF NOT EXISTS idx_deposito_ubicaciones_parent
  ON public.deposito_ubicaciones (parent_id);

CREATE OR REPLACE FUNCTION public.stock_validar_ubicacion_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_tipo text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.tipo <> 'zona' THEN
      RAISE EXCEPTION 'Solo una zona puede ser ubicación raíz';
    END IF;
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_parent_tipo
  FROM public.deposito_ubicaciones
  WHERE id = NEW.parent_id;

  IF v_parent_tipo IS NULL THEN
    RAISE EXCEPTION 'La ubicación padre no existe';
  END IF;

  IF (SELECT deposito_id FROM public.deposito_ubicaciones WHERE id = NEW.parent_id) <> NEW.deposito_id THEN
    RAISE EXCEPTION 'El padre de la ubicación debe pertenecer al mismo depósito';
  END IF;

  IF NEW.tipo = 'pasillo' AND v_parent_tipo <> 'zona' THEN
    RAISE EXCEPTION 'Un pasillo debe colgar de una zona';
  ELSIF NEW.tipo = 'estante' AND v_parent_tipo <> 'pasillo' THEN
    RAISE EXCEPTION 'Un estante debe colgar de un pasillo';
  ELSIF NEW.tipo = 'posicion' AND v_parent_tipo <> 'estante' THEN
    RAISE EXCEPTION 'Una posición debe colgar de un estante';
  ELSIF NEW.tipo = 'zona' THEN
    RAISE EXCEPTION 'Una zona no puede tener padre';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_validar_ubicacion_parent ON public.deposito_ubicaciones;
CREATE TRIGGER trg_stock_validar_ubicacion_parent
  BEFORE INSERT OR UPDATE OF parent_id, tipo, deposito_id
  ON public.deposito_ubicaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_validar_ubicacion_parent();

DROP TRIGGER IF EXISTS update_deposito_ubicaciones_updated_at ON public.deposito_ubicaciones;
CREATE TRIGGER update_deposito_ubicaciones_updated_at
  BEFORE UPDATE ON public.deposito_ubicaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_depositos
  ADD COLUMN IF NOT EXISTS ubicacion_id uuid REFERENCES public.deposito_ubicaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_depositos_ubicacion
  ON public.stock_depositos (ubicacion_id);

CREATE OR REPLACE FUNCTION public.stock_validar_stock_ubicacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ubicacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.deposito_ubicaciones u
    WHERE u.id = NEW.ubicacion_id
      AND u.deposito_id = NEW.deposito_id
  ) THEN
    RAISE EXCEPTION 'La ubicación no pertenece al depósito del stock';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_validar_stock_ubicacion ON public.stock_depositos;
CREATE TRIGGER trg_stock_validar_stock_ubicacion
  BEFORE INSERT OR UPDATE OF ubicacion_id, deposito_id
  ON public.stock_depositos
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_validar_stock_ubicacion();

-- ---------------------------------------------------------------------------
-- Configuración de auditorías
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.depositos_auditoria_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id uuid NOT NULL UNIQUE REFERENCES public.depositos(id) ON DELETE CASCADE,
  periodicidad varchar(20) NOT NULL DEFAULT 'mensual'
    CHECK (periodicidad IN (
      'semanal', 'quincenal', 'mensual', 'bimestral',
      'trimestral', 'semestral', 'anual', 'personalizada'
    )),
  intervalo_dias integer NOT NULL DEFAULT 30 CHECK (intervalo_dias > 0),
  dias_aviso_previo integer NOT NULL DEFAULT 3 CHECK (dias_aviso_previo >= 0),
  tolerancia_desvio_pct numeric(6,2) NOT NULL DEFAULT 0 CHECK (tolerancia_desvio_pct >= 0),
  incluir_sin_stock boolean NOT NULL DEFAULT true,
  responsable varchar(255),
  activo boolean NOT NULL DEFAULT true,
  proxima_fecha date,
  ultima_auditoria_total_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depositos_auditoria_config_proxima
  ON public.depositos_auditoria_config (proxima_fecha)
  WHERE activo = true;

DROP TRIGGER IF EXISTS update_depositos_auditoria_config_updated_at ON public.depositos_auditoria_config;
CREATE TRIGGER update_depositos_auditoria_config_updated_at
  BEFORE UPDATE ON public.depositos_auditoria_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Auditorías
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auditorias_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  tipo varchar(20) NOT NULL CHECK (tipo IN ('total', 'parcial')),
  estado varchar(20) NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'cerrada', 'cancelada')),
  fecha_programada date,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_cierre timestamptz,
  usuario_inicio_id varchar(255),
  usuario_inicio_nombre varchar(255),
  usuario_cierre_id varchar(255),
  usuario_cierre_nombre varchar(255),
  observaciones text,
  criterio_seleccion jsonb,
  total_items integer NOT NULL DEFAULT 0,
  items_controlados integer NOT NULL DEFAULT 0,
  items_con_desvio integer NOT NULL DEFAULT 0,
  items_no_encontrados integer NOT NULL DEFAULT 0,
  ajustes_aplicados boolean NOT NULL DEFAULT false,
  periodicidad_snapshot varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auditorias_stock_en_curso
  ON public.auditorias_stock (deposito_id)
  WHERE estado = 'en_curso';

CREATE INDEX IF NOT EXISTS idx_auditorias_stock_deposito
  ON public.auditorias_stock (deposito_id, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_auditorias_stock_estado
  ON public.auditorias_stock (estado);

DROP TRIGGER IF EXISTS update_auditorias_stock_updated_at ON public.auditorias_stock;
CREATE TRIGGER update_auditorias_stock_updated_at
  BEFORE UPDATE ON public.auditorias_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.depositos_auditoria_config
  DROP CONSTRAINT IF EXISTS depositos_auditoria_config_ultima_auditoria_total_id_fkey;

ALTER TABLE public.depositos_auditoria_config
  ADD CONSTRAINT depositos_auditoria_config_ultima_auditoria_total_id_fkey
  FOREIGN KEY (ultima_auditoria_total_id) REFERENCES public.auditorias_stock(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.auditorias_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.auditorias_stock(id) ON DELETE CASCADE,
  stock_deposito_id uuid NOT NULL REFERENCES public.stock_depositos(id) ON DELETE CASCADE,
  insumo_id integer NOT NULL,
  ubicacion_id uuid REFERENCES public.deposito_ubicaciones(id) ON DELETE SET NULL,
  cantidad_sistema numeric(10,2) NOT NULL,
  controlado boolean NOT NULL DEFAULT false,
  estado_item varchar(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado_item IN ('pendiente', 'ok', 'con_desvio', 'no_encontrado', 'deteriorado')),
  cantidad_contada numeric(10,2),
  desvio numeric(10,2) GENERATED ALWAYS AS (cantidad_contada - cantidad_sistema) STORED,
  motivo_desvio text,
  observaciones text,
  controlado_por_id varchar(255),
  controlado_por_nombre varchar(255),
  controlado_at timestamptz,
  ajuste_movimiento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_auditorias_stock_items UNIQUE (auditoria_id, stock_deposito_id),
  CONSTRAINT auditorias_stock_items_controlado_chk CHECK (
    (NOT controlado) OR (estado_item <> 'pendiente')
  )
);

CREATE INDEX IF NOT EXISTS idx_auditorias_stock_items_auditoria
  ON public.auditorias_stock_items (auditoria_id);

CREATE INDEX IF NOT EXISTS idx_auditorias_stock_items_pendientes
  ON public.auditorias_stock_items (auditoria_id)
  WHERE controlado = false;

-- ---------------------------------------------------------------------------
-- Movimientos: tipo ajuste + FKs
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
  CHECK (tipo IN ('entrada', 'salida', 'ajuste'));

ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS auditoria_id uuid REFERENCES public.auditorias_stock(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS ubicacion_id uuid REFERENCES public.deposito_ubicaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_stock_auditoria
  ON public.movimientos_stock (auditoria_id);

ALTER TABLE public.auditorias_stock_items
  DROP CONSTRAINT IF EXISTS auditorias_stock_items_ajuste_movimiento_id_fkey;

ALTER TABLE public.auditorias_stock_items
  ADD CONSTRAINT auditorias_stock_items_ajuste_movimiento_id_fkey
  FOREIGN KEY (ajuste_movimiento_id) REFERENCES public.movimientos_stock(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.deposito_ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depositos_auditoria_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en deposito_ubicaciones" ON public.deposito_ubicaciones;
CREATE POLICY "Permitir todo en deposito_ubicaciones"
  ON public.deposito_ubicaciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en depositos_auditoria_config" ON public.depositos_auditoria_config;
CREATE POLICY "Permitir todo en depositos_auditoria_config"
  ON public.depositos_auditoria_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en auditorias_stock" ON public.auditorias_stock;
CREATE POLICY "Permitir todo en auditorias_stock"
  ON public.auditorias_stock FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en auditorias_stock_items" ON public.auditorias_stock_items;
CREATE POLICY "Permitir todo en auditorias_stock_items"
  ON public.auditorias_stock_items FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposito_ubicaciones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depositos_auditoria_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias_stock TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias_stock_items TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers y RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_intervalo_dias_periodicidad(
  p_periodicidad text,
  p_intervalo_dias integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_periodicidad
    WHEN 'semanal' THEN 7
    WHEN 'quincenal' THEN 15
    WHEN 'mensual' THEN 30
    WHEN 'bimestral' THEN 60
    WHEN 'trimestral' THEN 90
    WHEN 'semestral' THEN 180
    WHEN 'anual' THEN 365
    WHEN 'personalizada' THEN COALESCE(NULLIF(p_intervalo_dias, 0), 30)
    ELSE 30
  END;
$$;

CREATE OR REPLACE FUNCTION public.stock_refresh_auditoria_contadores(p_auditoria_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.auditorias_stock a
  SET
    total_items = s.total_items,
    items_controlados = s.items_controlados,
    items_con_desvio = s.items_con_desvio,
    items_no_encontrados = s.items_no_encontrados
  FROM (
    SELECT
      COUNT(*)::integer AS total_items,
      COUNT(*) FILTER (WHERE controlado)::integer AS items_controlados,
      COUNT(*) FILTER (WHERE estado_item = 'con_desvio')::integer AS items_con_desvio,
      COUNT(*) FILTER (WHERE estado_item = 'no_encontrado')::integer AS items_no_encontrados
    FROM public.auditorias_stock_items
    WHERE auditoria_id = p_auditoria_id
  ) s
  WHERE a.id = p_auditoria_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_insertar_items_auditoria(
  p_auditoria_id uuid,
  p_deposito_id uuid,
  p_stock_deposito_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.auditorias_stock_items (
    auditoria_id,
    stock_deposito_id,
    insumo_id,
    ubicacion_id,
    cantidad_sistema
  )
  SELECT
    p_auditoria_id,
    sd.id,
    sd.insumo_id,
    sd.ubicacion_id,
    sd.cantidad_actual
  FROM public.stock_depositos sd
  WHERE sd.deposito_id = p_deposito_id
    AND sd.id = ANY (p_stock_deposito_ids)
  ON CONFLICT (auditoria_id, stock_deposito_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  PERFORM public.stock_refresh_auditoria_contadores(p_auditoria_id);
  RETURN v_inserted;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.stock_agregar_items_auditoria(
  p_auditoria_id uuid,
  p_stock_deposito_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria public.auditorias_stock%ROWTYPE;
  v_inserted integer;
BEGIN
  SELECT * INTO v_auditoria
  FROM public.auditorias_stock
  WHERE id = p_auditoria_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La auditoría no existe';
  END IF;

  IF v_auditoria.estado <> 'en_curso' THEN
    RAISE EXCEPTION 'Solo se pueden agregar items a una auditoría en curso';
  END IF;

  IF v_auditoria.tipo <> 'parcial' THEN
    RAISE EXCEPTION 'Solo una auditoría parcial admite agregar items';
  END IF;

  IF p_stock_deposito_ids IS NULL OR cardinality(p_stock_deposito_ids) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_stock_deposito_ids) AS sid(id)
    LEFT JOIN public.stock_depositos sd ON sd.id = sid.id
    WHERE sd.id IS NULL OR sd.deposito_id <> v_auditoria.deposito_id
  ) THEN
    RAISE EXCEPTION 'Hay items que no pertenecen al depósito de la auditoría';
  END IF;

  v_inserted := public.stock_insertar_items_auditoria(
    p_auditoria_id,
    v_auditoria.deposito_id,
    p_stock_deposito_ids
  );

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_controlar_item_auditoria(
  p_item_id uuid,
  p_estado_item text,
  p_cantidad_contada numeric,
  p_motivo text DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_usuario_id text DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_item public.auditorias_stock_items%ROWTYPE;
  v_auditoria public.auditorias_stock%ROWTYPE;
  v_tolerancia numeric;
  v_estado text;
  v_cantidad numeric;
  v_pct numeric;
BEGIN
  SELECT * INTO v_item
  FROM public.auditorias_stock_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El item de auditoría no existe';
  END IF;

  SELECT * INTO v_auditoria
  FROM public.auditorias_stock
  WHERE id = v_item.auditoria_id
  FOR UPDATE;

  IF v_auditoria.estado <> 'en_curso' THEN
    RAISE EXCEPTION 'La auditoría no está en curso';
  END IF;

  IF p_estado_item IS NULL OR p_estado_item = 'pendiente' THEN
    RAISE EXCEPTION 'Debe indicar un estado de control distinto de pendiente';
  END IF;

  IF p_estado_item NOT IN ('ok', 'con_desvio', 'no_encontrado', 'deteriorado') THEN
    RAISE EXCEPTION 'Estado de item inválido: %', p_estado_item;
  END IF;

  SELECT COALESCE(c.tolerancia_desvio_pct, 0)
  INTO v_tolerancia
  FROM public.depositos_auditoria_config c
  WHERE c.deposito_id = v_auditoria.deposito_id;

  v_tolerancia := COALESCE(v_tolerancia, 0);

  IF p_estado_item = 'no_encontrado' THEN
    v_estado := 'no_encontrado';
    v_cantidad := 0;
  ELSIF p_estado_item = 'deteriorado' THEN
    v_estado := 'deteriorado';
    v_cantidad := COALESCE(p_cantidad_contada, v_item.cantidad_sistema);
  ELSE
    IF p_cantidad_contada IS NULL THEN
      RAISE EXCEPTION 'Debe indicar la cantidad contada';
    END IF;
    IF p_cantidad_contada < 0 THEN
      RAISE EXCEPTION 'La cantidad contada no puede ser negativa';
    END IF;
    v_cantidad := p_cantidad_contada;
    IF v_item.cantidad_sistema = 0 THEN
      v_estado := CASE WHEN v_cantidad = 0 THEN 'ok' ELSE 'con_desvio' END;
    ELSE
      v_pct := ABS(v_cantidad - v_item.cantidad_sistema) / v_item.cantidad_sistema * 100;
      v_estado := CASE WHEN v_pct <= v_tolerancia THEN 'ok' ELSE 'con_desvio' END;
    END IF;
  END IF;

  UPDATE public.auditorias_stock_items
  SET
    controlado = true,
    estado_item = v_estado,
    cantidad_contada = v_cantidad,
    motivo_desvio = p_motivo,
    observaciones = p_observaciones,
    controlado_por_id = p_usuario_id,
    controlado_por_nombre = p_usuario_nombre,
    controlado_at = now()
  WHERE id = p_item_id;

  PERFORM public.stock_refresh_auditoria_contadores(v_item.auditoria_id);
  RETURN p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_cerrar_auditoria(
  p_auditoria_id uuid,
  p_aplicar_ajustes boolean,
  p_usuario_id text DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria public.auditorias_stock%ROWTYPE;
  v_pendientes integer;
  v_item record;
  v_mov_id uuid;
  v_cantidad numeric;
  v_intervalo integer;
BEGIN
  SELECT * INTO v_auditoria
  FROM public.auditorias_stock
  WHERE id = p_auditoria_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La auditoría no existe';
  END IF;

  IF v_auditoria.estado <> 'en_curso' THEN
    RAISE EXCEPTION 'Solo se puede cerrar una auditoría en curso';
  END IF;

  SELECT COUNT(*) INTO v_pendientes
  FROM public.auditorias_stock_items
  WHERE auditoria_id = p_auditoria_id
    AND controlado = false;

  IF v_pendientes > 0 THEN
    RAISE EXCEPTION 'Faltan % items por controlar', v_pendientes;
  END IF;

  IF COALESCE(p_aplicar_ajustes, false) THEN
    FOR v_item IN
      SELECT i.*
      FROM public.auditorias_stock_items i
      WHERE i.auditoria_id = p_auditoria_id
        AND i.desvio IS NOT NULL
        AND i.desvio <> 0
    LOOP
      v_cantidad := ABS(v_item.desvio);

      INSERT INTO public.movimientos_stock (
        tipo,
        deposito_id,
        insumo_id,
        cantidad,
        usuario_id,
        usuario_nombre,
        motivo,
        observaciones,
        auditoria_id,
        ubicacion_id
      )
      VALUES (
        'ajuste',
        v_auditoria.deposito_id,
        v_item.insumo_id,
        v_cantidad,
        p_usuario_id,
        p_usuario_nombre,
        'Ajuste por auditoría ' || v_auditoria.tipo,
        v_item.motivo_desvio,
        p_auditoria_id,
        v_item.ubicacion_id
      )
      RETURNING id INTO v_mov_id;

      UPDATE public.stock_depositos
      SET cantidad_actual = COALESCE(v_item.cantidad_contada, 0)
      WHERE id = v_item.stock_deposito_id;

      UPDATE public.auditorias_stock_items
      SET ajuste_movimiento_id = v_mov_id
      WHERE id = v_item.id;
    END LOOP;
  END IF;

  PERFORM public.stock_refresh_auditoria_contadores(p_auditoria_id);

  UPDATE public.auditorias_stock
  SET
    estado = 'cerrada',
    fecha_cierre = now(),
    usuario_cierre_id = p_usuario_id,
    usuario_cierre_nombre = p_usuario_nombre,
    ajustes_aplicados = COALESCE(p_aplicar_ajustes, false)
  WHERE id = p_auditoria_id;

  IF v_auditoria.tipo = 'total' THEN
    SELECT public.stock_intervalo_dias_periodicidad(c.periodicidad, c.intervalo_dias)
    INTO v_intervalo
    FROM public.depositos_auditoria_config c
    WHERE c.deposito_id = v_auditoria.deposito_id;

    UPDATE public.depositos_auditoria_config
    SET
      proxima_fecha = CURRENT_DATE + COALESCE(v_intervalo, 30),
      ultima_auditoria_total_id = p_auditoria_id
    WHERE deposito_id = v_auditoria.deposito_id;
  END IF;

  RETURN p_auditoria_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_cancelar_auditoria(
  p_auditoria_id uuid,
  p_usuario_id text DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado INTO v_estado
  FROM public.auditorias_stock
  WHERE id = p_auditoria_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La auditoría no existe';
  END IF;

  IF v_estado <> 'en_curso' THEN
    RAISE EXCEPTION 'Solo se puede cancelar una auditoría en curso';
  END IF;

  UPDATE public.auditorias_stock
  SET
    estado = 'cancelada',
    fecha_cierre = now(),
    usuario_cierre_id = p_usuario_id,
    usuario_cierre_nombre = p_usuario_nombre,
    observaciones = COALESCE(p_observaciones, observaciones)
  WHERE id = p_auditoria_id;

  RETURN p_auditoria_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_intervalo_dias_periodicidad(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_refresh_auditoria_contadores(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_insertar_items_auditoria(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_iniciar_auditoria(uuid, text, uuid[], jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_agregar_items_auditoria(uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_controlar_item_auditoria(uuid, text, numeric, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_cerrar_auditoria(uuid, boolean, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_cancelar_auditoria(uuid, text, text, text) TO anon, authenticated;
