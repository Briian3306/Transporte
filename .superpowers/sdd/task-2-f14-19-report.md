# Task 2 report — Add Validity and Diagnostic Schema with Safe Legacy Backfill

## What you implemented

Resumed interrupted Task 2 in place on `codex/tarifa-importe-cases` at HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9`. Did not recreate the migration; reused `ibarra-app/supabase/migrations/20260909181737_peajes_tarifa_vigencia_diagnostico.sql`.

Completed the schema/behavior specified by the brief:

- Nullable `tarifa_importe.fecha_vigencia_inicio date`, `fecha_vigencia_fin date`, `diagnostico text`.
- Named checks: six-value `diagnostico` domain (`MUESTRA_INSUFICIENTE`, `TARIFA_UNICA`, `CATEGORIA`, `POSIBLE_HORARIO`, `REVISAR`, `CONFIRMADO`) and `fecha_vigencia_fin IS NULL OR fecha_vigencia_inicio IS NULL OR fecha_vigencia_inicio < fecha_vigencia_fin`.
- Backfill **only** `diagnostico` via exact `tarifas_normalizadas_id` lineage. Validity dates stay `NULL`.
- `btree_gist` in schema `extensions`. Partial GiST exclusion `tarifa_importe_vigencia_confirmada_excl` on `tarifa_id WITH =` and `daterange(fecha_vigencia_inicio, COALESCE(fecha_vigencia_fin, 'infinity'::date), '[)') WITH &&`, limited to `diagnostico = 'CONFIRMADO' AND fecha_vigencia_inicio IS NOT NULL`.
- Replaced `peajes_trg_tarifa_importe_immutable()`: amount, parent, calculated category, cases, observation date, diagnostic, start date, lineage, and creation time stay immutable. Only one `fecha_vigencia_fin: NULL → non-NULL` transition is allowed (date check still enforced by the table CHECK).
- Replaced `peajes_trg_tarifa_importe_promote()`: only `CONFIRMADO` rows with a non-null start promote, ordered by `fecha_vigencia_inicio`. `REVISAR` and null-diagnostic inserts never move the pointer.
- `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id` were not altered.

Gaps filled in the dedicated pgTAP file:

- Explicit `has_column` / `col_type_is` / `col_is_null` for the three new columns (plan 41 → 50).
- Global assertion that every pre-existing validity date remains `NULL` after the lineage backfill (plan 51).

Compatibility follow-through (not in the brief file list, required so the suite did not get worse after the promote gate):

- Existing F14-16 / F14-17 / F14-18 / cases **direct INSERT fixtures** now insert `CONFIRMADO` with non-overlapping `[inicio, fin)` so current pointers still populate.
- After the first full-suite RED (guardar RPCs still inserted null diagnostic and no longer promoted), added `_peajes_append_tarifa_importe_confirmado()` and pointed `peajes_guardar_tarifas_actuales` / `peajes_guardar_refresco_tarifas` at it. That helper closes an open current row and appends `CONFIRMADO` with a non-overlapping start so existing writers keep advancing the pointer until Task 3 replaces those RPCs with explicit validity payloads.

Did not edit `tarifas_normalizadas`, `.pnpm-store/**`, the F14-18 `estaciones_vias_sentido` migrations, or F14-18 `task-N-report.md` files. Did not commit, amend, push, or deploy. Did not run `--linked` or any DESARROLLO write.

## What you tested and test results

All commands from `ibarra-app`, `npx supabase` only, `--local`.

| Command | Exit | Result |
|---|---|---|
| `npx supabase --version` | 0 | `2.111.0` |
| `npx supabase db reset --local --no-seed` (first, before shim) | 0 | Applied `20260909181737_peajes_tarifa_vigencia_diagnostico.sql`. No `--linked`. |
| `npx supabase test db --local supabase/tests/peajes_tarifa_vigencia_test.sql` | 0 | **Files=1, Tests=51, PASS** |
| `npx supabase test db --local` (after fixtures, before writer shim) | 1 | Files=18 Tests=547 FAIL. New F14-19 file 51/51 ok; F14-16 185/185 ok. RED caused by this task: refresh test 31; cases test 11; tarifario tests 11–12 (guardar no longer promoted). Baseline cases 13/16 still failing at that point. |
| `npx supabase db reset --local --no-seed` (after shim) | 0 | Migration applied, including writer shim. |
| `npx supabase test db --local supabase/tests/peajes_tarifa_vigencia_test.sql` | 0 | **Files=1, Tests=51, PASS** |
| `npx supabase test db --local` | 0 | **Files=18, Tests=547, PASS** (includes the new vigencia file). |
| `pnpm seed:local` | 1 | Auth/RBAC/pasadas seeds applied. `migrate-tarifario-v2.mjs --load-local` loaded catalog then failed parity: `null_current_pointers=27`, `directional_history_collisions=27`. See concerns. |

HEAD remained `95033bda8434b21473aa51937dfa8831acf0d3b9`. `supabase/.temp/project-ref` is still `kfffigvyvtzyczeiadxh`; no `db push --linked`, no `db reset --linked`, no MCP remote writes.

Compared with Task 1 baseline (Files=17 Tests=487 FAIL, 6 pre-existing): the suite is not worse. After reset + this task it is **Files=18 Tests=547 PASS**. The four refresh direction failures from Task 1 went away because `db reset` applied already-present working-tree `estaciones_vias_sentido` migrations (not edited here). Cases 13/16 also pass after the writer shim restored promotion through `guardar_refresco`.

## TDD Evidence

**Resumed interrupted work.** Production SQL for columns, checks, backfill, exclusion, immutable trigger, and promote trigger already existed on disk. Per controller: did not delete it to “start TDD over.” Missing dedicated-test column assertions were added after the schema existed, so they passed immediately on first run.

### RED (writer compatibility, new production SQL)

After fixture updates and the first reset, `npx supabase test db --local` **EXIT 1**. Failures caused by the new promote gate on existing writers that still `INSERT` without `diagnostico` / start:

- `peajes_refresh_tarifas_test.sql` test 31: `F14-18 guardar actualiza PICO y NO_PICO, preserva historial y avanza current`
- `peajes_tarifa_importe_cases_test.sql` test 11: `manual tariff save explicitly appends zero cases` (have 7, want 0 — pointer never moved)
- `peajes_tarifario_rpc_test.sql` tests 11–12: current still on 5500 instead of 5800

This failure was expected: `peajes_trg_tarifa_importe_promote()` correctly ignores null-diagnostic inserts, and Task 3 has not yet replaced the save RPCs.

Column assertions in `peajes_tarifa_vigencia_test.sql` were **not** watched as RED; schema already existed from the interrupted run.

### GREEN

After adding `_peajes_append_tarifa_importe_confirmado` and routing the two existing writers through it:

- `npx supabase test db --local supabase/tests/peajes_tarifa_vigencia_test.sql` → **51/51 PASS**
- `npx supabase test db --local` → **Files=18 Tests=547 PASS**

## Files changed

Task 2 product / test files:

- `ibarra-app/supabase/migrations/20260909181737_peajes_tarifa_vigencia_diagnostico.sql` (reused path; completed + writer compatibility helper)
- `ibarra-app/supabase/tests/peajes_tarifa_vigencia_test.sql` (new dedicated file; plan 51)
- `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` (9 column assertions already present from the interrupted run; fixtures updated for CONFIRMADO + non-overlapping intervals)
- `ibarra-app/supabase/tests/peajes_refresh_tarifas_test.sql` (fixture validity so detect/list still see current pointers)
- `ibarra-app/supabase/tests/peajes_tarifario_rpc_test.sql` (same)
- `ibarra-app/supabase/tests/peajes_tarifa_importe_cases_test.sql` (same)

Not edited by this task (pre-existing working-tree noise left as-is):

- `ibarra-app/supabase/migrations/20260908200033_peajes_estaciones_vias_sentido.sql`
- `ibarra-app/supabase/migrations/20260908200606_peajes_estaciones_vias_sentido_policy_fix.sql`
- `.pnpm-store/**`
- F14-16/F14-17/F14-18 `feature_list.json` evidence / F14-18 reports

`pnpm seed:local` rewrote `.superpowers/sdd/task-7-parity-report.md` / `.json` via the ETL default parity path. That was a seed side effect, not a Task 2 edit.

## Self-review findings

- Date check expression, six-value diagnostic domain, half-open `[inicio, fin)`, identity `(peaje_id, estacion_id, categoria, status, sentido)`, and `tarifas_normalizadas` non-touch match the brief verbatim.
- Dedicated test now has the required `has_column` / `col_type_is` / `col_is_null` trio for all three columns, plus lineage-only diagnostic backfill and “all pre-existing vigencia remain NULL.”
- Immutable trigger still allows `updated_at` and a single close of `fecha_vigencia_fin`. Closing before start is rejected by the table CHECK (`23514`), which the dedicated test covers.
- Writer shim is a compatibility bridge. Task 3 must replace `guardar_*` with explicit `fecha_vigencia_inicio` / `CONFIRM_NEW` vs `MARK_REVIEW` payloads and should not rely on `CURRENT_DATE` forever.
- Functions remain `SECURITY INVOKER`. Helper is `REVOKE`d from `PUBLIC` and granted to `authenticated, service_role`.

## Issues or concerns

1. **`pnpm seed:local` EXIT 1.** Catalog SQL loaded; parity gate failed with `null_current_pointers=27` and `directional_history_collisions=27` (same count). The ETL still assigns `current_tarifa_id` with a follow-up `UPDATE`, so this is likely the unresolved sentido-collision set rather than the promote trigger leaving every loaded row unpromoted. Auth/RBAC/pasadas did restore. Not fixed here (ETL / collision splitter is outside Task 2).
2. **Writer shim is extra scope** versus the brief’s file list. Needed so F14-17/F14-18 guardar tests (and the live save path) still advance current after the promote gate. Task 3 should replace it.
3. **Extra fixture files** (`peajes_refresh_tarifas_test.sql`, `peajes_tarifario_rpc_test.sql`, `peajes_tarifa_importe_cases_test.sql`) were updated so null-diagnostic inserts are no longer used as “current” fixtures. Brief listed only the F14-16 test as Modify; these edits were required to keep the suite from getting worse.
4. Task 1’s six pgTAP failures are gone after a real `db reset` (stale local DB at Task 1 never applied working-tree `estaciones_vias_sentido` migrations). This task did not edit those migrations.

## Confirmation

- No git commit, amend, push, or deploy.
- No DESARROLLO write (`--local` only; no `--linked`; no `db push`).
