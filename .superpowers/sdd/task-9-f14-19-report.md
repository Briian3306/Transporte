# Task 9 report — Fan Out Shared Edits into Independent History Saves

## What you implemented

Task 9 on `codex/tarifa-importe-cases`. Worked in place on Task 8 files. Did not commit, amend, push, or deploy. No DESARROLLO write. Did not alter `tarifas_normalizadas` or SQL migrations. Did not edit `.pnpm-store/**`. Did not implement Task 10 (Paso 9 summary/gate) or Task 11 (standalone Tarifario Vigente desde).

Replaced the mixed `guardar()` payload (`CambioRefrescoTarifa` drafts + rail `TarifaRefreshDecision[]`) with a **flat `TarifaRefreshDecision[]` only** — one element per station tariff identity:

- Shared editor value/status/direction/`Vigente desde` fan out to independent decisions. Dock Sud + Hudson with the same typed amount emit two `CONFIRM_NEW` rows with distinct `estacionId`, `candidateId`, `cases`, and later distinct `tarifa_id` / `tarifa_importe_id`.
- Grouping never sends a shared tariff id, current pointer, or history id. `cases` come from that station’s imported row indexes (Dock Sud 3, Hudson 1 in the required spec).
- Typed `Nuevo` is `CONFIRM_NEW` and requires start date. Rail `CONFIRM_NEW` also requires a non-empty New cell and exact identity. `MARK_REVIEW` uses the candidate amount, keeps `fechaVigenciaInicio` null, and wins over a prefilled New for that station identity.
- IDA and VUELTA drafts in one group go in a **single** `refresh.guardar(...)` call.
- Empty New is a no-op. Duplicate identities/candidate ids are rejected in the client before the RPC. On RPC error the dialog stays open, drafts stay filled, and the typed error message is shown.
- After success the dialog still emits `saved` and closes; Paso 9’s existing `onRefreshSaved` re-runs analysis. No Paso 9 summary UI.

Mock `guardar()` now accepts decisions and returns per-station `tarifa_id` / `tarifa_importe_id` (`tarifa-${estacionId}-${sentido}-${categoria}-${status}`).

## What you tested and test results

All commands from `ibarra-app`. ChromeHeadless Karma. No `--linked`. No DESARROLLO.

| Command | Exit | Result |
|---|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"` (RED) | 1 | **TOTAL: 5 FAILED, 22 SUCCESS** |
| same command after implementation (GREEN) | 0 | **TOTAL: 27 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.helpers.spec.ts"` | 0 | **TOTAL: 28 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | clean |
| `npx tsc --noEmit -p tsconfig.spec.json` | 0 | clean |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/paso9-revision.component.spec.ts"` | 1 | **7 FAILED, 3 SUCCESS** — pre-existing confirmation/dialog-gate failures. Spec never calls mock `guardar()`; `analizar()` was not changed. Task 10 owns this surface. |

## TDD Evidence

### RED (tests first, mixed draft payload still in place)

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"
```

**EXIT 1.** TOTAL: **5 FAILED, 22 SUCCESS**.

Why expected:

- Shared Dock Sud + Hudson save still sent `CambioRefrescoTarifa` (no `action`, no `fechaVigenciaInicio`) and the mock reused `tarifa-2-NO_PICO` / `ti-new-2-NO_PICO`.
- Typed New saved without a start date.
- Rail `CONFIRM_NEW` with empty New still called the RPC.
- IDA+VUELTA payload had no `CONFIRM_NEW` action.
- Duplicate editor identities still reached the RPC.

Existing UI/rail/date-picker specs stayed green.

### GREEN

After decision-only fan-out, per-station mock ids, date/New gates, and client duplicate reject:

- Dialog specs → **27/27 SUCCESS**, EXIT 0
- Helpers suite → **28/28 SUCCESS**, EXIT 0
- `npx tsc --noEmit -p tsconfig.app.json` → EXIT 0
- `npx tsc --noEmit -p tsconfig.spec.json` → EXIT 0

## Files changed

Task 9 product / test files only:

- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- `ibarra-app/src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts`

Did **not** edit SQL, `tarifas_normalizadas`, helpers, board, Paso 9 summary, or `.pnpm-store/**`. Did **not** commit.

## Self-review findings

- Completeness: required Dock Sud + Hudson fan-out, per-station cases, `CONFIRM_NEW` date+New+identity, `MARK_REVIEW` null validity, atomic IDA/VUELTA, empty New no-op, client duplicate reject, typed RPC error preservation, `saved` emit. Analysis re-run stays on Paso 9 `onRefreshSaved` (dialog has no `analizar` hook).
- Quality: one `collectSaveDecisions()` path; rail Confirm/Revisar merge with drafts instead of double-emitting the same identity. Per-station `candidateId` so shared assignment does not reuse Hudson’s id on Dock Sud (SQL would reject duplicate `candidate_id`).
- YAGNI: no Paso 9 summary, no standalone editor date, no SQL. Synthetic `typed:` candidate ids only when a cell has no matching station candidate (VUELTA typed beside an IDA candidate).
- Tests verify behavior: payload shape, distinct result ids, cases 3 vs 1, single RPC for both sentidos, no RPC on empty New / duplicates / missing date, drafts kept on mock failure.

## Issues or concerns

1. `paso9-revision.component.spec.ts` is red (7 failed) from the existing confirmation gate / refresh dialog opening. Out of Task 9 scope; mock `analizar()` unchanged; spec does not call `guardar()`.
2. Duplicate-identity coverage uses a duplicated editor in the test, not a natural UI path. Production grouping should not emit two editors for the same station identity.
3. No authenticated browser pass. Seed / DESARROLLO were not touched.

## Review fix (Important + cheap minor)

Did not commit, amend, push, or deploy. No DESARROLLO / SQL / `.pnpm-store/**`. Did not implement Task 10 or 11.

**Important:** rail `CONFIRM_NEW` treated a New cell as covering only when `cell.categoria === identity.categoria` and `identity.categoria` is `categoriaProveedor`. Assigning an `AMBIGUOUS_TARIFF_MATCH` (provider 3) onto New categoría 2 filled the cell that would save as `categoria_calculated` without Confirmar, then Confirmar failed with “Completá el importe en Nuevo”. Coverage now treats the cell as filled when `assignedByCell` matches that `candidateId`, or when `cell.categoria` equals `categoriaCalculada` / provider category. Emit still uses the cell as `categoriaCalculada` when it differs from the provider (`3` / `2`).

**Minor (cheap):** `reviewCovers` fallback now compares `candidateIdentity(...).sentido` (editor-resolved) instead of raw rail `sentido`. No dedicated spec; left other minors.

### TDD

**RED** — failing spec first, production still matching provider category only:

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"
```

**EXIT 1.** TOTAL: **1 FAILED, 27 SUCCESS**. Expected `'Completá el importe en Nuevo para confirmar la tarifa.'` not to contain `'Nuevo'`; `guardar` called 0 times.

**GREEN** — after `confirmDraftCovers` + `reviewCovers` sentido:

| Command | Exit | Result |
|---|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"` | 0 | **TOTAL: 28 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.helpers.spec.ts"` | 0 | **TOTAL: 28 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | clean |
| `npx tsc --noEmit -p tsconfig.spec.json` | 0 | clean |

### Files changed (this fix)

- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- `.superpowers/sdd/task-9-f14-19-report.md` (append only)

Did not edit the mock. Did not commit.

### Remaining concerns

- `reviewCovers` sentido change has no dedicated spec.
- Pre-existing `paso9-revision.component.spec.ts` failures and no authenticated browser pass remain out of this fix.
