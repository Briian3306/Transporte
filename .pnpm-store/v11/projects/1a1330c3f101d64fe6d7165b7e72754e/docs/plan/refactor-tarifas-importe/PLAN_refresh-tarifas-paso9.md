# Refresh Tarifas During Pasadas Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect distinct tariff-price candidates in the final Paso 9 review, classify them against current and historical v2 tariffs with a 1% tolerance, and require an explicit, in-place tariff refresh before a new price can be imported.

**Architecture:** Paso 9 owns the final-review state and never writes tariffs directly. A refresh service extracts the import scope, resolves tariff contexts in batch, obtains the comparable amount through the existing template engine, and calls a batch database matcher. A shared, extracted tariff-editor board is hosted in a large top-positioned `DialogComponent`; a dedicated transactional RPC appends immutable history and returns a precise update summary.

**Tech Stack:** Angular 19 standalone components, RxJS, existing Peajes transformation engine and tariff services, Supabase/Postgres RPCs with pgTAP, Jasmine/Karma, and the project DialogComponent.

**Spec:** User request “Implementación - Refresh de Tarifas durante la carga de pasadas” (2026-09-08); [F14-16 gradual tariff plan](./PLAN_migracion-gradual-tarifas-tarifa-importe.md); [F14-17 Tarifario documentation](../../06-components/peajes/tarifario.md).

## Global Constraints

- F14-16 and F14-17 are prerequisites. Keep `tarifas_normalizadas`, its writers, its FKs, the legacy `tarifa_status`, and all existing public F14-16 RPC signatures intact.
- Use `tarifas.current_tarifa_id -> tarifa_importe.importe` as the current amount. `tarifa_importe` business fields are immutable; a refresh appends rather than overwrites.
- A price matches when `abs(precio_comparado - importe) / importe <= 0.01`; the boundary is inclusive. Never alter a stored historical amount to make a comparison pass.
- `sentido` is `IDA`, `VUELTA`, or `AMBAS`; explicit `IDA`/`VUELTA` wins over `AMBAS`, while requested `AMBAS` matches only `AMBAS`.
- `status` remains `PICO` or `NO_PICO`. If a source row lacks it, resolve it only from exactly one matching current or historical price; do not infer it from `hora_*`. An unmatched candidate without a status requires an explicit choice in the dialog.
- `PRECIO` is the tariff candidate value. Apply `normalizarImportesPasada` only to obtain the persisted document sign, then compare its absolute physical price; `IMPORTE_NETO` is only a fallback when `PRECIO` is absent because the wizard synthetically derived the price.
- `requiere_normalizacion_iva` determines whether the existing `PeajesMotorTransformacionService` pipeline supplies the comparison value. No SQL or dialog code may divide by `1.21`, reproduce rounding, or normalize an already normalized value.
- The refresh dialog is shown only for `NEW_TARIFF` candidates. Historical matches are informative; current matches do not interrupt the flow.
- An empty Nuevo cell is a no-op. The user must explicitly save the proposed changes; never create a price automatically.
- Existing `peajes_confirmar_carga` invoice validation, duplicate handling, document grouping, and mass-import semantics remain unchanged. A new unresolved tariff blocks only the final Paso 9 confirmation.
- All SQL verification runs against Supabase CLI local. Do not apply, reset, seed, or write to DESARROLLO without a separate explicit authorization. Do not commit or push.

---

## Current Flow and Design Decisions

`Paso9RevisionComponent` currently renders the standardized rows and calls `PeajesCargaService.confirmarCarga` immediately. It correctly preserves per-document `rowIndexes` for mass imports, but has no tariff gate. Paso 8 already calls `TarifaValidationService` as a non-blocking diagnostic; its matcher and IVA adapter are reusable, but its per-row presentation is not a refresh workflow.

The route-only `TarifarioEditorComponent` already has the required dual `NO_PICO` / `PICO` board, blank-Nuevo semantics, history links, and bulk save. It cannot be embedded as-is because it reads route parameters and navigates on cancel. Extract its board/form interaction into a presentational component and keep both route editor and dialog as small hosts.

| Situation | Refresh result | Paso 9 behavior |
|---|---|---|
| Exactly one current configuration is within 1% | `CURRENT_TARIFF` | Informational count; confirmation remains available. |
| Current misses but exactly one immutable history value is within 1% | `HISTORICAL_TARIFF_MATCH` | Informational warning; no dialog and no history insert. |
| No current/history value matches and status is known | `NEW_TARIFF` | Open dialog and prefill the affected PICO or NO_PICO cell. |
| No current/history value matches and status is absent | `STATUS_REQUIRED` | Open dialog with detected amount; user selects PICO or NO_PICO before save. |
| Two tariff contexts match the same status-less value | `STATUS_AMBIGUOUS` | Show candidates and require user selection; never choose one silently. |
| Missing/non-numeric category or station context | `CONTEXT_INCOMPLETE` | Show a blocking final-review error; no fabricated tariff or price zero. |

When exactly one detected amount belongs to a new cell, that cell is prefilled. If a cell has two or more distinct detected amounts, show every amount and occurrence count, leave Nuevo blank, and require the user to select/type one amount. This prevents one invoice from silently selecting among conflicting prices.

For a missing `tarifas` identity, the save request must include `requiere_normalizacion_iva`. The dialog shows this as a required explicit checkbox/select for the new cell; it may display a sibling configuration as a suggestion, but it must not silently default to `false`. Existing identities retain their stored flag.

## Data Flow

```text
Paso 9 opens (included documents only)
  -> extract physical PRICE candidates and retain original row indexes
  -> deduplicate resolver contexts (station, category, requested status, requested direction)
  -> batch prepare contexts and learn which candidates require existing IVA normalization
  -> normalize only those representative rows through PeajesMotorTransformacionService
  -> deduplicate matching candidates by resolved context + comparable price
  -> batch current/history comparison (1%)
  -> CURRENT/HISTORICAL summary, or Refresh Tarifas dialog for unresolved candidates
  -> explicit dialog save: append immutable tarifa_importe / create missing tarifas
  -> re-run the same batch comparison; only all-current or historical results unlock confirmation
  -> confirm each document with existing RPC, then associate eligible persisted pasadas
```

The candidate extractor uses the exact set exposed by `Paso9RevisionComponent.pasadas`, not `validacion.validas`. This preserves RN-17 document filtering in mass mode. A candidate carries all original row indexes and count, so one DOCK SUD price shared by fifty rows causes one comparison but still produces an accurate result count and post-confirmation association list.

## Planned File Structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql` | Batch preparation/detection and secure transactional refresh-save RPCs; current F14-16 functions remain callable. |
| `supabase/tests/peajes_refresh_tarifas_test.sql` | pgTAP coverage for direction, current/history/new decisions, concurrency-safe no-duplicate save, and RLS grants. |
| `src/app/components/peajes/models/tarifa-refresh.contracts.ts` | Refresh candidate, result, dialog, and saved-summary interfaces plus its injection token. |
| `src/app/components/peajes/models/peajes.types.ts` | Optional `SENTIDO` and `TARIFA_STATUS` mapping keys; mandatory-column list remains unchanged. |
| `src/app/components/peajes/services/tarifa-refresh.service.ts` | Candidate extraction, two-stage batching, existing IVA adapter use, result grouping, save/recheck orchestration. |
| `src/app/components/peajes/services/tarifa-refresh.service.spec.ts` | Candidate grouping, 1% result mapping, IVA, missing status, and retry-safe save tests. |
| `src/app/components/peajes/services/peajes-tarifario.service.ts` | Typed wrappers for refresh preparation, detection, and transactional save RPCs. |
| `src/app/components/peajes/models/tarifario.contracts.ts` | Typed refresh RPC request/response methods on `PeajesTarifarioService`. |
| `src/app/components/peajes/tarifario/tarifario-editor-board.component.{ts,html,css}` | Reusable all-category PICO/NO_PICO board with current, detected, Nuevo, validation, and history events. |
| `src/app/components/peajes/tarifario/tarifario-editor.component.*` | Route host reduced to data loading, navigation, and save orchestration while retaining current behavior. |
| `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.{ts,html,css}` | Large in-place refresh dialog host, context sections, explicit IVA choice for new identities, and save status. |
| `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.{ts,html,css,spec.ts}` | Final-review tariff gate, summary, confirmation sequencing, and regression tests. |
| `src/app/components/shared/dialog/dialog.component.{ts,html,css,spec.ts}` | Explicit `xl` size and top-centred placement needed by the full tariff board. |
| `src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts` | Stateful Dock Sud mock scenarios for component tests without Supabase. |
| `docs/plan/refactor-tarifas-importe/INDEX.md`, `docs/plan/INDEX.md` | Link this plan while it is planned. |
| `feature_list.json`, `docs/claude-progress.md` | F14-18 status and plan-only decision record. |

## Tasks

### Task 1: Register F14-18 and Freeze Its Scope

**Files:**
- Modify: `feature_list.json`
- Modify: `docs/claude-progress.md`
- Modify: `docs/plan/refactor-tarifas-importe/INDEX.md`
- Modify: `docs/plan/INDEX.md`

**Produces:** F14-18 `not_started`, owned by the Peajes frontend/tariff workflow, depending on F14-16 and F14-17. Its evidence records planning only.

- [ ] Add F14-18 titled `Refresh Tarifas during Paso 9 pasadas import`, with dependencies `F14-16` and `F14-17`, status `not_started`, and no implementation evidence.
- [ ] Add verification criteria for batch current/history detection, 1% tolerance, explicit dialog confirmation, immutable history, missing identity creation, Paso 9 mass-import regression, and local-only SQL/Angular tests.
- [ ] Record that the plan does not alter F14-16/F14-17 evidence, `tarifas_normalizadas`, or DESARROLLO.
- [ ] Add the plan link to both plan indexes.

### Task 2: Define the Refresh Contracts and Candidate Extraction

**Files:**
- Create: `src/app/components/peajes/models/tarifa-refresh.contracts.ts`
- Modify: `src/app/components/peajes/models/peajes.types.ts`
- Modify: `src/app/components/peajes/models/tarifario.contracts.ts`
- Test: `src/app/components/peajes/services/tarifa-refresh.service.spec.ts`

**Consumes:** `PasadaEstandarizada`, `TarifaSentido`, `TarifaStatusPico`, F14-16 matching semantics.

**Produces:** The types used by database wrappers, dialog, and Paso 9.

```ts
export type RefreshTarifaCodigo =
  | 'CURRENT_TARIFF'
  | 'HISTORICAL_TARIFF_MATCH'
  | 'NEW_TARIFF'
  | 'STATUS_REQUIRED'
  | 'STATUS_AMBIGUOUS'
  | 'CONTEXT_INCOMPLETE';

export interface CandidatoRefrescoTarifa {
  id: string;
  estacionId: string;
  categoria: number | null;
  statusSolicitado: TarifaStatusPico | null;
  sentidoSolicitado: TarifaSentido;
  precioDirecto: number;
  filaRepresentativa: Record<string, unknown>;
  rowIndexes: number[];
}

export interface CambioRefrescoTarifa {
  peajeId: string;
  estacionId: string;
  sentido: TarifaSentido;
  categoria: number;
  status: TarifaStatusPico;
  importe: number;
  requiereNormalizacionIva: boolean | null;
}
```

- [ ] Write failing tests that extract `PRECIO` before `IMPORTE_NETO`, default missing direction to `AMBAS`, preserve all source row indexes, and exclude no valid price from the candidate count.
- [ ] Write failing tests that turn an NC price into its absolute physical tariff price after calling the existing `normalizarImportesPasada` helper.
- [ ] Add optional `SENTIDO` and `TARIFA_STATUS` keys to `PasadaColumnKey` and its mapped-key list. Keep both absent from `PASADA_COLUMNAS_OBLIGATORIAS`; initialize them as `null` wherever standardized rows are constructed.
- [ ] Implement a pure extractor that groups first by station/category/optional-status/requested-direction/physical-price. Use a non-rounded canonical numeric string only as the map key; retain the original numeric price for comparison.
- [ ] Define typed `prepararRefresco`, `detectarRefresco`, and `guardarRefresco` methods on `PeajesTarifarioService`; do not add direct Supabase calls to Paso 9.
- [ ] Run the focused extraction tests and existing mapping/Step 8 tests to prove optional source keys do not make a legacy file invalid.

### Task 3: Add Batch Refresh RPCs Without Duplicating F14-16 Matching Rules

**Files:**
- Create: `supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql`
- Create: `supabase/tests/peajes_refresh_tarifas_test.sql`

**Consumes:** `tarifas`, `tarifa_importe`, `estaciones.peaje_id`, the F14-16 direction precedence, pointer trigger, and immutable-history trigger.

**Produces:** `peajes_preparar_refresco_tarifas(jsonb)`, `peajes_detectar_refresco_tarifas(jsonb)`, and `peajes_guardar_refresco_tarifas(jsonb)`.

```sql
-- Candidate payload returned in caller order; one row per distinct candidate.
-- p_candidatos element:
-- { id, estacion_id, categoria, status_solicitado, sentido_solicitado,
--   precio_directo, precio_normalizado }
-- Result: current/history/new code, resolved peaje/status/sentido, current amount,
-- matching historical id when applicable, and requiere_normalizacion_iva.
```

- [ ] Write failing pgTAP cases for the Dock Sud current NO_PICO/PICO values, 0.23%, exactly 1%, greater than 1%, historical-only value, and many rows represented by one candidate.
- [ ] Write failing pgTAP cases for `IDA` exact priority, `VUELTA -> AMBAS` fallback, `AMBAS` exact-only, status-less unique price resolution, status ambiguity, and an unmatched status-less price requiring user selection.
- [ ] Extract the common direction/current/history candidate relation into one private SQL helper used by both the new refresh functions and the existing F14-16 public matcher implementation. Keep `peajes_resolver_tarifas_actuales` and `peajes_validar_tarifas_actuales` signatures and result codes unchanged.
- [ ] Implement `peajes_preparar_refresco_tarifas` to return all eligible PICO/NO_PICO configurations for each distinct resolver context and their IVA flags; it does no monetary arithmetic.
- [ ] Implement `peajes_detectar_refresco_tarifas` to select `precio_normalizado` only for configurations whose flag is true, test current before history, apply the inclusive 1% tolerance, and return all status candidates when a human choice is needed.
- [ ] Revoke `PUBLIC` execution and grant only `authenticated, service_role`; use `SECURITY INVOKER`, validate JSON types/UUIDs/enums, and verify the station belongs to the supplied peaje before any write.
- [ ] Run `npx supabase db reset --local --no-seed` and `npx supabase test db`; confirm F14-16 and the new suite both pass locally.

### Task 4: Implement Transactional, Immutable Refresh Saving

**Files:**
- Modify: `supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql`
- Modify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.ts`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.spec.ts`

**Consumes:** `CambioRefrescoTarifa[]` and the F14-16 pointer trigger.

**Produces:** A detailed result for the final-review summary.

```ts
export interface TarifaRefrescoGuardada {
  peaje_id: string;
  estacion_id: string;
  sentido: TarifaSentido;
  categoria: number;
  status: TarifaStatusPico;
  tarifa_id: string;
  anterior: number | null;
  nueva: number;
  tarifa_importe_id: string | null;
  accion: 'ACTUALIZADA' | 'IDENTIDAD_CREADA' | 'SIN_CAMBIO';
}
```

- [ ] Write failing pgTAP tests that one request can update both PICO and NO_PICO, creates a missing identity, preserves existing history, advances `current_tarifa_id`, and reports previous/new values.
- [ ] Write failing pgTAP tests that an exact amount already in the same identity returns `SIN_CAMBIO` without another `tarifa_importe`, while an existing identity never changes its IVA flag.
- [ ] Implement `peajes_guardar_refresco_tarifas` as one transaction. Lock each existing identity with `FOR UPDATE`; create an absent identity only when its request contains an explicit IVA boolean; insert only a new positive amount; let the established `AFTER INSERT` trigger update the pointer and update timestamp.
- [ ] Set `fecha_aparicion` from database `now()` inside the save transaction so a user-confirmed current refresh is eligible to become current. Do not trust a client timestamp or overwrite historical dates.
- [ ] Return one result per requested cell in stable input order. Reject incomplete, duplicate-in-payload, mismatched peaje/station, invalid category/status/direction, and missing-IVA-for-new-identity requests before partial writes.
- [ ] Map the RPC result in `PeajesTarifarioSupabaseService`, add service tests for request shape/error propagation, and rerun the local pgTAP suite.

### Task 5: Build a Reusable Full-Width Tariff Editor Board and Dialog Shell

**Files:**
- Create: `src/app/components/peajes/tarifario/tarifario-editor-board.component.ts`
- Create: `src/app/components/peajes/tarifario/tarifario-editor-board.component.html`
- Create: `src/app/components/peajes/tarifario/tarifario-editor-board.component.css`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.{ts,html,css,spec.ts}`
- Modify: `src/app/components/shared/dialog/dialog.component.{ts,html,css,spec.ts}`

**Consumes:** Existing `tarifario.helpers.ts`, editor contracts, and the visual interaction shown in the supplied reference image.

**Produces:** A presentation-only board reusable by both the route editor and the dialog; existing route behavior stays intact.

- [ ] Write failing board tests for all supplied categories, `—` for a missing current identity, empty Nuevo as no change, invalid numeric input, detected-price rendering, and keyboard focus order.
- [ ] Extract the two-lane current/Nuevo board from `TarifarioEditorComponent`. Give it inputs for rows, drafts, detected prices, read-only current data, and a flag controlling category addition; expose typed events for draft changes and history requests.
- [ ] Keep the route editor as the owner of routing, load/save, category addition, and history dialog. Run its existing 37-spec suite after the extraction.
- [ ] Add `size="xl"` and `placement="top"` to `DialogComponent`; `xl` is `min(1150px, 100%)`, and top placement centers horizontally with a viewport-top offset while retaining a scrollable body and visible action footer.
- [ ] Add dialog tests for `xl` and top-placement classes while preserving the default `md`/center behavior, Escape, backdrop-close option, and projected footer actions.

### Task 6: Implement Refresh Candidate Orchestration and the Modal Host

**Files:**
- Create: `src/app/components/peajes/services/tarifa-refresh.service.ts`
- Create: `src/app/components/peajes/services/tarifa-refresh.service.spec.ts`
- Create: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- Create: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.html`
- Create: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.css`
- Create: `src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts`

**Consumes:** Tasks 2–5, `TarifaComparisonAdapterService`, the selected template configurations, and `PEAJES_TARIFARIO_SERVICE`.

**Produces:** `TARIFA_REFRESH_SERVICE` with `analizar`, `guardar`, and `revalidar` operations plus a self-contained dialog host.

```ts
export interface TarifaRefreshService {
  analizar(input: {
    pasadas: PasadaEstandarizada[];
    documentos: ReadonlyArray<WizardDocumentoGrupo>;
    configuraciones: ConfiguracionPlantilla[];
  }): Promise<ResumenRefrescoTarifas>;
  guardar(cambios: CambioRefrescoTarifa[]): Promise<TarifaRefrescoGuardada[]>;
}
```

- [ ] Write failing service tests proving resolver contexts are deduplicated before the preparation RPC and only distinct resolved-context/comparable-price candidates reach detection.
- [ ] Write failing service tests proving the existing adapter is called once per representative row only when at least one eligible configuration requires IVA normalization; direct amounts remain untouched otherwise.
- [ ] Implement two-stage orchestration: prepare contexts, calculate comparable prices with the existing adapter, group candidates, then detect current/history/new in one batch. Map every distinct candidate result back to all original row indexes.
- [ ] Implement the dialog with one vertically stacked section per `peaje + estacion + sentido`, never tabs. Each section loads all configured categories, displays PICO and NO_PICO side by side, marks detected values, and pre-fills only an unambiguous new cell.
- [ ] For `STATUS_REQUIRED`/`STATUS_AMBIGUOUS`, display the detected amounts and require the reviewer to select PICO or NO_PICO before the board accepts a Nuevo value. For a missing identity, require the new cell's IVA selection before enabling Guardar cambios.
- [ ] Make Cancel close the dialog without saving and leave Paso 9 on the same screen. Make save show per-cell server errors without discarding unaffected drafts; after a successful save emit the detailed summary and require caller revalidation.
- [ ] Implement a stateful Dock Sud mock covering current, historical, one new NO_PICO, one new PICO, conflicting detected amounts, and server failure so component tests never depend on a live database.

### Task 7: Gate Paso 9, Preserve Mass Imports, and Associate Confirmed Pasadas

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.html`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.css`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`
- Modify: `src/app/components/peajes/services/peajes-carga.service.ts`
- Modify: `src/app/components/peajes/wizard/mocks/peajes-carga.mock.ts`
- Modify: `supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql`

**Consumes:** Tasks 2–6 and existing `TarifaValidationService.asociarTrasConfirmacion`.

**Produces:** A final-review tariff summary and a confirmation gate that operates on exactly the rows each document persists.

- [ ] Write failing Paso 9 tests for: all-current without dialog; historical warning without dialog; new tariff opens dialog and disables Confirmar carga; cancel saves nothing/imports nothing; save/revalidation unlocks confirmation; and the final summary lists station/category/status/direction/previous/new.
- [ ] Write a mass-import regression test with interleaved `rowIndexes`, ensuring analysis uses `pasadasDeDocumentosIncluidos` while each `confirmarCarga` receives its original document subset in the established order.
- [ ] Start analysis in `ngOnInit` after catalogs load and retain a fingerprint of the included standardized rows plus template configuration. Disable confirmation while analysis, dialog review, revalidation, or tariff save is active.
- [ ] Render a concise Spanish summary in Paso 9: number of current rows, historical rows, unresolved candidates, and after save a table headed `Tarifas actualizadas` with Estación, Categoría, Estado, Sentido, Anterior, Nueva.
- [ ] Keep historical matches informative. When unresolved candidates exist, open `<app-tarifa-refresh-dialog size="xl" placement="top">`; without `peajes:manage`, show the required-permission message and keep confirmation disabled rather than exposing an unauthorized save.
- [ ] After a successful dialog save, rerun the same analysis. Do not call `confirmarCarga` until no `NEW_TARIFF`, `STATUS_REQUIRED`, `STATUS_AMBIGUOUS`, or `CONTEXT_INCOMPLETE` result remains.
- [ ] Extend the confirmation payload to persist normalized `sentido` for each pasada, defaulting only absent input to `AMBAS`. Update `peajes_confirmar_carga` additively to consume that JSON key while retaining all its document/duplicate semantics; do not overwrite legacy `tarifa_status`.
- [ ] After each successful document confirmation, map returned persisted pasadas by the already preserved subset order and call `asociarTrasConfirmacion` only for `CURRENT_TARIFF`/`HISTORICAL_TARIFF_MATCH` (including a newly saved/revalidated current value). If association fails, show a retriable warning without falsely reporting an import failure or re-inserting the document.

### Task 8: Verify Database, Service, Component, and Manual Flows

**Files:**
- Verify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Verify: `src/app/components/peajes/services/tarifa-refresh.service.spec.ts`
- Verify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`
- Verify: `src/app/components/peajes/tarifario/**/*.spec.ts`
- Verify: `src/app/components/shared/dialog/dialog.component.spec.ts`

- [ ] Run `npx supabase start`, `npx supabase db reset --local --no-seed`, and `npx supabase test db` from `ibarra-app`. Record the command, local environment, exit code, file count, and test count.
- [ ] Run focused Angular tests for tariff refresh service, Paso 9, tariff editor, tariff service, shared dialog, existing adapter, and Paso 8; then run `npx tsc --noEmit -p tsconfig.app.json` and `npx tsc --noEmit -p tsconfig.spec.json`.
- [ ] Use the local seeded UI to manually verify the supplied Dock Sud scenario: duplicate 11,975.15 and 14,968.96 prices do not open the dialog; 12,500 and 15,500 prefill their respective cells; save appends history; the summary displays both changes; confirmation stays on Paso 9 until complete.
- [ ] Manually verify an older 12,010 price against current 14,500/historical 12,000 is labelled historical and creates neither a dialog nor a history row.
- [ ] Manually verify a status-less unmatched value requires a PICO/NO_PICO choice, a missing identity shows `—` rather than zero, a dialog cancel makes no write, and a retry after a save cannot duplicate the same amount.
- [ ] Inspect local rows to prove previous `tarifa_importe.importe` values are unchanged, only intended appended records exist, their parents point to the new current records, and legacy tariff fields remain unchanged.

### Task 9: Document Only Verified Behavior and Close F14-18

**Files:**
- Modify: `docs/06-components/peajes/tarifario.md`
- Modify: `docs/modulos/peajes.md`
- Modify: `docs/backend/peajes/tarifas-tarifa-importe.md`
- Modify: `docs/backend/peajes/index.md`
- Modify: `feature_list.json`
- Modify: `docs/claude-progress.md`
- Modify: `docs/session-handoff.md`

- [ ] Document the confirmed Paso 9 detection sequence, candidate deduplication, current/history/new outcome meanings, direction/status rules, IVA adapter boundary, dialog permissions, and immutable save semantics.
- [ ] Document only the implemented refresh RPC signatures and result types; leave legacy tariff documentation and F14-16 compatibility statements intact.
- [ ] Add local verification evidence with exact commands, exit codes, counts, and manual-flow results. Do not use DESARROLLO as evidence.
- [ ] Mark F14-18 `passing` only when every database, Angular, TypeScript, manual-flow, and documentation gate above is complete; otherwise retain `in_progress` with the blocking evidence.

## Final Acceptance Checklist

- [ ] Paso 9 compares imported prices before confirmation and never evaluates duplicate tariff candidates one-by-one unnecessarily.
- [ ] Current values, 0.23% differences, and exactly 1% differences do not open the refresh dialog.
- [ ] Historical values are recognized before any new-tariff decision and never create duplicate history.
- [ ] A new price cannot be imported until a permitted user explicitly saves or resolves it in the in-place dialog.
- [ ] The dialog keeps the user on Paso 9, displays all relevant categories together, places PICO/NO_PICO side by side, shows missing values as `—`, and preserves `sentido` context.
- [ ] New values append immutable `tarifa_importe` records, preserve old amounts, create missing identities only with explicit IVA configuration, and advance the current pointer through the established trigger.
- [ ] The final Paso 9 summary accurately lists tariff changes performed during this import session.
- [ ] Existing invoice validation, duplicate consent, mass document grouping, F14-16 shadow matching, and `tarifas_normalizadas` continue to work.
