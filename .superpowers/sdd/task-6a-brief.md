# Task 6A RED — Paso 8 tariff diagnostics tests only

Read this first. Tasks 2–6 are review-approved. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Files you may create/modify:**
- Create: `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.spec.ts`
- Modify: `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts`

**Files you must not create/edit:**
- `tarifa-validation.service.ts` (frontend GREEN)
- `peajes.types.ts` (frontend GREEN) — import wished-for types; if they do not exist yet, import from the future service path or skip-compile via the same pattern as Task 5 (import from the module that GREEN will create, so RED fails as module-not-found **or** extend the existing spec so tests fail on missing API)
- `paso8-validacion.component.ts` / `.html` (frontend GREEN)
- migrations, ETL, product docs

Preferred RED style (match Task 5): specs import the service/types GREEN will add, so `ng test` fails because those exports/files are missing, not because of spec syntax.

## Behavior the tests must demand

Paso 8 remains owner of invoice reconciliation, duplicate consent, required-column, station, and patent diagnostics. Tariff validation is an **additional, separately reported** diagnostic group.

Shadow phase must **not**:
- add tariff outcomes to `ResultadoValidacionCarga.errores`
- change `dentroTolerancia`
- change `puedeContinuar`
- change duplicate-consent handling

Outcomes:
- `AL_DIA` → `ok` tariff diagnostic
- `HISTORICA`, `DESFASADO`, `SIN_TARIFA`, `CATEGORIA_PENDIENTE`, `ESTADO_AMBIGUO`, RPC/service failure → non-blocking `warning`

Service:
- Batch resolve then batch validate (no N+1).
- Missing mapped `SENTIDO` defaults to `AMBAS` (optional source mapping; not a mandatory column).
- IVA: call existing adapter/`PeajesMotorTransformacionService` **exactly once** only when resolver `requiere_normalizacion_iva` is true.
- Association RPC `peajes_asociar_pasadas_tarifa_importe` only after successful confirmation, only `AL_DIA`/`HISTORICA`, retry-safe, retain `tarifa_normalizada_id`.

Spanish table columns (component): row, station, category, requested/applied direction, status, audited amount, compared amount, relative error, outcome. Preserve expandable technical RPC/request/response details.

UI strings in Spanish.

## Verify RED

From `ibarra-app`:
```
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected FAIL because service/API is absent (or existing Paso 8 tests still pass and new describes fail to load). Record which.

No DESARROLLO. No commit. Do not remove `tarifas_normalizadas`.

## Report

Write `.superpowers/sdd/task-6a-report.md` with TDD RED evidence.
