# Task 3 RED — immutable history + current pointer (tests only)

Read this first. Task 2 schema is review-approved and must stay. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Files:**
- Modify: `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Do **not** create `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql`
- Do **not** edit Task 2 migration `20260907100000_peajes_tarifas_v2_schema.sql`
- Do **not** edit product docs, ETL, or Angular

**Consumes:** Task 2 schema.  
**Produces (this dispatch):** Failing pgTAP for missing trigger/constraint behavior.

## Plan steps for the tester

- [ ] Add failing pgTAP cases for: a cross-parent pointer, a rejected history update/delete, later promotion, earlier non-demotion, and stable equal-date ordering.
- [ ] Run from `ibarra-app`: `npx supabase test db --local` (reset if needed). Confirm the **new** cases fail because the trigger/constraint behavior is missing, not because the test file cannot parse.
- [ ] Update `plan(N)` to match the new assertion count. Keep all Task 2 assertions passing.
- [ ] Do not apply anything to DESARROLLO. Do not commit.

## Behavior the tests must demand (Task 3 GREEN will implement)

From the F14-16 plan:

1. **Composite parent-pointer FK:** `(tarifas.id, tarifas.current_tarifa_id) → tarifa_importe(tarifa_id, id)`. A `tarifas` row cannot point at an amount belonging to another tariff. Unique `(tarifa_id, id)` already exists from Task 2.

2. **Immutable history:** `BEFORE UPDATE OR DELETE` on `tarifa_importe` rejects changes to business columns and rejects DELETE. Corrections append a new row. (`created_at`/`updated_at` audit: follow the plan — application updates to business columns are forbidden.)

3. **Insert promotion:** `AFTER INSERT` on `tarifa_importe` compares `(fecha_aparicion, created_at, id)` with the parent's current row. Promote only a **strictly later** tuple. Copy the selected row's `fecha_aparicion` to `tarifas.fecha_actualizacion`. An earlier insert never demotes the pointer. Equal-date ordering is stable via that full tuple (including `id`).

4. `current_tarifa_id` may still be null until a first history row is inserted (bootstrap). After a first insert, promotion should set it.

5. Targeted assertion: no `tarifas` row can reference an amount belonging to another tariff (cross-parent pointer must fail).

Do **not** implement RPCs, ETL, or IVA arithmetic. Do **not** remove `tarifas_normalizadas`.

## Hard constraints

- Keep `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id`.
- Local CLI only. No DESARROLLO.
- Do not commit.
- TDD: new cases fail for missing Task 3 behavior. Existing Task 2 tests must remain green on the Task 2 schema.

## Report

Write/append to `.superpowers/sdd/task-3-report.md` with TDD RED evidence (command, failing output, why expected). No GREEN yet.
