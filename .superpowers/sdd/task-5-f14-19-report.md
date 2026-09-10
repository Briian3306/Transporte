# Task 5 report — Extend Angular Contracts and Date-Aware Candidate Extraction

## What you implemented

Task 5 on `codex/tarifa-importe-cases` at HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9` (unchanged). Worked in place. Did not commit, amend, push, or deploy. No DESARROLLO write. Did not alter `tarifas_normalizadas` or SQL migrations. Did not edit `.pnpm-store/**`. Did not implement dialog board / grouping / Paso 9 UI.

Extended Angular refresh contracts and mappers for F14-19 matching codes and validity-aware candidates.

- `RefreshTarifaCodigo` / `RefreshTarifaCodigoRpc` now include `CURRENT_CATEGORY_CORRECTION | HISTORICAL_CATEGORY_CORRECTION | AMBIGUOUS_TARIFF_MATCH | REVIEW_RECORDED` plus the existing fail-closed codes.
- Verbatim `TarifaMatchOption` and `TarifaRefreshDecision` live in `tarifario.contracts.ts` and are re-exported from `tarifa-refresh.contracts.ts`.
- Candidate key is `estacion|categoria|status|sentido|fechaPasada(yyyy-MM-dd)|precio`. Same physical price on two calendar dates is two candidates. Original `rowIndexes` are preserved. Omitted-document indexes are skipped.
- Every candidate/result keeps `categoriaProveedor` (from `pasadas.CATEGORIA`) and `categoriaCalculada` (null at extraction; filled from detect). `pasadas.categoria` is never rewritten.
- Candidates also carry `fechaPasada`, station catalog names, `cases`, and source `candidatePrice`, while keeping `EXPLICIT` / `LANE_MAP` direction confidence.
- FC/NC physical sign still goes through `normalizarImportesPasada`. Conditional IVA still goes through `TarifaComparisonAdapterService` only. No `/ 1.21` in refresh or tarifario services.
- Detect RPC payload now sends `fecha_pasada` and `categoria_proveedor`. Result mapper accepts snake_case and camelCase for correction codes, `possible_matches`, diagnostics, validity dates, and `categoriaCalculada`.
- Summary adds `filasCorreccionCategoria`, `filasNuevasConfirmadas`, `filasSinResolver`, `filasCambioVigencia`. `pendientes` is retained as an alias of unresolved rows for Paso 9.
- `asociacionDesdeResultadoRefresco()` maps current + current-correction → `AL_DIA`, historical + historical-correction + `REVIEW_RECORDED` → `HISTORICA`, and returns no `categoria` field.

Compile-compat only (required new candidate/result fields): `tarifa-refresh.mock.ts`, dialog spec helper, helpers spec helper. No dialog/Paso 9 UI behavior.

## What you tested and test results

All commands from `ibarra-app`. ChromeHeadless Karma. No `--linked`. No DESARROLLO.

| Command | Exit | Result |
|---|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh.service.spec.ts" --include="**/peajes-tarifario.service.spec.ts"` (RED) | 1 | **TOTAL: 12 FAILED, 21 SUCCESS** |
| same command (GREEN) | 0 | **TOTAL: 33 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | clean |
| `npx tsc --noEmit -p tsconfig.spec.json` | 0 | clean |

## TDD Evidence

### RED (tests first, old extractor/mappers still date-unaware)

After the specs compiled (type assertions / `as never` so Karma ran assertions, not load errors):

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh.service.spec.ts" --include="**/peajes-tarifario.service.spec.ts"
```

**EXIT 1.** TOTAL: **12 FAILED, 21 SUCCESS**.

Why expected: candidate id was still `estacion|categoria|status|sentido|precio` (`est-dock-sud|2||AMBAS|5300`); `fechaPasada` / `categoriaProveedor` / `categoriaCalculada` / catalog metadata / `cases` were undefined; omitted row index `1` was kept; detect RPC omitted `fecha_pasada` and `categoria_proveedor`; match options / validity / decisions were unmapped; `asociacionDesdeResultadoRefresco` was missing.

Existing extraction/IVA-false tests stayed green.

### GREEN

After contracts, extractor, refresh orchestration, and RPC mappers:

- Focused suites → **33/33 SUCCESS**, EXIT 0
- `npx tsc --noEmit -p tsconfig.app.json` → EXIT 0
- `npx tsc --noEmit -p tsconfig.spec.json` → EXIT 0

## Files changed

Task 5 product / test files:

- `ibarra-app/src/app/components/peajes/models/tarifa-refresh.contracts.ts`
- `ibarra-app/src/app/components/peajes/models/tarifario.contracts.ts`
- `ibarra-app/src/app/components/peajes/services/tarifa-refresh.service.ts`
- `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.ts`
- `ibarra-app/src/app/components/peajes/services/tarifa-refresh.service.spec.ts`
- `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.spec.ts`

Compile-compat only:

- `ibarra-app/src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.spec.ts`

Did **not** edit SQL, `tarifas_normalizadas`, Paso 9 UI, dialog grouping, or `.pnpm-store/**`. Did **not** commit.

## Self-review findings

- Candidate date is calendar `yyyy-MM-dd` from standardized `FECHA_HORA`; time-of-day does not split groups.
- Prepare is still identity-only (no date). Detect key includes `fechaPasada`.
- `filasNuevasConfirmadas` is `0` from `analizar()`; confirmed-new / validity-change sections that need save results wait for Task 10.
- `filasCambioVigencia` counts detect rows with a non-null `fechaVigenciaFin` (closed interval evidence).
- `pendientes` remains for current Paso 9 copy.
- Association helper does not update `pasadas.categoria`. Paso 9 still associates only `CURRENT_TARIFF` / `HISTORICAL_TARIFF_MATCH` until Task 10 wires the helper.

## Issues or concerns

1. Dialog `guardar()` still sends `CambioRefrescoTarifa` without `action`. Local SQL from Tasks 3–4 requires `CONFIRM_NEW` / `MARK_REVIEW`. Runtime save stays broken until Task 9.
2. `filasNuevasConfirmadas` cannot be derived from detect codes alone; Task 10 should merge save results.
3. Paso 9 `asociarTrasConfirmacion` was not changed (out of scope); category-correction and `REVIEW_RECORDED` associations are ready via `asociacionDesdeResultadoRefresco` but unused.
4. `fechaPasadaCanonico` only parses `yyyy-MM-dd…` standardized values, not raw `dd/MM/yyyy`.
5. `seed:local` / DESARROLLO were not touched.

## Commits

None.
