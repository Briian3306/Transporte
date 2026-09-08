# Task 7 RED review — unique-lineage backfill pgTAP

Reviewer: task-scoped gate against `task-7-brief.md` + plan Task 7 RED checkbox. Did **not** re-run `npx supabase test db`. Reviewed the working-tree test file, the implementer report, and GREEN-absence greps. Reconstruct of the uncommitted test-file delta is in `review-task-7-red.diff` (git CLI unavailable here).

## Spec Compliance

- ✅ Spec compliant

RED-only pgTAP for `peajes_backfill_pasadas_tarifa_importe()` matches the dispatch contract. Tasks 2–6 stay at tests 1–155; `plan(165)` adds exactly the ten new cases. No backfill function, ETL load path, or parity report was implemented.

## Spec / file-scope check

Allowed file: `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`.

GREEN artifacts confirmed absent:

- No `peajes_backfill_pasadas_tarifa_importe` in `supabase/migrations/`, `scripts/`, or `src/`
- `migrate-tarifario-v2.mjs` still parse-only (no Postgres / `pasadas` writes)
- `validar_migracion_tarifario_v2.sql` still has the empty PRECIO_LAST stub
- No `20260908_*` migration; no DESARROLLO SQL

Task 6 block still ends at the approved association assertions; Task 7 is an append with dedicated `167…` fixtures. No Cruzado workbook load.

Hard constraints in the demanded contract: `tarifas_normalizadas` fingerprint + count; every `pasadas.tarifa_normalizada_id` preserved (including T6); no current-pointer rewrite; no history insert; T6 association FKs left as AL_DIA/HISTORICA/DESFASADO left them.

## Strengths

- Zero-arg signature is locked with `has_function(..., ARRAY[]::name[])` plus `PERFORM` (function, not a procedure).
- Helper catches only `undefined_function` (`42883`) so the file can finish (`Wstat: 0`) without turning “leave null / no mutation” into vacuous TAP passes on RED: tests 158–163 require first run `= 'ok'`.
- Positive 1:1 fill (two pasadas → one lineage `id = TN`) plus unmatched-null plus coincidental `tarifa_importe.id = TN` with `tarifas_normalizadas_id` null — that last case forbids joining on history `id` when lineage is missing.
- Idempotent retry: unique stays filled, unmatched/coincidental stay null; fill compares use `IS TRUE` so NULL TAP cannot look like a pass.
- Report TAP (`plan(165)`, 156–165 fail, 1–155 pass, Files=14 Tests=397) matches the ten new assertions and the missing-function failure mode. Non-unique lineage is honestly documented as un-fixtureable under the partial unique index, with GREEN still told to use `HAVING count(*) = 1`.

## Issues

### Critical

None.

### Important

None.

### Minor

1. **Retry does not re-assert TN / pointers / history count / T6 FKs.** After the second `PERFORM`, only pasada fill/null is checked (`peajes_f14_tarifas_importe_test.sql` ~2260–2288). A GREEN bug that mutates on the second call would slip past 162–163. Brief idempotency is about pasada FKs, so this is not blocking.

2. **No fixture where `tarifa_importe.id ≠ tarifas_normalizadas_id`.** Unique-fill rows use `id = TN`. GREEN could join `pasadas.tarifa_normalizada_id = tarifa_importe.id` *and* `tarifas_normalizadas_id IS NOT NULL` and still pass. Production lineage forbids that mismatch (ETL + validator); coincidental-id already blocks the dangerous null-lineage id join.

3. **Tests 158–160/163 still `ok(NULL)` on a no-op GREEN.** They rely on `run1 = 'ok' AND (tarifa_importe_id = uuid)`. A stub that exists but does not fill yields NULL, not FALSE. RED is clean because the gate is FALSE. Aligning with 165’s `IS TRUE` would make no-op GREEN fail more cleanly. Unique-fill (158) still blocks a full pass.

## Assessment

**Task quality:** Approved

**Reasoning:** The tests demand the brief’s backfill contract (zero-arg RPC, unique lineage fill, unmatched/coincidental left null, no invented history, zero TN mutation, preserve every `tarifa_normalizada_id`, idempotent, no pointer/history/T6 rewrite) and fail because the function is absent, not because of SQL syntax. Remaining plan Task 7 work (local ETL load, parity counts) is correctly still unimplemented and belongs to GREEN after this RED.

GREEN write notes (from the report, still valid): local-only `peajes_backfill_pasadas_tarifa_importe() → void`; join unique `pasadas.tarifa_normalizada_id = tarifa_importe.tarifas_normalizadas_id` (not coincidental `id`); never UPDATE `tarifa_normalizada_id`, never INSERT/UPDATE `tarifas_normalizadas`, never INSERT `tarifa_importe`, never rewrite `tarifas.current_tarifa_id`; no DESARROLLO / `apply_migration` / `db push --linked`.
