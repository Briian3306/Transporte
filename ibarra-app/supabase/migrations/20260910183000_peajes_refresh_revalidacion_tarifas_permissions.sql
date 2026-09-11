-- F14-20: The project grants EXECUTE to anon by default for public functions.
-- Keep price-refresh matching available only to signed-in callers.

REVOKE EXECUTE ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public._peajes_detectar_refresco_tarifas_precio(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_detectar_refresco_tarifas(jsonb) TO authenticated, service_role;
