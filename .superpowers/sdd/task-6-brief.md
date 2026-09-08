# Task 6 RED — shadow resolver / validator pgTAP only

Read this first. Tasks 2–5 are review-approved. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Files:**
- Modify: `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Do **not** create `ibarra-app/supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`
- Do **not** edit Task 2/3 migrations, Angular adapter, ETL, or product docs
- Do **not** modify `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`, or their signatures

**Consumes:** Task 2 schema, Task 3 pointer, Task 5 IVA protocol (SQL receives both prices; no `/ 1.21`).  
**Produces (this dispatch):** failing pgTAP for missing RPCs.

## RPCs the tests must demand

- `peajes_resolver_tarifas_actuales(p_pasadas jsonb)` — batch, preserve caller row index; resolve peaje via `estaciones.peaje_id`; return configuration, `current_tarifa_id`, audited `importe`, `requiere_normalizacion_iva`.
- `peajes_validar_tarifas_actuales(p_pasadas jsonb)` — batch; choose direct vs supplied normalized price **only** from the flag; apply `abs(compared - importe) / importe <= 0.01`; never divide by 1.21.
- Idempotent post-confirmation association RPC that writes `pasadas.tarifa_importe_id` only for matching v2 rows (`AL_DIA` / `HISTORICA`); never updates `tarifa_normalizada_id` or tariff history.

## Matching / result codes

Direction: `IDA`/`VUELTA` exact first, then `AMBAS`. `AMBAS` matches only `AMBAS`.

Status: source `PICO`/`NO_PICO`, or uniquely resolvable across those two; never guess from `hora_*`. Absent/`PENDIENTE` with two candidates → `ESTADO_AMBIGUO`.

Outcomes (none mutate history):

| Code | When |
|---|---|
| `AL_DIA` | current importe matches within inclusive 1% |
| `HISTORICA` | a non-current immutable history amount matches within 1% |
| `DESFASADO` | neither; include audited amount, compared amount, relative error |
| `SIN_TARIFA` | missing configuration |
| `CATEGORIA_PENDIENTE` | missing/non-numeric calculated category |
| `ESTADO_AMBIGUO` | unresolved status |

## Failing cases to add

Keep Task 2–3 assertions green (`plan(N)` update). Add failing tests for:

1. Batch row-order preservation
2. `IDA` exact priority
3. `VUELTA` → `AMBAS` fallback
4. `AMBAS` exact-only (does not pick IDA/VUELTA)
5. Missing configuration → `SIN_TARIFA`
6. Ambiguous/missing status → `ESTADO_AMBIGUO`
7. Historical-price recognition → `HISTORICA`
8. Inclusive 1% (`exact`, `0.01`, `> 0.01`)
9. Validator uses supplied normalized price **only** when flag true; SQL of the future migration must contain no `/ 1.21` (you can assert via `pg_get_functiondef` once GREEN exists; for RED, the RPC-missing failure is enough, plus a test that will grep function source after GREEN)
10. Association RPC: AL_DIA/HISTORICA writes `tarifa_importe_id`; retry idempotent; `tarifa_normalizada_id` unchanged; does not insert history

New cases must fail because RPCs/functions are missing (`42883` or similar), not because the test file cannot parse. Task 2–3 tests stay green.

## Verify RED

From `ibarra-app`: `npx supabase test db --local` (reset if needed).

No DESARROLLO. No commit. Do not remove `tarifas_normalizadas`.

## Report

Write `.superpowers/sdd/task-6-report.md` with TDD RED evidence.
