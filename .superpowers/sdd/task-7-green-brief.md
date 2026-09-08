# Task 7 GREEN — backfill, local ETL load, parity report

Copy of the dispatch contract for the Backend write agent. RED is Approved (`task-7-review.md`). Do **not** edit the pgTAP test file.

**Owner:** Backend write  
**Workspace:** `C:/Users/FRANCIS/Documents/progamacion/Transporte` on `feat/f14-16-tarifas-v2`  
**Skills:** `backend-supabase-write`, `supabase`, `supabase-postgres-best-practices`, TDD  
**No DESARROLLO:** never `apply_migration`, `db push --linked`, `db reset --linked`, or MCP remote writes.  
**Hard constraint:** do not remove `tarifas_normalizadas`. Preserve every `pasadas.tarifa_normalizada_id`. Do not commit. Do not start Task 8.

## Do not edit

- `peajes_f14_tarifas_importe_test.sql`
- Any `*.spec.ts`
- Product docs / `feature_list.json` / `claude-progress.md` (Task 9/10)
- Legacy RPCs: `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`
- Already-applied Task 2/3/6 migrations

## Implement

### 1. Backfill function

New local migration, e.g. `ibarra-app/supabase/migrations/20260908100000_peajes_backfill_pasadas_tarifa_importe.sql`.

`peajes_backfill_pasadas_tarifa_importe()` — zero-arg, `void` (`PERFORM`).

- Unique `pasadas.tarifa_normalizada_id` = `tarifa_importe.tarifas_normalizadas_id` → set `pasadas.tarifa_importe_id` to that history `id`
- Unmatched or non-unique → leave `tarifa_importe_id` null; do not invent `tarifa_importe` rows
- Do not update `tarifa_normalizada_id`, current pointers, or insert history
- Zero mutation of `tarifas_normalizadas`
- Idempotent
- Coincidental `tarifa_importe.id` equal to a legacy id **without** lineage must **not** fill
- SECURITY / grants: `authenticated` / `service_role` like neighboring peajes RPCs (`REVOKE PUBLIC`, `SECURITY INVOKER`)

### 2. Local ETL load (CLI only)

Extend `migrate-tarifario-v2.mjs` (or a sibling it exports) with an **explicit local** connection (`127.0.0.1:54321` / CLI URL from env — never DESARROLLO). Load parsed `tarifas` / `tarifa_importe` into the local DB after `db reset` migrations. Fail closed. Do not overwrite audit xlsx.

If history sheet `importe` is still a raw string, parse with `parseArs`.

Workbook: `scripts/peajes-catalogo-audit/out/tarifario-last-cruzado.xlsx` (do not invent a DESARROLLO dump).

### 3. Integrity + parity report

Fix `validar_migracion_tarifario_v2.sql` so `precio_last_current_mismatches` uses real staged PRECIO_LAST, not `JOIN (SELECT NULL WHERE false)`.

Produce a local parity report (markdown/JSON under `.superpowers/sdd/` or `scripts/peajes-catalogo-audit/out/`) with:

- legacy links (`pasadas.tarifa_normalizada_id` not null)
- v2 links (`pasadas.tarifa_importe_id` not null)
- unmapped (legacy without v2)
- current-pointer mismatches
- price comparison mismatches

Any **unexplained** mismatch is a cutover blocker — record it; do not hide it.

After load, run backfill on local CLI only.

### 4. Verify GREEN

From `ibarra-app`:

```
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db
```

pgTAP must PASS including tests 156–165 (14 files; expect Tests ≥ 397).

Also:

```
node --test scripts/peajes-catalogo-audit/*.test.mjs
```

## Report

Write `.superpowers/sdd/task-7-green-report.md` with commands, dates, exit codes, test counts, parity counts, files changed.

Update `.superpowers/sdd/progress.md` Task 7 to GREEN done, waiting review.
