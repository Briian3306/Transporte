# Task 5 Report — IVA-safe comparison adapter (RED only)

**Status:** DONE  
**Owner:** Backend tester (RED)  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created a failing Angular spec for F14-16 Task 5. No adapter service, no SQL, no ETL, no Paso 8, no product docs.

`tarifa-comparison-adapter.service.spec.ts` demands:

1. **`precioComparable`:** `requiereNormalizacionIva = false` returns raw `precioDirecto`; `true` returns pipeline `precioNormalizado`; `true` + `null` throws `/Precio normalizado requerido/`.
2. **Adapter + flag false:** `obtenerPrecioComparable` returns `precioDirecto` and does **not** call `PeajesMotorTransformacionService.aplicarPipeline`.
3. **Adapter + flag true:** calls `aplicarPipeline` **exactly once** with `[fila]` and the selected-template configs; comparable price is the mock `IMPORTE_NETO` (not IVA arithmetic in the spec). Configs use `eliminarIvaStrategy.codigo`.
4. **Missing pipeline result:** empty pipeline or `IMPORTE_NETO: null` throws the same controlled Spanish error after one engine call.

Did **not** create `tarifa-comparison-adapter.service.ts`.  
Did **not** put `/ 1.21` in the spec. Motor is a Jasmine spy; `eliminarIvaStrategy` is only used for the real `ELIMINAR_IVA` code.

## What you tested

Local Angular Karma only. No DESARROLLO, no SQL, no remote write.

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** FAIL (expected RED). Exit 1. Spec **parses**; webpack/tsc fail because the adapter module is absent, not because the spec has invalid syntax.

## TDD Evidence

**RED command:**

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Result:** FAIL. Exit 1. Karma: `Found 1 load error`. Duration ~46 s.

**Why this failure is expected:** `tarifa-comparison-adapter.service.ts` does not exist. Observed:

- Webpack: `Module not found: Error: Can't resolve './tarifa-comparison-adapter.service'`
- TypeScript: `error TS2307: Cannot find module './tarifa-comparison-adapter.service'` (spec line 9)
- No TS syntax errors in the spec file itself

**GREEN:** not this dispatch. Backend write adds `tarifa-comparison-adapter.service.ts` after this RED evidence.

## Files changed

1. `ibarra-app/src/app/components/peajes/services/tarifa-comparison-adapter.service.spec.ts` — created
2. `.superpowers/sdd/task-5-report.md` — this report

Did **not** create `ibarra-app/src/app/components/peajes/services/tarifa-comparison-adapter.service.ts`.  
Did **not** edit product docs, SQL, ETL, or Paso 8.  
Did **not** commit.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.

## Self-review findings

- Wished-for API: export `TarifaComparisonInput`, `precioComparable`, `TarifaComparisonAdapterService.obtenerPrecioComparable({ precioDirecto, requiereNormalizacionIva, fila, configuraciones })`.
- TestBed matches existing Peajes service specs (`PeajesCargaSupabaseService`).
- Engine mocked via `PeajesMotorTransformacionService.aplicarPipeline`; IVA not reimplemented.
- Hard constraint: no `/ 1.21` in spec; GREEN adapter must not contain `/ 1.21` or duplicate rounding.

## Issues or concerns

None blocking. Note for the write agent:

1. When the flag is false, never call `aplicarPipeline`.
2. When the flag is true, call `aplicarPipeline` once; take `IMPORTE_NETO` from the first pipeline row as `precioNormalizado`.
3. Throw `Error` matching `/Precio normalizado requerido/` if that value is missing.
4. Delegate selection to exported `precioComparable`. Do not divide by 1.21 or copy `eliminarIvaStrategy` rounding into the adapter.
5. Inject `PeajesMotorTransformacionService` (class token), same as the rest of Peajes.

---

# Task 5 Report — IVA-safe comparison adapter (GREEN)

**Status:** DONE  
**Owner:** Backend write (GREEN)  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Created `tarifa-comparison-adapter.service.ts` only. Spec untouched.

- Exported `TarifaComparisonInput`, `precioComparable`, and `TarifaComparisonAdapterService` (`providedIn: 'root'`).
- Flag false: `precioComparable` returns `precioDirecto`; `aplicarPipeline` is not called.
- Flag true: `PeajesMotorTransformacionService.aplicarPipeline` once with `[fila]` and `configuraciones`; first-row `IMPORTE_NETO` is `precioNormalizado`.
- Missing/null/non-number pipeline importe throws `Error('Precio normalizado requerido')`.
- IVA stays in the existing pipeline / `eliminarIvaStrategy`. Adapter has no `/ 1.21` and no duplicate rounding.

Did **not** edit the spec.  
Did **not** write DESARROLLO.  
Did **not** remove `tarifas_normalizadas`.  
Did **not** commit.

## GREEN evidence

```powershell
cd ibarra-app
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
```

| Command | Result |
|---|---|
| `ng test` adapter spec | **PASS.** Exit 0. `TOTAL: 7 SUCCESS`. Chrome Headless. ~51 s. |
| `tsc --noEmit -p tsconfig.app.json` | **PASS.** Exit 0. Empty stdout. |
| `tsc --noEmit -p tsconfig.spec.json` | **PASS.** Exit 0. Empty stdout. |

Source search of `tarifa-comparison-adapter.service.ts` for `/ 1.21` and `/1.21`: **no matches**.

## Files changed (GREEN)

1. `ibarra-app/src/app/components/peajes/services/tarifa-comparison-adapter.service.ts` — created
2. `.superpowers/sdd/task-5-report.md` — GREEN evidence appended

Did **not** edit `tarifa-comparison-adapter.service.spec.ts`.
