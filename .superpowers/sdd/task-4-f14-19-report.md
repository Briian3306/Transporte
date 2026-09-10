# Task 4 report — Implement Validity-Aware Ordered Matching and Category Correction

## What you implemented

Task 4 on `codex/tarifa-importe-cases` at HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9` (unchanged). Worked in place. Did not commit, amend, push, or deploy. Local `npx supabase` from `ibarra-app` only. No `--linked`. No DESARROLLO write.

Modified the Task 3 migration `ibarra-app/supabase/migrations/20260909192938_peajes_tarifa_matching_correcciones.sql`. Did not create a new migration. Task 3 `CONFIRM_NEW` / `MARK_REVIEW` writers were not changed.

Added `_peajes_tarifas_matching_candidatos(estacion, categoria, sentido, status, fecha_pasada, precio_directo, precio_normalizado)`. It returns current and historical `tarifa_importe` rows **across all categories** at the station, with `same_category`, `dir_rank`, `current_rank`, `validity_rank`, `diagnostico`, `error_relativo`, and half-open `[inicio, fin)` compatibility. Price selection is unchanged: `precio_normalizado` only when the matched identity’s IVA flag is true. No SQL `/ 1.21`.

Replaced public `peajes_detectar_refresco_tarifas(jsonb)` (the fail-closed wrapper) with a matcher that:

- Parses `categoria_proveedor` (fallback `categoria`) and `fecha_pasada`.
- Fail-closes at the RPC boundary: missing/invalid `sentido_solicitado` → `DIRECTION_REQUIRED`; `unresolvedReason=CONFLICT` → `DIRECTION_CONFLICT`; never defaults to `AMBAS`.
- Safe matches: `abs(comparable - importe) / importe <= 0.01`, compatible validity, `diagnostico IS DISTINCT FROM 'REVISAR'`. Prefer exact direction over AMBAS fallback; prefer known covering intervals (`validity_rank=0`) over unknown legacy (`1`).
- Five-stage order: original-category current → original-category historical → other-category current → other-category historical → unresolved/new.
- If original-category current exists **and** another category’s current also matches, return `AMBIGUOUS_TARIFF_MATCH` (do not auto-pick original).
- Collapse to `CURRENT_CATEGORY_CORRECTION` / `HISTORICAL_CATEGORY_CORRECTION` only when one unique other-category identity remains. Provider category is unchanged; target is `categoria_calculada`.
- Multiple identities → `AMBIGUOUS_TARIFF_MATCH` or existing `STATUS_AMBIGUOUS` / direction codes. No pick by lowest error or amount order. `possible_matches` lists every 1% `TarifaMatchOption`, including `REVISAR`.

Did not implement Angular/UI. Did not alter `tarifas_normalizadas`. Did not edit `.pnpm-store/**`.

## What you tested and test results

All commands from `ibarra-app`, `npx supabase` only, `--local`.

| Command | Exit | Result |
|---|---|---|
| `npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql` (RED, before matcher SQL) | 1 | **Files=1, Tests=78, Failed 11/78** (tests 66–76) |
| `npx supabase db reset --local --no-seed` | 0 | Applied modified `20260909192938_peajes_tarifa_matching_correcciones.sql`. No `--linked`. |
| `npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql` (GREEN) | 0 | **Files=1, Tests=78, PASS** |
| `npx supabase test db --local` | 0 | **Files=18, Tests=588, PASS** |
| Privilege query (`npx supabase db query --local`) | 0 | See below. |
| `pnpm seed:local` | 1 | Auth/RBAC/pasadas restored. Tarifario v2 ETL: `null_current_pointers=27`, `directional_history_collisions=27`. Same known seed failure as Tasks 2–3; not made worse. |

Compared with Task 3 GREEN (`Files=18 Tests=575` after re-review): this task added 13 pgTAP assertions (`refresh` 65→78) and the suite is **588 PASS**.

### Privileges (local)

`prosecdef = false` (SECURITY INVOKER) for `peajes_detectar_refresco_tarifas`, `_peajes_tarifas_matching_candidatos`, `peajes_guardar_refresco_tarifas`, and `peajes_guardar_tarifas_actuales`.

ACL on all four: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. No PUBLIC grant. `anon` has no EXECUTE.

`supabase/.temp/project-ref` is still `kfffigvyvtzyczeiadxh`; no `db push --linked`, no `db reset --linked`, no MCP remote writes.

## TDD Evidence

### RED (tests first, old matcher still original-category only)

```
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 1.** Files=1 Tests=78 **Failed 11/78**. Failed tests 66–76.

Why expected: helper did not exist; detect still read only `categoria` (so `categoria_proveedor` payloads were `CONTEXT_INCOMPLETE`); original-category matcher returned `NEW_TARIFF` / `CURRENT_TARIFF` instead of correction / ambiguous / historical-correction codes.

- Tests 66–67: `_peajes_tarifas_matching_candidatos` missing.
- Tests 68, 71: unique 5300 Category 2 PICO with provider 3 did not return `CURRENT_CATEGORY_CORRECTION`.
- Test 69 / 76: 5300 in Categories 2 and 3 did not return `AMBIGUOUS_TARIFF_MATCH`.
- Test 70: historical Category 2 5300 did not return `HISTORICAL_CATEGORY_CORRECTION`.
- Tests 72–74: `have: CONTEXT_INCOMPLETE` / wanted `NEW_TARIFF` or `HISTORICAL_TARIFF_MATCH` because `categoria_proveedor` was ignored.
- Test 75: covering current with `categoria_proveedor` was `CONTEXT_INCOMPLETE`, not `CURRENT_TARIFF`.

Tests 77–78 (no `/ 1.21`, `DIRECTION_CONFLICT`) already passed on RED: fail-closed direction was already in the wrapper.

### GREEN

After appending the helper + detect rewrite to the Task 3 migration and `db reset --local --no-seed`:

- Focused refresh → **78/78 PASS**
- Full local suite → **Files=18 Tests=588 PASS** (Task 3 save tests included)

## Files changed

Task 4 product / test files:

- `ibarra-app/supabase/migrations/20260909192938_peajes_tarifa_matching_correcciones.sql` (Task 3 path reused; matching/detect appended; save RPCs untouched)
- `ibarra-app/supabase/tests/peajes_refresh_tarifas_test.sql` (plan 65→78; 5300 unique/ambiguous/historical, REVISAR, validity, fail-closed conflict, helper ranks)

Report only:

- `.superpowers/sdd/task-4-f14-19-report.md`

## Self-review

- Five-stage order is encoded as successive buckets; original-current unique still wins when no other-category **current** competes, which keeps Dock Sud 11975.15 as `CURRENT_TARIFF` even though Category 5 historical 12000 is inside 1%.
- Unique 5300 / provider 3 → `CURRENT_CATEGORY_CORRECTION`, `categoria_proveedor=3`, `categoria_calculada=2`.
- Same 5300 on Categories 2 and 3 → `AMBIGUOUS_TARIFF_MATCH` with both options; `tarifa_id` null; not collapsed by error.
- Historical Category 2 5300 with provider 3 → `HISTORICAL_CATEGORY_CORRECTION`, never `NEW_TARIFF`.
- `REVISAR` is never a safe match; it still appears in `possible_matches`.
- Validity uses `[inicio, fin)`; a current pointer that does not cover `fecha_pasada` is not `CURRENT_TARIFF`.
- Fail-closed direction is inlined in the public detect RPC (wrapper replaced). `peajes_detectar_refresco_tarifas_legacy` remains but is unused.
- Save functions from Task 3 still `SECURITY INVOKER`; focused + full suite include those tests.

## Concerns

- Public detect no longer delegates to `_legacy`; dead legacy function stays until a later cleanup. Behavior is covered by pgTAP, including `DIRECTION_REQUIRED` / `DIRECTION_CONFLICT`.
- `possible_matches` is also returned on unique matches so operators see `REVISAR` evidence. Task 5 Angular guards must ignore extra keys until they are typed.
- Cross-category 1% matching can surface `AMBIGUOUS_TARIFF_MATCH` on real catalogs when two **current** identities share an amount. That is required, not accidental.
- Helper/detect use `SET search_path = public` like the existing F14-18 RPCs, not the empty-string advisor preference.
- Docs under `docs/backend/` were not updated (out of Task 4 file list; Task 13).
- `pnpm seed:local` still EXIT 1 with `null_current_pointers=27` (ETL/collisions from Task 2, unchanged).

## No-commit / no-DESARROLLO confirmation

HEAD remains `95033bda8434b21473aa51937dfa8831acf0d3b9`. No commit, amend, push, or deploy. No `--linked`. No DESARROLLO write. `tarifas_normalizadas` untouched. `.pnpm-store/**` not edited.

## Fix pass

Fixed the Important finding: `possible_matches` was built from `amount_hits` (1% only), so station 016 on `2026-03-01` returned `HISTORICAL_TARIFF_MATCH` while still listing the August current 5300 (`es_actual: true`, `tarifa_importe_id` `…3e1`). Task 5/8 would treat that as a selectable option.

Change: `possible` now aggregates only `amount_hits` rows with `compatible_validity`. REVISAR with null dates remains compatible and still appears. Safe-match path unchanged. Task 3 save RPCs untouched. No Angular.

Added pgTAP assertion on `val-hist`: covering historical `…3e0` is present; non-covering current `…3e1` / August pointer with `es_actual` is absent. Plan 78→79.

### TDD

**RED** (test first, matcher SQL unchanged):

```
npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql
```

**EXIT 1.** Files=1 Tests=79 Failed 1/79. Failed test 75: "F14-19 val-hist possible_matches excludes the non-covering current 5300 pointer". Expected: `possible` still aggregated all 1% hits, including the August current.

**GREEN** after `WHERE h.compatible_validity` on `possible` and `npx supabase db reset --local --no-seed` (EXIT 0; applied `20260909192938_peajes_tarifa_matching_correcciones.sql`):

### Covering tests

| Command | Exit | Output |
|---|---|---|
| `npx supabase test db --local supabase/tests/peajes_refresh_tarifas_test.sql` | 0 | `All tests successful.` `Files=1, Tests=79` `Result: PASS` |
| `npx supabase test db --local` | 0 | `All tests successful.` `Files=18, Tests=589` `Result: PASS` |

Focused:

```
Connecting to local database...
/Users/FRANCIS/Documents/progamacion/Transporte/ibarra-app/supabase/tests/peajes_refresh_tarifas_test.sql .. ok
All tests successful.
Files=1, Tests=79,  1 wallclock secs ( 0.04 usr  0.01 sys +  0.00 cusr  0.03 csys =  0.08 CPU)
Result: PASS
```

Full suite:

```
All tests successful.
Files=18, Tests=589,  4 wallclock secs ( 0.25 usr  0.07 sys +  0.22 cusr  0.32 csys =  0.86 CPU)
Result: PASS
```

No commit, amend, push, or deploy. HEAD still `95033bda8434b21473aa51937dfa8831acf0d3b9`. No `--linked`. No DESARROLLO write. `pnpm seed:local` not re-run this pass.
