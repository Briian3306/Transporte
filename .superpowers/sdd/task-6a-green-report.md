# Task 6A GREEN Report — Paso 8 shadow tariff diagnostics

**Status:** DONE  
**Owner:** Frontend experience  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created `TarifaValidationService` and wired Paso 8 so `validar()` always reports a non-blocking `id: 'tarifas'` diagnostic, including the Spanish result table. Invoice errors, `dentroTolerancia`, `puedeContinuar`, and duplicate consent stay independent of tariff outcomes.

Service contract:

- `validarLote(pasadas, configuraciones)` — one `peajes_resolver_tarifas_actuales`, then one `peajes_validar_tarifas_actuales` for resolved rows only; preserves caller `idx`; never calls association.
- Missing `sentido` → `AMBAS`; `IDA`/`VUELTA` forwarded unchanged.
- `TarifaComparisonAdapterService.obtenerPrecioComparable` once per row with `requiere_normalizacion_iva`; others send `precio_normalizado: null`.
- Early resolver codes (`SIN_TARIFA`, etc.) kept; resolver RPC error rejects without validator/adapter.
- `asociarTrasConfirmacion` filters `AL_DIA`/`HISTORICA`, retries the same `p_asociaciones` payload, never sends `tarifa_normalizada_id`.

Paso 8:

- Maps standardized rows (`estacion_id`, `precio_directo` from `IMPORTE_NETO`/`PRECIO`, `categoria`, `fecha_hora`, source `SENTIDO` or `'AMBAS'`) and passes `state.toConfiguracionesPlantilla()`.
- Always appends diagnostic `id: 'tarifas'` (empty lote → `ok`). UUID-error case still has 6 groups.
- `AL_DIA` → `ok` / “Al día”. Other codes and service throw → `warning` + Spanish labels; `tecnico.rpc` from the error when present.
- Does **not** call `asociarTrasConfirmacion` from `validar()`.
- Does **not** push tariff rows into `resultado.errores`.

## What you tested

Local Angular Karma + `tsc --noEmit`. No DESARROLLO, no SQL, no remote write. Did not edit spec files.

### GREEN command 1 — focused specs

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** PASS. Exit 0.  
**TOTAL: 35 SUCCESS** (0 failed). Duration ~1.0 s tests / ~48 s wall.

First run had 1 failure (`Subir igualmente` missing after duplicate consent). HTML now keeps the consent button visible after `subirIgualmente()` (`error || duplicadosConfirmados`) so the existing control stays on screen without changing gating. Re-run: 35 SUCCESS.

Did not touch Paso 9 or `peajes-carga.service.ts`, so those specs were not required.

### GREEN command 2 — app types

```powershell
cd ibarra-app
pnpm.cmd exec npx tsc --noEmit -p tsconfig.app.json
```

**Result:** PASS. Exit 0.

### GREEN command 3 — spec types

```powershell
cd ibarra-app
pnpm.cmd exec npx tsc --noEmit -p tsconfig.spec.json
```

**Result:** PASS. Exit 0.

## Files changed

1. `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.ts` — created
2. `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.ts` — inject service, map rows, always add `tarifas` diagnostic
3. `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.html` — Spanish table + keep `Subir igualmente` after consent
4. `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.css` — compact overflow styles for the tariff table
5. `.superpowers/sdd/task-6a-green-report.md` — this report

Did **not** edit `*.spec.ts`.  
Did **not** edit migrations, ETL, or product docs.  
Did **not** edit Task 5 adapter.  
Did **not** remove or stop writing `tarifas_normalizadas`.  
Did **not** commit.  
Did **not** write DESARROLLO.

## Association-after-confirm (pending)

`asociarTrasConfirmacion` exists and is covered by the service spec. Paso 8 does not call it during `validar()`.

Paso 9 / `peajes-carga.service.ts` were **not** wired, to avoid editing those specs. After a successful `peajes_confirmar_carga`, a later small patch should:

1. Keep the existing `peajes_normalizar_tarifas` call.
2. Call `asociarTrasConfirmacion` only with `AL_DIA`/`HISTORICA` rows, using the returned `pasada_ids`.
3. Retry with the same payload; never send `tarifa_normalizada_id`.
