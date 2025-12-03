-- Insertar el módulo de stock
INSERT INTO system_modules (name, description, icon, route, is_active, order_index)
VALUES (
  'stock',
  'Gestión de depósitos, insumos y movimientos de stock',
  'fas fa-warehouse',
  '/stock/dashboard',
  true,
  60
) ON CONFLICT (name) DO NOTHING;

-- Insertar permisos para el módulo
-- Asumiendo que existen system_actions con nombres 'read', 'create', 'manage'
DO $$
DECLARE
  v_module_id uuid;
  v_read_action_id uuid;
  v_create_action_id uuid;
  v_manage_action_id uuid;
  v_admin_role_id uuid;
BEGIN
  -- Obtener ID del módulo
  SELECT id INTO v_module_id FROM system_modules WHERE name = 'stock';

  -- Obtener IDs de acciones (asumiendo que existen en system_actions)
  SELECT id INTO v_read_action_id FROM system_actions WHERE name = 'read';
  SELECT id INTO v_create_action_id FROM system_actions WHERE name = 'create';
  SELECT id INTO v_manage_action_id FROM system_actions WHERE name = 'manage';

  -- Insertar permisos del módulo (combinación de módulo y acción)
  INSERT INTO module_permissions (module_id, action_id)
  VALUES 
    (v_module_id, v_read_action_id),
    (v_module_id, v_create_action_id),
    (v_module_id, v_manage_action_id)
  ON CONFLICT DO NOTHING;

  -- Asignar permisos al rol 'admin'
  SELECT id INTO v_admin_role_id FROM user_roles WHERE name = 'admin';
  
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, module_permission_id)
    SELECT v_admin_role_id, id 
    FROM module_permissions 
    WHERE module_id = v_module_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Para 'administrador' (nombre alternativo común)
  SELECT id INTO v_admin_role_id FROM user_roles WHERE name = 'administrador';
  
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, module_permission_id)
    SELECT v_admin_role_id, id 
    FROM module_permissions 
    WHERE module_id = v_module_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensaje de confirmación
  RAISE NOTICE 'Módulo de stock agregado exitosamente con permisos para rol admin/administrador';

END $$;

