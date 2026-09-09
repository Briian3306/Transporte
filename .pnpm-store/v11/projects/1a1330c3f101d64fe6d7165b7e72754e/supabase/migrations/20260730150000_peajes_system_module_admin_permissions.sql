-- Repair: registrar módulo peajes en RBAC host + permisos Admin
-- Causa: F01 omitía el alta si system_modules no existía (CLI vacío);
-- en DESARROLLO el módulo puede faltar → PermissionGuard exige peajes:read → acceso denegado
-- aunque el usuario tenga rol Admin. Idempotente; no-op si host RBAC ausente.

DO $$
DECLARE
  v_module_id uuid;
  v_read_action_id uuid;
  v_create_action_id uuid;
  v_manage_action_id uuid;
  v_admin_role record;
  v_assigned int := 0;
BEGIN
  IF to_regclass('public.system_modules') IS NULL THEN
    RAISE NOTICE 'system_modules ausente: se omite repair peajes RBAC (ok en CLI vacío)';
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
    RAISE NOTICE 'system_actions/module_permissions ausentes: módulo peajes sin permisos';
    RETURN;
  END IF;

  SELECT id INTO v_read_action_id FROM public.system_actions WHERE name = 'read';
  SELECT id INTO v_create_action_id FROM public.system_actions WHERE name = 'create';
  SELECT id INTO v_manage_action_id FROM public.system_actions WHERE name = 'manage';

  IF v_read_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_read_action_id)
    ON CONFLICT (module_id, action_id) DO NOTHING;
  END IF;

  IF v_create_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_create_action_id)
    ON CONFLICT (module_id, action_id) DO NOTHING;
  END IF;

  IF v_manage_action_id IS NOT NULL THEN
    INSERT INTO public.module_permissions (module_id, action_id)
    VALUES (v_module_id, v_manage_action_id)
    ON CONFLICT (module_id, action_id) DO NOTHING;
  END IF;

  IF to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.role_permissions') IS NULL THEN
    RAISE NOTICE 'user_roles/role_permissions ausentes: módulo peajes sin asignación a Admin';
    RETURN;
  END IF;

  -- Case-insensitive: admin / Admin / administrador
  FOR v_admin_role IN
    SELECT id, name
    FROM public.user_roles
    WHERE lower(name) IN ('admin', 'administrador')
  LOOP
    INSERT INTO public.role_permissions (role_id, module_permission_id)
    SELECT v_admin_role.id, mp.id
    FROM public.module_permissions mp
    WHERE mp.module_id = v_module_id
    ON CONFLICT (role_id, module_permission_id) DO NOTHING;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;
    RAISE NOTICE 'Permisos peajes asignados a rol % (filas tocadas=%)', v_admin_role.name, v_assigned;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE lower(name) IN ('admin', 'administrador')
  ) THEN
    RAISE NOTICE 'No hay rol admin/administrador: módulo peajes creado sin role_permissions';
  END IF;

  RAISE NOTICE 'Repair peajes RBAC listo (module_id=%)', v_module_id;
END $$;
