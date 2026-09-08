# Task 1: Register F14-16 and Freeze the Superseded Scope

Read this first — it is your requirements, with the exact values to use verbatim.

**Owner:** Documentation agent  
**Required skills:** `documentacion-proyecto` at `ibarra-app/.agents/skills/documentacion-proyecto/SKILL.md`  
**Files (only these):**
- Modify: `ibarra-app/feature_list.json`
- Modify: `ibarra-app/docs/plan/refactor-tarifas-importe/INDEX.md`
- Modify: `ibarra-app/docs/plan/INDEX.md`
- Modify: `ibarra-app/docs/claude-progress.md`
- Modify: `ibarra-app/docs/session-handoff.md`

**Produces:** F14-16 as `in_progress`; F14-12–F14-15 explicitly recorded as “superseded by F14-16, never implemented”; F14-11 untouched.

- [ ] Add F14-16 with the approved title, dependency `F14-11`, owner `01-backend-supabase`, and the verification gates in Tasks 2–9.
- [ ] Leave F14-11 status, evidence, fixture paths, and its “no SQL” history unchanged.
- [ ] Record that the new plan supersedes the unstarted F14-12–F14-15 contract because it adds direction, current pointer, audited Cross data, IVA flag, and immutable history.
- [ ] Link this plan from both plan indexes without creating product documentation that claims unimplemented behavior.
- [ ] Do not mark F14-16 passing and do not commit.

## Approved title

Use a title that matches the F14-16 plan goal: direction-aware `tarifas` current-configuration table and immutable `tarifa_importe` price history, preserving audited `PRECIO_LAST`, existing tariff behavior, and the `tarifas_normalizadas` compatibility path.

Suggested title (use unless an existing F14-16 entry already exists — then update that entry, do not duplicate):

`Catálogo tarifas + tarifa_importe v2 (sentido, puntero current, historia inmutable, shadow matching)`

## PRD refs for F14-16

- `docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`
- `docs/plan/refactor-tarifas-importe/PLAN_refactor_tarifas_importe.md` (Wave 0 / F14-11 historical fixture scope only)

## Verification gates to copy onto F14-16 (Tasks 2–9)

Include these as `verification` strings (Spanish, matching neighboring F14 entries):

1. Migración local `20260907100000_peajes_tarifas_v2_schema.sql`: tablas `tarifas` / `tarifa_importe`, unique `(peaje_id, estacion_id, status, categoria, sentido)`, `pasadas.sentido` default `AMBAS`, `pasadas.tarifa_importe_id` nullable; `tarifas_normalizadas` intacta.
2. Migración `20260907101000_peajes_tarifas_v2_current_pointer.sql`: historia append-only, puntero `current_tarifa_id` del mismo padre, promoción por `(fecha_aparicion, created_at, id)`.
3. ETL `migrate-tarifario-v2.mjs` + tests Node: IDs del workbook, linaje 1:1, `PRECIO_LAST` canónico, tolerancia 1% (0.23% / 1% / >1%); sin write a DESARROLLO.
4. Adapter Angular `tarifa-comparison-adapter`: IVA solo vía pipeline existente; SQL sin `/ 1.21`.
5. RPCs `peajes_resolver_tarifas_actuales` y `peajes_validar_tarifas_actuales` en batch; códigos `AL_DIA` / `HISTORICA` / `DESFASADO` / `SIN_TARIFA` / `CATEGORIA_PENDIENTE` / `ESTADO_AMBIGUO`; no mutan historia.
6. Paso 8: diagnósticos de tarifa no bloqueantes; no cambia `dentroTolerancia` ni `puedeContinuar`; asociación post-confirmación solo `AL_DIA`/`HISTORICA`.
7. Carga local + backfill de `pasadas.tarifa_importe_id` solo por linaje único; informe de paridad sin mismatches inexplicados.
8. Readers de compatibilidad / `pwbi_tarifas_v2` solo tras paridad; `pwbi_tarifas` sin cambio no aprobado; sin DROP de legado.
9. `npx supabase db reset --local --no-seed` + `npx supabase test db`; Node ETL/matcher; ng test adapter + tarifa-validation + paso8; `tsc --noEmit` app+spec. Evidencia solo local.

## F14-12..F14-15

Do not implement them. Record they are superseded by F14-16 and were never implemented. Prefer status `blocked` if that is already used in `feature_list.json`; otherwise keep `not_started` and put the superseded sentence in `evidence`. Do not rewrite their historical titles/prd_refs except to add a pointer to the F14-16 plan.

## Indexes

- `ibarra-app/docs/plan/refactor-tarifas-importe/INDEX.md`: Wave 0 remains done; add F14-16 plan as the executable SQL/ETL/UI work.
- `ibarra-app/docs/plan/INDEX.md`: link the gradual plan.

Do **not** create `docs/06-tablas/peajes/tarifas-tarifa-importe.md` or `docs/backend/peajes/tarifas-tarifa-importe.md` in this task (Task 10, after tests are green).

## Global Constraints (binding)

- This plan is for a new feature `F14-16`; retain the delivered F14-11 fixture evidence unchanged.
- Supersede the unimplemented F14-12 through F14-15 proposal only after registering F14-16; never rewrite historical evidence.
- Do not modify, delete, rename, or remove foreign keys from `tarifas_normalizadas` during any migration wave.
- User confirmation 2026-09-07: **do not remove `tarifas_normalizadas` now**. Keep the table, FKs, writers, RPCs, and `pasadas.tarifa_normalizada_id`. Retirement is a later explicit project, not F14-16.
- Do not edit an already-applied migration. All database changes use the new migration files named in this plan.
- `PRECIO_LAST` is the audited source of truth for `tarifa_importe.importe`; it is never changed to make a comparison pass.
- A price matches when `abs(compared_price - importe) / importe <= 0.01`. The boundary is inclusive.
- `sentido` is mandatory and restricted to `IDA`, `VUELTA`, or `AMBAS`; `AMBAS` is a real tariff value, not unknown direction data.
- `requiere_normalizacion_iva` is a separate boolean on `tarifas`; it does not change the meaning of PICO/NO_PICO `status`.
- SQL must not reproduce `ELIMINAR_IVA`. Angular's existing `eliminarIvaStrategy` and `PeajesMotorTransformacionService` are the sole IVA implementation.
- Supabase CLI local is the only SQL test environment. DESARROLLO (`kfffigvyvtzyczeiadxh`) receives no migration, data, or reset in this work without a later explicit user authorization.
- Do not commit or push unless the user explicitly requests it.
- UI strings remain Spanish. This plan extends the existing Paso 8 validation screen; it creates no new screen and does not change invoice-reconciliation blocking rules during the shadow phase.

## Ownership

You are the Documentation agent. You must not modify product SQL or TypeScript. You must not mark F14-16 `passing`.
