-- F14-16 Task 2: empty v2 schema (tarifas + tarifa_importe) and pasadas shadow columns.
-- Additive only. Does NOT drop, rename, or alter tarifas_normalizadas or its FKs.
-- Current-pointer composite FK and immutability triggers belong to Task 3.

-- -----------------------------------------------------------------------------
-- 1) public.tarifas — current configuration (no money)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES public.estaciones (id) ON DELETE RESTRICT,
  status text NOT NULL,
  categoria smallint NOT NULL,
  sentido text NOT NULL DEFAULT 'AMBAS',
  requiere_normalizacion_iva boolean NOT NULL DEFAULT false,
  current_tarifa_id uuid NULL,
  fecha_actualizacion timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_status_chk CHECK (status IN ('PICO', 'NO_PICO')),
  CONSTRAINT tarifas_categoria_chk CHECK (categoria BETWEEN 0 AND 10),
  CONSTRAINT tarifas_sentido_chk CHECK (sentido IN ('IDA', 'VUELTA', 'AMBAS')),
  CONSTRAINT tarifas_config_uk UNIQUE (peaje_id, estacion_id, status, categoria, sentido)
);

COMMENT ON TABLE public.tarifas IS
  'F14-16 · Configuración vigente de tarifa por (peaje, estación, status, categoría, sentido). Sin importe; el monto vive en tarifa_importe.';
COMMENT ON COLUMN public.tarifas.sentido IS
  'IDA | VUELTA | AMBAS. AMBAS es un valor real de aplicabilidad, no “dirección desconocida”.';
COMMENT ON COLUMN public.tarifas.requiere_normalizacion_iva IS
  'Si true, la comparación usa el precio ya normalizado por el pipeline Angular; SQL no reproduce ELIMINAR_IVA.';
COMMENT ON COLUMN public.tarifas.current_tarifa_id IS
  'Puntero al tarifa_importe vigente. Nullable en bootstrap Task 2; Task 3 agrega el FK compuesto.';

-- estacion_id is not a left prefix of tarifas_config_uk (starts with peaje_id).
CREATE INDEX IF NOT EXISTS idx_tarifas_estacion_id
  ON public.tarifas (estacion_id);

-- -----------------------------------------------------------------------------
-- 2) public.tarifa_importe — amount history (status/categoria live only on tarifas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarifa_importe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarifa_id uuid NOT NULL REFERENCES public.tarifas (id) ON DELETE RESTRICT,
  importe numeric(14,2) NOT NULL,
  importe_base numeric(14,2) NULL,
  desvio numeric(10,4) NULL,
  hora_min numeric(5,2) NULL,
  hora_max numeric(5,2) NULL,
  hora_media numeric(5,2) NULL,
  categoria_calculated smallint NULL,
  fecha_aparicion timestamptz NOT NULL,
  tarifas_normalizadas_id uuid NULL
    REFERENCES public.tarifas_normalizadas (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifa_importe_importe_chk CHECK (importe > 0),
  CONSTRAINT tarifa_importe_categoria_calculated_chk
    CHECK (categoria_calculated BETWEEN 0 AND 10),
  CONSTRAINT tarifa_importe_tarifa_id_id_uk UNIQUE (tarifa_id, id)
);

COMMENT ON TABLE public.tarifa_importe IS
  'F14-16 · Historial de importes de una configuración tarifas. Inmutabilidad de negocio en Task 3.';
COMMENT ON COLUMN public.tarifa_importe.tarifas_normalizadas_id IS
  'Linaje opcional 1:1 hacia tarifas_normalizadas. NULL = monto solo en el tarifario cruzado o detectado después.';

CREATE UNIQUE INDEX IF NOT EXISTS tarifa_importe_tarifas_normalizadas_id_uidx
  ON public.tarifa_importe (tarifas_normalizadas_id)
  WHERE tarifas_normalizadas_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tarifa_importe_history_idx
  ON public.tarifa_importe (tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC);

-- -----------------------------------------------------------------------------
-- 3) pasadas shadow columns — no peaje_id (RN-05). Retain tarifa_normalizada_id.
-- -----------------------------------------------------------------------------
ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS sentido text NOT NULL DEFAULT 'AMBAS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pasadas_sentido_chk'
      AND conrelid = 'public.pasadas'::regclass
  ) THEN
    ALTER TABLE public.pasadas
      ADD CONSTRAINT pasadas_sentido_chk
      CHECK (sentido IN ('IDA', 'VUELTA', 'AMBAS'));
  END IF;
END $$;

ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS tarifa_importe_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pasadas_tarifa_importe_id_fkey'
      AND conrelid = 'public.pasadas'::regclass
  ) THEN
    ALTER TABLE public.pasadas
      ADD CONSTRAINT pasadas_tarifa_importe_id_fkey
      FOREIGN KEY (tarifa_importe_id)
      REFERENCES public.tarifa_importe (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.pasadas.sentido IS
  'F14-16 · Dirección de la pasada: IDA | VUELTA | AMBAS. Default AMBAS.';
COMMENT ON COLUMN public.pasadas.tarifa_importe_id IS
  'F14-16 · Shadow match al historial v2. NULL = aún sin clasificar en v2. El FK legado tarifa_normalizada_id se retiene.';

CREATE INDEX IF NOT EXISTS idx_pasadas_tarifa_importe_id
  ON public.pasadas (tarifa_importe_id);

CREATE INDEX IF NOT EXISTS idx_pasadas_shadow_backlog
  ON public.pasadas (estacion_id, categoria, tarifa_status, sentido, precio)
  WHERE tarifa_importe_id IS NULL;

-- -----------------------------------------------------------------------------
-- 4) RLS plana + grants (mismo patrón que tarifas_normalizadas)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifa_importe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifas_authenticated_all ON public.tarifas;
CREATE POLICY tarifas_authenticated_all ON public.tarifas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tarifa_importe_authenticated_all ON public.tarifa_importe;
CREATE POLICY tarifa_importe_authenticated_all ON public.tarifa_importe
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifa_importe TO authenticated;
GRANT ALL ON public.tarifas TO service_role;
GRANT ALL ON public.tarifa_importe TO service_role;
