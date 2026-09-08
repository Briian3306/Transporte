# Task 5 GREEN — IVA-safe comparison adapter (implementation only)

Read this first. RED spec is review-approved. Do not edit the spec.

**Owner:** Backend write  
**Files:**
- Create: `ibarra-app/src/app/components/peajes/services/tarifa-comparison-adapter.service.ts`
- Do **not** edit `tarifa-comparison-adapter.service.spec.ts`

## Implement

Export `TarifaComparisonInput`, `precioComparable`, and `TarifaComparisonAdapterService` so the spec compiles.

`precioComparable` exactly:

```ts
export function precioComparable(input: TarifaComparisonInput): number {
  if (!input.requiereNormalizacionIva) return input.precioDirecto;
  if (input.precioNormalizado == null) throw new Error('Precio normalizado requerido');
  return input.precioNormalizado;
}
```

Adapter `obtenerPrecioComparable({ precioDirecto, requiereNormalizacionIva, fila, configuraciones })`:

- Flag false: return `precioDirecto`; **never** call `aplicarPipeline`.
- Flag true: call `PeajesMotorTransformacionService.aplicarPipeline` **once** with `[fila]` and `configuraciones`; take `IMPORTE_NETO` from the first result row as `precioNormalizado`; then `precioComparable`.
- Missing/null pipeline importe: throw `Error('Precio normalizado requerido')`.
- Inject the motor via the class token, same as other Peajes services (`providedIn: 'root'`).
- **Must not** contain `/ 1.21` or a duplicate rounding implementation. IVA lives in `eliminarIvaStrategy` / the existing pipeline only.

Reviewer minor (do not change tests): GREEN source check for `/ 1.21` is mandatory because fixtures use 121/100.

## Verify

From `ibarra-app`:
```
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
```
Expect adapter spec PASS. tsc should not fail on this new file (pre-existing errors elsewhere: note them, do not "fix" unrelated code).

No DESARROLLO. No commit. Do not remove `tarifas_normalizadas`.

## Report

Append GREEN evidence to `.superpowers/sdd/task-5-report.md`. Confirm a search of the adapter file finds no `/ 1.21`.
