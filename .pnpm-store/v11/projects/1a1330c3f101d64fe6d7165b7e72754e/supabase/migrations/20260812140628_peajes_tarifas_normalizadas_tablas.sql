-- F14-1: tablas tarifas_parametros_peaje, tarifas_status_catalogo, tarifas_normalizadas
-- + trigger de validación de status (capa 2) + RLS plana + grants.

-- -----------------------------------------------------------------------------
-- 1) tarifas_parametros_peaje
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarifas_parametros_peaje (
  peaje_id uuid PRIMARY KEY REFERENCES public.peajes (id) ON DELETE CASCADE,
  umbral_muestra_minima integer NOT NULL DEFAULT 15,
  umbral_dispersion numeric(6,3) NOT NULL DEFAULT 4.100,
  auto_confirmar_horario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_parametros_peaje_muestra_chk CHECK (umbral_muestra_minima > 0),
  CONSTRAINT tarifas_parametros_peaje_dispersion_chk CHECK (umbral_dispersion >= 0)
);

COMMENT ON TABLE public.tarifas_parametros_peaje IS
  'F14-1 · Umbrales de clasificación tarifaria por concesión. Una fila por peaje; ausente = defaults.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.umbral_muestra_minima IS
  'Mínimo de pasadas en un nivel de tarifa para considerarlo estadísticamente confiable.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.umbral_dispersion IS
  'Desvío estándar horario (en horas) por debajo del cual el nivel se considera concentrado en franja (POSIBLE_HORARIO). Referencia: distribución uniforme 0-23 h ≈ 6.922.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.auto_confirmar_horario IS
  'Reservado: si true, un nivel POSIBLE_HORARIO se confirmaría solo. MVP lo deja en false; la confirmación siempre es humana.';

-- -----------------------------------------------------------------------------
-- 2) tarifas_status_catalogo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarifas_status_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE CASCADE,
  codigo text NOT NULL,
  etiqueta text NOT NULL,
  color text NOT NULL DEFAULT '#94A3B8',
  tipo_meta text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_status_catalogo_tipo_meta_chk
    CHECK (tipo_meta IN ('PICO', 'NO_PICO', 'NEUTRO')),
  CONSTRAINT tarifas_status_catalogo_codigo_chk
    CHECK (btrim(codigo) <> '' AND codigo = upper(codigo)),
  CONSTRAINT tarifas_status_catalogo_reservado_chk
    CHECK (codigo NOT IN ('PENDIENTE', 'POSIBLE_HORARIO')),
  CONSTRAINT tarifas_status_catalogo_uk UNIQUE (peaje_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_status_catalogo_peaje
  ON public.tarifas_status_catalogo (peaje_id, orden);

COMMENT ON TABLE public.tarifas_status_catalogo IS
  'F14-1 · Códigos de status que cada concesión puede asignar a un nivel de tarifa confirmado. Dataset de referencia: PICO / NO_PICO.';
COMMENT ON COLUMN public.tarifas_status_catalogo.codigo IS
  'Código en mayúsculas, único por peaje. No puede colisionar con los universales PENDIENTE / POSIBLE_HORARIO.';
COMMENT ON COLUMN public.tarifas_status_catalogo.tipo_meta IS
  'Agrupador transversal para reportes cross-concesión aunque cada peaje use nombres propios.';
COMMENT ON COLUMN public.tarifas_status_catalogo.orden IS
  'Orden sugerido por precio ascendente; la UI lo usa para pre-seleccionar la asignación.';

-- -----------------------------------------------------------------------------
-- 3) tarifas_normalizadas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarifas_normalizadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES public.estaciones (id) ON DELETE RESTRICT,
  categoria text NULL,
  importe numeric(14,2) NOT NULL,
  importe_base numeric(14,2) NOT NULL,
  cases integer NOT NULL DEFAULT 0,
  multiplicador numeric(10,4) NOT NULL DEFAULT 1,
  desvio numeric(10,4) NULL,
  hora_min numeric(5,2) NULL,
  hora_max numeric(5,2) NULL,
  hora_media numeric(5,2) NULL,
  patron text NOT NULL,
  diagnostico text NOT NULL DEFAULT 'MUESTRA_INSUFICIENTE',
  status text NOT NULL DEFAULT 'PENDIENTE',
  muestra_confiable boolean NOT NULL DEFAULT false,
  confirmado_manual boolean NOT NULL DEFAULT false,
  confirmado_por uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  confirmado_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_normalizadas_patron_chk CHECK (patron IN ('A', 'B')),
  CONSTRAINT tarifas_normalizadas_diagnostico_chk CHECK (diagnostico IN (
    'MUESTRA_INSUFICIENTE', 'TARIFA_UNICA', 'CATEGORIA',
    'POSIBLE_HORARIO', 'REVISAR', 'CONFIRMADO'
  )),
  CONSTRAINT tarifas_normalizadas_cases_chk CHECK (cases >= 0),
  CONSTRAINT tarifas_normalizadas_importe_chk CHECK (importe > 0),
  CONSTRAINT tarifas_normalizadas_patron_categoria_chk CHECK (
    (patron = 'A' AND categoria IS NULL) OR (patron = 'B' AND categoria IS NOT NULL)
  ),
  CONSTRAINT tarifas_normalizadas_confirmacion_chk CHECK (
    confirmado_manual = false OR confirmado_at IS NOT NULL
  ),
  CONSTRAINT tarifas_normalizadas_uk
    UNIQUE NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_peaje
  ON public.tarifas_normalizadas (peaje_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_estacion
  ON public.tarifas_normalizadas (estacion_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_status
  ON public.tarifas_normalizadas (status);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_diagnostico
  ON public.tarifas_normalizadas (diagnostico);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_categoria
  ON public.tarifas_normalizadas (categoria)
  WHERE categoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_cola_revision
  ON public.tarifas_normalizadas (peaje_id, muestra_confiable DESC, cases DESC)
  WHERE confirmado_manual = false
    AND diagnostico IN ('POSIBLE_HORARIO', 'REVISAR');
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_familia
  ON public.tarifas_normalizadas (estacion_id, categoria, importe);

COMMENT ON TABLE public.tarifas_normalizadas IS
  'F14-1 · Nivel de tarifa observado por (peaje, estación, categoría, importe) con su clasificación algorítmica y el status confirmado por el analista.';
COMMENT ON COLUMN public.tarifas_normalizadas.peaje_id IS
  'Concesión. Derivada siempre de estaciones.peaje_id; nunca se recibe por parámetro (RN-05).';
COMMENT ON COLUMN public.tarifas_normalizadas.categoria IS
  'Texto crudo del proveedor tal como vino en el archivo (RN-15). NULL = Patrón A (archivo sin columna de categoría). Sin FK ni catálogo; NO es patentes.categoria.';
COMMENT ON COLUMN public.tarifas_normalizadas.importe IS
  'pasadas.precio del nivel. Solo se agregan documentos tipo FC (ver riesgo de signos en NC).';
COMMENT ON COLUMN public.tarifas_normalizadas.importe_base IS
  'Importe mínimo de la familia: por estación en Patrón A, por estación+categoría en Patrón B.';
COMMENT ON COLUMN public.tarifas_normalizadas.multiplicador IS
  'importe / importe_base, 4 decimales. 1.0000 en el nivel base.';
COMMENT ON COLUMN public.tarifas_normalizadas.desvio IS
  'stddev_pop de la hora del día (0-23.99, UTC) de las pasadas del nivel. Referencia: uniforme ≈ 6.922. Bajo = concentrado en franja horaria.';
COMMENT ON COLUMN public.tarifas_normalizadas.patron IS
  'A = familia sin categoría (variación intra-estación). B = familia con categoría del proveedor.';
COMMENT ON COLUMN public.tarifas_normalizadas.diagnostico IS
  'Capa 1, algorítmica y fija: MUESTRA_INSUFICIENTE | TARIFA_UNICA | CATEGORIA | POSIBLE_HORARIO | REVISAR | CONFIRMADO.';
COMMENT ON COLUMN public.tarifas_normalizadas.status IS
  'Capa 2, entrada del usuario: PENDIENTE | POSIBLE_HORARIO (universales) o un codigo de tarifas_status_catalogo del mismo peaje. Validado por trg_validar_status_tarifa.';
COMMENT ON COLUMN public.tarifas_normalizadas.confirmado_manual IS
  'true bloquea la sobreescritura de diagnostico/status por el recálculo automático.';

-- -----------------------------------------------------------------------------
-- 4) Trigger de validación de status (FK condicional emulada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_validar_status_tarifa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('PENDIENTE', 'POSIBLE_HORARIO') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tarifas_status_catalogo c
    WHERE c.peaje_id = NEW.peaje_id
      AND c.codigo = NEW.status
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'status "%" no es universal ni existe en tarifas_status_catalogo para el peaje % (F14 · capa 2)',
    NEW.status, NEW.peaje_id
    USING ERRCODE = '23514';
END;
$$;

COMMENT ON FUNCTION public.peajes_validar_status_tarifa() IS
  'F14-1 · FK condicional de tarifas_normalizadas.status: universales o codigo del catálogo del peaje.';

DROP TRIGGER IF EXISTS trg_validar_status_tarifa ON public.tarifas_normalizadas;
CREATE TRIGGER trg_validar_status_tarifa
  BEFORE INSERT OR UPDATE OF status, peaje_id ON public.tarifas_normalizadas
  FOR EACH ROW EXECUTE FUNCTION public.peajes_validar_status_tarifa();

-- -----------------------------------------------------------------------------
-- 5) RLS plana (PRD §5.2) — RLS por rol/empresa diferida
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarifas_normalizadas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas_parametros_peaje   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas_status_catalogo    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifas_normalizadas_authenticated_all ON public.tarifas_normalizadas;
CREATE POLICY tarifas_normalizadas_authenticated_all ON public.tarifas_normalizadas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tarifas_parametros_peaje_authenticated_all ON public.tarifas_parametros_peaje;
CREATE POLICY tarifas_parametros_peaje_authenticated_all ON public.tarifas_parametros_peaje
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tarifas_status_catalogo_authenticated_all ON public.tarifas_status_catalogo;
CREATE POLICY tarifas_status_catalogo_authenticated_all ON public.tarifas_status_catalogo
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_normalizadas     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_parametros_peaje TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_status_catalogo  TO authenticated;
GRANT ALL ON public.tarifas_normalizadas     TO service_role;
GRANT ALL ON public.tarifas_parametros_peaje TO service_role;
GRANT ALL ON public.tarifas_status_catalogo  TO service_role;
