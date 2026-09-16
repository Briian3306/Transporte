-- Agregados del dashboard de stock: 1 fila de métricas + conteo de alertas por depósito.
-- Evita bajar stock_depositos / movimientos / catálogo de insumos al navegador.

CREATE INDEX IF NOT EXISTS idx_movimientos_entrada_costo_insumo
  ON public.movimientos_stock (insumo_id, fecha DESC)
  WHERE tipo = 'entrada'
    AND costo_unitario IS NOT NULL
    AND costo_unitario > 0;

CREATE OR REPLACE VIEW public.v_stock_dashboard_estadisticas
WITH (security_invoker = true) AS
WITH stock_agg AS (
  SELECT
    COUNT(DISTINCT insumo_id)::int AS total_insumos,
    COUNT(*) FILTER (WHERE cantidad_actual <= 0)::int AS items_criticos,
    COUNT(*) FILTER (
      WHERE cantidad_minima > 0
        AND cantidad_actual > 0
        AND cantidad_actual < cantidad_minima
    )::int AS items_bajo_minimo,
    COUNT(*) FILTER (
      WHERE cantidad_maxima > 0
        AND cantidad_actual > cantidad_maxima
    )::int AS items_sobre_maximo
  FROM public.stock_depositos
),
depositos_agg AS (
  SELECT COUNT(*)::int AS total_depositos
  FROM public.depositos
  WHERE activo IS TRUE
),
movimientos_agg AS (
  SELECT
    COUNT(*)::int AS movimientos_mes,
    COUNT(*) FILTER (WHERE tipo = 'entrada')::int AS entradas_mes,
    COUNT(*) FILTER (WHERE tipo = 'salida')::int AS salidas_mes,
    COUNT(*) FILTER (WHERE tipo = 'ajuste')::int AS ajustes_mes
  FROM public.movimientos_stock
  WHERE fecha >= date_trunc('month', now())
),
ultimo_costo AS (
  SELECT DISTINCT ON (insumo_id)
    insumo_id,
    costo_unitario
  FROM public.movimientos_stock
  WHERE tipo = 'entrada'
    AND costo_unitario IS NOT NULL
    AND costo_unitario > 0
  ORDER BY insumo_id, fecha DESC
),
valor AS (
  SELECT COALESCE(SUM(s.cantidad_actual * COALESCE(c.costo_unitario, 0)), 0)::numeric(14, 2) AS valor_total
  FROM public.stock_depositos s
  LEFT JOIN ultimo_costo c ON c.insumo_id = s.insumo_id
)
SELECT
  stock_agg.total_insumos,
  depositos_agg.total_depositos,
  valor.valor_total,
  stock_agg.items_criticos,
  stock_agg.items_bajo_minimo,
  stock_agg.items_sobre_maximo,
  movimientos_agg.movimientos_mes,
  movimientos_agg.entradas_mes,
  movimientos_agg.salidas_mes,
  movimientos_agg.ajustes_mes
FROM stock_agg
CROSS JOIN depositos_agg
CROSS JOIN movimientos_agg
CROSS JOIN valor;

COMMENT ON VIEW public.v_stock_dashboard_estadisticas IS
  'Métricas del dashboard de stock (agregados + valor por último costo de entrada). security_invoker=true.';

CREATE OR REPLACE VIEW public.v_stock_alertas_por_deposito
WITH (security_invoker = true) AS
SELECT
  deposito_id,
  COUNT(*) FILTER (WHERE cantidad_actual <= 0)::int AS criticos,
  COUNT(*) FILTER (
    WHERE cantidad_minima > 0
      AND cantidad_actual > 0
      AND cantidad_actual < cantidad_minima
  )::int AS bajo_minimo,
  COUNT(*) FILTER (
    WHERE cantidad_maxima > 0
      AND cantidad_actual > cantidad_maxima
  )::int AS sobre_maximo,
  COUNT(*) FILTER (
    WHERE cantidad_actual <= 0
      OR (cantidad_minima > 0 AND cantidad_actual > 0 AND cantidad_actual < cantidad_minima)
      OR (cantidad_maxima > 0 AND cantidad_actual > cantidad_maxima)
  )::int AS total_alertas
FROM public.stock_depositos
GROUP BY deposito_id;

COMMENT ON VIEW public.v_stock_alertas_por_deposito IS
  'Conteo de ítems críticos / bajo mínimo / sobre máximo por depósito. security_invoker=true.';

GRANT SELECT ON public.v_stock_dashboard_estadisticas TO anon, authenticated, service_role;
GRANT SELECT ON public.v_stock_alertas_por_deposito TO anon, authenticated, service_role;
