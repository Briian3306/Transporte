# Task 10 — Canonical docs and F14-16 close

**Owner:** Documentation agent (04)  
**Date:** 2026-09-08  
**Skills:** `ibarra-app/.agents/skills/documentacion-proyecto/SKILL.md`, `ibarra-app/.agents/skills/backend-documenter/SKILL.md`  
**Branch:** `feat/f14-16-tarifas-v2`  
**Commits:** none (forbidden). No product SQL/TypeScript. No DESARROLLO.

## Role

Document **implemented** F14-16 behavior only. Consume Task 9 evidence (all local gates green) and the four v2 migrations + backfill. Do not invent unbuilt scope. Mark F14-16 `passing` only after canonical pages exist and Task 9 evidence is copied into `feature_list.json`.

## Sources (read, do not edit migrations)

- Plan: `ibarra-app/docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`
- Task 9: `.superpowers/sdd/task-9-report.md` (gates green; F14-16 still `in_progress` until this task)
- Schema: `20260907100000_peajes_tarifas_v2_schema.sql`
- Pointer: `20260907101000_peajes_tarifas_v2_current_pointer.sql`
- Shadow RPCs: `20260907102000_peajes_tarifas_v2_shadow_matching.sql`
- Compat reader: `20260907103000_peajes_tarifas_v2_compat_cutover.sql`
- Backfill: `20260908100000_peajes_backfill_pasadas_tarifa_importe.sql`

## Create

- `ibarra-app/docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- `ibarra-app/docs/backend/peajes/tarifas-tarifa-importe.md`

## Modify (indexes + compatibility)

- `docs/06-tablas/peajes/INDEX.md`
- `docs/backend/peajes/index.md`
- `docs/06-tablas/peajes/tarifas-normalizadas.md` — legacy raw-category / earliest-date + retained compatibility; link v2. Do **not** rewrite as deleted.
- `docs/06-tablas/peajes/modelo-datos.md`
- `docs/06-tablas/peajes/documentos-pasadas.md`
- `docs/backend/functions/index.md`
- `docs/backend/peajes/pwbi-views.md` — parallel `pwbi_tarifas_v2`; do **not** claim `pwbi_tarifas` was replaced
- `docs/06-components/peajes/validacion-carga.md` — Paso 8 shadow diagnostics (implemented)
- `docs/modulos/peajes.md`
- `docs/session-handoff.md`
- `docs/claude-progress.md`
- `docs/plan/INDEX.md` / `docs/plan/refactor-tarifas-importe/INDEX.md` if needed
- `feature_list.json` F14-16 → `passing` after pages + Task 9 evidence

## Must document (implemented)

- Columns, unique `(peaje_id, estacion_id, status, categoria, sentido)`, composite current pointer, immutable history
- ID lineage `tarifa_importe.id = tarifas_normalizadas_id` when lineage exists; Cross-only UUID otherwise
- Direction: IDA/VUELTA exact then AMBAS; AMBAS exact-only
- IVA: flag + adapter once; SQL has no `/ 1.21`
- 1% inclusive tolerance; batch RPCs resolver / validator / asociar
- Backfill unique lineage only
- Paso 8 non-blocking shadow diagnostics
- `tarifas_normalizadas` **stays**

## Honest deferred / limits

- `asociarTrasConfirmacion` on the service, **not** wired after `peajes_confirmar_carga` (carga still calls `peajes_normalizar_tarifas`)
- Real-volume `pasadas.tarifa_importe_id` backfill unproven outside pgTAP (`--no-seed` empty 0/0/0)
- `pwbi_tarifas_v2` is not a drop-in clone of `pwbi_tarifas`; LEFT JOIN may yield NULL Importe
- `_stg_precio_last` is staging, not runtime catalog
- No DROP of legacy readers
- `SENTIDO` is read if present on the mapped row; default `AMBAS`; not in `PASADA_COLUMN_KEYS`

## Out of scope

- Product code, migrations, commits, DESARROLLO, Tarifario RPC swap (F14-17)
