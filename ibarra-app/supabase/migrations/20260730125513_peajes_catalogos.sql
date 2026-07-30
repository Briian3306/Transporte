-- F01-1: Catálogos base Peajes + alta system_modules 'peajes'
-- Dominio aislado: no usa checklist_templates.

-- -----------------------------------------------------------------------------
-- peajes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.peajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ubicacion text,
  descripcion text,
  -- text: admite UUID de empresa o marcador global '__global__' (RN-23 / contrato 03)
  empresa_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peajes_empresa_id ON public.peajes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_peajes_nombre ON public.peajes (nombre);

COMMENT ON TABLE public.peajes IS 'Catálogo de peajes / corredores (PRD §11.5)';

-- -----------------------------------------------------------------------------
-- estaciones (pertenece a peaje; la pasada referencia estación)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  ubicacion text,
  descripcion text,
  codigos_proveedor text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estaciones_peaje_id ON public.estaciones (peaje_id);
CREATE INDEX IF NOT EXISTS idx_estaciones_nombre ON public.estaciones (nombre);
CREATE INDEX IF NOT EXISTS idx_estaciones_codigos_proveedor ON public.estaciones USING gin (codigos_proveedor);

COMMENT ON TABLE public.estaciones IS 'Estaciones de peaje; peaje_id obligatorio (RN-04/RN-05)';
COMMENT ON COLUMN public.estaciones.codigos_proveedor IS 'Códigos/nombres del proveedor para sugerencia RF-17';

-- -----------------------------------------------------------------------------
-- patentes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patente text NOT NULL,
  categoria text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patentes_patente_uk UNIQUE (patente),
  CONSTRAINT patentes_categoria_chk CHECK (categoria IN ('TRANSPORTE', 'REMIS'))
);

CREATE INDEX IF NOT EXISTS idx_patentes_categoria ON public.patentes (categoria);

COMMENT ON TABLE public.patentes IS 'Patentes internas (PRD §11.4); categoría TRANSPORTE|REMIS';

-- -----------------------------------------------------------------------------
-- pases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pase text NOT NULL,
  patente_id uuid NOT NULL REFERENCES public.patentes (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pases_pase_uk UNIQUE (pase)
);

CREATE INDEX IF NOT EXISTS idx_pases_patente_id ON public.pases (patente_id);

COMMENT ON TABLE public.pases IS 'Dispositivos/pases reutilizables (PRD §11.3 / RN-02)';

-- -----------------------------------------------------------------------------
-- RLS (MVP: authenticated full access; auth granular fuera de alcance §5.2)
-- -----------------------------------------------------------------------------
ALTER TABLE public.peajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peajes_authenticated_all ON public.peajes;
CREATE POLICY peajes_authenticated_all ON public.peajes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS estaciones_authenticated_all ON public.estaciones;
CREATE POLICY estaciones_authenticated_all ON public.estaciones
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS patentes_authenticated_all ON public.patentes;
CREATE POLICY patentes_authenticated_all ON public.patentes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pases_authenticated_all ON public.pases;
CREATE POLICY pases_authenticated_all ON public.pases
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peajes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pases TO authenticated;
GRANT ALL ON public.peajes TO service_role;
GRANT ALL ON public.estaciones TO service_role;
GRANT ALL ON public.patentes TO service_role;
GRANT ALL ON public.pases TO service_role;

-- -----------------------------------------------------------------------------
-- system_modules + permisos peajes (patrón stock; no-op si host ausente)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_module_id uuid;
  v_read_action_id uuid;
  v_create_action_id uuid;
  v_manage_action_id uuid;
  v_admin_role_id uuid;
BEGIN
  IF to_regclass('public.system_modules') IS NULL THEN
    RAISE NOTICE 'system_modules ausente: se omite alta del módulo peajes (ok en CLI vacío)';
    RETURN;
  END IF;

  INSERT INTO public.system_modules (name, description, icon, route, is_active, order_index)
  VALUES (
    'peajes',
    'Procesar pasadas, configuraciones y facturas de peajes',
    'fas fa-road',
    '/peajes',
    true,
    70
  )
  ON CONFLICT (name) DO UPDATE
  SET
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route,
    is_active = true;

  SELECT id INTO v_module_id FROM public.system_modules WHERE name = 'peajes';

  IF to_regclass('public.system_actions') IS NULL
     OR to_regclass('public.module_permissions') IS NULL THEN
    RAISE NOTICE 'system_actions/module_permissions ausentes: módulo peajes creado sin permisos';
    RETURN;
  END IF;

  SELECT id INTO v_read_action_id FROM public.system_actions WHERE name = 'read';
  SELECT id INTO v_create_action_id FROM public.system_actions WHERE name = 'create';
  SELECT id INTO v_manage_action_id FROM public.system_actions WHERE name = 'manage';

  IF v_read_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_read_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_create_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_create_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_manage_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_manage_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.role_permissions') IS NOT NULL THEN
    SELECT id INTO v_admin_role_id FROM public.user_roles WHERE name = 'admin';
    IF v_admin_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, module_permission_id)
      SELECT v_admin_role_id, mp.id
      FROM public.module_permissions mp
      WHERE mp.module_id = v_module_id
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_admin_role_id FROM public.user_roles WHERE name = 'administrador';
    IF v_admin_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, module_permission_id)
      SELECT v_admin_role_id, mp.id
      FROM public.module_permissions mp
      WHERE mp.module_id = v_module_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RAISE NOTICE 'Módulo peajes registrado (id=%)', v_module_id;
END $$;
