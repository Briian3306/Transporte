# Task 2 Report — F14-16 v2 schema pgTAP (RED only)

**Status:** DONE  
**Owner:** Backend tester  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created failing pgTAP for the F14-16 Task 2 schema contract. No production migration, no ETL, no Angular, no product docs.

The suite asserts, verbatim from the brief:

- `public.tarifas` columns, types, nullability, FKs to `peajes`/`estaciones`, unique `(peaje_id, estacion_id, status, categoria, sentido)`, `sentido` default `AMBAS`, `requiere_normalizacion_iva` default false, nullable `current_tarifa_id` (Task 2 bootstrap).
- `public.tarifa_importe` columns, `importe numeric(14,2) > 0`, legacy-compatible `importe_base`/`desvio`, nullable `hora_*` `numeric(5,2)`, nullable `categoria_calculated` 0–10, lineage FK to `tarifas_normalizadas`, unique `(tarifa_id, id)`, unique partial on `tarifas_normalizadas_id`, history index `(tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC)`.
- `status` and `categoria` must **not** live on `tarifa_importe`.
- `pasadas.sentido text not null default 'AMBAS'`, nullable `pasadas.tarifa_importe_id` FK + index, partial shadow-backlog index, **no** `pasadas.peaje_id`.
- Hard constraint: `tarifas_normalizadas` still exists and `pasadas.tarifa_normalizada_id` FK remains intact.
- RLS enabled + authenticated ALL + grants matching existing tariff tables.

Does **not** assert the Task 3 current-pointer composite FK or immutability triggers.

## What you tested

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`.

1. `npx supabase db reset --local --no-seed` from `ibarra-app` — **exit 0**. Last applied migration: `20260902185000_peajes_pwbi_tarifas_fecha_aparicion.sql`. No `20260907100000_peajes_tarifas_v2_schema.sql` (not created).
2. `npx supabase test db --local` from `ibarra-app` — **exit 1** (expected RED).

Full suite: **Files=14, Tests=344**. Thirteen existing files `ok`. Only the new file failed.

New file: **112 tests, 105 failed, 7 passed**.

The 7 passes are intentional RED leftovers, not false greens of v2:

| # | Why it passes today |
|---|---|
| 1–4 | `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id` FK already exist; `pasadas` has no `peaje_id` |
| 79–80 | `hasnt_column` on missing `tarifa_importe` (status/categoria absent; still required at GREEN) |
| 111 | `pasadas` INSERT with legacy `tarifa_normalizada_id` still works |

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db --local
```

**Result:** FAIL. `peajes_f14_tarifas_importe_test.sql` — Failed tests: 5–78, 81–110, 112.

**Why this failure is expected:** v2 objects are missing. The file **parses and runs** (112 TAP results, Wstat 0). Failures are schema absence, not SQL syntax:

- `relation "public.tarifas" does not exist` / `relation "public.tarifa_importe" does not exist` (`42P01`)
- `Column public.tarifas.* does not exist` / `Column public.pasadas.sentido does not exist`
- `column "sentido" of relation "pasadas" does not exist` (`42703`) when CHECK is asserted
- `pasadas.sentido default AMBAS tras INSERT` → `have: NULL, want: AMBAS`

Existing suites still green (legacy F14 including `peajes_f14_fecha_aparicion_test.sql` and `peajes_f14_test.sql`).

**GREEN:** not this dispatch. Backend write adds `20260907100000_peajes_tarifas_v2_schema.sql` after this RED evidence.

## Files changed

1. `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` — created

Did **not** create `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql`.  
Did **not** edit product docs, ETL, or Angular.  
Did **not** commit.

## Self-review findings

- Completeness: tables, columns, checks, uniques, indexes, shadow columns, RLS/grants, and legacy FK coverage match the brief.
- Catalog assertions (`has_table`, `ok(COALESCE(...))`) so missing relations TAP-fail instead of aborting the file.
- `throws_ok`/`lives_ok` wrap v2 DML; CHECK tests fail today with `42P01`/`42703` instead of the wanted `23514`/`23505`.
- Hard constraint covered by passing tests 1–4.
- YAGNI: no pointer composite FK, no immutability triggers.

## Issues or concerns

None blocking. Two notes for the write agent:

1. Tests 79–80 (`hasnt_column` status/categoria) pass while `tarifa_importe` is missing; they become real guards once the table exists.
2. Index assertions match column lists / `pg_get_indexdef`, not prescribed index names. Unique `(tarifa_id, id)` must be an explicit unique constraint (PK on `id` alone is not enough).

---

## Appendix — review must-fix (2026-09-07)

**Status:** DONE (still RED; no migration)

Patched only `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` for the three Important review items. `plan(118)` (was 112).

| Finding | Change |
|---|---|
| 1. `VUELTA` never accepted | `lives_ok` INSERT `sentido = 'VUELTA'` on `tarifas` (test 111) and `pasadas` (test 116). Kept NORTE rejects and IDA/AMBAS accepts. |
| 2. `tarifa_importe` timestamps | `created_at` / `updated_at` now assert `timestamptz` + `default now()` (tests 77–78, 81–82), same pattern as `tarifas`. |
| 3. History index too loose | Requires exact columns `(tarifa_id, fecha_aparicion, created_at, id)` plus `fecha_aparicion DESC`, `created_at DESC`, and `, id DESC` in `pg_get_indexdef`. A 3-column index fails. |

Did **not** create the migration. Did **not** commit. Reset not needed (local schema already at last applied migration).

### Covering command

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL (expected RED). Exit 1. `Wstat: 0` (file parses). Files=14, Tests=350. Thirteen existing files `ok`. Only `peajes_f14_tarifas_importe_test.sql` failed: **118 tests, 111 failed, 7 passed**.

Failed tests: 5–82, 85–116, 118.

New assertions fail because v2 schema is missing, not syntax:

- test 77–78 / 81–82: `Column public.tarifa_importe.created_at/updated_at does not exist` and default `NULL`
- test 87: history index missing
- test 111: `died: 42P01: relation "public.tarifas" does not exist` (`lives_ok` VUELTA)
- test 116: `died: 42703: column "sentido" of relation "pasadas" does not exist` (`lives_ok` VUELTA)

The 7 passes remain the same intentional leftovers: tests 1–4 (legacy `tarifas_normalizadas` / no `pasadas.peaje_id`), 83–84 (`hasnt_column` status/categoria on missing `tarifa_importe`), 117 (legacy `pasadas` INSERT with `tarifa_normalizada_id`).

---

## GREEN — schema migration (2026-09-07)

**Status:** DONE  
**Owner:** Backend write  
**Commits:** none (forbidden)

### What was implemented

Created `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql` only. Did **not** edit the pgTAP file, product docs, ETL, or Angular. Did **not** touch `tarifas_normalizadas` or its FKs. Did **not** add `pasadas.peaje_id`, current-pointer composite FK, or immutability triggers (Task 3).

Empty v2 objects:

- `public.tarifas` with unique `(peaje_id, estacion_id, status, categoria, sentido)`, `sentido` default `AMBAS`, nullable `current_tarifa_id`, CHECKs PICO/NO_PICO, categoria 0–10, sentido IDA|VUELTA|AMBAS.
- `public.tarifa_importe` with `importe numeric(14,2) > 0`, explicit unique `(tarifa_id, id)`, unique partial lineage, history index `(tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC)`. No `status`/`categoria` columns.
- `pasadas.sentido` NOT NULL default `AMBAS` + CHECK; nullable `pasadas.tarifa_importe_id` FK + index; partial shadow-backlog index.
- RLS enabled + authenticated ALL + grants matching `tarifas_normalizadas`.

### What was tested

Local CLI only. No DESARROLLO, no `db push --linked`, no MCP `apply_migration`.

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db --local
```

**Reset:** exit 0. Last applied: `20260907100000_peajes_tarifas_v2_schema.sql`.

**pgTAP:** exit 0. **Files=14, Tests=350. Result: PASS.** All 14 files `ok`, including `peajes_f14_tarifas_importe_test.sql` (`plan(118)`). Existing F14 suites still green (`peajes_f14_fecha_aparicion_test.sql`, `peajes_f14_test.sql`).

### Files changed

1. `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql` — created
2. `.superpowers/sdd/task-2-report.md` — GREEN evidence appended

Did **not** modify `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`.  
Did **not** commit.

### Self-review

- Unique `(tarifa_id, id)` is an explicit UNIQUE constraint (PK on `id` alone is not the composite).
- History index includes `id DESC`; lineage unique is partial `WHERE tarifas_normalizadas_id IS NOT NULL`.
- Legacy `pasadas.tarifa_normalizada_id` FK unchanged.
- YAGNI: no pointer composite FK, no immutability triggers.
- DESARROLLO (`kfffigvyvtzyczeiadxh`) not written.
