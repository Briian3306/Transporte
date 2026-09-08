# Task 6 GREEN — shadow resolver / validator / association RPCs (SQL only)

Read this first. RED pgTAP (tests 133–155, `plan(155)`) is review-approved. Do not edit the test file.

**Owner:** Backend write  
**Files:**
- Create: `ibarra-app/supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`
- Do **not** edit `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Do **not** edit Task 2/3 migrations, Angular, ETL, or product docs
- Do **not** modify `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`, or their signatures

## RPCs (match RED helpers)

| RPC | Args | Returns |
|---|---|---|
| `peajes_resolver_tarifas_actuales` | `p_pasadas jsonb` `{idx, estacion_id, categoria, status?, sentido, fecha_hora?}` | jsonb `{idx, tarifa_id, current_tarifa_id, importe, peaje_id, sentido_aplicado, requiere_normalizacion_iva, codigo?}` |
| `peajes_validar_tarifas_actuales` | `p_pasadas jsonb` `{idx, tarifa_id, current_tarifa_id, importe, requiere_normalizacion_iva, precio_directo, precio_normalizado}` | jsonb `{idx, codigo, tarifa_importe_id?, importe, precio_comparado, error_relativo}` |
| `peajes_asociar_pasadas_tarifa_importe` | `p_asociaciones jsonb` `{pasada_id, tarifa_importe_id, codigo}` | void; only `AL_DIA`/`HISTORICA` update `pasadas.tarifa_importe_id` |

Preserve caller `idx` order. Batch, no N+1.

## Matching

1. `peaje_id` from `estaciones.peaje_id` (never add `pasadas.peaje_id`).
2. Direction: `IDA`/`VUELTA` exact first, then `AMBAS`. `AMBAS` matches only `AMBAS`. (Implement IDA→AMBAS fallback even if RED only tested VUELTA→AMBAS.)
3. Status `PICO`/`NO_PICO` or uniquely resolvable; never infer from `hora_*`. Else `ESTADO_AMBIGUO`.
4. Missing/non-numeric `categoria` → `CATEGORIA_PENDIENTE` (plan §8; implement even if RED did not assert it).
5. Missing config → `SIN_TARIFA`.
6. Current pointer `importe`: `AL_DIA` if `abs(compared - importe) / importe <= 0.01`. Non-current history match → `HISTORICA`. Else `DESFASADO` with audited, compared, relative error.
7. None of these mutate history.

## Validator IVA

Choose `precio_normalizado` only when `requiere_normalizacion_iva` is true; else `precio_directo`. **SQL source must not contain `/ 1.21` or `/1.21`.** Tests grep `pg_get_functiondef`.

## Association

Idempotent. Never update `tarifa_normalizada_id`. Never INSERT `tarifa_importe`. Ignore non-AL_DIA/HISTORICA.

## Hard constraints

- Do not remove `tarifas_normalizadas`.
- Local CLI only. No DESARROLLO. No commit.
- If tests fail because SQL is wrong, fix SQL. If they fail because a test is wrong, BLOCKED — do not change tests.

## Verify

From `ibarra-app`:
```
npx supabase db reset --local --no-seed
npx supabase test db --local
```
Expect PASS including `peajes_f14_tarifas_importe_test.sql` (`plan(155)`) and existing suites.

## Report

Append GREEN evidence to `.superpowers/sdd/task-6-report.md`. Confirm function defs have no `/ 1.21`.
