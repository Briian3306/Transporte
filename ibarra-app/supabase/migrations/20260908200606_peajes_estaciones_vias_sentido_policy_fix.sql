-- Tighten the direction-map policies after the initial production rollout.
-- Keep SELECT separate from mutations so read-only users never inherit a
-- permissive write policy, and avoid a mutable trigger search_path.
CREATE OR REPLACE FUNCTION public.peajes_touch_estaciones_vias_sentido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_write
  ON public.estaciones_vias_sentido;
DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_insert
  ON public.estaciones_vias_sentido;
DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_update
  ON public.estaciones_vias_sentido;
DROP POLICY IF EXISTS estaciones_vias_sentido_authenticated_delete
  ON public.estaciones_vias_sentido;

CREATE POLICY estaciones_vias_sentido_authenticated_insert
  ON public.estaciones_vias_sentido
  FOR INSERT TO authenticated
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
  );

CREATE POLICY estaciones_vias_sentido_authenticated_update
  ON public.estaciones_vias_sentido
  FOR UPDATE TO authenticated
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
  );

CREATE POLICY estaciones_vias_sentido_authenticated_delete
  ON public.estaciones_vias_sentido
  FOR DELETE TO authenticated
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
  );
