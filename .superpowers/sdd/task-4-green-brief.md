# Task 4 GREEN — workbook ETL + 1% matcher (implementation only)

Read this first. RED Node tests are review-approved. Do not edit the test files.

**Owner:** Backend write  
**Files:**
- Create: `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs`
- Modify: `ibarra-app/scripts/peajes-catalogo-audit/match-tarifario-last.mjs`
- Create: `ibarra-app/supabase/scripts/validar_migracion_tarifario_v2.sql`
- Do **not** edit `migrate-tarifario-v2.test.mjs` or `match-tarifario-last.test.mjs`

**Consumes:** fixtures in the tests; workbook `out/tarifario-last-cruzado.xlsx` is read-only.  
**Produces:** fail-closed import payload + in-memory reconciliation report. **No remote data write.**

## Implement

1. Export `parseTarifarioV2({ tarifas, tarifas_importe, cruzado })` matching the RED tests (dynamic import from `./migrate-tarifario-v2.mjs`).
2. Parent IDs from `tarifas` sheet stay `tarifas.id`. Lineage rows keep `tarifa_importe.id = tarifas_normalizadas_id`. Cross `TARIFA_ID` must exist. Fail closed on invalid UUID, duplicate parent IDs, unknown `sentido`, 1:N lineage, missing Cross parent, colliding keys.
3. `PRECIO_LAST` is canonical current `importe`. Never rewrite it. Example 31427.15 vs 31500 stays as-is.
4. If an **exact** audited amount already exists for that parent, that row becomes `current_tarifa_id` (do not always append a duplicate). If not, append a Cross-only row: new UUID, null lineage, `fecha_aparicion = LAST_UPDATED`, select it as current.
5. Reconciliation report fields: `parent_id`, `historical_id`, `legacy_id`, `audited_amount`, `chosen_pointer`, `source_timestamp`. Do not write it into `supabase/migrations/`. Do not overwrite `auditoria-catalogo-20260904.xlsx`.
6. Matcher: `abs(compared_price - importe) / importe <= 0.01` inclusive. Use numeric `importe` (PRECIO_LAST) as denominator. Outcomes already used by tests (`AL_DIA` / `DESFASADO`).
7. `validar_migracion_tarifario_v2.sql`: integrity queries that return zero-mismatch counts (lineage 1:1, pointer belongs to parent, `PRECIO_LAST` vs current importe). Run it only against local CLI if practical; empty tables should report 0 mismatches. Do not `apply_migration` to DESARROLLO. Full workbook load into Postgres is Task 7.

## Hard constraints

- Do not remove `tarifas_normalizadas`.
- Do not commit. No DESARROLLO.
- If tests fail because implementation is wrong, fix implementation. If they fail because a test is wrong, stop (BLOCKED) — do not change tests.

## Verify

From `ibarra-app`:
```
node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs
```
Expect PASS (25 tests).

## Report

Append GREEN evidence to `.superpowers/sdd/task-4-report.md`.
