-- Crear tabla de relación muchos-a-muchos entre usuarios y roles
CREATE TABLE IF NOT EXISTS public.user_profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_user_id ON public.user_profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_role_id ON public.user_profile_roles(role_id);

-- Habilitar RLS
ALTER TABLE public.user_profile_roles ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS básicas (ajustar según necesidades de seguridad)
-- Permitir lectura a usuarios autenticados
CREATE POLICY "Users can view user_profile_roles" ON public.user_profile_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir inserción a usuarios autenticados (ajustar según permisos)
CREATE POLICY "Users can insert user_profile_roles" ON public.user_profile_roles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir actualización a usuarios autenticados
CREATE POLICY "Users can update user_profile_roles" ON public.user_profile_roles
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Permitir eliminación a usuarios autenticados
CREATE POLICY "Users can delete user_profile_roles" ON public.user_profile_roles
  FOR DELETE USING (auth.role() = 'authenticated');

-- Migrar datos existentes: crear registros en user_profile_roles para usuarios que tienen role_id
INSERT INTO public.user_profile_roles (user_id, role_id, created_at, updated_at)
SELECT id, role_id, created_at, updated_at
FROM public.user_profiles
WHERE role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_profile_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_user_profile_roles_updated_at
  BEFORE UPDATE ON public.user_profile_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_roles_updated_at();;
