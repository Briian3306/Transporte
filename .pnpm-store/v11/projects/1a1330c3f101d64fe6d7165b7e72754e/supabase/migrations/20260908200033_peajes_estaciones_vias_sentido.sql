-- Direction metadata for provider station/lane values used by Paso 9.
-- This table is deliberately operational catalogue data: it does not change
-- tariffs, and it has no new permission identifier. Existing Peajes RLS and
-- application guards decide who may edit it.
CREATE TABLE IF NOT EXISTS public.estaciones_vias_sentido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  estacion_id uuid NOT NULL REFERENCES public.estaciones(id) ON DELETE CASCADE,
  codigo_estacion text NOT NULL,
  via text NOT NULL,
  sentido text NOT NULL CHECK (sentido IN ('IDA', 'VUELTA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estaciones_vias_sentido_uk
    UNIQUE (empresa_id, estacion_id, codigo_estacion, via),
  CONSTRAINT estaciones_vias_sentido_codigo_chk CHECK (btrim(codigo_estacion) <> ''),
  CONSTRAINT estaciones_vias_sentido_via_chk CHECK (btrim(via) <> '')
);

CREATE INDEX IF NOT EXISTS idx_estaciones_vias_sentido_lookup
  ON public.estaciones_vias_sentido (empresa_id, estacion_id, codigo_estacion, via);

CREATE OR REPLACE FUNCTION public.peajes_touch_estaciones_vias_sentido()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  station_empresa text;
BEGIN
  NEW.codigo_estacion := btrim(NEW.codigo_estacion);
  NEW.via := btrim(NEW.via);
  NEW.sentido := upper(btrim(NEW.sentido));
  SELECT p.empresa_id INTO station_empresa
  FROM public.estaciones e
  JOIN public.peajes p ON p.id = e.peaje_id
  WHERE e.id = NEW.estacion_id;
  IF station_empresa IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'La estación % no pertenece a la empresa %', NEW.estacion_id, NEW.empresa_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_peajes_touch_estaciones_vias_sentido
  ON public.estaciones_vias_sentido;
CREATE TRIGGER trg_peajes_touch_estaciones_vias_sentido
  BEFORE INSERT OR UPDATE ON public.estaciones_vias_sentido
  FOR EACH ROW EXECUTE FUNCTION public.peajes_touch_estaciones_vias_sentido();

ALTER TABLE public.estaciones_vias_sentido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_select
  ON public.estaciones_vias_sentido;
DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_write
  ON public.estaciones_vias_sentido;

-- CREATE POLICY validates relations at parse time. On empty CLI (--no-seed)
-- host RBAC tables are absent, matching the established no-op pattern.
DO $$
BEGIN
  IF to_regclass('public.user_profile_roles') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.module_permissions') IS NULL
     OR to_regclass('public.system_modules') IS NULL
     OR to_regclass('public.system_actions') IS NULL THEN
    RAISE NOTICE 'RBAC ausente: se omiten policies estaciones_vias_sentido (ok en CLI vacío)';
    RETURN;
  END IF;

  EXECUTE $pol$
    CREATE POLICY estaciones_vias_sentido_authenticated_select
      ON public.estaciones_vias_sentido
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profile_roles upr
          JOIN public.role_permissions rp ON rp.role_id = upr.role_id
          JOIN public.module_permissions mp ON mp.id = rp.module_permission_id
          JOIN public.system_modules sm ON sm.id = mp.module_id
          JOIN public.system_actions sa ON sa.id = mp.action_id
          WHERE upr.user_id = (SELECT auth.uid())
            AND sm.name = 'peajes'
            AND sa.name IN ('read', 'manage')
        )
      )
  $pol$;

  EXECUTE $pol$
    CREATE POLICY estaciones_vias_sentido_authenticated_write
      ON public.estaciones_vias_sentido
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profile_roles upr
          JOIN public.role_permissions rp ON rp.role_id = upr.role_id
          JOIN public.module_permissions mp ON mp.id = rp.module_permission_id
          JOIN public.system_modules sm ON sm.id = mp.module_id
          JOIN public.system_actions sa ON sa.id = mp.action_id
          WHERE upr.user_id = (SELECT auth.uid())
            AND sm.name = 'peajes'
            AND sa.name IN ('create', 'manage')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profile_roles upr
          JOIN public.role_permissions rp ON rp.role_id = upr.role_id
          JOIN public.module_permissions mp ON mp.id = rp.module_permission_id
          JOIN public.system_modules sm ON sm.id = mp.module_id
          JOIN public.system_actions sa ON sa.id = mp.action_id
          WHERE upr.user_id = (SELECT auth.uid())
            AND sm.name = 'peajes'
            AND sa.name IN ('create', 'manage')
        )
      )
  $pol$;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estaciones_vias_sentido TO authenticated;
GRANT ALL ON public.estaciones_vias_sentido TO service_role;

COMMENT ON TABLE public.estaciones_vias_sentido IS
  'Provider station/lane direction map. Only explicit IDA/VUELTA values are accepted; AMBAS is never inferred.';
