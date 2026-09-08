# Task 6 Report — shadow resolver / validator pgTAP (RED only)

**Status:** DONE  
**Owner:** Backend tester  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Added failing pgTAP for F14-16 Task 6 RPCs to the existing Task 2–3 suite. No production migration, no ETL, no Angular, no product docs.

New cases (tests 133–155) demand, verbatim from the brief:

1. **Batch row-order preservation** — caller `idx` 0 (`SIN_TARIFA`) then `idx` 1 (IDA match).
2. **`IDA` exact priority** over `AMBAS`; `peaje_id` resolved via `estaciones.peaje_id`.
3. **`VUELTA` → `AMBAS` fallback** when no `VUELTA` config exists.
4. **`AMBAS` exact-only** — does not pick `IDA`/`VUELTA` (`SIN_TARIFA`).
5. **Missing configuration** → `SIN_TARIFA`.
6. **Ambiguous/missing status** → `ESTADO_AMBIGUO` (absent status with PICO+NO_PICO does not guess `hora_*`; `PENDIENTE` with two candidates). Unique missing status (only `NO_PICO`) still resolves.
7. **Historical-price recognition** → `HISTORICA` (non-current 1000; current is 2000).
8. **Inclusive 1%** — exact `AL_DIA`, relative error `= 0.01` `AL_DIA`, `> 0.01` `DESFASADO` with audited/compared/relative error.
9. **Validator IVA protocol** — flag true uses supplied `precio_normalizado` (1210 directo ignored); flag false uses `precio_directo`. `pg_get_functiondef` of resolver+validator must contain no `/ 1.21` (or `/1,21`).
10. **Association RPC** `peajes_asociar_pasadas_tarifa_importe(jsonb)` — `AL_DIA`/`HISTORICA` write `pasadas.tarifa_importe_id`; `DESFASADO` ignored; retry idempotent; `tarifa_normalizada_id` unchanged; no `tarifa_importe` insert.

`plan(155)` (was 132). All 132 Task 2–3 assertions kept. `tarifas_normalizadas` and `pasadas.tarifa_normalizada_id` still asserted.

Wished-for contract (GREEN):

| RPC | Args | Returns |
|---|---|---|
| `peajes_resolver_tarifas_actuales` | `p_pasadas jsonb` array of `{idx, estacion_id, categoria, status?, sentido, fecha_hora?}` | jsonb array `{idx, tarifa_id, current_tarifa_id, importe, peaje_id, sentido_aplicado, requiere_normalizacion_iva, codigo?}` |
| `peajes_validar_tarifas_actuales` | `p_pasadas jsonb` array of `{idx, tarifa_id, current_tarifa_id, importe, requiere_normalizacion_iva, precio_directo, precio_normalizado}` | jsonb array `{idx, codigo, tarifa_importe_id?, importe, precio_comparado, error_relativo}` |
| `peajes_asociar_pasadas_tarifa_importe` | `p_asociaciones jsonb` array of `{pasada_id, tarifa_importe_id, codigo}` | void (PERFORM); only `AL_DIA`/`HISTORICA` update |

Helpers catch `undefined_function` (`42883`) so missing RPCs TAP-fail instead of aborting the file.

Did **not** create `ibarra-app/supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`.  
Did **not** edit Task 2/3 migrations, Angular adapter, ETL, or product docs.  
Did **not** modify `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`, or their signatures.

## What you tested

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`. Reset not needed: local schema already includes Task 2–3 migrations.

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL (expected RED). Exit 1. **Wstat: 0** (file parses). Files=14, Tests=387.

Thirteen existing files `ok`. Only `peajes_f14_tarifas_importe_test.sql` failed: **155 tests, 23 failed, 132 passed**.

Failed tests: **133–155** (all new Task 6 cases). Tests 1–132 (Task 2–3) still pass.

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
npx supabase test db --local
```

**Result:** FAIL. `peajes_f14_tarifas_importe_test.sql` — Failed tests: 133–155. Wstat: 0.

**Why this failure is expected:** Task 6 RPCs are missing. Failures are missing functions, not SQL syntax:

| # | Assertion | Observed |
|---|---|---|
| 133–135 | `has_function` resolver / validator / asociar `(jsonb)` | Function does not exist |
| 136–143 | Resolver matching (order, IDA, VUELTA→AMBAS, AMBAS-only, SIN_TARIFA, ESTADO_AMBIGUO, unique status) | `have: NULL` / `ok` false — helper returns `{_sqlstate: 42883}` |
| 144–149 | Validator HISTORICA / 1% / IVA flag | `have: NULL` want `AL_DIA`/`HISTORICA`/`DESFASADO` |
| 150 | `pg_get_functiondef` contains no `/ 1.21` | Function missing → def NULL → `ok` false |
| 151, 153 | Association `PERFORM` succeeds | `have: 42883, want: ok` |
| 152, 154–155 | FK writes, retry idempotent, no history insert | `tarifa_importe_id` still NULL (`ok` false) |

Existing suites still green (legacy F14 including `peajes_f14_fecha_aparicion_test.sql` and `peajes_f14_test.sql`).

**GREEN:** not this dispatch. Backend write adds `20260907102000_peajes_tarifas_v2_shadow_matching.sql` after this RED evidence.

## Files changed

1. `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` — Task 6 cases appended; `plan(155)`
2. `.superpowers/sdd/task-6-report.md` — this report

Did **not** create `ibarra-app/supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`.  
Did **not** edit product docs, ETL, or Angular.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.

## Self-review findings

- Completeness: all 10 brief cases covered; unique-status complement so GREEN cannot always return `ESTADO_AMBIGUO` when status is omitted.
- RPC-missing failures wrapped (`pg_temp.rpc_jsonb` / `asociar_pasadas` / `fn_def`) so Wstat stays 0.
- Association 42883 is explicit (`have: 42883, want: ok`).
- Hard constraint: Task 2–3 tests 1–132 still pass; legacy normalizer RPCs untouched.
- YAGNI: no production SQL.

## Issues or concerns

None blocking. Notes for the write agent:

1. Return **jsonb arrays** (not SETOF) so caller `idx` order is positional.
2. SQL must **not** divide by 1.21; choose `precio_directo` vs `precio_normalizado` only from `requiere_normalizacion_iva`.
3. Association name locked by tests: `peajes_asociar_pasadas_tarifa_importe(jsonb)`. Never update `tarifa_normalizada_id` or insert `tarifa_importe`.
4. Do not change `peajes_normalizar_tarifas` / `peajes_recalcular_tarifas` / `peajes_confirmar_status_tarifa` signatures.
5. Do not DROP `tarifas_normalizadas`.

---

# Task 6 GREEN — shadow resolver / validator / association RPCs

**Status:** DONE  
**Owner:** Backend write  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created only `ibarra-app/supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`.

Three SECURITY INVOKER RPCs (`SET search_path = public`; REVOKE PUBLIC; GRANT authenticated/service_role):

| RPC | Returns |
|---|---|
| `peajes_resolver_tarifas_actuales(p_pasadas jsonb)` | jsonb array; preserves caller order/`idx`; `peaje_id` via `estaciones`; IDA/VUELTA exact then AMBAS; AMBAS-only; `CATEGORIA_PENDIENTE` / `ESTADO_AMBIGUO` / `SIN_TARIFA` |
| `peajes_validar_tarifas_actuales(p_pasadas jsonb)` | jsonb array; chooses `precio_normalizado` only when flag true; inclusive `abs(compared - importe) / importe <= 0.01` → `AL_DIA`; non-current history → `HISTORICA`; else `DESFASADO` |
| `peajes_asociar_pasadas_tarifa_importe(p_asociaciones jsonb)` | void; updates `pasadas.tarifa_importe_id` only for `AL_DIA`/`HISTORICA`; idempotent; never touches `tarifa_normalizada_id` or inserts history |

Did **not** edit the test file, Task 2/3 migrations, Angular, ETL, or product docs.  
Did **not** modify `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`.  
Did **not** remove `tarifas_normalizadas`. No DESARROLLO. No commit.

## GREEN evidence

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db --local
```

**Result:** PASS. Files=14, Tests=387. All tests successful.  
`peajes_f14_tarifas_importe_test.sql` ok (`plan(155)` including tests 133–155). Existing suites still green.

`pg_get_functiondef` of resolver, validator, and association: **no** `/ 1.21`, `/1.21`, `/ 1,21`, or `/1,21` (`has_iva_div = false` for all three).
