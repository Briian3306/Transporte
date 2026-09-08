# Task 6A Report — Paso 8 shadow tariff diagnostics (RED only)

**Status:** DONE  
**Owner:** Backend tester (RED)  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created failing Angular specs for F14-16 Task 6A. No validation service, no Paso 8 UI, no types file, no SQL, no ETL, no product docs.

`tarifa-validation.service.spec.ts` demands:

1. **Batch, no N+1** — three rows → one `peajes_resolver_tarifas_actuales` then one `peajes_validar_tarifas_actuales`; caller `idx` order preserved; `validarLote` never calls `peajes_asociar_pasadas_tarifa_importe`.
2. **Direction** — resolver payload sends `IDA`/`VUELTA` as requested; missing mapped `SENTIDO` becomes `AMBAS`. Angular does not collapse IDA/VUELTA to AMBAS (SQL keeps exact-first then AMBAS).
3. **IVA via Task 5 adapter** — `TarifaComparisonAdapterService.obtenerPrecioComparable` is **not** called when `requiere_normalizacion_iva` is false (`precio_normalizado: null`). When one of two rows is flagged, the adapter is called **exactly once** with that `fila` + template `configuraciones`; validator receives the mock comparable price. No `/ 1.21` in the spec.
4. **Early resolver codes** — `SIN_TARIFA` is kept; validator batch contains only the resolved row.
5. **Association** — `asociarTrasConfirmacion` calls `peajes_asociar_pasadas_tarifa_importe` with only `AL_DIA`/`HISTORICA`; retry sends the same payload; no `tarifa_normalizada_id`.
6. **RPC failure** — resolver error rejects; validator and adapter are not called.

`paso8-validacion.component.spec.ts` extends existing TestBeds with a `TarifaValidationService` mock and adds shadow cases:

- `AL_DIA` → diagnostic `id: 'tarifas'` `ok`; Spanish “Al día”; does not add `resultado.errores`; `dentroTolerancia` / `puedeContinuar` unchanged; association not called during `validar()`.
- `HISTORICA`, `DESFASADO`, `SIN_TARIFA`, `CATEGORIA_PENDIENTE`, `ESTADO_AMBIGUO` → non-blocking `warning`.
- Spanish table: Fila, Estación, Categoría, Sentido solicitado/aplicado, Estado, Importe auditado/comparado, Error relativo, Resultado; expandable technical RPC details.
- Service throw → warning + `Detalles técnicos`; invoice path still continuable.
- Duplicate consent (`Subir igualmente`) still gates `puedeContinuar`; tariff warning stays a warning.
- Existing UUID-error case now expects 6 diagnostic groups including `tarifas`.

Did **not** create `tarifa-validation.service.ts`.  
Did **not** edit `paso8-validacion.component.ts` / `.html` or `peajes.types.ts`.  
Did **not** edit migrations.

Wished-for service API (GREEN):

| Export | Contract |
|---|---|
| `validarLote(pasadas, configuraciones)` | Promise; batch resolver then validator |
| `asociarTrasConfirmacion(asociaciones)` | Promise; filter `AL_DIA`/`HISTORICA`; RPC `p_asociaciones` |
| `PasadaValidacionTarifaInput` | `idx`, `estacion_id`, `categoria`, `status?`, `sentido?`, `fecha_hora?`, `precio_directo`, `pasada_id?`, `fila` |
| `ResultadoFilaValidacionTarifa` | idx, codigo, tarifa ids, importe, precio_comparado, error_relativo, peaje_id, sentido_solicitado/aplicado, flag IVA, categoria, status, estacion_id |

## What you tested

Local Angular Karma only. No DESARROLLO, no SQL, no remote write.

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** FAIL (expected RED). Exit 1. Specs **parse**; webpack/tsc fail because the service module is absent, not because of spec syntax.

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** FAIL. Exit 1. Karma: `Found 1 load error`. Duration ~44 s.

**Which RED mode:** service/API absent (Task 5 style). Existing Paso 8 invoice tests **did not execute** (bundle load error). They did **not** fail from a spec syntax error.

**Why this failure is expected:** `tarifa-validation.service.ts` does not exist. Observed:

- Webpack: `Can't resolve './tarifa-validation.service'` (service spec)
- Webpack: `Can't resolve '../../services/tarifa-validation.service'` (Paso 8 spec)
- TypeScript: `error TS2307: Cannot find module './tarifa-validation.service'` (service spec line 9)
- TypeScript: `error TS2307: Cannot find module '../../services/tarifa-validation.service'` (Paso 8 spec line 17)
- No other TS errors in either spec (no implicit-any / syntax errors)

**GREEN:** not this dispatch. Frontend experience adds `tarifa-validation.service.ts`, types, and Paso 8 UI after this RED evidence.

## Files changed

1. `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.spec.ts` — created
2. `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts` — tariff-diagnostic cases + service mock; `validarLote` args asserted (mapped rows, SENTIDO/AMBAS, template configuraciones)
3. `.superpowers/sdd/task-6a-report.md` — this report

Did **not** create `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.ts`.  
Did **not** edit `paso8-validacion.component.ts` / `.html` or `peajes.types.ts`.  
Did **not** edit product docs, SQL, or ETL.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.

## Important review patch (Task 6A RED re-review)

**Date:** 2026-09-07  
**Finding:** Paso 8 never asserted `validarLote` arguments; mock return could hide `validarLote([])`, dropped `SENTIDO`, or empty template configs.

**Change:** `paso8-validacion.component.spec.ts` only. New test `envía a validarLote las pasadas mapeadas, SENTIDO/AMBAS y las configuraciones de plantilla` plus helper `argsValidarLote`. Existing invoice/duplicate-consent tests unchanged.

Asserted after `validar()`:

- `validarLote` called once (not `[]`): two mapped rows with `estacion_id`, `precio_directo` 1840, `categoria` 5, and both `fecha_hora` values.
- Mapped source `SENTIDO: 'IDA'` forwarded as `sentido: 'IDA'`.
- Missing source `SENTIDO` sent as `sentido: 'AMBAS'` (component default at wizard→service boundary).
- Second arg is template `configuraciones` from the selected pipeline (`IMPORTE_NETO` / `ELIMINAR_IVA`), not empty.

Did **not** create `tarifa-validation.service.ts`. Did **not** edit component `.ts`/`.html`. Did **not** commit.

### Re-run RED

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** FAIL (expected RED). Exit 1. Karma: `Found 1 load error`. Duration ~40 s.

**Which RED mode:** service/API absent (same as first RED). Specs parse; webpack/tsc fail because the service module is missing. No spec-syntax / implicit-any errors. Observed:

- Webpack: `Can't resolve './tarifa-validation.service'` (service spec)
- Webpack: `Can't resolve '../../services/tarifa-validation.service'` (Paso 8 spec)
- TypeScript: `error TS2307: Cannot find module './tarifa-validation.service'` (service spec line 9)
- TypeScript: `error TS2307: Cannot find module '../../services/tarifa-validation.service'` (Paso 8 spec line 18)
- Existing Paso 8 invoice tests **did not execute** (bundle load error).

## Self-review findings

- Wished-for API is imported from the module GREEN will create (same RED style as Task 5).
- Adapter is a Jasmine spy; IVA is not reimplemented (`obtenerPrecioComparable` mock return value).
- Shadow phase is asserted as extra diagnostic group, not `ResultadoValidacionCarga.errores`.
- Existing TestBeds provide a no-op/empty `TarifaValidationService` mock so GREEN cannot break invoice tests by constructing a real Supabase client.

## Issues or concerns

None blocking. Notes for the frontend GREEN agent:

1. Inject `TarifaComparisonAdapterService` (class token); call it only when resolver `requiere_normalizacion_iva` is true, once per flagged row.
2. Default missing `sentido` to `AMBAS` in the resolver payload; forward `IDA`/`VUELTA` unchanged. Paso 8 must also send `AMBAS` on the `validarLote` payload when source `SENTIDO` is missing (wizard→service boundary).
3. Do not call `peajes_asociar_pasadas_tarifa_importe` from `validarLote`; only `asociarTrasConfirmacion` after successful confirmation, `AL_DIA`/`HISTORICA` only.
4. Paso 8: always add diagnostic `id: 'tarifas'` (empty lote → `ok`). Warnings never change `dentroTolerancia` / `puedeContinuar` / duplicate consent.
5. Spanish table columns and outcome labels as asserted (`Al día`, `Histórica`, `Desfasado`, `Sin tarifa`, `Categoría pendiente`, `Estado ambiguo`).
6. Do not DROP `tarifas_normalizadas`. Do not add tariff rows to `resultado.errores`.
