-- Repair: rol `admin` quedó sin filas en role_permissions (DESARROLLO).
-- Efecto: PermissionGuard bloquea /users (users:read) y /roles (users:manage)
-- aunque el usuario tenga el rol admin. Idempotente; no-op si host RBAC ausente.

DO $$
DECLARE
  v_admin_role record;
  v_assigned int := 0;
BEGIN
  IF to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.module_permissions') IS NULL THEN
    RAISE NOTICE 'RBAC ausente: se omite repair admin role_permissions';
    RETURN;
  END IF;

  FOR v_admin_role IN
    SELECT id, name
    FROM public.user_roles
    WHERE lower(name) IN ('admin', 'administrador')
  LOOP
    INSERT INTO public.role_permissions (role_id, module_permission_id)
    SELECT v_admin_role.id, mp.id
    FROM public.module_permissions mp
    ON CONFLICT (role_id, module_permission_id) DO NOTHING;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;
    RAISE NOTICE 'Permisos asignados a rol % (filas tocadas=%)', v_admin_role.name, v_assigned;
  END LOOP;
END $$;
