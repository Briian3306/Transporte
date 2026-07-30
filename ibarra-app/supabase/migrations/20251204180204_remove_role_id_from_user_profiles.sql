-- Eliminar la foreign key constraint
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_id_fkey;

-- Eliminar el campo role_id de user_profiles
ALTER TABLE public.user_profiles 
DROP COLUMN IF EXISTS role_id;;
