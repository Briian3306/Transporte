-- DEV seed: host RBAC mirror for Supabase CLI (DESARROLLO-aligned).
-- Committed for local development. Grants admin + peajes to francis@transporteibarra.com.ar

BEGIN;

CREATE TABLE IF NOT EXISTS public.system_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description text,
  icon varchar(50),
  route varchar(100),
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  full_name varchar(255),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profile_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.system_modules(id) ON DELETE CASCADE,
  action_id uuid REFERENCES public.system_actions(id) ON DELETE CASCADE,
  UNIQUE (module_id, action_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.user_roles(id) ON DELETE CASCADE,
  module_permission_id uuid REFERENCES public.module_permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, module_permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_roles_user_id ON public.user_profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_role_id ON public.user_profile_roles(role_id);

-- Actions (same IDs as DESARROLLO)
INSERT INTO public.system_actions (id, name, description) VALUES
  ('4597f65a-a036-4ba5-8717-ad19c73206b0', 'approve', 'Aprobar solicitudes'),
  ('6e4340c7-240e-44e0-b706-be47c7b2db47', 'assign', 'Asignar tareas'),
  ('b24965b4-5d4e-4cfa-857b-d493f33fdc30', 'create', 'Crear nuevos registros'),
  ('95a8ad1d-d11e-469d-bce4-2403826f5391', 'delete', 'Eliminar registros'),
  ('8bef2244-6467-459f-9825-7bfd37b51f21', 'export', 'Exportar datos'),
  ('64d77168-fece-48d6-bf1a-520c661dee26', 'import', 'Importar datos'),
  ('3d827497-fc01-42fd-87ae-e93f984e86ad', 'manage', 'Gestionar completamente'),
  ('c176e795-0a5a-442f-8997-7e133f4b0452', 'read', 'Ver y consultar registros'),
  ('423c1035-51f2-4ca9-999d-bbbbb638c249', 'reject', 'Rechazar solicitudes'),
  ('de9b858c-d7a0-4a5b-8d98-7af9504a87de', 'update', 'Modificar registros existentes.')
ON CONFLICT (id) DO NOTHING;

-- Modules (same IDs as DESARROLLO)
INSERT INTO public.system_modules (id, name, description, icon, route, order_index, is_active) VALUES
  ('b95b58be-7b30-42c0-8540-a642afd46e2b', 'checklists', 'Gestión de Checklists', 'fas fa-clipboard-list', '/checklist', 1, true),
  ('2806bb3d-22ff-46b7-8b06-f43dccb83be3', 'users', 'Gestión de Usuarios', 'fas fa-users', '/users', 2, true),
  ('161e61b1-3729-4753-8ba0-013cfb35497e', 'incidentes', 'Gestion de incidentes', 'fas fa-users', '/incidentes/historial', 3, true),
  ('5f28327f-4402-4e17-8c27-f696a331b6af', 'templates', 'Gestion de Templates de Checklist', 'fas fa-clipboard-list', '/templates', 4, true),
  ('fb2a442a-59d1-401c-b16c-261c03d2eccc', 'flota', 'Gestion de flota', 'fas fa-truck', '/flota', 6, true),
  ('576cfa4d-b07a-448d-be95-965aa9a2cf40', 'neumaticos', 'Registro y gestión de neumáticos', 'fas fa-truck-monster', '/neumaticos/registro', 50, true),
  ('c1c5f6fc-2c80-4061-a611-24848cdc9a35', 'stock', 'Gestión de depósitos, insumos y movimientos de stock', 'fas fa-warehouse', '/stock/dashboard', 60, true),
  ('4f3325e8-3b58-444f-bb89-e8287bbe9432', 'peajes', 'Procesar pasadas, configuraciones y facturas de peajes', 'fas fa-road', '/peajes', 70, true)
ON CONFLICT (id) DO NOTHING;

-- Roles
INSERT INTO public.user_roles (id, name, description, is_system_role) VALUES
  ('302a8fca-976f-4cb8-81ca-b9cc9edc4665', 'admin', 'Administrador del sistema con acceso completo', true),
  ('3978ddcb-ef1b-4a52-b410-65e772f3c909', 'administrador', 'Administrador de operaciones', true)
ON CONFLICT (id) DO NOTHING;

-- Every module × every action
INSERT INTO public.module_permissions (module_id, action_id)
SELECT m.id, a.id
FROM public.system_modules m
CROSS JOIN public.system_actions a
ON CONFLICT (module_id, action_id) DO NOTHING;

-- Admin + administrador get all module permissions
INSERT INTO public.role_permissions (role_id, module_permission_id)
SELECT r.id, mp.id
FROM public.user_roles r
CROSS JOIN public.module_permissions mp
WHERE r.name IN ('admin', 'administrador')
ON CONFLICT (role_id, module_permission_id) DO NOTHING;

-- Francis profile + admin roles
INSERT INTO public.user_profiles (id, email, full_name, is_active)
VALUES (
  '2103d8df-a4f7-46fd-9984-74e3ddf1d993',
  'francis@transporteibarra.com.ar',
  'Francis Rojas',
  true
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = true,
    updated_at = now();

INSERT INTO public.user_profile_roles (user_id, role_id)
VALUES
  ('2103d8df-a4f7-46fd-9984-74e3ddf1d993', '302a8fca-976f-4cb8-81ca-b9cc9edc4665'),
  ('2103d8df-a4f7-46fd-9984-74e3ddf1d993', '3978ddcb-ef1b-4a52-b410-65e772f3c909')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- RLS so the Angular client can read permissions
ALTER TABLE public.system_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rbac_actions_select ON public.system_actions;
CREATE POLICY rbac_actions_select ON public.system_actions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_modules_select ON public.system_modules;
CREATE POLICY rbac_modules_select ON public.system_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_roles_select ON public.user_roles;
CREATE POLICY rbac_roles_select ON public.user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_profiles_select ON public.user_profiles;
CREATE POLICY rbac_profiles_select ON public.user_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_profiles_update ON public.user_profiles;
CREATE POLICY rbac_profiles_update ON public.user_profiles FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_profile_roles_all ON public.user_profile_roles;
CREATE POLICY rbac_profile_roles_all ON public.user_profile_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rbac_module_permissions_select ON public.module_permissions;
CREATE POLICY rbac_module_permissions_select ON public.module_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rbac_role_permissions_select ON public.role_permissions;
CREATE POLICY rbac_role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.system_actions, public.system_modules, public.user_roles,
  public.user_profiles, public.user_profile_roles, public.module_permissions,
  public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_profiles, public.user_profile_roles TO authenticated;

COMMIT;
