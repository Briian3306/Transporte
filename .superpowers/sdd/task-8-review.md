# Task 8 RED review — compatibility readers pgTAP

Reviewer: task-scoped gate against `task-8-brief.md` + plan Task 8 RED checkbox. Did **not** re-run `npx supabase test db`. Reviewed the working-tree test files, the implementer report, and GREEN-absence greps. Reconstruct of the uncommitted test-file delta is in `review-task-8-red.diff` (git CLI unavailable here).

## Spec Compliance

- ✅ Spec compliant

RED-only pgTAP for parallel `pwbi_tarifas_v2` matches the dispatch contract. Tasks 2–7 stay at tests 1–165; `plan(176)` adds eleven new cases (166–170 pass on RED, 171–176 fail). Optional Power BI suite is `plan(45)` with tests 42–45 only. No compatibility view, cutover migration, or product SQL was implemented.

## Spec / file-scope check

Allowed files:

- `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- `ibarra-app/supabase/tests/peajes_pwbi_views_test.sql` (v2 assertions only)

GREEN artifacts confirmed absent:

- No `pwbi_tarifas_v2` in `supabase/migrations/`, `scripts/`, or `src/`
- No `20260907103000_peajes_tarifas_v2_compat_cutover.sql` (or any equivalent cutover migration)
- `pwbi_tarifas` still defined from `tarifas_normalizadas` + peajes + estaciones
- Node `splitSentidoCollisions remaps the second sentido onto a new parent id` still skipped (Task 9)
- No DESARROLLO SQL; no `feature_list.json` / ETL / Angular edits in this dispatch

Task 7 block still ends at the approved unique-lineage backfill assertions; Task 8 is an append with dedicated `168…` fixtures. No Cruzado workbook load.

Hard constraints in the demanded contract: legacy RPCs `peajes_normalizar_tarifas(uuid)` / `peajes_recalcular_tarifas(uuid)` / `peajes_confirmar_status_tarifa(jsonb)` remain; `pwbi_tarifas` still exists and its viewdef still reads `tarifas_normalizadas` (not `tarifa_importe`); `has_view` (not table) for v2; GRANT catalog lookups use `relkind = 'v'`; fixture Importe via current pointer, not historial 1111, not decoy TN 5555.

Suite arithmetic matches the report without re-running pgTAP: fourteen `plan()` totals sum to **412**; Task 7 was 397; +11 f14 +4 pwbi = 412.

## Strengths

- Parallel reader is locked as a **VIEW** (`has_view` + GRANT `relkind='v'`), not a rewrite of `pwbi_tarifas`. Test 170 keeps the legacy view on `tarifas_normalizadas`.
- Quoted PascalCase set is complete in f14 test 172: `Tarifa_ID`, `Peaje_ID`, `Estacion_ID`, `Categoria`, `Sentido`, `Status`, `Importe`, `Current_Tarifa_ID`. `Sentido` is the discriminator vs `pwbi_tarifas`.
- Helper catches only `undefined_table` (`42P01`) and `undefined_column` (`42703`) so the file can finish (`Wstat: 0`). Tests 173–174 are catalog lookups (`COALESCE(..., false)`), so a missing view TAP-fails instead of aborting.
- Fixture traps wrapping `pwbi_tarifas` / reading TN: decoy TN at the same station is 5555 / `PENDIENTE` / `categoria` NULL; v2 parent is PICO / categoria 4 / IDA / Importe 9999 / `Current_Tarifa_ID` = later history `168…200`. Lookup is `tarifas.id`, not the TN id.
- Current pointer is populated by the existing Task 3 promote trigger (1111 then later 9999). Test 176 also requires `Current_Tarifa_ID = tarifas.current_tarifa_id`.
- Optional pwbi 42–45 were **not** folded into the combined `pwbi_*` GRANT `ok()` groups. Existing tests 1–41 unchanged.
- Report TAP (`plan(176)`, 171–176 fail, 1–170 pass; pwbi 42–45 fail; Files=14 Tests=412; `have: 42P01`) matches the new assertions and the missing-view failure mode.

## Issues

### Critical

None.

### Important

None.

### Minor

1. **Current pointer coincides with latest `fecha_aparicion`.** Historial 1111 is earlier than 9999, so GREEN could `JOIN` on `MAX(fecha_aparicion)` instead of `tarifa_importe.id = tarifas.current_tarifa_id` and still pass 176. Domain promote already keeps current = latest after inserts; a post-insert `UPDATE` of the pointer to the older sibling would lock the brief’s join. Not blocking.

2. **`service_role` SELECT and `security_invoker = false` are not asserted.** Brief GRANT list includes `service_role`; existing `pwbi_*` tests also only check `anon` / `authenticated`. GREEN notes already say to match the Power BI pattern.

3. **Test 175 is labeled “no 42P01” but also fails on `_sqlstate = no_row`.** A view that exists but does not return the fixture row fails 175 with `have: no_row`, not `42P01`. Test 176 still blocks a full pass. Fine for GREEN, slightly overloaded TAP name.

4. **No `pg_get_viewdef` on `pwbi_tarifas_v2`.** Behavior + PascalCase columns are enough; GREEN could still name the eight columns from a hardcoded one-row stub. The 168… identity plus TN/historial traps make that stub useless in practice.

## Assessment

**Task quality:** Approved

**Reasoning:** The tests demand the brief’s parallel v2 reader (VIEW `pwbi_tarifas_v2` over `tarifas` + current `tarifa_importe`, PascalCase columns, anon/authenticated SELECT, leftover legacy RPCs and `pwbi_tarifas`) and fail because the view is absent, not because of SQL syntax. Tasks 1–165 stay green on the same file; the cutover migration is correctly still unimplemented and belongs to GREEN after this RED.

GREEN write notes (from the report, still valid): local-only `CREATE VIEW public.pwbi_tarifas_v2` (not a table, not `CREATE OR REPLACE` of `pwbi_tarifas`) reading `tarifas` JOIN `tarifa_importe` on `ti.id = tarifas.current_tarifa_id` (and `ti.tarifa_id = tarifas.id`); quoted PascalCase columns above; GRANT SELECT to `anon`, `authenticated`, `service_role`; `security_invoker = false`; do not DROP `tarifas_normalizadas`, its FKs/triggers, `pasadas.tarifa_normalizada_id`, or the three legacy RPCs; do not unskip Node `splitSentidoCollisions`; no DESARROLLO / `apply_migration` / `db push --linked`.
