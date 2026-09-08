# Task 4 Report — workbook ETL + 1% matcher

**Status:** DONE (GREEN)  
**Owner:** Backend write (GREEN); Backend tester (RED)  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Added failing Node tests for F14-16 Task 4 ETL + 1% matcher. No production parser, no matcher logic change, no SQL, no Angular, no product docs.

New `migrate-tarifario-v2.test.mjs` demands, via `parseTarifarioV2({ tarifas, tarifas_importe, cruzado })`:

1. **Workbook IDs:** `tarifas` sheet IDs remain parent `tarifas.id`; UUID syntax and uniqueness. Invalid UUID and duplicate parent IDs abort.
2. **Direction:** `sentido` is `IDA` | `VUELTA` | `AMBAS`; `AMBAS` is a real value (not `''` / `null` / `UNKNOWN`). Unknown sentido aborts.
3. **One-to-one lineage:** `tarifa_importe.id = tarifas_normalizadas.id`; one legacy ID → two amount rows aborts; one history ID → two parents aborts; parent ID colliding with a different configuration key aborts; missing Cross `TARIFA_ID` aborts (no invented parent).
4. **`PRECIO_LAST` preservation:** current `importe` is `31500`, not `31427.15`.
5. **Cross-only amounts:** fresh UUID history row, `tarifas_normalizadas_id` null, `fecha_aparicion = LAST_UPDATED`, that row is current.
6. **Fail closed:** mismatched IDs/keys throw.
7. **Reconciliation report:** `parent_id`, `historical_id`, `legacy_id`, `audited_amount`, `chosen_pointer`, `source_timestamp`. In-memory API; `reportPath` (if present) must not live under `supabase/migrations/` and must not overwrite `auditoria-catalogo-20260904.xlsx`.

`match-tarifario-last.test.mjs` adds the 1% inclusive contract (`abs(compared_price - importe) / importe <= 0.01`): exact, 0.23% (`31427.15` vs `31500`, `PRECIO_LAST` unchanged), exactly 1% (`10100` vs `10000`), and >1% (`10101` vs `10000` must be `DESFASADO`).

Did **not** create `migrate-tarifario-v2.mjs`.  
Did **not** edit `match-tarifario-last.mjs`.  
Did **not** overwrite `out/auditoria-catalogo-20260904.xlsx`. Cruzado workbook treated as read-only.

## What you tested

Local Node only. No DESARROLLO, no SQL, no remote write.

```powershell
cd ibarra-app
node --check scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs
node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs
```

**Result:** FAIL (expected RED). Exit 1. **File parses** (`node --check` exit 0; TAP `1..25`, no syntax/load abort of the test files).

**25 tests: 9 pass, 16 fail.**

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs
```

**Result:** FAIL. `# tests 25` `# pass 9` `# fail 16`.

**Why this failure is expected:** ETL module is missing; matcher still uses formatted-string equality, not 1% relative tolerance.

| # | Assertion | Observed |
|---|---|---|
| 1–7 | Existing matcher cases | `ok` — unchanged |
| 8 | Exact 1% case `10000` vs `10000` → `AL_DIA` | `ok` — string equality already matches |
| 9 | 0.23% `31427.15` vs `31500` → `AL_DIA`, `PRECIO_LAST` kept | `DESFASADO` (string inequality) |
| 10 | Exactly 1% `10100` vs `10000` → `AL_DIA` | `DESFASADO` (string inequality) |
| 11 | >1% `10101` vs `10000` → `DESFASADO` | `ok` — any difference is already `DESFASADO` |
| 12–25 | All 14 ETL cases | `ERR_MODULE_NOT_FOUND` `migrate-tarifario-v2.mjs` |

Passes 8 and 11 are intentional RED leftovers (current matcher already classifies exact as `AL_DIA` and any difference as `DESFASADO`). They stay as required 1% boundary assertions so GREEN cannot loosen `>1%` or drop exact.

Existing matcher tests 1–7 still pass. YERAU / AUSOL TIGRE remain `DESFASADO` (relative error ≫ 1%).

**GREEN:** not this dispatch. Backend write adds `migrate-tarifario-v2.mjs` (`parseTarifarioV2`) and 1% comparison in `match-tarifario-last.mjs` after this RED evidence.

## Files changed

1. `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs` — created
2. `ibarra-app/scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs` — 1% cases appended
3. `.superpowers/sdd/task-4-report.md` — this report

Did **not** create `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs`.  
Did **not** edit `match-tarifario-last.mjs`.  
Did **not** create `supabase/scripts/validar_migracion_tarifario_v2.sql`.  
Did **not** edit product docs, migrations, or Angular.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.

## Self-review findings

- Completeness: workbook IDs, sentido, 1:1 lineage, `PRECIO_LAST`, Cross-only UUID, fail-closed missing `TARIFA_ID`, report shape, 1% boundaries — all present.
- Fixtures are in-memory; real Cruzado xlsx is read-only existence check only.
- Dynamic `import('./migrate-tarifario-v2.mjs')` so the test **file parses**; failures are per-test `ERR_MODULE_NOT_FOUND`, not a syntax error.
- Wished-for API: `parseTarifarioV2` returns `{ tarifas, tarifa_importe, report }`. Throws on fail-closed cases.
- Hard constraint: no DROP/`tarifas_normalizadas` mutation in tests; lineage keeps legacy IDs.

## Issues or concerns

None blocking. Note for the write agent:

1. Formula denominator is audited `importe` (`PRECIO_LAST`): `abs(10100-10000)/10000 = 0.01` matches; `abs(10101-10000)/10000 = 0.0101` must not.
2. 0.23% case must keep `PRECIO_LAST` as `$31.500,00` — do not rewrite it to `$31.427,15` to force `AL_DIA`.
3. Cross-only current row: new UUID, `tarifas_normalizadas_id === null`, `fecha_aparicion === LAST_UPDATED`.
4. Do not write `out/auditoria-catalogo-20260904.xlsx` or anything under `supabase/migrations/`.
5. Tests never call DESARROLLO; ETL GREEN must not either.

---

## GREEN — implementation (2026-09-07)

**Owner:** Backend write  
**Commits:** none  
**DESARROLLO:** not written  
**`tarifas_normalizadas`:** not removed

### What was implemented

1. `parseTarifarioV2({ tarifas, tarifas_importe, cruzado })` in `migrate-tarifario-v2.mjs`: fail-closed UUID/uniqueness/sentido/lineage/Cross parent; parent IDs stay `tarifas.id`; lineage keeps `tarifa_importe.id = tarifas_normalizadas_id`; exact audited amount reuses that history row as `current_tarifa_id`; otherwise appends a Cross-only UUID with null lineage, `fecha_aparicion = LAST_UPDATED`, `importe = PRECIO_LAST` (never rewritten). In-memory `report` only (`parent_id`, `historical_id`, `legacy_id`, `audited_amount`, `chosen_pointer`, `source_timestamp`). No `reportPath`.
2. Matcher `motivoFila`: `abs(compared - importe) / importe <= 0.01` inclusive, denominator = numeric `PRECIO_LAST`. Existing YERAU / AUSOL TIGRE remain `DESFASADO`.
3. `validar_migracion_tarifario_v2.sql`: read-only local counts (lineage 1:1, pointer belongs to parent, staged `PRECIO_LAST` vs current importe). Empty staging → 0 mismatches. Not a migration.

Did **not** edit the two test files.  
Did **not** overwrite `out/auditoria-catalogo-20260904.xlsx`.  
Did **not** write under `supabase/migrations/`.

### GREEN command

```powershell
cd ibarra-app
node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs
```

**Result:** PASS. Exit 0. `# tests 25` `# pass 25` `# fail 0`. Duration ~405 ms.

### Local SQL (CLI, not DESARROLLO)

```powershell
npx supabase db query --local -f supabase/scripts/validar_migracion_tarifario_v2.sql
```

**Result:** exit 0. All four counts `0` (empty v2 tables; Task 7 loads the workbook).

### Files created/modified (GREEN)

1. `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs` — created
2. `ibarra-app/scripts/peajes-catalogo-audit/match-tarifario-last.mjs` — 1% relative tolerance
3. `ibarra-app/supabase/scripts/validar_migracion_tarifario_v2.sql` — created
4. `.superpowers/sdd/task-4-report.md` — GREEN evidence appended

Did **not** edit `migrate-tarifario-v2.test.mjs` or `match-tarifario-last.test.mjs`.  
Did **not** commit.

