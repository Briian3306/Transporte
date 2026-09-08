# Task 10 review — Canonical docs and F14-16 close

Reviewer: task-scoped gate against plan Task 10, `task-10-brief.md`, `task-10-report.md`, and required Task 9 evidence. Did **not** re-run the verification suite. Did **not** implement product code. Did **not** commit. Reconstruct of the docs delta is in `review-task-10.diff`.

## Spec Compliance

- ✅ Spec compliant

Canonical pages exist for implemented schema / RPCs / Paso 8 shadow only. `tarifas_normalizadas` is documented as a retained compatibility path (not deleted). `pwbi_tarifas_v2` is documented as parallel, not a replacement of `pwbi_tarifas`. Deferred items are stated honestly. F14-16 is `passing` and Task 9 evidence is actually copied (pgTAP 14/412, Node 53/53, Angular 35+52, tsc app+spec, local, no DESARROLLO). F14-12..F14-15 remain `not_started` with superseded evidence; no unbuilt F14-12..15 scope is presented as shipped. F14-17 editor RPCs stay out of F14-16.

## Spec / file-scope check

Created (as claimed):

- `ibarra-app/docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- `ibarra-app/docs/backend/peajes/tarifas-tarifa-importe.md`

Indexes / compatibility updated (as claimed): `docs/06-tablas/peajes/INDEX.md`, `tarifas-normalizadas.md`, `modelo-datos.md`, `documentos-pasadas.md`, `docs/backend/peajes/index.md`, `docs/backend/functions/index.md`, `pwbi-views.md`, `validacion-carga.md`, `docs/modulos/peajes.md`, `session-handoff.md`, `claude-progress.md`, `docs/plan/INDEX.md`, `docs/plan/refactor-tarifas-importe/INDEX.md`, `feature_list.json` F14-16.

Spot-checked against migrations / Angular (not a suite re-run):

- Unique `(peaje_id, estacion_id, status, categoria, sentido)` matches `tarifas_config_uk`
- Composite pointer `MATCH SIMPLE`; promote by strictly later `(fecha_aparicion, created_at, id)`
- ID lineage `tarifa_importe.id = tarifas_normalizadas_id` when lineage exists
- Direction IDA/VUELTA exact then AMBAS; AMBAS exact-only
- Validator has no `/ 1.21`; 1% inclusive; HISTORICA `error_relativo` vs current `importe`
- `SENTIDO` read from mapped row, default `AMBAS`, not in `PASADA_COLUMN_KEYS`
- `asociarTrasConfirmacion` exists on the service; no call from `peajes-carga` / `peajes_confirmar_carga`
- `_stg_precio_last` in `20260908100000`; grants postgres/service_role only
- `pwbi_tarifas_v2` LEFT JOIN on `current_tarifa_id` + `tarifa_id`; thinner column set

Task 9 report vs F14-16 evidence: same date 2026-09-08, local only, `db reset --local --no-seed` EXIT 0, Files=14 Tests=412, Node 53/53 skipped 0, ng 35 + 52 SUCCESS, tsc both EXIT 0, unexplained 0, pasadas 0/0/0 explained, no DESARROLLO.

## Strengths

- Split is correct: tables page owns columns/pointer/lineage/staging; backend page owns matching, IVA protocol, RPC signatures, Paso 8 non-blocking behavior, and a dedicated **Límites y diferidos** list.
- `tarifas-normalizadas.md` keeps raw-category / earliest-date semantics and adds a compatibility paragraph plus a v2 link. It does not rewrite the legacy table as deleted.
- `pwbi-views.md` keeps the full `pwbi_tarifas` column map, adds `pwbi_tarifas_v2` with NULL `Importe` / missing names/`hora_*`/`fecha_aparicion`, and states v2 is **not** applied to DESARROLLO. Notes that Power Query M still covers only the legacy view.
- Paso 8 is documented as shadow diagnostics that do not enter `errores`, `dentroTolerancia`, or `puedeContinuar`. Invoice reconciliation remains the continuation rule.
- Handoff / progress / feature evidence name the same deferrals Task 9 left: unwired `asociarTrasConfirmacion`, empty-pasadas 0/0/0, thinner v2, `_stg_precio_last` staging.

## Issues

### Critical

None.

### Important

None. F14-16 may stay `passing`.

### Minor

Follow-ups in docs only; do not reopen F14-16.

1. **F14-16 verification bullet still sounds like post-confirm association is in the load path.**
   - File: `ibarra-app/feature_list.json` F14-16 `verification` (“asociación post-confirmación solo AL_DIA/HISTORICA”).
   - Evidence and canonical pages correctly say the RPC/service exist and are **not** wired after `peajes_confirmar_carga`.
   - Fix later: add “servicio/RPC listos; no invocados post-confirm” so the verification list matches the evidence.

2. **Stale F13 verify blurb on the tables index.**
   - File: `ibarra-app/docs/06-tablas/peajes/INDEX.md` (“Evidencia reciente: F13 → 75 PASS”).
   - The date stamp is 2026-09-08 but the verify block still points at F13.
   - Fix later: point at F14-16 local 14/412 or drop the stale number.

3. **Duplicate IA-factura link.**
   - File: `ibarra-app/docs/modulos/peajes.md` (two identical `[IA de factura (F17)]` entries).
   - Cosmetic; remove one.

4. **Broken PRD href in modelo-datos.**
   - File: `ibarra-app/docs/06-tablas/peajes/modelo-datos.md` (`peaje-prd-short.mdort.md.md`).
   - Same typo already exists in `pipeline-editable-paso3.md`. Task 10 touched this file; worth fixing when convenient. Real path is `docs/plan/peaje-prd-short.md.md`.

5. **Plan sidecar still says F14-12..F14-15 “diferidos”.**
   - File: `ibarra-app/docs/plan/normalizacion-tarifa/INDEX.md` (not in the Task 10 required list).
   - Canonical plan INDEX already says superseded / never implemented. Align the sidecar when touching that folder.

6. **Legacy motor pages have no v2 pointer.**
   - `docs/backend/peajes/auditoria-tarifas.md` and `docs/backend/peajes/confirmar-carga.md` still describe only `peajes_normalizar_tarifas` (which remains true).
   - A one-line “v2 asociar not wired; see tarifas-tarifa-importe.md” would prevent a reader from missing the shadow path.

## Assessment

**Task quality:** Approved

**Reasoning:** Task 10 documented implemented F14-16 behavior, copied Task 9 local evidence into `feature_list.json`, and did not paper over deferrals or invent F14-12..15 / Tarifario RPC scope. Minors are index/link polish and do not require setting F14-16 back to `in_progress`.
