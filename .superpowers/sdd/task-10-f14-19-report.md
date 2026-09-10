# Task 10 report — Five-Part Paso 9 Tariff Summary and Review Gate

## What you implemented

Task 10 on `codex/tarifa-importe-cases`. Worked in `ibarra-app/`. Did not commit, amend, push, or deploy. No DESARROLLO write. Did not alter `tarifas_normalizadas` or SQL. Did not edit `.pnpm-store/**`. Did not implement Task 11. Did not revert Task 8/9 dialog/save work.

Paso 9 now has a six-part tariff summary and a confirmation gate based on explicit persisted decisions:

- Sections: Coincidencias vigentes, Coincidencias históricas, Correcciones de categoría, Tarifas nuevas confirmadas, Marcadas REVISAR, Cambios de vigencia. Empty sections are omitted (no empty-state copy).
- Station **names** (catalog, then candidate `estacionNombre`), never UUIDs/`est-dock-sud`.
- Correction line exactly `Categoría proveedor 3 -> calculada 2`.
- Validity rows: station, category, status, direction, previous price, new price, `Vigente desde` in `dd/MM/yyyy` (calendar parse, no timezone shift).
- Gate: unacknowledged `NEW_TARIFF` / `AMBIGUOUS_TARIFF_MATCH` / status / direction / context codes still block. `REVIEW_RECORDED` does not. Cancel/`onRefreshCancelled` / silent close never counts as acknowledgement.
- After save, Paso 9 re-analyzes then remaps persisted `REVISAR` rows to `REVIEW_RECORDED` (and `CONFIRMADO` + `NEW_TARIFF` to `CURRENT_TARIFF`) from `tarifasActualizadas`. Needed because detect still excludes `REVISAR` from safe matches and would otherwise keep returning `NEW_TARIFF`.
- `filasNuevasConfirmadas` is counted from saved non-`REVISAR` rows (candidate `rowIndexes`), not left at the Task 5 hardcoded `0` on the Paso 9 overlay.
- Post-confirm association uses `asociacionDesdeResultadoRefresco` for current, historical, category-correction, and `REVIEW_RECORDED`. Never sends `pasadas.categoria`. Row index fallback `rowIndexes[i] ?? i` for non-masiva.
- `peajes:manage` still required to write in the dialog. A user without manage can inspect but cannot bypass the gate.
- Preserved: omitted documents, per-document row indexes, FC/NC sign path, duplicate consent passthrough, partial mass-import failures, association warning.

Mock `analizar()` now remembers `guardar()` decisions so a `MARK_REVIEW` re-analyze returns `REVIEW_RECORDED` (and passes documentos/catalog into the extractor).

## What you tested and test results

All commands from `ibarra-app`. ChromeHeadless Karma. No `--linked`. No DESARROLLO.

| Command | Exit | Result |
|---|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/paso9-revision.component.spec.ts"` (first RED) | 1 | **TOTAL: 3 FAILED, 12 SUCCESS** |
| overlay-only RED | 1 | **TOTAL: 1 FAILED, 15 SUCCESS** |
| same command (GREEN) | 0 | **TOTAL: 16 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"` | 0* | **ChromeHeadless 28 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh.service.spec.ts"` | 0 | **TOTAL: 22 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | clean |
| `npx tsc --noEmit -p tsconfig.spec.json` | 0 | clean |

\* Dialog run: ChromeHeadless finished **28 SUCCESS**. An extra Electron client in this environment then re-ran the suite (56 SUCCESS) and karma hung on shutdown; process was killed. Not a product failure.

## TDD Evidence

### RED (tests first, old compact note + NEW_TARIFF-always-blocks gate)

Existing confirm/mass-import tests were first given `SENTIDO: 'AMBAS'` so they fail/pass on the **tariff gate**, not missing direction. Default EST-096 then classifies as `CURRENT_TARIFF` and those tests went green immediately (12 SUCCESS).

New tests then failed for the missing feature:

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/paso9-revision.component.spec.ts"
```

**EXIT 1.** TOTAL: **3 FAILED, 12 SUCCESS**.

Why expected:

- Six-section copy (`Coincidencias vigentes`, `Categoría proveedor 3 -> calculada 2`, `Vigente desde` `01/09/2026`, Hudson/Dock Sud names) was not in the template.
- After mock `MARK_REVIEW` + `onRefreshSaved`, analizar still returned `NEW_TARIFF`, so confirmation stayed blocked and the dialog reopened.
- Association still mapped only `CURRENT_TARIFF` (and would miss corrections / `REVIEW_RECORDED`).

A second RED for production overlay (detect keeps `NEW_TARIFF` after REVISAR save):

**EXIT 1.** TOTAL: **1 FAILED, 15 SUCCESS** — `habilita confirmar tras REVISAR persistido aunque re-analizar siga en NEW_TARIFF`.

### GREEN

After summary UI, gate/`REVIEW_RECORDED` overlay, association helper, and mock memory of review saves:

- Paso 9 specs → **16/16 SUCCESS**, EXIT 0
- Dialog specs → **28/28 SUCCESS** (ChromeHeadless)
- Refresh service specs → **22/22 SUCCESS**, EXIT 0
- `npx tsc --noEmit -p tsconfig.app.json` → EXIT 0
- `npx tsc --noEmit -p tsconfig.spec.json` → EXIT 0

## Files changed

Task 10 product / test files:

- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.html`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.css`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`
- `ibarra-app/src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts` (REVIEW_RECORDED after review save; documentos/catalog on extraer)

Did **not** edit SQL, `tarifas_normalizadas`, `resumirFilasRefresco` (still `0` at analizar; Paso 9 overlays from saved rows), dialog component, or `.pnpm-store/**`. Did **not** commit.

## Self-review findings

- Completeness: six sections, exact correction/validity copy, name-not-id, REVISAR gate, cancel is not acknowledgement, manage cannot bypass, association via helper without `categoria`, mass-import/omitted/partial/warning preserved, detect-NEW_TARIFF overlay after persisted REVISAR.
- Quality: overlay lives in Paso 9 so production does not depend on detect emitting `REVIEW_RECORDED` (SQL still treats REVISAR as non-safe). Calendar `dd/MM/yyyy` avoids DatePipe timezone skew.
- YAGNI: no Task 11 Tarifario date/history dialog. No SQL. Empty sections omitted rather than six empty headers.
- Tests verify behavior: unresolved blocks; cancel keeps block; persisted REVISAR unblocks even if re-analyze stays `NEW_TARIFF`; association payload has five codes and no `categoria`.

## Issues or concerns

1. Live authenticated browser walkthrough of Paso 9 was not run; verification is component/unit tests.
2. Detect RPC still does not return `REVIEW_RECORDED`; Paso 9 overlays from this session’s `tarifasActualizadas`. A later session that reloads the wizard without those saved rows would see `NEW_TARIFF` again until detect learns `REVIEW_RECORDED` (backend follow-up, not this task).
3. `resumirFilasRefresco().filasNuevasConfirmadas` remains `0` in the shared helper; Paso 9 overwrites the summary count from saved rows.
4. Dialog karma hung after ChromeHeadless 28 SUCCESS because an extra Electron client attached in this environment.
5. Existing confirm fixtures now set `SENTIDO: 'AMBAS'` so they exercise current-match confirmation rather than `DIRECTION_REQUIRED`.

---

## Review-fix round (Critical + Important)

Fix subagent. Did not commit, amend, push, or deploy. Did not write DESARROLLO, SQL, `tarifas_normalizadas`, or `.pnpm-store/**`. Did not implement Task 11. Did not revert Task 8/9 dialog save fan-out.

### What was fixed

- Overlay now remaps persisted `REVISAR` / `CONFIRMADO` for remaining blocking codes (not only `NEW_TARIFF`), then **recomputes** `resumirFilasRefresco` from overlaid resultados so `contextIncomplete` is not stale from pre-overlay `DIRECTION_REQUIRED`.
- True `CONTEXT_INCOMPLETE` (missing station / numeric category, identity not persistable) stays `CONTEXT_INCOMPLETE` and still blocks.
- Overlayed `CONFIRMADO` is `CURRENT_TARIFF` + `diagnostico: 'CONFIRMADO'` so association works, but **Coincidencias vigentes** excludes those rows. Header counts use section lengths so they match the six-part partition.
- After cancel, **Revisar tarifas** reopens the dialog while Confirmar stays disabled when `confirmationBlocked`.
- Association coverage: saved `CONFIRMADO` overlay includes `tarifa_importe_id` and never sends `pasadas.categoria`.

### TDD

**RED** (tests first, no production change):

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/paso9-revision.component.spec.ts"
```

**EXIT 1.** TOTAL: **4 FAILED, 17 SUCCESS**.

Why expected:

- `DIRECTION_REQUIRED` + `contextIncomplete` stayed blocked after persisted `MARK_REVIEW` (stale flag).
- `CONTEXT_INCOMPLETE` was remapped to `REVIEW_RECORDED` instead of staying blocked.
- Overlayed `CONFIRMADO` listed under vigentes and nuevas.
- No `Revisar tarifas` button after cancel.

The CONFIRMADO association spec was already green on existing overlay (`NEW_TARIFF` → `CURRENT_TARIFF`); kept as coverage.

**GREEN** after overlay recompute, CONFIRMADO remap, section partition, and reopen button:

| Command | Exit | Result |
|---|---|---|
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/paso9-revision.component.spec.ts"` | 0 | **TOTAL: 21 SUCCESS** |
| `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh-dialog.component.spec.ts"` | 0 | **TOTAL: 28 SUCCESS** |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | clean |
| `npx tsc --noEmit -p tsconfig.spec.json` | 0 | clean |

Mock/contracts unchanged; `tarifa-refresh.service.spec.ts` not re-run.

### Files changed

- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.html`
- `ibarra-app/src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`

Did **not** edit CSS, mock, SQL, dialog component, or contracts.

### Remaining concerns

1. No live authenticated browser walkthrough of Paso 9.
2. Detect RPC still does not emit `REVIEW_RECORDED`; overlay is session-local.
3. `CONTEXT_INCOMPLETE` is still not in `dialogNeeded`, so **Revisar tarifas** does not appear for missing station/category (intentional: identity was never persistable).
4. `Cambios de vigencia` can still list a row that also appears under nuevas when `fecha_vigencia_inicio` is set (minor; skipped).
