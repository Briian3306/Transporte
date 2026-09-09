# Task 2 report — F14-18 contracts and candidate extraction

**Status:** complete (RED then GREEN). No commit. No DESARROLLO.

## RED

`pnpm.cmd exec ng test --include="**/tarifa-refresh.service.spec.ts" --watch=false --browsers=ChromeHeadless`

Failed as expected: module `tarifa-refresh.contracts` missing; `SENTIDO` / `TARIFA_STATUS` not on `PasadaColumnKey`.

## GREEN

Same include: **TOTAL 10 SUCCESS**.

Regression: `paso5-mapeo` + `paso8-validacion` + `column-recognition` → **TOTAL 45 SUCCESS**. Optional keys did not make a legacy mapped file invalid (`PASADA_COLUMNAS_OBLIGATORIAS` unchanged).

## What landed

- `tarifa-refresh.contracts.ts`: refresh types, `TARIFA_REFRESH_SERVICE` token, pure `extraerCandidatosRefresco`.
- Optional `SENTIDO` / `TARIFA_STATUS` on `PasadaColumnKey` + `PASADA_COLUMN_KEYS`; initialized `null` in `construirPasadasDesdeMapeo`.
- Typed `prepararRefresco` / `detectarRefresco` / `guardarRefresco` on `PeajesTarifarioService`. Implementers throw until Task 4 (TypeScript `implements` requirement; no RPC wrappers).

## Not in this task

SQL/RPC, `TarifaRefreshService` orchestration, Paso 9 UI.
