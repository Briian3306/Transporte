# Task 11 report — Keep the Standalone Tarifario Compatible with Validity

**Status:** DONE_WITH_CONCERNS  
**Commits:** none  
**Branch work:** uncommitted on `codex/tarifa-importe-cases`

## What you implemented

Standalone route editor (`/peajes/tarifario/...`) now sends one explicit start date with every save batch and shows a truthful validity/diagnostic history.

- Shared `app-date-range-picker` with `mode="single"` and label **Vigente desde**. No end-date control.
- Start date is required only when at least one New cell is non-empty. Blank New stays a no-op (no RPC).
- Each `TarifarioImporteCambio` includes optional `fechaVigenciaInicio`. `save()` stamps the same ISO date on every change so `peajes_guardar_tarifas_actuales` can close the previous open interval.
- `PeajesTarifarioSupabaseService.guardar` maps that field to `fecha_vigencia_inicio` on each JSON element.
- List, editor, and history mappers now read vigencia + diagnóstico + categoría calculada (snake or camel). `fecha_aparicion` stays observation time and is never used as validity.
- History dialog columns: **Desde**, **Hasta**, **Importe**, **Diagnóstico**, **Categoría calculada**, **Vigente**. Legacy nulls: `Sin fecha conocida` for dates, `—` for diagnóstico / categoría calculada.

Paso 9 / refresh-dialog save flow was not changed. Task 12 gates and Task 13 docs were not implemented. No SQL / migrations.

## Tests + results

From `ibarra-app`:

| Command | Result |
|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifario-editor.component.spec.ts"` | **15 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/peajes/tarifario/**/*.spec.ts"` | **59 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/peajes-tarifario.service.spec.ts"` | **14 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | **pass** |
| `npx tsc --noEmit -p tsconfig.spec.json` | **pass** |

No live browser session (covering tests + component DOM assertions for picker and history).

## TDD Evidence RED then GREEN

**RED (behavioral, after compile stubs):** 10 FAILED / 21 SUCCESS on editor + historial-dialog + service specs.

Failures were the missing behavior, not typos:

- `guardar` still sent camelCase `fechaVigenciaInicio` instead of `fecha_vigencia_inicio`.
- `listar` / `obtenerEditor` / `listarHistorial` did not map vigencia / diagnóstico / categoría calculada (`undefined` or hardcoded `null`).
- Editor save without a date still called the RPC.
- Editor save with New cells did not attach `fechaVigenciaInicio`.
- No `app-date-range-picker` (`componentInstance` was null).
- History still used `Fecha` / `fecha_aparicion` (`14/1/24`, `20/8/25`) instead of `Desde` / `Hasta` / `Sin fecha conocida`.

**GREEN:** same suites all pass (15 / 59 / 14) after implementation.

## Files changed

- `ibarra-app/src/app/components/peajes/models/tarifario.contracts.ts`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-editor.component.ts`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-editor.component.html`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-editor.component.css`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-editor.component.spec.ts`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-historial-dialog.component.ts`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-historial-dialog.component.html`
- `ibarra-app/src/app/components/peajes/tarifario/tarifario-historial-dialog.component.spec.ts` *(new)*
- `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.ts`
- `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.spec.ts`
- `ibarra-app/src/app/components/peajes/tarifario/mocks/tarifario.mock.ts`

Not edited: SQL, migrations, Paso 9 refresh-dialog save, Task 12/13, `.pnpm-store/**`.

## Self-review

- Blank New remains omitted by `collectCambios`; `save()` returns before RPC when the batch is empty.
- Filled New without a date does not call `guardar` and surfaces `Indicá la fecha de Vigente desde…`.
- The same `yyyy-MM-dd` start is attached to every change in the batch (RPC close-previous behavior).
- History formatters use only `fechaVigenciaInicio` / `fechaVigenciaFin`. Observation `fecha_aparicion` is kept on the model and is not displayed as validity.
- Shared history dialog is reused by Paso 9; column change is display-only and does not alter refresh save.
- Mock `guardar` now closes the previous open interval when a start date is present, matching the RPC contract used by tests.

## Concerns

1. **History RPC payload is still the F14-17 shape.** `peajes_listar_tarifa_historial` returns only `id`, `importe`, `fecha_aparicion`, `es_actual`. This task was not allowed to change SQL. The mapper is ready; live history will show `Sin fecha conocida` / `—` until a later RPC emits vigencia / diagnóstico / categoría calculada. Same for list/editor payloads if those RPCs do not yet include the extra columns.
2. **No live browser pass.** Verification was Karma + `tsc`, not a logged-in `/peajes/tarifario` session.
3. History keeps an **Importe** column (needed to read the price) in addition to the brief’s Desde / Hasta / Diagnóstico / Categoría calculada / Vigente.
