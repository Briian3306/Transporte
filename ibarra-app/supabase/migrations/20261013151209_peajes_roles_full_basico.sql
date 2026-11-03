-- Roles Peajes - Full y Peajes - Basico.
-- El rol legado "peajes" no tenía role_permissions, así que el módulo
-- solo abría con admin/administrador. Basico cubre carga rápida, documentos,
-- catálogos y pasadas. Full cubre todas las acciones del módulo peajes.
-- No-op si el RBAC host todavía no existe (CLI vacío antes del seed).

DO $$
DECLARE
  v_module_id uuid;
  v_full_id uuid;
  v_basico_id uuid;
  v_legacy_id uuid;
BEGIN
  IF to_regclass('public.system_modules') IS NULL
     OR to_regclass('public.system_actions') IS NULL
     OR to_regclass('public.module_permissions') IS NULL
     OR to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.role_permissions') IS NULL THEN
    RAISE NOTICE 'RBAC host ausente: se omiten roles peajes full/basico';
    RETURN;
  END IF;

  SELECT id INTO v_module_id
  FROM public.system_modules
  WHERE name = 'peajes';

  IF v_module_id IS NULL THEN
    RAISE NOTICE 'Módulo peajes ausente: se omiten roles peajes full/basico';
    RETURN;
  END IF;

  INSERT INTO public.module_permissions (module_id, action_id)
  SELECT v_module_id, a.id
  FROM public.system_actions a
  WHERE a.name IN ('read', 'create', 'update', 'delete', 'manage', 'export', 'import')
  ON CONFLICT (module_id, action_id) DO NOTHING;

  INSERT INTO public.user_roles (name, description, is_system_role)
  VALUES
    (
      'peajes - full',
      'Acceso completo a todas las rutas y acciones del módulo Peajes',
      false
    ),
    (
      'peajes - basico',
      'Carga rápida, documentos (facturas), catálogos y pasadas, sin plantillas ni algoritmos',
      false
    )
  ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

  SELECT id INTO v_full_id FROM public.user_roles WHERE name = 'peajes - full';
  SELECT id INTO v_basico_id FROM public.user_roles WHERE name = 'peajes - basico';
  SELECT id INTO v_legacy_id FROM public.user_roles WHERE name = 'peajes';

  INSERT INTO public.role_permissions (role_id, module_permission_id)
  SELECT v_full_id, mp.id
  FROM public.module_permissions mp
  WHERE mp.module_id = v_module_id
  ON CONFLICT (role_id, module_permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, module_permission_id)
  SELECT v_basico_id, mp.id
  FROM public.module_permissions mp
  JOIN public.system_actions a ON a.id = mp.action_id
  WHERE mp.module_id = v_module_id
    AND a.name IN ('read', 'create', 'update')
  ON CONFLICT (role_id, module_permission_id) DO NOTHING;

  IF v_legacy_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module_permission_id)
    SELECT v_legacy_id, mp.id
    FROM public.module_permissions mp
    JOIN public.system_actions a ON a.id = mp.action_id
    WHERE mp.module_id = v_module_id
      AND a.name IN ('read', 'create', 'update')
    ON CONFLICT (role_id, module_permission_id) DO NOTHING;
  END IF;
END $$;
