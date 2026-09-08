# Task 2 RED review — needs fixes before Backend write

Reviewer: d23ed4cc-8614-4252-bd88-f2e10d9f1663
Spec: ✅ (RED-only, no migration, tarifas_normalizadas proven)
Task quality: Needs fixes

No Critical. Three Important items must be patched in `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` before the write agent creates the migration.

## Must fix (Important)

1. **`VUELTA` is never accepted.** Add `lives_ok` (or equivalent) INSERTs of `sentido = 'VUELTA'` on both `tarifas` and `pasadas`. Keep existing rejects of invalid values (`NORTE`) and accepts of `IDA`/`AMBAS`. A CHECK that omits `VUELTA` must fail these tests.

2. **`tarifa_importe.created_at` / `updated_at` must assert `timestamptz` and `default now()`**, matching the `tarifas` timestamp assertions. Brief requires both columns `timestamptz not null default now()`.

3. **History index must require `id` (and `id DESC`).** The brief index is `(tarifa_id, fecha_aparicion desc, created_at desc, id desc)`. The current ILIKE check would pass a three-column index. Tighten so a missing `id DESC` fails.

## Do not

- Create or edit `20260907100000_peajes_tarifas_v2_schema.sql`
- Edit product docs, ETL, Angular
- Commit
- Remove `tarifas_normalizadas` assertions
- Add Task 3 pointer/immutability tests

## Covering tests

Re-run from `ibarra-app`:
```
npx supabase test db --local
```
(reset only if needed). Expect still RED: v2 tables missing. New VUELTA / timestamp / index assertions should fail for missing schema, not for test syntax. Existing 13 files still pass. Record command + relevant TAP in the report appendix.

Update `plan(N)` if the assertion count changes.
