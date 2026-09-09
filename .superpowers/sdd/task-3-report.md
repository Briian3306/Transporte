# Task 3 report — F14-18 batch prepare/detect RPCs

**Status:** complete (RED then GREEN). No commit. No DESARROLLO.

## RED

`npx supabase db reset --local --no-seed` then `npx supabase test db`

`peajes_refresh_tarifas_test.sql` failed: functions missing (`has_function` 1–3). F14-16 suite still green.

## GREEN

After `20260908150000_peajes_refresh_tarifas_paso9.sql`:

`npx supabase test db` → **Files=16 Tests=456 PASS** (refresh suite 29/29). Includes F14-16 `peajes_f14_tarifas_importe_test.sql`.

## What landed

- Private helper `_peajes_tarifas_montos_candidatos(uuid, smallint, text, text)`.
- `peajes_preparar_refresco_tarifas` / `peajes_detectar_refresco_tarifas` (SECURITY INVOKER, PUBLIC revoked).
- F14-16 `peajes_resolver_tarifas_actuales` and `peajes_validar_tarifas_actuales` rewritten onto the helper; public signatures and codes unchanged.
- Detect: current before history, inclusive 1%, direction/status rules, IVA via flag only (no `/ 1.21`).

## Note

`guardar` is Task 4. pgTAP-only this task (`--no-seed`); seed deferred until the app is needed.
