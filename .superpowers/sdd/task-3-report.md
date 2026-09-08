# Task 3 Report — immutable history + current pointer (RED only)

**Status:** DONE  
**Owner:** Backend tester  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Added failing pgTAP for F14-16 Task 3 behavior to the existing Task 2 suite. No production migration, no ETL, no Angular, no product docs.

New cases (tests 119–132) demand, verbatim from the brief:

1. **Composite parent-pointer FK** `(tarifas.id, tarifas.current_tarifa_id) → tarifa_importe(tarifa_id, id)` (catalog) plus a **cross-parent pointer** `UPDATE` that must fail with `23503`.
2. **Immutable history:** `UPDATE` of `importe` and `DELETE` of a **non-current** history row must throw. Non-current DELETE is required so GREEN cannot satisfy it with the composite FK alone.
3. **Insert promotion:** first history row sets `current_tarifa_id` and copies `fecha_aparicion` to `tarifas.fecha_actualizacion`.
4. **Later promotion:** a strictly later `(fecha_aparicion, created_at, id)` tuple promotes pointer and `fecha_actualizacion`.
5. **Earlier non-demotion:** an earlier tuple leaves pointer and `fecha_actualizacion` unchanged.
6. **Stable equal-date ordering:** same `fecha_aparicion` compares `created_at` then `id` (later `created_at` wins even with a smaller id; equal `created_at` uses later id; earlier of either does not demote).

`plan(132)` (was 118). All 118 Task 2 assertions kept. `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id` still asserted.

Did **not** create `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql`.  
Did **not** edit `20260907100000_peajes_tarifas_v2_schema.sql`.

## What you tested

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`. Reset not needed: local schema already includes Task 2 `20260907100000_peajes_tarifas_v2_schema.sql`.

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL (expected RED). Exit 1. **Wstat: 0** (file parses). Files=14, Tests=364.

Thirteen existing files `ok`. Only `peajes_f14_tarifas_importe_test.sql` failed: **132 tests, 14 failed, 118 passed**.

Failed tests: **119–132** (all new Task 3 cases). Tests 1–118 (Task 2) still pass.

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL. `peajes_f14_tarifas_importe_test.sql` — Failed tests: 119–132. Wstat: 0.

**Why this failure is expected:** Task 3 triggers/constraints are missing. Failures are missing behavior, not SQL syntax:

| # | Assertion | Observed (Task 2 schema) |
|---|---|---|
| 119 | Composite FK `(id, current_tarifa_id) → (tarifa_id, id)` | `ok` false — constraint absent |
| 120 | First insert promotes pointer | `have: NULL, want: …000000000060` |
| 121 | First insert copies `fecha_aparicion` | `have: 2026-01-01, want: 2026-07-01` |
| 122 | Later tuple promotes pointer | `have: NULL, want: …000000000061` |
| 123 | Later promotion copies `fecha_aparicion` | `have: 2026-01-01, want: 2026-08-01` |
| 124 | Earlier insert does not demote | `have: NULL, want: …000000000061` |
| 125 | Earlier insert leaves `fecha_actualizacion` | `have: 2026-01-01, want: 2026-08-01` |
| 126 | Cross-parent pointer rejected (`23503`) | `caught: no exception, wanted: 23503` |
| 127 | History `UPDATE importe` rejected | `caught: no exception, wanted: an exception` |
| 128 | History `DELETE` (non-current row) rejected | `caught: no exception, wanted: an exception` |
| 129 | Equal date: later `created_at` promotes | `have: NULL, want: …000000000090` |
| 130 | Equal date: earlier `created_at` does not demote | `have: NULL, want: …000000000090` |
| 131 | Equal date+`created_at`: later `id` promotes | `have: NULL, want: …0000000000a1` |
| 132 | Equal date+`created_at`: earlier `id` does not demote | `have: NULL, want: …0000000000a1` |

Existing suites still green (legacy F14 including `peajes_f14_fecha_aparicion_test.sql` and `peajes_f14_test.sql`).

**GREEN:** not this dispatch. Backend write adds `20260907101000_peajes_tarifas_v2_current_pointer.sql` after this RED evidence.

## Files changed

1. `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` — Task 3 cases appended; `plan(132)`
2. `.superpowers/sdd/task-3-report.md` — this report

Did **not** create `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql`.  
Did **not** edit the Task 2 migration.  
Did **not** edit product docs, ETL, or Angular.  
Did **not** commit.

## Self-review findings

- Completeness: cross-parent pointer, rejected UPDATE/DELETE, later promotion, earlier non-demotion, equal-date (`created_at` then `id`) all present.
- DELETE targets a non-current history row so GREEN must implement the immutability trigger, not only the composite FK.
- Equal-date `created_at` test uses a **smaller** id on the later `created_at` row so GREEN cannot pass by comparing `id` first.
- Hard constraint: Task 2 `tarifas_normalizadas` / `pasadas.tarifa_normalizada_id` assertions untouched.
- YAGNI: no RPCs, no IVA arithmetic, no ETL.

## Issues or concerns

None blocking. Note for the write agent:

1. Cross-parent `throws_ok` expects SQLSTATE `23503` (composite FK), not a generic `RAISE`.
2. History UPDATE/DELETE `throws_ok` accepts any exception (`NULL` errcode) so GREEN may choose the trigger SQLSTATE.
3. Promotion tests set explicit `created_at` (not `now()`) so equal-date ordering is deterministic.
4. Sentinel `tarifas.fecha_actualizacion = 2026-01-01` distinguishes “not copied” from a successful copy of `fecha_aparicion`.

---

# Task 3 GREEN — current pointer + immutable history (SQL only)

**Status:** DONE  
**Owner:** Backend write  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql` only.

1. Composite FK `tarifas_current_pointer_fkey`: `(tarifas.id, current_tarifa_id) → tarifa_importe(tarifa_id, id)` with `MATCH SIMPLE` so a NULL pointer is valid until the first history insert. Cross-parent pointer raises `23503`.
2. `BEFORE UPDATE OR DELETE` trigger `trg_tarifa_importe_immutable`: rejects DELETE and updates to business columns (`tarifa_id`, `importe`, `importe_base`, `desvio`, `hora_*`, `categoria_calculated`, `fecha_aparicion`, `tarifas_normalizadas_id`) plus identity/`created_at`. SQLSTATE `23514`. `updated_at` remains writable.
3. `AFTER INSERT` trigger `trg_tarifa_importe_promote`: locks the parent `tarifas` row, promotes a NULL pointer on first insert, otherwise promotes only a strictly later `(fecha_aparicion, created_at, id)` tuple and copies `fecha_aparicion` to `tarifas.fecha_actualizacion`. Earlier tuples never demote.

Did **not** edit `peajes_f14_tarifas_importe_test.sql`.  
Did **not** edit `20260907100000_peajes_tarifas_v2_schema.sql`.  
Did **not** remove `tarifas_normalizadas`.  
Did **not** write DESARROLLO. Did **not** commit.

## GREEN evidence

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db --local
```

**Reset:** PASS. Applied `20260907101000_peajes_tarifas_v2_current_pointer.sql` after Task 2 schema. No DESARROLLO.

**Tests:** PASS. Exit 0. Files=14, Tests=364. All files `ok`, including `peajes_f14_tarifas_importe_test.sql` (`plan(132)`, tests 119–132 now green).

## Files changed (this dispatch)

1. `ibarra-app/supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql` — created
2. `.superpowers/sdd/task-3-report.md` — GREEN evidence appended

## Issues or concerns

None. Local CLI only.
