# Task 7 GREEN review — backfill, local ETL load, parity

Reviewer: task-scoped gate against Approved RED (`task-7-review.md`) + `task-7-green-brief.md` + plan Task 7. Did **not** re-run `npx supabase test db` (report already exit 0 / Files=14 Tests=397; the migration matches tests 156–165). Did **not** re-run docker load. Reconstruct of the uncommitted GREEN delta is in `review-task-7-green.diff`. Independently replayed the skipped Node assertions against current `splitSentidoCollisions`.

## Spec Compliance

- ✅ Spec compliant

GREEN implements the Approved RED backfill contract, local-only Cruzado load, PRECIO_LAST validator join, and a parity report. pgTAP file is untouched. No DESARROLLO. `tarifas_normalizadas` is not dropped. No `/ 1.21`.

## Spec / file-scope check

GREEN files only:

- `supabase/migrations/20260908100000_peajes_backfill_pasadas_tarifa_importe.sql` (created)
- `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs` (load path on Task 4 parse-only)
- `scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs` (parseArs + local URL tests; one skip)
- `supabase/scripts/validar_migracion_tarifario_v2.sql` (stub replaced)
- `.superpowers/sdd/task-7-parity-report.md` / `.json`

Did **not** edit `peajes_f14_tarifas_importe_test.sql` (header still says the function is absent; `plan(165)` and tests 156–165 match Approved RED). No `*.spec.ts`, product docs, `feature_list.json`, or `claude-progress.md`. Legacy RPCs (`peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`) and Task 2/3/6 migrations untouched.

Hard constraints held in the diff:

- Zero-arg `peajes_backfill_pasadas_tarifa_importe() → void`; `SECURITY INVOKER`; `REVOKE PUBLIC`; `GRANT` `authenticated`, `service_role`
- Unique lineage via `tarifas_normalizadas_id` + `HAVING count(*) = 1` (not coincidental `tarifa_importe.id`; not `min(uuid)`)
- Unmatched / null-lineage coincidental id left null; no history insert
- `UPDATE` only `pasadas.tarifa_importe_id`; `tarifa_normalizada_id` / TN fingerprint / current pointers not rewritten
- Load refuses DESARROLLO URL markers and non-loopback hosts; writes through `docker exec` into `supabase_db_ibarra-app`
- `validar_migracion_tarifario_v2.sql` joins `public._stg_precio_last` (no `WHERE false` stub)
- History `importe` parsed with `parseArs`

Tests: implementer reported pgTAP PASS exit 0, 14/397 including 156–165; Node 52 pass / 1 skip; `--load-local` exit 0. This review did not re-run pgTAP or docker load (gate instruction).

## Strengths

- Backfill SQL is the RED contract in one `UPDATE`: unique `pasadas.tarifa_normalizada_id = tarifa_importe.tarifas_normalizadas_id`, coincidental id without lineage cannot match, no invented `tarifa_importe` rows, idempotent overwrite of the same unique id.
- Local ETL is opt-in (`--load-local`); parse-only remains the default. Fail-closed URL check runs before docker. Audit xlsx is refused.
- Wave 0 IDA/VUELTA shared parent UUID is handled by `splitSentidoCollisions` (VUELTA gets a deterministic new id; history stays on the original; Cruzado `TARIFA_ID` is duplicated). Load reported 27 remaps instead of aborting.
- Validator + parity JSON distinguish explained leftovers (50 without staged PRECIO_LAST, 8 TN unique-key lineage skips, 27 sentido remaps) from unexplained cutover blockers (`unexplained: []`).
- Official pgTAP gate stayed on `db reset --local --no-seed`; post-load dirty-DB collision with estación tests was not used as evidence.

## Issues

### Critical

None.

### Important

None.

**Skipped `splitSentidoCollisions` Node test — allowed deferral, not blocking.**

This is not a hidden ETL integrity failure. The skip was user-requested so the Node gate would not block load while Wave 0 IDA/VUELTA shared UUIDs were being split. Current `splitSentidoCollisions` already does what the skipped test asks: second sentido (`VUELTA`) gets a new parent id, cruzado is duplicated, unique ids = 2. Independent replay of those assertions: **WOULD_PASS**. Production load counted **27** remaps and recorded them as explained. Task 4 RED never included this test (25/25 stayed); GREEN added it and left the skip on. Unskip in Task 9 so the remap cannot regress silently.

**Empty pasadas 0/0/0 after `--no-seed` — expected, not an unexplained gap.**

The official GREEN verify is `db reset --local --no-seed` then pgTAP, then catalog load. That reset leaves `pasadas` empty, so legacy/v2/unmapped = 0 is the empty-table identity, not a hidden mismatch. Unique-lineage backfill is proven by pgTAP fixtures 156–165. The plan’s “local backfill of real pasadas” needs a local pasadas seed that this GREEN brief did not require and that DESARROLLO dump is forbidden to supply. Record for Task 9: if a local pasadas seed exists, re-run load + backfill and treat non-zero unmapped-with-unique-lineage as a cutover blocker. Do not block Task 8 on empty-table zeros.

### Minor

1. **Skip leftover.** Remove `{ skip: ... }` on the sentido-split test in Task 9; the function already satisfies it. Leaving it skipped does not change load behavior.

2. **Real-volume backfill still unproven outside pgTAP.** Catalog loaded (546 / 1282 / 496) but no local pasadas rows were filled. Task 9 should say so in evidence rather than treating 0/0/0 as production-like parity.

3. **`INSERT … ON CONFLICT (id) DO NOTHING` on `tarifas` / `tarifa_importe`.** Parse already fail-closes duplicate parent ids after split. If split were bypassed, this SQL would silently drop the second sentido instead of aborting. Prefer fail-closed inserts for the catalog tables; keep `DO NOTHING` only for `peajes` / `estaciones` / TN stubs.

4. **`public._stg_precio_last` is a permanent local staging table in a product migration.** Documented as non-product, RLS on, revoked from `authenticated`. Fine for the validator join; Task 10 should not describe it as a runtime catalog table.

5. **8 TN unique-key lineage skips** (`peaje+estacion+categoria+importe`, no PICO/NO_PICO) null `tarifas_normalizadas_id` on the colliding history row. Allowed (do not invent / do not violate TN unique). With real pasadas those 8 TN ids would stay unmapped — already explained; re-check at Task 9.

## Assessment

**Task quality:** Approved

**Reasoning:** The zero-arg backfill RPC matches RED tests 156–165 (unique lineage fill, unmatched/coincidental left null, no invented history, zero TN mutation, preserve every `tarifa_normalizada_id`), local ETL is CLI-only and fail-closed against DESARROLLO, and the PRECIO_LAST stub is gone. The skipped Node test does not hide a remap failure (assertions would pass; 27 remaps are explained), and empty pasadas counts are the expected `--no-seed` identity to record at Task 9 rather than a Task 8 blocker.
