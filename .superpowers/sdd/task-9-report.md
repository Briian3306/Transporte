# Task 9 — Independent verification and evidence (F14-16)

**Status:** DONE (all gates green)  
**Owner:** Backend tester  
**Date:** 2026-09-08  
**Target:** local only  
**Commits:** none  
**F14-16 status:** remains `in_progress` (Task 10 marks `passing` after docs)

Did **not** implement features. Did **not** write DESARROLLO. Did **not** run `db reset --linked`, `db push --linked`, or `apply_migration`.

## Unskip

Removed `{ skip: ... }` from `splitSentidoCollisions remaps the second sentido onto a new parent id` in `scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs`.

Re-run: **ok 42**, not skipped.

## Gates

All commands from `ibarra-app/` unless noted. Date **2026-09-08**.

### 1. `npx supabase start`

**Exit:** 0  
**Outcome:** PASS. Local stack already running; CLI restarted stopped sidecar services. `DB_URL` = `127.0.0.1:54322`. Not DESARROLLO.

### 2. `npx supabase db reset --local --no-seed`

**Exit:** 0  
**Outcome:** PASS. Recreated local DB. Applied F14-16 migrations including:

- `20260907100000_peajes_tarifas_v2_schema.sql`
- `20260907101000_peajes_tarifas_v2_current_pointer.sql`
- `20260907102000_peajes_tarifas_v2_shadow_matching.sql`
- `20260907103000_peajes_tarifas_v2_compat_cutover.sql`
- `20260908100000_peajes_backfill_pasadas_tarifa_importe.sql`

`--no-seed` leaves `pasadas` empty. Message: `Reset local database.` branch `feat/f14-16-tarifas-v2`.

### 3. `npx supabase test db`

**Exit:** 0  
**Outcome:** PASS. `All tests successful.` **Files=14, Tests=412.** `peajes_f14_tarifas_importe_test.sql` ok. `peajes_pwbi_views_test.sql` ok.

### 4. `node --test scripts/peajes-catalogo-audit/*.test.mjs`

**Exit:** 0  
**Outcome:** PASS. `# tests 53` `# pass 53` `# fail 0` `# skipped 0`. Sentido-split test ran (`ok 42 - splitSentidoCollisions remaps the second sentido onto a new parent id`).

### 5. Focused Angular (adapter + validation + Paso 8)

```
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Exit:** 0  
**Outcome:** PASS. **TOTAL: 35 SUCCESS** (0 failed). Chrome Headless.

### 6. F14/audit regression (cheap existing specs)

```
pnpm.cmd exec ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Exit:** 0  
**Outcome:** PASS. **TOTAL: 52 SUCCESS** (0 failed). Did not run full-app `ng test`.

### 7. `pnpm.cmd exec npx tsc --noEmit -p tsconfig.app.json`

**Exit:** 0  
**Outcome:** PASS (no diagnostics).

### 8. `pnpm.cmd exec npx tsc --noEmit -p tsconfig.spec.json`

**Exit:** 0  
**Outcome:** PASS (no diagnostics).

### 9. Task 7 GREEN local parity report (review only; no `--load-local`)

Source: `.superpowers/sdd/task-7-parity-report.md` + `.json` (`2026-09-08T12:02:13.103Z`).

| Metric | Count |
|---|---|
| unexplained | **[]** (zero) |
| current_pointer_mismatches | 0 |
| price_comparison_mismatches | 0 |
| lineage_1n / lineage_id / pointer_parent | 0 |
| null_current_pointers | 0 |
| legacy_links / v2_links / unmapped | **0 / 0 / 0** |

**Empty pasadas 0/0/0 after `--no-seed`:** **explained**. Official verify rebuilds without seed, so `pasadas` is empty; those zeros are the empty-table identity, not a hidden pointer/lineage/price mismatch. Unique-lineage backfill is proven by pgTAP fixtures (Task 7 tests 156–165; this run’s Files=14 Tests=412 includes that file ok). **Real-volume pasadas backfill remains unproven** outside those fixtures.

Explained leftovers (not cutover blockers): 50 without staged PRECIO_LAST; 27 sentido remaps; 8 TN unique-key lineage skips.

## Deferred (do not implement here; Task 10 / follow-up)

1. **Task 6A:** `asociarTrasConfirmacion` unwired after confirm (Paso 9 / `peajes-carga.service.ts`). Allowed deferral; wiring would need carga/Paso 9 spec edits.
2. **Task 8:** `pwbi_tarifas_v2` LEFT JOIN can yield null `Importe` when `current_tarifa_id` is missing or parent mismatch. Document as “all `tarifas` + current amount when the pointer is valid,” not INNER-only.
3. **Task 8:** v2 is **not** a drop-in column clone of `pwbi_tarifas` (no `Peaje_Nombre` / `Estacion_Nombre` / `hora_*` / current `fecha_aparicion`). Do not rewrite the view unless a test fails.
4. **Task 7:** real-volume local pasadas seed + backfill still not run; 8 TN unique-key lineage skips; `INSERT … ON CONFLICT (id) DO NOTHING` on catalog tables; `_stg_precio_last` is local staging, not a runtime catalog table.
5. F14-16 **not** marked `passing` — Task 10 adds canonical docs then status.

## Files changed (this task)

1. `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs` — unskip only
2. `ibarra-app/feature_list.json` — F14-16 **evidence** only; status stays `in_progress`
3. `ibarra-app/docs/claude-progress.md` — Task 9 entry
4. `.superpowers/sdd/task-9-brief.md` / `task-9-report.md` / `progress.md`

No product UI, migrations, ETL load logic, or canonical docs.
