-- Insertar el módulo de stock (no-op si host RBAC ausente — ok en CLI vacío)
DO $$
DECLARE
  v_module_id uuid;
  v_read_action_id uuid;
  v_create_action_id uuid;
  v_manage_action_id uuid;
  v_admin_role_id uuid;
BEGIN
  IF to_regclass('public.system_modules') IS NULL THEN
    RAISE NOTICE 'system_modules ausente: se omite alta del módulo stock (ok en CLI vacío)';
    RETURN;
  END IF;

  INSERT INTO system_modules (name, description, icon, route, is_active, order_index)
  VALUES (
    'stock',
    'Gestión de depósitos, insumos y movimientos de stock',
    'fas fa-warehouse',
    '/stock/dashboard',
    true,
    60
  ) ON CONFLICT (name) DO NOTHING;

  IF to_regclass('public.system_actions') IS NULL
     OR to_regclass('public.module_permissions') IS NULL THEN
    RAISE NOTICE 'system_actions/module_permissions ausentes: módulo stock creado sin permisos';
    RETURN;
  END IF;

  SELECT id INTO v_module_id FROM system_modules WHERE name = 'stock';

  SELECT id INTO v_read_action_id FROM system_actions WHERE name = 'read';
  SELECT id INTO v_create_action_id FROM system_actions WHERE name = 'create';
  SELECT id INTO v_manage_action_id FROM system_actions WHERE name = 'manage';

  IF v_read_action_id IS NOT NULL THEN
    INSERT INTO module_permissions (module_id, action_id)
    VALUES (v_module_id, v_read_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_create_action_id IS NOT NULL THEN
    INSERT INTO module_permissions (module_id, action_id)
    VALUES (v_module_id, v_create_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_manage_action_id IS NOT NULL THEN
    INSERT INTO module_permissions (module_id, action_id)
    VALUES (v_module_id, v_manage_action_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.role_permissions') IS NOT NULL THEN
    SELECT id INTO v_admin_role_id FROM user_roles WHERE name = 'admin';
    IF v_admin_role_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, module_permission_id)
      SELECT v_admin_role_id, id
      FROM module_permissions
      WHERE module_id = v_module_id
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_admin_role_id FROM user_roles WHERE name = 'administrador';
    IF v_admin_role_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, module_permission_id)
      SELECT v_admin_role_id, id
      FROM module_permissions
      WHERE module_id = v_module_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RAISE NOTICE 'Módulo de stock agregado exitosamente con permisos para rol admin/administrador';
END $$;
