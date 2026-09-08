# Task 10 — Canonical docs and F14-16 close

**Status:** DONE  
**Owner:** Documentation  
**Date:** 2026-09-08  
**Target:** docs only  
**Commits:** none  
**F14-16 status:** `passing`

Did **not** implement product code. Did **not** edit migrations. Did **not** write DESARROLLO. Did **not** commit.

## Created

- `ibarra-app/docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- `ibarra-app/docs/backend/peajes/tarifas-tarifa-importe.md`
- `.superpowers/sdd/task-10-brief.md`
- `.superpowers/sdd/task-10-report.md` (this file)

## Indexes / compatibility updated

- `docs/06-tablas/peajes/INDEX.md`
- `docs/backend/peajes/index.md`
- `docs/06-tablas/peajes/tarifas-normalizadas.md` — legacy raw-category / earliest-date + retained compatibility; link v2. Table not rewritten as deleted.
- `docs/06-tablas/peajes/modelo-datos.md`
- `docs/06-tablas/peajes/documentos-pasadas.md`
- `docs/backend/functions/index.md`
- `docs/backend/peajes/pwbi-views.md` — parallel `pwbi_tarifas_v2`; `pwbi_tarifas` not replaced
- `docs/06-components/peajes/validacion-carga.md` — Paso 8 non-blocking shadow diagnostics
- `docs/modulos/peajes.md`
- `docs/session-handoff.md`
- `docs/claude-progress.md` — Task 10 close + Task 9 evidence
- `docs/plan/INDEX.md`
- `docs/plan/refactor-tarifas-importe/INDEX.md`
- `ibarra-app/feature_list.json` — F14-16 `passing`; Task 9 evidence copied

## Documented (implemented)

- Unique `(peaje_id, estacion_id, status, categoria, sentido)`; composite current pointer; immutable history
- ID lineage `tarifa_importe.id = tarifas_normalizadas_id` when lineage exists; Cross-only UUID otherwise
- Direction: IDA/VUELTA exact then AMBAS; AMBAS exact-only
- IVA: flag + adapter once; SQL has no `/ 1.21`
- 1% inclusive; batch RPCs resolver / validator / asociar
- Backfill unique lineage only
- Paso 8 non-blocking shadow diagnostics
- `tarifas_normalizadas` stays

## Deferred called out in docs (not papered over)

1. `asociarTrasConfirmacion` on the service, **not** wired after `peajes_confirmar_carga`
2. Real-volume `pasadas.tarifa_importe_id` backfill unproven outside pgTAP (`--no-seed` 0/0/0)
3. `pwbi_tarifas_v2` is not a drop-in clone; LEFT JOIN may yield NULL `Importe`
4. `_stg_precio_last` is staging, not runtime catalog
5. No DROP of legacy readers
6. `SENTIDO` read if present; default `AMBAS`; not in `PASADA_COLUMN_KEYS`

## Task 9 evidence (copied into F14-16)

Date 2026-09-08, local only:

| Gate | Result |
|---|---|
| `npx supabase start` | EXIT 0 |
| `npx supabase db reset --local --no-seed` | EXIT 0 |
| `npx supabase test db` | EXIT 0, Files=14, Tests=412 |
| `node --test scripts/peajes-catalogo-audit/*.test.mjs` | 53/53 skipped 0 |
| ng adapter + validation + paso8 | 35 SUCCESS |
| ng auditoria-tarifas | 52 SUCCESS |
| `tsc --noEmit` app + spec | EXIT 0 |

## Out of scope (unchanged)

Product SQL/TypeScript, DESARROLLO, git commit, F14-17 Tarifario RPC swap, Power Query M workbook for `pwbi_tarifas_v2`.
