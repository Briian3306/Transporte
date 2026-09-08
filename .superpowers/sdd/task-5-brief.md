# Task 5 RED — IVA-safe comparison adapter tests only

Read this first. Tasks 2–4 are review-approved. This dispatch is Backend tester RED only.

**Owner (this dispatch):** Backend tester  
**Files:**
- Create: `ibarra-app/src/app/components/peajes/services/tarifa-comparison-adapter.service.spec.ts`
- Do **not** create `tarifa-comparison-adapter.service.ts` (write agent, GREEN)
- Do **not** edit product docs, SQL, ETL, or Paso 8

**Consumes:** existing `PeajesMotorTransformacionService`, `eliminarIvaStrategy`.  
**Produces (this dispatch):** failing Angular spec.

## Contract the tests must demand

From the F14-16 plan:

```ts
export interface TarifaComparisonInput {
  precioDirecto: number;
  precioNormalizado: number | null;
  requiereNormalizacionIva: boolean;
}

export function precioComparable(input: TarifaComparisonInput): number {
  if (!input.requiereNormalizacionIva) return input.precioDirecto;
  if (input.precioNormalizado == null) throw new Error('Precio normalizado requerido');
  return input.precioNormalizado;
}
```

Plus the Angular adapter service:

- `requiere_normalizacion_iva = false` → comparable price is raw `precioDirecto`; do **not** call the template pipeline.
- `requiere_normalizacion_iva = true` → request a pipeline-produced normalized price **exactly once** via the existing `PeajesMotorTransformacionService` / `eliminarIvaStrategy` path; then `precioComparable` uses that value.
- If the flag is true and the pipeline result is missing, throw a controlled error (`Precio normalizado requerido` or equivalent Spanish).
- Adapter must not contain `/ 1.21` or a duplicate rounding implementation. Tests can read the adapter source after GREEN; for RED, assert behavior via mocks of the existing engine (do not reimplement IVA in the spec).

Follow existing Peajes `*.service.spec.ts` patterns (standalone, `TestBed` if needed).

## Verify RED

From `ibarra-app`:
```
pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: FAIL because the adapter is absent (or exports missing). Spec file must compile enough to run and fail for the right reason.

No DESARROLLO. No commit.

## Hard constraints

- SQL must not reproduce `ELIMINAR_IVA` (this task is Angular-only).
- Do not remove `tarifas_normalizadas`.
- Do not implement the service.

## Report

Write `.superpowers/sdd/task-5-report.md` with TDD RED evidence.
