# Task 7 RED — lineage backfill pgTAP only

Read this first. Tasks 2–6A are review-approved. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Skills:** `ibarra-app/.agents/skills/backend-tester/SKILL.md` plus TDD. All SQL against **Supabase CLI local**. Never DESARROLLO.

**Files you may modify:**
- `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Files you must not create/edit:**
- migrations (no Task 7 migration in RED; backfill is a function/script GREEN will add)
- `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs` (GREEN)
- `supabase/scripts/validar_migracion_tarifario_v2.sql` (GREEN — PRECIO_LAST stub stays until GREEN)
- Angular / Paso 8 / product docs / `feature_list.json`

Keep Tasks 2–6 assertions green (`plan(N)` bump only for new tests). Do not break the hard constraint: `tarifas_normalizadas` stays; `pasadas.tarifa_normalizada_id` never rewritten by this backfill.

## Behavior the tests must demand

GREEN will implement a local-only RPC/function (suggested name, match this unless you have a strong reason):

`peajes_backfill_pasadas_tarifa_importe()`  
(no args, or a jsonb filter if you need it for fixtures — document the wished-for signature in the report)

It must:

1. **One-to-one lineage backfill.** Where `pasadas.tarifa_normalizada_id` equals exactly one `tarifa_importe.tarifas_normalizadas_id`, set `pasadas.tarifa_importe_id` to that history row’s `id` (lineage keeps `id = tarifas_normalizadas_id`).
2. **Unmatched left null.** No lineage row, or non-unique mapping → leave `tarifa_importe_id` null. Do not invent a `tarifa_importe` row.
3. **Zero mutation of `tarifas_normalizadas`.** Row count, ids, and business columns unchanged. Every original `pasadas.tarifa_normalizada_id` preserved (including unmatched rows).
4. **Idempotent.** Running twice does not change already-filled unique matches and still leaves unmatched null.
5. **Does not** update `tarifa_normalizada_id`, current pointers, or insert history.

Use fixture inserts in the existing test file (same UUID style as Task 6). Do **not** load the real Cruzado workbook in pgTAP.

Preferred RED style: tests call the missing function so pgTAP fails because the RPC/function is absent (or `has_function` fails), not because of SQL syntax errors in the test file. Existing Task 2–6 tests must still be planned and remain intended-green.

## Verify RED

From `ibarra-app`:

```
npx supabase start
npx supabase test db
```

If local DB is already up, `npx supabase test db` is enough. Expected: suite fails on the new backfill tests; Task 2–6 tests stay passing. Record `plan(N)`, files, FAIL reason.

Do **not** run `db reset --linked`, `db push --linked`, `apply_migration`, or any DESARROLLO command.

No commit.

## Report

Write `.superpowers/sdd/task-7-report.md` with TDD RED evidence (command, date, exit code, which tests failed and why that is expected).
