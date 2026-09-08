# Task 8 RED — compatibility readers pgTAP only

Read this first. Task 7 GREEN is **Approved** (coordinator). This dispatch is Backend tester RED only. Do **not** implement views/migrations.

**Owner (this dispatch):** Backend tester  
**Skills:** `ibarra-app/.agents/skills/backend-tester/SKILL.md` plus TDD. All SQL against **Supabase CLI local**. Never DESARROLLO.

**Files you may modify:**
- `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` (add failing tests; bump `plan(N)`)
- Optionally **add** failing assertions in `ibarra-app/supabase/tests/peajes_pwbi_views_test.sql` **only** for a new parallel `pwbi_tarifas_v2` — do **not** change existing `pwbi_tarifas` expectations

**Files you must not create/edit:**
- `supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql` (GREEN)
- Any other migration
- ETL / Angular / product docs / `feature_list.json`

Keep tests **1–165** green (`plan(N)` bump only for new tests). Do not unskip the Node `splitSentidoCollisions` test (Task 9). Do not remove `tarifas_normalizadas`. Do not alter `pwbi_tarifas`.

## Wished-for contract (GREEN)

Parallel v2 reader only. No DROP of legacy tables, FKs, triggers, RPC signatures, or `pwbi_tarifas`.

| Object | Kind | Role |
|---|---|---|
| `public.pwbi_tarifas_v2` | **VIEW** (not a table, not a rewrite of `pwbi_tarifas`) | Current configuration from `tarifas` + current amount from `tarifa_importe` via `tarifas.current_tarifa_id` |
| `public.pwbi_tarifas` | existing view | Unchanged; still `tarifas_normalizadas` + peajes + estaciones |
| `peajes_normalizar_tarifas(uuid)` | existing RPC | Signature unchanged (no DROP) |
| `peajes_recalcular_tarifas(uuid)` | existing RPC | Signature unchanged (no DROP) |
| `peajes_confirmar_status_tarifa(jsonb)` | existing RPC | Signature unchanged (no DROP) |

No new RPC is required for this cutover. Readers are the view.

### `pwbi_tarifas_v2` columns (quoted PascalCase, Power BI / Data API)

Enough to prove the view is not empty-schema vapor. GREEN must expose at least:

| Column | Source |
|---|---|
| `Tarifa_ID` | `tarifas.id` |
| `Peaje_ID` | `tarifas.peaje_id` |
| `Estacion_ID` | `tarifas.estacion_id` |
| `Categoria` | `tarifas.categoria` (smallint calculated, not raw TN text) |
| `Sentido` | `tarifas.sentido` (`IDA` / `VUELTA` / `AMBAS`) — **not** present on `pwbi_tarifas` |
| `Status` | `tarifas.status` (`PICO` / `NO_PICO`) |
| `Importe` | `tarifa_importe.importe` of the row `tarifas.current_tarifa_id` |
| `Current_Tarifa_ID` | `tarifas.current_tarifa_id` |

Join `tarifa_importe` on `tarifa_importe.id = tarifas.current_tarifa_id` (and `tarifa_importe.tarifa_id = tarifas.id`). Do **not** source `Importe` from `tarifas_normalizadas` or from a non-current history row.

Grants (match other `pwbi_*`): `SELECT` to `anon`, `authenticated`, `service_role`. `security_invoker = false` is the existing Power BI pattern; GREEN should follow it.

### What GREEN must not do

- DROP or rewrite `pwbi_tarifas`
- DROP `peajes_normalizar_tarifas` / `peajes_recalcular_tarifas` / `peajes_confirmar_status_tarifa` or change their argument types
- DROP `tarifas_normalizadas`, its FKs, triggers, or `pasadas.tarifa_normalizada_id`
- Treat `pwbi_tarifas_v2` as `SELECT * FROM pwbi_tarifas`

## Failing cases to add

Keep Task 2–7 assertions (`plan(165)` today). Add:

**Still available (these should PASS on RED):**

1. `has_function` `peajes_normalizar_tarifas(uuid)`
2. `has_function` `peajes_recalcular_tarifas(uuid)`
3. `has_function` `peajes_confirmar_status_tarifa(jsonb)`
4. `has_view` `pwbi_tarifas`
5. `pwbi_tarifas` viewdef still reads `tarifas_normalizadas` and does not mention `tarifa_importe`

**Missing v2 (these should FAIL on RED with missing view, not SQL syntax):**

6. `has_view` `public.pwbi_tarifas_v2`
7. Required columns listed above exist on that view
8. `anon` and `authenticated` have `SELECT` on `pwbi_tarifas_v2` (catalog lookup so missing view TAP-fails, no `42P01` abort)
9. Fixture read: current `Importe` via `current_tarifa_id` (not the older history amount, not a decoy TN amount), plus peaje / estación / categoría / sentido / status from `tarifas`

Helper must catch `undefined_table` (`42P01`) / `undefined_column` (`42703`) so the file still finishes (`Wstat: 0`). Fixtures: dedicated `168…` UUIDs (do not collide with Task 6 `166…` / Task 7 `167…`). Do not load the Cruzado workbook.

Optional in `peajes_pwbi_views_test.sql`: `has_view` / `has_column` for `pwbi_tarifas_v2` only. Leave every existing `pwbi_tarifas` assertion and the combined `pwbi_*` GRANT `ok()` groups untouched.

## Verify RED

From `ibarra-app`:

```
npx supabase start
npx supabase test db
```

If local DB already has Task 7 catalog load, prefer `npx supabase db reset --local --no-seed` then `test db` so AUSOL fixtures do not collide — but if reset would take very long and current `test db` already isolates transactions, `test db` alone is OK. Record which.

Expected: new v2-view tests FAIL (missing `pwbi_tarifas_v2`); tests 1–165 PASS; legacy RPC / `pwbi_tarifas` assertions among the new tests PASS.

Do **not** run `db reset --linked`, `db push --linked`, `apply_migration`, or any DESARROLLO command.

No commit.

## Report

Write `.superpowers/sdd/task-8-report.md` with TDD RED evidence (command, date, exit code, `plan(N)`, FAIL reason).

Update `.superpowers/sdd/progress.md`: Task 7 complete (GREEN Approved); Task 8 in_progress RED waiting review. Note Task 9 must unskip `splitSentidoCollisions remaps the second sentido onto a new parent id` and record empty-pasadas 0/0/0.
