# Task 8 Report — compatibility readers pgTAP (RED only)

**Status:** DONE  
**Owner:** Backend tester  
**Date:** 2026-09-08  
**Commits:** none (forbidden)

## What you implemented

Added failing pgTAP for F14-16 Task 8 compatibility readers. No production migration, no view, no Angular, no product docs.

New cases in `peajes_f14_tarifas_importe_test.sql` (`plan(176)`, was 165). Tests **1–165** kept.

**Still available (PASS on RED — no DROP):**

| # | Assertion |
|---|---|
| 166 | `has_function` `peajes_normalizar_tarifas(uuid)` |
| 167 | `has_function` `peajes_recalcular_tarifas(uuid)` |
| 168 | `has_function` `peajes_confirmar_status_tarifa(jsonb)` |
| 169 | `has_view` `pwbi_tarifas` |
| 170 | `pwbi_tarifas` viewdef still reads `tarifas_normalizadas` and does not mention `tarifa_importe` |

**Missing v2 (FAIL on RED):**

| # | Assertion |
|---|---|
| 171 | `has_view` `public.pwbi_tarifas_v2` |
| 172 | Required columns: `Tarifa_ID`, `Peaje_ID`, `Estacion_ID`, `Categoria`, `Sentido`, `Status`, `Importe`, `Current_Tarifa_ID` |
| 173 | `anon` SELECT on `pwbi_tarifas_v2` (catalog lookup) |
| 174 | `authenticated` SELECT on `pwbi_tarifas_v2` (catalog lookup) |
| 175 | `SELECT` does not raise `undefined_table` (`42P01`) |
| 176 | Current `Importe` via `tarifas.current_tarifa_id` (9999, not historial 1111, not decoy TN 5555) plus peaje/estación/categoría/sentido/status |

Optional Power BI suite (`peajes_pwbi_views_test.sql`, `plan(45)`, was 41): tests **42–45** demand `pwbi_tarifas_v2` + columns `Tarifa_ID` / `Importe` / `Sentido`. Existing `pwbi_tarifas` assertions and combined `pwbi_*` GRANT groups were **not** changed.

Helper `pg_temp.pwbi_tarifas_v2_row()` catches `undefined_table` (`42P01`) and `undefined_column` (`42703`) so missing view TAP-fails instead of aborting the file (`Wstat: 0`).

Fixtures use dedicated `168…` UUIDs (station, decoy TN, tarifas, two history rows). Do **not** load the Cruzado workbook.

Wished-for contract (GREEN):

| Object | Kind | Contract |
|---|---|---|
| `pwbi_tarifas_v2` | VIEW | `tarifas` JOIN `tarifa_importe` on `current_tarifa_id`; PascalCase columns above; GRANT SELECT `anon` / `authenticated` / `service_role` |
| `pwbi_tarifas` | existing VIEW | Unchanged; still `tarifas_normalizadas` |
| `peajes_normalizar_tarifas(uuid)` | RPC | Signature unchanged |
| `peajes_recalcular_tarifas(uuid)` | RPC | Signature unchanged |
| `peajes_confirmar_status_tarifa(jsonb)` | RPC | Signature unchanged |

No new RPC. No DROP of legacy tables, FKs, triggers, or `pwbi_tarifas`.

Did **not** create `ibarra-app/supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql`.  
Did **not** alter `pwbi_tarifas`.  
Did **not** edit ETL / Angular / product docs / `feature_list.json`.  
Did **not** unskip the Node `splitSentidoCollisions` test.

## What you tested

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`.

First `npx supabase test db` on the dirty Task 7 catalog DB collided AUSOL/estación fixtures (expected). Official RED evidence is after local reset:

```powershell
cd ibarra-app
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db
```

**Result:** FAIL (expected RED). Exit 1. **Wstat: 0** (files parse). Files=14, Tests=412.

Twelve existing files `ok`. Only the two Task 8 files failed:

- `peajes_f14_tarifas_importe_test.sql` — **176 tests, 6 failed, 170 passed**. Failed: **171–176**. Tests **1–170** pass (1–165 Task 2–7 + 166–170 legacy RPC / `pwbi_tarifas`).
- `peajes_pwbi_views_test.sql` — **45 tests, 4 failed, 41 passed**. Failed: **42–45**. Existing `pwbi_tarifas` tests 1–41 still pass.

## TDD Evidence

**RED command (official):**

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

**Date:** 2026-09-08  
**Result:** FAIL. Exit 1. Files=14, Tests=412.

**Why this failure is expected:** `pwbi_tarifas_v2` is missing. Failures are missing view, not SQL syntax:

| # | Assertion | Observed |
|---|---|---|
| 171 | `has_view` `pwbi_tarifas_v2` | View does not exist |
| 172 | Required columns count = 8 | `ok` false (0 columns) |
| 173–174 | anon/authenticated SELECT | `ok` false (`COALESCE` catalog miss) |
| 175 | SELECT does not raise `42P01` | `have: 42P01, want: NULL` |
| 176 | Current importe + identity from `tarifas` | `ok` false — helper returned `_sqlstate=42P01` |
| pwbi 42–45 | `has_view` / `has_column` | Relation does not exist |

Tests 166–170 PASS: legacy RPCs and `pwbi_tarifas` still present.

**GREEN:** not this dispatch. Backend write adds `20260907103000_peajes_tarifas_v2_compat_cutover.sql` after this RED review is Approved.

## Files changed

1. `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` — Task 8 cases; `plan(176)`
2. `ibarra-app/supabase/tests/peajes_pwbi_views_test.sql` — parallel `pwbi_tarifas_v2` only; `plan(45)`
3. `.superpowers/sdd/task-8-brief.md` — wished-for contract
4. `.superpowers/sdd/task-8-report.md` — this report
5. `.superpowers/sdd/progress.md` — Task 7 complete; Task 8 RED waiting review

Did **not** create a Task 8 migration.  
Did **not** edit product docs, ETL, or Angular.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.  
Did **not** alter `pwbi_tarifas`.

## Self-review findings

- Completeness: parallel v2 view, legacy RPC signatures, `pwbi_tarifas` unchanged, current importe via pointer (not historial, not TN).
- Missing-view failures wrapped (`pg_temp.pwbi_tarifas_v2_row`) so Wstat stays 0; TAP shows `have: 42P01`.
- Hard constraint: tests 1–165 still pass; `tarifas_normalizadas` not dropped; `pwbi_tarifas` still planned.
- YAGNI: no production SQL.

## Issues or concerns

None blocking. Notes for the write agent:

1. Name locked: **VIEW** `public.pwbi_tarifas_v2` — not a table, not `CREATE OR REPLACE` of `pwbi_tarifas`.
2. Read `tarifas` + `tarifa_importe` via `tarifas.current_tarifa_id`. Do not source `Importe` from `tarifas_normalizadas`.
3. Quoted PascalCase columns: `Tarifa_ID`, `Peaje_ID`, `Estacion_ID`, `Categoria`, `Sentido`, `Status`, `Importe`, `Current_Tarifa_ID`.
4. GRANT SELECT to `anon`, `authenticated`, `service_role` (Power BI Data API). Existing `pwbi_*` use `security_invoker = false`.
5. Leave `peajes_normalizar_tarifas(uuid)`, `peajes_recalcular_tarifas(uuid)`, `peajes_confirmar_status_tarifa(jsonb)` signatures unchanged. No DROP.
6. Do not DROP `tarifas_normalizadas`, its FKs, triggers, or `pwbi_tarifas`.
7. Local-only. No `apply_migration` / `db push --linked` / DESARROLLO.
8. Do not unskip Node `splitSentidoCollisions remaps the second sentido onto a new parent id` (Task 9).
