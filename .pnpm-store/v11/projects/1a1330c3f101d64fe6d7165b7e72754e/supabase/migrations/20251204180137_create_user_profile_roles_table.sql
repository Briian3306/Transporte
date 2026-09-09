-- Relación muchos-a-muchos usuarios/roles (no-op si host RBAC ausente — ok en CLI vacío)
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'user_profiles/user_roles ausentes: se omite user_profile_roles (ok en CLI vacío)';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.user_profile_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role_id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_profile_roles_user_id ON public.user_profile_roles(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_profile_roles_role_id ON public.user_profile_roles(role_id);

  ALTER TABLE public.user_profile_roles ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view user_profile_roles" ON public.user_profile_roles;
  CREATE POLICY "Users can view user_profile_roles" ON public.user_profile_roles
    FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can insert user_profile_roles" ON public.user_profile_roles;
  CREATE POLICY "Users can insert user_profile_roles" ON public.user_profile_roles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can update user_profile_roles" ON public.user_profile_roles;
  CREATE POLICY "Users can update user_profile_roles" ON public.user_profile_roles
    FOR UPDATE USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can delete user_profile_roles" ON public.user_profile_roles;
  CREATE POLICY "Users can delete user_profile_roles" ON public.user_profile_roles
    FOR DELETE USING (auth.role() = 'authenticated');

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'role_id'
  ) THEN
    INSERT INTO public.user_profile_roles (user_id, role_id, created_at, updated_at)
    SELECT id, role_id, created_at, updated_at
    FROM public.user_profiles
    WHERE role_id IS NOT NULL
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  CREATE OR REPLACE FUNCTION update_user_profile_roles_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS update_user_profile_roles_updated_at ON public.user_profile_roles;
  CREATE TRIGGER update_user_profile_roles_updated_at
    BEFORE UPDATE ON public.user_profile_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profile_roles_updated_at();
END $$;
