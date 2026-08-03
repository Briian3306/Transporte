-- Quitar role_id de user_profiles (no-op si la tabla/columna no existe — ok en CLI vacío)
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'user_profiles ausente: se omite drop role_id (ok en CLI vacío)';
    RETURN;
  END IF;

  ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_role_id_fkey;

  ALTER TABLE public.user_profiles
    DROP COLUMN IF EXISTS role_id;
END $$;
