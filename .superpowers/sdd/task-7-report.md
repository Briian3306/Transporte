# Task 7 Report — unique-lineage backfill pgTAP (RED only)

**Status:** DONE  
**Owner:** Backend tester  
**Date:** 2026-09-08  
**Commits:** none (forbidden)

## What you implemented

Added failing pgTAP for F14-16 Task 7 backfill to the existing Task 2–6 suite. No production migration, no ETL load path, no Angular, no product docs.

Overnight draft cases were already in `peajes_f14_tarifas_importe_test.sql` with **no** `task-7-report.md`. This dispatch finished RED: locked the zero-arg `has_function` signature, gated “leave null / preserve / no mutation” assertions on a successful first run (so they fail while the RPC is absent instead of passing vacuously), coerced the retry equality to `IS TRUE` (avoid NULL TAP), ran local pgTAP, and wrote this report.

New cases (tests **156–165**) demand, verbatim from the brief:

1. **Function exists** — `peajes_backfill_pasadas_tarifa_importe()` with no args.
2. **Executes** — `PERFORM` succeeds (`ok`, not SQLSTATE `42883`).
3. **One-to-one lineage backfill** — two pasadas sharing unique `tarifa_normalizada_id` = `tarifa_importe.tarifas_normalizadas_id` get `tarifa_importe_id` = that history `id` (id = TN id); `tarifa_normalizada_id` unchanged.
4. **Unmatched left null** — pasada whose TN has no lineage row stays `tarifa_importe_id` null; TN id preserved. Do not invent a `tarifa_importe` row.
5. **Coincidental id is not lineage** — history row whose `id` equals a TN id but `tarifas_normalizadas_id` is null does **not** fill the pasada. Covers “leave null / do not invent” under the partial unique index (two non-null lineage rows with the same `tarifas_normalizadas_id` cannot be inserted).
6. **Every `pasadas.tarifa_normalizada_id` preserved** (including unmatched and Task 6 association rows); pasada count unchanged.
7. **Zero mutation of `tarifas_normalizadas`** — row count + business-column fingerprint unchanged.
8. **Does not rewrite current pointers, insert history, or touch Task 6 association FKs.**
9. **Retry does not throw.**
10. **Idempotent** — unique matches stay filled; unmatched stay null.

`plan(165)` (was 155). All 155 Task 2–6 assertions kept. `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id` still asserted.

Wished-for contract (GREEN):

| RPC | Args | Returns |
|---|---|---|
| `peajes_backfill_pasadas_tarifa_importe` | none | `void` (`PERFORM`) |

Lineage rule: `pasadas.tarifa_normalizada_id` equals **exactly one** `tarifa_importe.tarifas_normalizadas_id` → set `pasadas.tarifa_importe_id` to that history `id`. Unmatched / non-unique → leave null. GREEN should still join 1:1 (`HAVING count(*) = 1`) even though the unique index already forbids duplicate non-null lineage.

Helper `pg_temp.backfill_pasadas()` catches `undefined_function` (`42883`) so missing RPC TAP-fails instead of aborting the file (`Wstat: 0`).

Fixtures use dedicated `167…` UUIDs (station, TN, tarifas, history, pasadas) so they do not collide with Task 2–6. Do **not** load the Cruzado workbook in pgTAP.

Did **not** create a Task 7 migration or `peajes_backfill_pasadas_tarifa_importe`.  
Did **not** edit `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs`.  
Did **not** edit `supabase/scripts/validar_migracion_tarifario_v2.sql` (PRECIO_LAST stub stays until GREEN).  
Did **not** edit Angular / Paso 8 / product docs / `feature_list.json`.

## What you tested

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`. Local DB was already up (`npx supabase status` showed `DB_URL` on `127.0.0.1:54322`; some ancillary containers stopped — not required for pgTAP).

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL (expected RED). Exit 1. **Wstat: 0** (file parses). Files=14, Tests=397.

Thirteen existing files `ok`. Only `peajes_f14_tarifas_importe_test.sql` failed: **165 tests, 10 failed, 155 passed**.

Failed tests: **156–165** (all new Task 7 cases). Tests 1–155 (Task 2–6) still pass.

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
npx supabase test db --local
```

**Date:** 2026-09-08  
**Result:** FAIL. Exit 1. `peajes_f14_tarifas_importe_test.sql` — Failed tests: 156–165. Wstat: 0. Files=14, Tests=397.

**Why this failure is expected:** `peajes_backfill_pasadas_tarifa_importe()` is missing. Failures are missing function, not SQL syntax:

| # | Assertion | Observed |
|---|---|---|
| 156 | `has_function` `peajes_backfill_pasadas_tarifa_importe()` (no args) | Function does not exist |
| 157 | First `PERFORM` succeeds | `have: 42883, want: ok` |
| 158 | Unique 1:1 lineage fills `tarifa_importe_id` | `ok` false — helper returned `42883`, so gated `result = 'ok'` fails |
| 159 | Unmatched lineage stays null | same gate (`42883`) |
| 160 | Coincidental id without `tarifas_normalizadas_id` stays null | same gate |
| 161 | All `tarifa_normalizada_id` preserved | same gate |
| 162 | `tarifas_normalizadas` count + fingerprint unchanged | same gate |
| 163 | No pointer rewrite / no history insert / Task 6 FKs intact | same gate |
| 164 | Retry `PERFORM` succeeds | `have: 42883, want: ok` |
| 165 | Retry idempotent (unique filled, unmatched null) | `ok` false — unique matches still NULL |

Existing suites still green (legacy F14 including `peajes_f14_fecha_aparicion_test.sql` and `peajes_f14_test.sql`).

**GREEN:** not this dispatch. Backend write adds a **local-only** backfill function matching this contract after RED review is Approved. Also (Task 4 minors, GREEN scope): staged PRECIO_LAST comparison in `validar_migracion_tarifario_v2.sql`; `parseArs` on history importe if still missing; ETL load path in `migrate-tarifario-v2.mjs` with **explicit local** connection only.

## Files changed

1. `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` — Task 7 cases; `plan(165)`
2. `.superpowers/sdd/task-7-report.md` — this report

Did **not** create a Task 7 migration.  
Did **not** edit product docs, ETL, or Angular.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.

## Self-review findings

- Completeness: unique fill, unmatched null, coincidental-id (do not invent), zero TN mutation, preserve every `tarifa_normalizada_id`, idempotent retry, no pointer/history/association mutation.
- RPC-missing failures wrapped (`pg_temp.backfill_pasadas`) so Wstat stays 0.
- Vacuous-pass avoided: null/preserve/no-mutation tests require first run `= 'ok'`.
- Hard constraint: Task 2–6 tests 1–155 still pass; `tarifas_normalizadas` not dropped; `tarifa_normalizada_id` never rewritten by the demanded backfill.
- YAGNI: no production SQL.

## Issues or concerns

None blocking. Notes for the write agent:

1. Name locked: `peajes_backfill_pasadas_tarifa_importe()` — **no args**, `void`.
2. Fill only unique `pasadas.tarifa_normalizada_id` = `tarifa_importe.tarifas_normalizadas_id`. Use `HAVING count(*) = 1` (or equivalent); do not match on coincidental `tarifa_importe.id`.
3. Never update `pasadas.tarifa_normalizada_id`, never INSERT/UPDATE `tarifas_normalizadas`, never insert `tarifa_importe`, never rewrite `tarifas.current_tarifa_id`.
4. Idempotent second run.
5. Local-only. No `apply_migration` / `db push --linked` / DESARROLLO.
6. Do not DROP `tarifas_normalizadas`.
7. Non-unique lineage cannot be fixtureed (partial unique index). Still implement 1:1 in SQL.
