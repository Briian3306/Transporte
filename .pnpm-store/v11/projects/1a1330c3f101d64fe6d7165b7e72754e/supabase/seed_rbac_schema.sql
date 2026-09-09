-- DDL for host RBAC tables. Separate file so CLI seed batches finish CREATE
-- before seed_rbac.sql inserts rows.

SET search_path = public, extensions, pg_catalog;

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
  id uuid PRIMARY KEY,
  email varchar(255) NOT NULL,
  full_name varchar(255),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'user_profiles FK to auth.users omitida: %', SQLERRM;
END $$;

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
