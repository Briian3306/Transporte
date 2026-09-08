# Task 3 GREEN — current pointer + immutable history (SQL only)

Read this first. RED pgTAP (tests 119–132, `plan(132)`) is review-approved. Implement production SQL only.

**Owner:** Backend write  
**Files:**
- Create: `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql`
- Do **not** edit `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Do **not** edit `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql`
- Do **not** edit product docs, ETL, or Angular

## Implement exactly

1. Composite FK `(tarifas.id, tarifas.current_tarifa_id) → tarifa_importe(tarifa_id, id)`. Unique `(tarifa_id, id)` already exists. Pointer may be NULL (MATCH SIMPLE / deferred as needed for bootstrap insert-then-promote). A row must not point at another tariff’s amount.

2. `BEFORE UPDATE OR DELETE` on `tarifa_importe`: reject DELETE; reject updates to **all business columns** (not only `importe`: `tarifa_id`, `importe`, `importe_base`, `desvio`, `hora_*`, `categoria_calculated`, `fecha_aparicion`, `tarifas_normalizadas_id`). Corrections append a new row. Reviewer note: tests probe `importe` + DELETE of a non-current row; the trigger must still lock the other business columns.

3. `AFTER INSERT` promotion: compare `(fecha_aparicion, created_at, id)` with the parent’s current row. Promote only a **strictly later** tuple. Copy the selected row’s `fecha_aparicion` to `tarifas.fecha_actualizacion`. First insert on a NULL pointer promotes. Earlier insert never demotes. Equal-date ordering is the full tuple.

4. Verify conceptually (and with the existing tests): no `tarifas` row can reference an amount belonging to another tariff.

## Hard constraints

- Do not remove or alter `tarifas_normalizadas` or existing FKs.
- Do not edit already-applied migrations.
- Local CLI only. No DESARROLLO. No commit.
- If tests fail because SQL is wrong, fix SQL. If they fail because a test is wrong, stop (BLOCKED) — do not change tests.

## Verify

From `ibarra-app`:
```
npx supabase db reset --local --no-seed
npx supabase test db --local
```
Expect PASS including `peajes_f14_tarifas_importe_test.sql` (`plan(132)`) and existing suites.

## Report

Append GREEN evidence to `.superpowers/sdd/task-3-report.md`.
