# F14-18 Task 4 report

**Status:** complete (GREEN)

## What shipped

- `peajes_guardar_refresco_tarifas(jsonb)` in `ibarra-app/supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql`
  - Two-pass validate-then-mutate; `FOR UPDATE` on existing identity
  - Missing identity requires explicit boolean `requiere_normalizacion_iva` (JSON `null` / omitted rejected as `P0001`)
  - Exact current importe → `SIN_CAMBIO`; otherwise append `tarifa_importe` with `fecha_aparicion = now()`
  - Existing IVA flag is never updated; JSON result keeps explicit `anterior` / `tarifa_importe_id` nulls
- Angular wrappers `prepararRefresco` / `detectarRefresco` / `guardarRefresco` in `peajes-tarifario.service.ts`

## Tests

- `npx supabase test db` from `ibarra-app` → **Files=16 Tests=467 PASS** (refresh suite 40/40)
- `pnpm.cmd exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless` → **7 SUCCESS** (prior session)

pgTAP tests 31–32 must run the RPC into a temp table before asserting side effects; uncorrelated scalar subqueries in the same `SELECT` as the RPC were planned as InitPlans and saw pre-write state.

## Constraints

No DESARROLLO writes. No commit.
