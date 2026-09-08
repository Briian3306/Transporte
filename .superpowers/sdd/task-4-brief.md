# Task 4 RED — workbook ETL Node tests only

Read this first. Tasks 2–3 schema/pointer are review-approved. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Files you may create/modify:**
- Create: `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs`
- Modify: `ibarra-app/scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs`

**Files you must not create/edit:**
- `migrate-tarifario-v2.mjs` (write agent, GREEN)
- `match-tarifario-last.mjs` (write agent owns production matcher)
- `supabase/scripts/validar_migracion_tarifario_v2.sql` (GREEN, needs local data)
- migrations, product docs, Angular
- `out/auditoria-catalogo-20260904.xlsx` (do not overwrite)

**Workbook source (read-only):** `ibarra-app/scripts/peajes-catalogo-audit/out/tarifario-last-cruzado.xlsx`

## Failing tests to add

Run from `ibarra-app`:
```
node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs
```
New assertions must FAIL until GREEN implements the parser/matcher. Existing matcher tests may still pass — do not break them unless you are adding a new required case.

Cover:

1. **Workbook IDs:** `tarifas` sheet IDs remain parent `tarifas.id`. Validate UUID syntax and uniqueness.
2. **Direction:** `sentido` is `IDA` | `VUELTA` | `AMBAS` only. `AMBAS` is a real value, not unknown.
3. **One-to-one lineage:** one legacy `tarifas_normalizadas.id` maps to at most one amount row; one history ID maps to one parent. Reject if a workbook parent ID collides with a different configuration key, or a Cross `TARIFA_ID` does not exist.
4. **`PRECIO_LAST` preservation:** audited Cruzado current amount is the source of truth; never rewrite it to make a comparison pass. Observed example: `31427.15` vs `31500.00` (0.23%) is a match under 1% tolerance, not a reason to change `PRECIO_LAST`.
5. **Cross-only amounts:** if no exact historical line exists, create a fresh UUID history row with null lineage; `LAST_UPDATED` is `fecha_aparicion`; that row becomes current.
6. **1% inclusive tolerance** in `match-tarifario-last` tests: exact match, 0.23% example, exactly 1%, and greater than 1% (must not match). Formula: `abs(compared_price - importe) / importe <= 0.01`.
7. **Fail closed:** mismatched IDs/keys abort; do not invent parents.
8. **Reconciliation report shape** (assert the builder/API, not a written xlsx in migrations): parent ID, historical ID, legacy ID, audited amount, chosen pointer, source timestamp. Report must not live in `supabase/migrations/` and must not overwrite the 20260904 audit workbook.

Keep tests isolated with small fixtures where possible. If you must read the real workbook, treat it as read-only.

## Hard constraints

- Do not remove `tarifas_normalizadas`.
- ETL in GREEN must not run a remote data write. Tests must not call DESARROLLO.
- Do not commit.
- TDD: new tests fail because the ETL module is missing or the matcher lacks the new cases — not because the test file cannot parse.

## Report

Write `.superpowers/sdd/task-4-report.md` with TDD RED evidence. No GREEN yet.
