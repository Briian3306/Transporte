# Task 3 report — Make Confirmed and Review Saves Atomic

## What you implemented

Task 3 on `codex/tarifa-importe-cases` at HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9` (unchanged). Worked in place. Did not commit, amend, push, or deploy. Local `npx supabase` from `ibarra-app` only. No `--linked`. No DESARROLLO write.

Created `ibarra-app/supabase/migrations/20260909192938_peajes_tarifa_matching_correcciones.sql` via `npx supabase migration new peajes_tarifa_matching_correcciones` and used that exact generated path. Did not edit Task 2’s `20260909181737_*.sql`.

Replaced the Task 2 `CURRENT_DATE` compatibility writers with explicit `CONFIRM_NEW` / `MARK_REVIEW` payloads. SQL signatures of `peajes_guardar_refresco_tarifas(jsonb)` and `peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)` are unchanged. Both remain `SECURITY INVOKER`.

Behavior:

- Validate the entire payload before any mutation (action/status/direction, positive amount, category 0–10, required start for `CONFIRM_NEW`, forbidden start for `MARK_REVIEW`, station ownership, explicit IVA for a missing identity, duplicate `candidate_id` and identity cells).
- Lock existing `tarifas` rows with `SELECT … FOR UPDATE` in order `(peaje_id, estacion_id, sentido, categoria, status)`.
- `CONFIRM_NEW`: close the prior current row at the new start, then insert `diagnostico = 'CONFIRMADO'` with `fecha_vigencia_fin` NULL, move `current_tarifa_id`, update `tarifas.fecha_actualizacion`. Half-open `[inicio, fin)`. Adjacent `[2026-06-01, 2026-09-01)` then `[2026-09-01, infinity)` is accepted. A start before the active start or overlapping another known confirmed interval rejects the whole batch.
- `MARK_REVIEW`: append `diagnostico = 'REVISAR'` with null validity. Does not close the current row and does not move the pointer.
- Refresh return keeps input order and includes prior amount, prior end, new start/end, diagnostic, calculated category, candidate id, and new history id.
- Route-editor JSON elements now require `fecha_vigencia_inicio`; `diagnostico = 'CONFIRMADO'` is set internally.
- Dropped `_peajes_append_tarifa_importe_confirmado` (the `CURRENT_DATE` shim) and folded close-then-insert into `_peajes_aplicar_importe_guardado`.

Did not implement Task 4 matching/detect changes. Did not alter `tarifas_normalizadas`. Did not edit `.pnpm-store/**`.

## What you tested and test results

All commands from `ibarra-app`, `npx supabase` only, `--local`.

| Command | Exit | Result |
|---|---|---|
| `npx supabase db reset --local --no-seed` | 0 | Applied `20260909192938_peajes_tarifa_matching_correcciones.sql`. No `--linked`. |
| `npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql` (GREEN) | 0 | **Files=1, Tests=63, PASS** |
| `npx supabase test db --local supabase/tests/peajes_tarifario_rpc_test.sql` (GREEN) | 0 | **Files=1, Tests=22, PASS** |
| `npx supabase test db --local supabase/tests/peajes_tarifa_vigencia_test.sql` | 0 | **Files=1, Tests=51, PASS** (Task 2 file unbroken) |
| `npx supabase test db --local` | 0 | **Files=18, Tests=573, PASS** |
| Privilege / constraint queries (`npx supabase db query --local`) | 0 | See below. |
| `pnpm seed:local` | 1 | Auth/RBAC/pasadas restored. Tarifario v2 ETL: `null_current_pointers=27`, `directional_history_collisions=27`. Known from Task 2; not made worse. |

Compared with Task 2 GREEN (`Files=18 Tests=547`): this task added 26 pgTAP assertions (`refresh` 44→63, `tarifario` 15→22) and the suite is **573 PASS**.

### Privileges and constraints (local)

`prosecdef = false` (SECURITY INVOKER) for `peajes_guardar_refresco_tarifas`, `peajes_guardar_tarifas_actuales`, and `_peajes_aplicar_importe_guardado`.

ACL on all three: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. No PUBLIC grant. `anon` has no EXECUTE. `authenticated` and `service_role` retain EXECUTE only.

Task 2 checks/exclusion remain: `tarifa_importe_diagnostico_chk`, `tarifa_importe_vigencia_fechas_chk`, `tarifa_importe_vigencia_confirmada_excl` (GiST `[inicio, fin)` on dated CONFIRMADO).

Old helper `_peajes_append_tarifa_importe_confirmado(uuid,numeric,integer)` is gone (`to_regprocedure` IS NULL).

`supabase/.temp/project-ref` is still `kfffigvyvtzyczeiadxh`; no `db push --linked`, no `db reset --linked`, no MCP remote writes.

## TDD Evidence

### RED (tests first, current writers still using `CURRENT_DATE`)

Focused refresh **before** the new migration, against the Task 2 shim:

```
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 1.** Files=1 Tests=63 **Failed 12/63**. Failed tests 41–42, 44–50, 55–57.

Why expected: the live writers still stamp `CURRENT_DATE`, always confirm, ignore `action` / payload start, and lock without the required `ORDER BY`. Specifically:

- Test 41: function body had `FOR UPDATE` but not `ORDER BY t.peaje_id, t.estacion_id, t.sentido, t.categoria, t.status`.
- Tests 42 / 44 / 45: confirm save wrote `CURRENT_DATE` (2026-09-09) instead of `2026-09-01`; return lacked `anterior_fin` / diagnostic / calculated category.
- Tests 46–47 / 50 / 55–57: `caught: no exception` / `wanted: P0001` (overlap, invalid action, required start, forbidden review start, duplicate candidate id).
- Test 48: batch did not roll back because overlap did not throw.
- Test 49: `MARK_REVIEW` still confirmed and moved the pointer.

Focused tarifario **before** the new migration:

```
npx supabase test db --local supabase/tests/peajes_tarifario_rpc_test.sql
```

**EXIT 1.** Files=1 Tests=22 **Failed 5/22** (tests 16–20).

- Test 16: `have: 2026-09-09` / `want: 2026-09-01` — the shim closed the prior row at `CURRENT_DATE`, not the payload start.
- Tests 17–20: missing explicit CONFIRMADO start, no required-start rejection, no overlap rejection, no deterministic lock order.

Existing status/sentido/importe/category throws and privilege grants already passed (they were not the missing behavior).

### GREEN (after `20260909192938_peajes_tarifa_matching_correcciones.sql`)

```
npx supabase db reset --local --no-seed
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 0.** Files=1 Tests=63 PASS.

```
npx supabase test db --local supabase/tests/peajes_tarifario_rpc_test.sql
```

**EXIT 0.** Files=1 Tests=22 PASS.

```
npx supabase test db --local
```

**EXIT 0.** Files=18 Tests=573 PASS.

## Files changed

- `ibarra-app/supabase/migrations/20260909192938_peajes_tarifa_matching_correcciones.sql` (new; CLI-generated path)
- `ibarra-app/supabase/tests/peajes_refresh_tarifas_test.sql` (F14-19 atomic-save cases; existing guardar payloads now send `action` + `fecha_vigencia_inicio`; plan 44→63)
- `ibarra-app/supabase/tests/peajes_tarifario_rpc_test.sql` (editor start/overlap/lock/privilege cases; plan 15→22)
- `ibarra-app/supabase/tests/peajes_tarifa_importe_cases_test.sql` (payloads only: `action` + `fecha_vigencia_inicio` so cases still hit the integer check)

Not changed: Task 2 migration, `peajes_tarifa_vigencia_test.sql`, `tarifas_normalizadas`, `.pnpm-store/**`, F14-18 `task-N-report.md`. No git commit.

## Self-review findings

- Signatures, `SECURITY INVOKER`, and grants match the brief. PUBLIC/anon have no EXECUTE.
- Close-then-insert order is in the helper; review inserts never call the close branch; the Task 2 promote trigger still ignores `REVISAR`.
- Lock order is present in both writers with alias `t` as the tests require.
- CamelCase contract keys (`peajeId`, `fechaVigenciaInicio`, `categoriaCalculada`, `candidateId`, …) are accepted alongside snake_case.
- Empty `Nuevo` remains a UI no-op; SQL does not invent amounts.
- Task 4 detect/matching RPCs were not touched.

## Issues or concerns

1. **`SIN_CAMBIO` still short-circuits** when `CONFIRM_NEW` amount equals the current pointer amount, even if a start date is supplied. Kept so F14-18 “importe exacto vigente es SIN_CAMBIO” stays green. A validity-only confirm of the same amount would be ignored until a later task decides otherwise.
2. **`pnpm seed:local` EXIT 1** with `null_current_pointers=27` / `directional_history_collisions=27` — same known ETL/collision issue as Task 2. Auth/RBAC/pasadas restored. Not treated as a Task 3 failure.
3. Internal helper `_peajes_aplicar_importe_guardado` is `SECURITY INVOKER` with EXECUTE for `authenticated, service_role` because the public writers are invoker and must be able to call it. Same grant pattern as the dropped Task 2 shim. PUBLIC/anon still have no EXECUTE.

## Confirmation: no git commit, no DESARROLLO write

- HEAD remains `95033bda8434b21473aa51937dfa8831acf0d3b9`.
- `git status` shows the Task 3 migration as untracked and the three test files as modified. No commit, amend, or push.
- All `npx supabase` commands used `--local`. No `--linked`. No `db push`. No MCP remote/schema writes to `kfffigvyvtzyczeiadxh`.

## Fix pass

Review finding: `CONFIRM_NEW` with the same current amount was a no-op (`SIN_CAMBIO`) even when a later `fecha_vigencia_inicio` was supplied. That skipped close, insert, pointer move, and `fecha_actualizacion`, while `peajes_guardar_tarifas_actuales` did not short-circuit.

Did not commit, amend, push, or deploy. Local `npx supabase` from `ibarra-app` only. No DESARROLLO write. SQL signatures unchanged. SECURITY INVOKER and grants unchanged.

### What changed

- `ibarra-app/supabase/tests/peajes_refresh_tarifas_test.sql` (tests first): F14-18 `SIN_CAMBIO` now sends the current start `2026-07-01` and still asserts no extra row. New F14-19 cases: same amount `14500` with later start `2026-09-01` must return `ACTUALIZADA`, close the prior open row, insert open `CONFIRMADO`, move `current_tarifa_id`, bump `fecha_actualizacion`, and grow history 2→3. Plan 63→65.
- `ibarra-app/supabase/migrations/20260909192938_peajes_tarifa_matching_correcciones.sql`: `SIN_CAMBIO` only when amount matches **and** start is null or equal to the current start. Same-amount later start takes the close-then-insert path. Overlap validation still rejects `v_fecha < v_cur_inicio`; it skips the `<=` raise only for the same-amount same-start no-op so F14-18 can return `SIN_CAMBIO` instead of `P0001`. Route-editor RPC left without a `SIN_CAMBIO` branch.

### TDD RED/GREEN (SIN_CAMBIO)

**RED** — tests only, live writer still short-circuited on amount:

```
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 1.** Files=1 Tests=65 **Failed 3/65** (tests 33, 35–36).

```
# Failed test 33: "F14-18 guardar importe exacto vigente con el mismo inicio es SIN_CAMBIO"
#         have: P0001
#         want: SIN_CAMBIO
# Failed test 35: "F14-19 CONFIRM_NEW mismo importe e inicio posterior no es SIN_CAMBIO"
#         have: SIN_CAMBIO
#         want: ACTUALIZADA
# Failed test 36: "F14-19 CONFIRM_NEW mismo importe e inicio posterior cierra e inserta CONFIRMADO abierto"
```

Right reasons: same start still hit the overlap `<=` raise (`P0001`); later start still returned `SIN_CAMBIO` and did not close/insert.

**GREEN** — after the migration edit and `npx supabase db reset --local --no-seed` (EXIT 0; applied `20260909192938_peajes_tarifa_matching_correcciones.sql`):

```
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 0.** Files=1, Tests=65, PASS.

### Covering tests

All from `ibarra-app`, `--local` only.

| Command | Exit | Result |
|---|---|---|
| `npx supabase db reset --local --no-seed` | 0 | Applied the edited Task 3 migration. |
| `npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql` (GREEN) | 0 | **Files=1, Tests=65, PASS** |
| `npx supabase test db --local supabase/tests/peajes_tarifario_rpc_test.sql` | 0 | **Files=1, Tests=22, PASS** |
| `npx supabase test db --local` | 0 | **Files=18, Tests=575, PASS** (was 573; +2 SIN_CAMBIO assertions) |
| `pnpm seed:local` | 1 | Auth/RBAC/pasadas restored. Tarifario v2 ETL: `null_current_pointers=27`, `directional_history_collisions=27`. Known; not this fix. |

### Remaining concerns

1. Same-start `SIN_CAMBIO` still needs the overlap-loop exemption (`v_fecha = v_cur_inicio` and same amount). A same-start confirm with a **different** amount still raises `P0001`, which is intended.
2. `pnpm seed:local` EXIT 1 with `null_current_pointers=27` — unchanged known ETL issue.
3. No extra route-editor pgTAP for same-amount later start; that writer already had no `SIN_CAMBIO` short-circuit. Refresh and editor now agree on the later-start event.

No git commit. HEAD unchanged. No `--linked` / no DESARROLLO.
