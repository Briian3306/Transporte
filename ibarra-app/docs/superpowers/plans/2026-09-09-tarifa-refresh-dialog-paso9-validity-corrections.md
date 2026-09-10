# Tariff Refresh Dialog / Paso 9 Validity and Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Paso 9 tariff refresh flow so imported toll prices are normalized, matched against current and historical validity periods, corrected across provider categories when unique, explicitly confirmed or marked for review, and edited without losing any detected station.

**Architecture:** Keep Paso 9 as the orchestration boundary, `TarifaRefreshServiceImpl` as the Angular domain adapter, and Supabase RPCs as the atomic matching/save boundary. Extend the additive `tarifas` + `tarifa_importe` v2 model without deleting or altering `tarifas_normalizadas`; represent confirmed effective periods on immutable amount rows, keep unresolved review rows outside the current pointer, and derive dialog editor groups from the complete detected-station set instead of filtering that set by checkbox state.

**Tech Stack:** Angular 19 standalone components, RxJS, existing Peajes transformation/IVA pipeline, shared dialog/select/date-picker components, Supabase/PostgreSQL migrations and `SECURITY INVOKER` RPCs, pgTAP, Jasmine/Karma, TypeScript, and browser-based visual verification.

**Spec:** The reviewed user brief “Refactor - Tarifa Refresh Dialog / Paso 9” (2026-09-09), the existing [F14-18 Paso 9 refresh plan](../../plan/refactor-tarifas-importe/PLAN_refresh-tarifas-paso9.md), the [Peajes short PRD](../../plan/peaje-prd-short.md), and the current [tarifas / tarifa_importe model](../../06-tablas/peajes/tarifas-tarifa-importe.md).

## Global Constraints

- Do not write to, reset, migrate, or seed DESARROLLO while implementing or verifying this plan. All database work is local until separately authorized.
- Do not delete, rename, replace, or alter `tarifas_normalizadas`, its foreign keys, writers, RPC signatures, or `pasadas.tarifa_normalizada_id`.
- Do not overwrite or delete a historical `tarifa_importe.importe`; historical corrections are a separate workflow.
- The tariff identity remains exactly `(peaje_id, estacion_id, categoria, status, sentido)`, with `status IN ('PICO', 'NO_PICO')` and `sentido IN ('IDA', 'VUELTA', 'AMBAS')`.
- `AMBAS` means that one tariff applies to both directions. It never means unknown direction, and no custom direction values are allowed.
- Never infer `IDA` or `VUELTA` from an amount. Use explicit import data, the existing station/lane mapping, a uniquely applicable `AMBAS` configuration, or an explicit user selection.
- Preserve the provider category in `pasadas.categoria`. A correction is exposed as `categoria_calculated` and through the associated `tarifa_importe_id`; no update may replace the provider value.
- Reuse `TarifaComparisonAdapterService` and `PeajesMotorTransformacionService` for price/IVA normalization. SQL and dialog code must not duplicate `/ 1.21`, rounding, or template-pipeline logic.
- Match amounts using the existing inclusive tolerance `abs(comparable - importe) / importe <= 0.01`.
- A new confirmed tariff requires only `fecha_vigencia_inicio`; its `fecha_vigencia_fin` is `NULL`, and the previous current row closes at the new start date.
- Validity uses half-open date intervals `[fecha_vigencia_inicio, fecha_vigencia_fin)`. Adjacent periods are valid; overlapping confirmed periods are rejected.
- Every station detected in included imported `pasadas` remains represented. Checkbox state means “share this editor,” never “remove/ignore this station.”
- An empty `Nuevo` field is a no-op. Detected values are suggestions and are never persisted merely by opening the dialog.
- UI copy remains Spanish, follows the current Peajes visual language, works on mobile, has visible keyboard focus, and never relies on color alone.

---

## Existing Architecture and Confirmed Gaps

The working tree is clean on `codex/tarifa-importe-cases`. F14-16, F14-17, and F14-18 are recorded as `passing`; this plan is a follow-up feature and must be registered separately before implementation.

### Current flow

1. `Paso9RevisionComponent` loads passes, plates, stations, and station/lane directions, then calls `TarifaRefreshServiceImpl.analizar()`.
2. `extraerCandidatosRefresco()` groups included rows by station, provider category, optional status, resolved direction, and physical price while preserving source `rowIndexes`.
3. `TarifaRefreshServiceImpl` calls `peajes_preparar_refresco_tarifas`, invokes the existing IVA adapter only when the tariff identity requires it, and then calls `peajes_detectar_refresco_tarifas`.
4. The current SQL matcher searches current and historical amounts only inside the original category. It does not return cross-category options or a calculated category.
5. `TarifaRefreshDialogComponent` loads the existing Tarifario board. Its current selection model uses only `grupo.seleccionadas` to load, render, and save; it rejects an empty selection. Consequently, deselected stations disappear instead of becoming independent editors.
6. `peajes_guardar_refresco_tarifas` currently appends `tarifa_importe` using `fecha_aparicion = now()` and relies on the promotion trigger. It has no validity start/end or diagnostic fields.
7. `Paso9RevisionComponent.confirmationBlocked` blocks every unresolved result. Paso 9 summarizes only current/historical/pending counts and saved tariff amounts, not category corrections, diagnostics, validity changes, or unresolved-but-acknowledged rows.

### Current database model

- `tarifas` already owns the complete tariff identity and has `current_tarifa_id` plus `fecha_actualizacion`.
- `tarifa_importe` currently has immutable `importe`, optional `categoria_calculated`, `cases`, `fecha_aparicion`, and optional lineage to `tarifas_normalizadas`.
- The immutability trigger rejects updates to all business fields. It must be revised in the same migration that introduces validity, otherwise than weakened generally.
- `tarifas_normalizadas.diagnostico` currently accepts `MUESTRA_INSUFICIENTE`, `TARIFA_UNICA`, `CATEGORIA`, `POSIBLE_HORARIO`, `REVISAR`, and `CONFIRMADO`.
- The existing current-pointer trigger promotes by `(fecha_aparicion, created_at, id)`. Explicit validity requires promotion to be diagnostic- and effective-date-aware and requires `REVISAR` rows never to become current.

### Required behavior after this ref

```text
included pasadas
  -> existing price/IVA normalization
  -> date-aware exact provider category: current, then historical
  -> exact other category: current, then historical
  -> one unique match: safe match/correction
  -> several matches: explicit choice or REVISAR
  -> no match: confirm a new active tariff or persist a REVISAR candidate
  -> derive editor groups from every detected station
  -> save one independent history record per station identity
  -> re-analyze and render the final Paso 9 tariff summary
```

---

## Design Decisions Fixed by This Plan

### Validity and diagnostics

- Use PostgreSQL `date` for `fecha_vigencia_inicio` and `fecha_vigencia_fin`, because the operator supplies a calendar date and the business examples are day-granular. Keep `fecha_aparicion timestamptz` unchanged as observation/audit time.
- Add all three columns as nullable for backward compatibility. New `CONFIRMADO` rows require a start date; new `REVISAR` rows have both validity fields `NULL` because they are not active periods.
- Reuse the complete six-value diagnostic domain from `tarifas_normalizadas` so lineage backfill is lossless. Runtime Paso 9 writes only `CONFIRMADO` or `REVISAR`.
- Backfill `diagnostico` only when `tarifa_importe.tarifas_normalizadas_id` has exact lineage. Leave it `NULL` when no trustworthy source exists.
- Do not derive historical validity from `fecha_aparicion`. First observation is evidence, not proof of the effective start. Existing start/end values remain `NULL` unless a later reviewed migration has stronger evidence.
- Closing an active row is the sole permitted historical business update: `fecha_vigencia_fin` may transition once from `NULL` to the next confirmed start date. It cannot be reopened or changed again, and every other historical field remains immutable.
- Enable `btree_gist` in the migration and add a partial GiST exclusion constraint for explicitly dated `CONFIRMADO` rows so the same `tarifa_id` cannot have overlapping `[start, end)` periods. Unknown legacy periods and `REVISAR` candidates are excluded from that constraint.
- A `REVISAR` row is an observed candidate, not an active tariff: it never closes the prior row and never becomes `current_tarifa_id`.

### Unresolved candidates

The existing schema requires every `tarifa_importe` to belong to a valid tariff identity. Therefore, “continue as REVISAR” must still have a valid category, status, and allowed direction selected; the user is acknowledging uncertainty about the amount/match, not creating an `UNKNOWN` enum value. If category is ambiguous, retain the provider category as the parent identity and leave `categoria_calculated = NULL`; if the user selects one unique/corrected category, use that category for the parent and store the same value in `categoria_calculated`. If status or direction is ambiguous, the dialog requires an explicit allowed value before it can persist the `REVISAR` record.

Confirmed and review candidates are both associated to the persisted `pasadas` through `pasadas.tarifa_importe_id`. That association preserves the provider category on the pasada while making the calculated tariff identity auditable through the linked `tarifas.categoria`. Existing historical rows are never mutated merely because a new pasada matched them.

### Validity-aware matching

- Add `fechaPasada` (`yyyy-MM-dd`) to the candidate key so one price observed on different service dates can resolve to different historical periods.
- A dated confirmed row is temporally compatible only when the pasada date is inside its half-open interval.
- The current pointer is checked first but is accepted only when its explicit interval covers the pasada date. A legacy current row with unknown validity remains eligible as a compatibility fallback.
- Historical matching prefers a known covering interval, then a legacy row with unknown dates. A known interval that does not cover the pasada date is not a match even when the amount matches.
- `REVISAR` rows appear as possible review candidates but never count as safe current or historical matches.

### Matching result contract

```ts
export type RefreshTarifaCodigo =
  | 'CURRENT_TARIFF'
  | 'HISTORICAL_TARIFF_MATCH'
  | 'CURRENT_CATEGORY_CORRECTION'
  | 'HISTORICAL_CATEGORY_CORRECTION'
  | 'NEW_TARIFF'
  | 'AMBIGUOUS_TARIFF_MATCH'
  | 'STATUS_REQUIRED'
  | 'STATUS_AMBIGUOUS'
  | 'DIRECTION_REQUIRED'
  | 'DIRECTION_CONFLICT'
  | 'CONTEXT_INCOMPLETE'
  | 'REVIEW_RECORDED';

export interface TarifaMatchOption {
  tarifaId: string;
  tarifaImporteId: string;
  categoria: number;
  status: 'PICO' | 'NO_PICO';
  sentido: 'IDA' | 'VUELTA' | 'AMBAS';
  importe: number;
  diagnostico: string | null;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  esActual: boolean;
  errorRelativo: number;
}
```

Every result keeps both `categoriaProveedor` and `categoriaCalculada`. `categoriaCalculada` is set automatically only when exactly one compatible other-category identity remains after status, direction, validity, and tolerance filtering.

### Grouping model

```ts
export interface DetectedStation {
  estacionId: string;
  estacionNombre: string;
  peajeId: string;
  peajeNombre: string;
  color: StationSessionColor;
}

export interface SharedTariffGroupState {
  detectedStations: readonly DetectedStation[];
  sharedStationIds: readonly string[];
}

export function deriveEditorGroups(state: SharedTariffGroupState): string[][] {
  const shared = state.detectedStations
    .map((station) => station.estacionId)
    .filter((id) => state.sharedStationIds.includes(id));
  const independent = state.detectedStations
    .map((station) => station.estacionId)
    .filter((id) => !state.sharedStationIds.includes(id))
    .map((id) => [id]);
  return shared.length >= 2 ? [shared, ...independent] : [...shared.map((id) => [id]), ...independent];
}
```

The source is always `detectedStations`, limited to stations present in included imported pasadas. Catalog rows enrich names/directions/current values but never add unrelated stations and never remove a detected one.

---

## UX Direction

**Subject and job:** A toll-operations analyst is performing the last audit before an import. The dialog’s single job is to turn each detected price discrepancy into an explicit, traceable decision without making the operator remember which station or tariff cell produced it.

**Palette:** Preserve the existing Peajes shell and use `Operational ink #0F233A`, `Action blue #004AC6`, `Surface #FFFFFF`, `Divider #D5E0EC`, `Warning amber #B45309`, and `Review red #B42318`. Assign station trace colors in deterministic detected order from `#6D28D9`, `#15803D`, `#0369A1`, `#B45309`, `#BE123C`, and `#0F766E`; always pair the color dot/stripe with the station name.

**Typography:** Keep the application’s inherited UI family for headings/body and its existing tabular/monospace utility face for amounts, dates, categories, and IDs. Do not add a webfont or a new global type scale.

**Layout:** Each derived editor group is a vertical audit sheet. Its header names every station in the group, then renders one `AMBAS` board or adjacent stacked `IDA` and `VUELTA` boards. A persistent candidate rail above the board shows detected amounts, source stations, counts, and unresolved reasons. The footer remains visible while the dialog body scrolls.

**Signature element:** A station “trace stripe” repeats the same temporary color and station label across selection chips, detected-candidate pills, per-station current values, and autocomplete actions. This is an audit aid, not decoration and not persisted data.

```text
┌ Tariff review ─────────────────────────────────────────────────────┐
│ Stations that share one editor: [● Dock Sud] [● Hudson] [ Gutierrez ]
│                                                                    │
│ ┌ Shared: ● Dock Sud + ● Hudson ─────────────────────────────────┐ │
│ │ Detected: ● Dock Sud $28,740.39 ×2   ● Hudson $28,740.39 ×4   │ │
│ │ VUELTA · Effective from [ dd/mm/yyyy ]                         │ │
│ │ Cat │ NO_PICO Actual │ Detected │ NUEVO │ PICO Actual │ NUEVO │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ ┌ Independent: ● Gutierrez ─────────────────────────────────────┐ │
│ │ ... its own current values, decisions, and history ...        │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                       [Cancel] [Mark review] [Save confirmed]       │
└────────────────────────────────────────────────────────────────────┘
```

New inputs use a solid border, visible background, persistent placeholder `Ingresar nueva tarifa`, and a text label. Hover only strengthens the border; focus uses the established blue outline. On mobile, each category becomes a readable card ordered `Actual -> Detectado -> Nuevo` for NO_PICO and then PICO.

---

## Planned File Map

| Path | Responsibility |
|---|---|
| `feature_list.json` | Register the follow-up feature as `F14-19` after plan approval; do not change F14-18 evidence. |
| `docs/claude-progress.md` | Record plan approval, implementation checkpoints, blockers, and final evidence. |
| `supabase/migrations/` (generated by `npx supabase migration new peajes_tarifa_vigencia_diagnostico`) | Add nullable validity/diagnostic fields, safe backfill, interval constraints, and revised immutable/current-pointer triggers. |
| `supabase/migrations/` (generated by `npx supabase migration new peajes_tarifa_matching_correcciones`) | Replace refresh matching/save RPC implementations and extend history/list/association responses without changing existing RPC signatures. |
| `supabase/tests/peajes_tarifa_vigencia_test.sql` | pgTAP schema, backfill, immutability, interval, pointer, and diagnostic tests. |
| `supabase/tests/peajes_refresh_tarifas_test.sql` | Extend current matching/save coverage with category correction, ambiguity, validity, review, and grouped independent history. |
| `src/app/components/peajes/models/tarifario.contracts.ts` | Validity, diagnostic, category correction, match-option, decision, save, and summary contracts. |
| `src/app/components/peajes/models/tarifa-refresh.contracts.ts` | Date-aware candidate extraction and expanded result codes/metadata. |
| `src/app/components/peajes/services/peajes-tarifario.service.ts` | Map the expanded RPC payloads without direct Supabase calls in components. |
| `src/app/components/peajes/services/tarifa-refresh.service.ts` | Normalize candidates, call ordered matcher, aggregate result classes, save confirmed/review decisions, and re-analyze. |
| `src/app/components/peajes/services/tarifa-refresh.service.spec.ts` | Unit tests for extraction dates, normalization, matching mapping, corrections, ambiguities, and summary counts. |
| `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.ts` | Pure detected-station, grouping, station-color, candidate-assignment, and autocomplete reducers. |
| `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.spec.ts` | Required grouping and safe-autocomplete test matrix. |
| `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.{ts,html,css}` | Render every derived group, status/direction/category choices, single start-date control, candidates, warnings, and explicit save/review actions. |
| `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts` | Component integration for dynamic editors, accessible station traces, assignment, payload fan-out, and unresolved review. |
| `src/app/components/peajes/tarifario/tarifario-editor-board.component.{ts,html,css}` | Distinguish Actual/Detected/Nuevo and support station-labelled detected/current rows while preserving route-editor reuse. |
| `src/app/components/peajes/tarifario/tarifario-editor-board.component.spec.ts` | Input affordance, detected labels/colors, keyboard focus, and mobile-semantic coverage. |
| `src/app/components/peajes/tarifario/tarifario-editor.component.{ts,html,css,spec.ts}` | Require one start date for confirmed route-editor changes and retain blank-New/history behavior. |
| `src/app/components/peajes/tarifario/tarifario-historial-dialog.component.{ts,html}` | Show observation date, validity start/end, diagnostic, calculated category, and current badge. |
| `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.{ts,html,css,spec.ts}` | Explicit review gate, association codes, and final five-section tariff summary for simple and mass imports. |
| `src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts` | Deterministic current/history/correction/ambiguous/review/validity scenarios. |
| `docs/06-components/peajes/tarifario.md` | Verified route editor and Paso 9 UX. |
| `docs/backend/peajes/refresh-tarifas-paso9.md` | Matching order, payloads, transaction semantics, and permissions. |
| `docs/06-tablas/peajes/tarifas-tarifa-importe.md` | New columns, interval semantics, backfill limits, and immutability exception. |
| `docs/backend/peajes/tarifas-tarifa-importe.md` | RPC and compatibility details. |

---

## Implementation Tasks

### Task 1: Register F14-19 and Capture the Baseline

**Files:**
- Modify: `feature_list.json`
- Modify: `docs/claude-progress.md`

**Interfaces:**
- Consumes: F14-16/F14-17/F14-18 `passing` state and this approved plan.
- Produces: One active `F14-19` record with exact verification criteria; no product behavior.

- [ ] Add `F14-19` titled `Tarifa Refresh Dialog validity, category correction and unresolved review`, owned by the tariff/Paso 9 workflow and dependent on F14-16, F14-17, and F14-18.
- [ ] Copy the acceptance cases from this plan into `verification`; set only F14-19 to `in_progress` when implementation begins.
- [ ] Record the clean starting commit and `git status --short` in `docs/claude-progress.md`; do not rewrite prior feature evidence.
- [ ] From `ibarra-app`, run the current focused Angular suites and `npx supabase test db` before changes. Record existing failures as baseline evidence rather than attributing them to F14-19.

### Task 2: Add Validity and Diagnostic Schema with Safe Legacy Backfill

**Files:**
- Create via Supabase CLI: migration basename `peajes_tarifa_vigencia_diagnostico`
- Create: `supabase/tests/peajes_tarifa_vigencia_test.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Interfaces:**
- Consumes: current `tarifa_importe`, `tarifas_normalizadas.diagnostico`, immutable trigger, and current-pointer trigger.
- Produces: nullable `fecha_vigencia_inicio date`, `fecha_vigencia_fin date`, and `diagnostico text` with database-enforced interval rules.

- [ ] Run `npx supabase --version` and `npx supabase migration new peajes_tarifa_vigencia_diagnostico`; use the exact generated path for all edits and progress evidence.
- [ ] Write failing pgTAP assertions for the three columns, `date` types, nullability, six-value diagnostic check, invalid date ordering, and unchanged legacy table/FKs.
- [ ] Write failing pgTAP fixtures proving `tarifas_normalizadas.diagnostico` copies only through exact `tarifas_normalizadas_id` lineage and unlinked history remains `NULL`.
- [ ] Add the columns and named checks. The date check is `fecha_vigencia_fin IS NULL OR fecha_vigencia_inicio IS NULL OR fecha_vigencia_inicio < fecha_vigencia_fin`.
- [ ] Backfill only `diagnostico` through exact lineage. Assert that the migration leaves every pre-existing `fecha_vigencia_inicio` and `fecha_vigencia_fin` `NULL`.
- [ ] Enable `btree_gist` in the standard Supabase extensions schema and add a partial exclusion constraint over `tarifa_id WITH =` and `daterange(fecha_vigencia_inicio, COALESCE(fecha_vigencia_fin, 'infinity'::date), '[)') WITH &&`, limited to `diagnostico = 'CONFIRMADO' AND fecha_vigencia_inicio IS NOT NULL`.
- [ ] Replace `peajes_trg_tarifa_importe_immutable()` so amount, parent, calculated category, cases, observation date, diagnostic, start date, lineage, and creation time remain immutable; allow only one `fecha_vigencia_fin: NULL -> non-NULL` transition that passes the date check.
- [ ] Replace `peajes_trg_tarifa_importe_promote()` so only `CONFIRMADO` rows with a non-null start can promote. `REVISAR` and legacy/null-diagnostic inserts never move the pointer.
- [ ] Run the new pgTAP file alone, then reset local and run the complete database suite. Confirm no write touched DESARROLLO.

### Task 3: Make Confirmed and Review Saves Atomic

**Files:**
- Create via Supabase CLI: migration basename `peajes_tarifa_matching_correcciones`
- Modify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Modify: `supabase/tests/peajes_tarifario_rpc_test.sql`

**Interfaces:**
- Consumes: `TarifaRefreshDecision[]` and the validity schema from Task 2.
- Produces: expanded `peajes_guardar_refresco_tarifas(jsonb)` and `peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)` behavior with unchanged SQL signatures.

```ts
export interface TarifaRefreshDecision {
  candidateId: string;
  action: 'CONFIRM_NEW' | 'MARK_REVIEW';
  peajeId: string;
  estacionId: string;
  categoriaProveedor: number;
  categoriaCalculada: number | null;
  status: 'PICO' | 'NO_PICO';
  sentido: 'IDA' | 'VUELTA' | 'AMBAS';
  importe: number;
  fechaVigenciaInicio: string | null;
  cases: number;
  requiereNormalizacionIva: boolean | null;
}
```

- [ ] Write failing pgTAP tests for a confirmed save that locks the tariff row, validates all payload elements before mutation, closes the prior current row at the new start, inserts a `CONFIRMADO` row with null end, updates `current_tarifa_id`, and updates `tarifas.fecha_actualizacion`.
- [ ] Assert the prior amount, category metadata, observation date, lineage, and cases are byte-for-byte unchanged after its end date closes.
- [ ] Assert `[2026-06-01, 2026-09-01)` followed by `[2026-09-01, infinity)` succeeds, while a start before the active start or inside another known interval rejects the entire batch.
- [ ] Write a failing test that `MARK_REVIEW` inserts `diagnostico = 'REVISAR'` with null validity, does not close the current row, and does not move the pointer.
- [ ] Validate allowed action/status/direction, positive amount, category 0–10, required start for `CONFIRM_NEW`, forbidden start for `MARK_REVIEW`, station ownership, explicit IVA for a missing identity, and duplicate candidate/identity cells before writes.
- [ ] Lock existing `tarifas` rows in deterministic `(peaje_id, estacion_id, sentido, categoria, status)` order to reduce grouped-save deadlock risk.
- [ ] For confirmed rows, update the prior end before inserting the new open interval. For review rows, append only the review observation. Return stable input order and include prior amount, prior end, new start/end, diagnostic, calculated category, and new history ID.
- [ ] Extend the route-editor save RPC JSON elements with `fecha_vigencia_inicio`; keep the function signature unchanged and set `diagnostico = 'CONFIRMADO'` internally.
- [ ] Run focused pgTAP, then the full database suite. Query constraints and function privileges to prove the functions remain `SECURITY INVOKER`, `PUBLIC` has no execute, and `authenticated, service_role` retain only the existing intended access.

### Task 4: Implement Validity-Aware Ordered Matching and Category Correction

**Files:**
- Modify: the Task 3 generated migration
- Modify: `supabase/tests/peajes_refresh_tarifas_test.sql`

**Interfaces:**
- Consumes: `{ id, estacion_id, categoria_proveedor, status_solicitado, sentido_solicitado, fecha_pasada, precio_directo, precio_normalizado }[]`.
- Produces: one ordered result per candidate with result code, provider/calculated categories, safe match or all possible matches, validity metadata, and diagnostic.

- [ ] Write failing pgTAP cases for the exact five-stage order: original-category current, original-category historical, other-category current, other-category historical, then unresolved/new.
- [ ] Add a candidate relation that returns current and historical rows across all categories while retaining `same_category`, direction rank, current rank, validity rank, diagnostic, and relative error.
- [ ] Apply price normalization selection exactly as today: `precio_normalizado` only when the matched identity’s IVA flag is true; never perform IVA arithmetic in SQL.
- [ ] Filter safe matches to the inclusive 1% boundary and compatible validity. Prefer known covering intervals to unknown legacy intervals.
- [ ] Collapse to a correction only when one unique compatible target identity remains. Return `CURRENT_CATEGORY_CORRECTION` or `HISTORICAL_CATEGORY_CORRECTION`, provider category unchanged, and target category as `categoria_calculada`.
- [ ] When more than one category, status, direction, or historical identity remains, return `AMBIGUOUS_TARIFF_MATCH` (or the existing specific status/direction code) plus every `TarifaMatchOption`; do not pick by lowest error or amount order.
- [ ] Exclude `REVISAR` rows from safe current/history matches but include them in `possible_matches` with their diagnostic so the operator sees prior unresolved evidence.
- [ ] Preserve fail-closed direction behavior from `20260908200056_peajes_refresh_direction_fail_closed.sql`: null/conflicting direction never becomes `AMBAS` at the RPC boundary.
- [ ] Add explicit tests for `5300` matching only Category 2 PICO when provider category is 3, the same `5300` appearing in Categories 2 and 3 remaining ambiguous, and a historical Category 2 match never returning `NEW_TARIFF`.

### Task 5: Extend Angular Contracts and Date-Aware Candidate Extraction

**Files:**
- Modify: `src/app/components/peajes/models/tarifa-refresh.contracts.ts`
- Modify: `src/app/components/peajes/models/tarifario.contracts.ts`
- Modify: `src/app/components/peajes/services/tarifa-refresh.service.ts`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.ts`
- Modify: `src/app/components/peajes/services/tarifa-refresh.service.spec.ts`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.spec.ts`

**Interfaces:**
- Consumes: existing standardized pasadas, document signs, lane-direction map, template configuration, and expanded RPCs.
- Produces: typed candidates/results/decisions/summaries used by the dialog and Paso 9.

- [ ] Write failing unit tests proving the candidate key includes the pasada calendar date, preserves all original row indexes, excludes omitted documents, and keeps provider category separate from calculated category.
- [ ] Keep `normalizarImportesPasada` for FC/NC physical sign and `TarifaComparisonAdapterService` for conditional IVA comparison; add a regression test that spies on the adapter so no duplicate normalization path appears.
- [ ] Extend candidates with `fechaPasada`, station display metadata, and source price/count while keeping explicit/lane-map direction confidence.
- [ ] Extend RPC payload mappers and result guards for category correction codes, possible matches, diagnostics, validity dates, and `categoriaCalculada`.
- [ ] Replace aggregate `pendientes` alone with counts for current matches, historical matches, category corrections, confirmed-new rows, unresolved rows, and validity changes; retain old fields temporarily if another component still consumes them.
- [ ] Extend association eligibility to current/history category-correction results and persisted `REVIEW_RECORDED` results without changing `pasadas.categoria`.
- [ ] Run the refresh and tariff-service specs and both TypeScript no-emit builds.

### Task 6: Replace Selection Filtering with a Pure Station Grouping Reducer

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.spec.ts`

**Interfaces:**
- Consumes: all detected imported stations plus compatible tariff-family metadata.
- Produces: deterministic `EditorGroup[]`, station session colors, and safe autocomplete assignments.

- [ ] Write the required failing test: three detected stations selected for sharing derive exactly one editor containing all three.
- [ ] Write the required failing test: two selected and one deselected derive two editors—one shared pair and one singleton.
- [ ] Write the required failing test: no stations selected derive three singleton editors.
- [ ] Write the required failing test: deselecting any station preserves it exactly once across the resulting groups.
- [ ] Add invariant tests that every detected station appears once, no catalog-only station appears, order follows first import occurrence, incompatible direction families cannot share, and changing grouping does not discard drafts belonging to unaffected station identities.
- [ ] Implement `deriveEditorGroups()` from `detectedStations` plus `sharedStationIds`; delete the current early return that rejects an empty selection.
- [ ] Implement deterministic session-only station colors from the six-color palette. Return both color and station label for all chip/candidate view models.
- [ ] Implement safe autocomplete: prefill only when exactly one candidate maps to one identity cell; for a shared group, require every member to propose the same normalized amount for that cell. Multiple distinct prices remain visible and unassigned.
- [ ] Add tests that three distinct unmatched prices remain three candidates, never infer PICO/NO_PICO or direction, and cannot overwrite one another in one `Nuevo` cell.

### Task 7: Refactor the Reusable Tariff Board for Actual / Detected / New Clarity

**Files:**
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.html`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.css`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.spec.ts`
- Verify: `src/app/components/peajes/tarifario/tarifario-editor.component.spec.ts`

**Interfaces:**
- Consumes: tariff rows, drafts, station-labelled current values, and candidate suggestions.
- Produces: a presentation-only editor usable by both the route editor and each Paso 9 group.

- [ ] Write failing tests for persistent `Actual`, `Detectado`, and `Nuevo` labels, station-labelled detected amounts/counts, solid editable fields, placeholder text, `aria-label`, and visible invalid/focus classes.
- [ ] Expand `TarifarioDetectedAmount` with station id/name/color and candidate id. Add an explicit `candidateSelected` event instead of mutating a draft from the board.
- [ ] When grouped current values are identical, render one amount plus all station names; when they differ, render one station-labelled amount per station so an anchor value never masquerades as the group’s current value.
- [ ] Change empty inputs from dashed/subtle to a solid border and distinct editable background. Preserve blank-as-no-op, decimal parsing, tabular numbers, Enter/Tab navigation, and history events.
- [ ] Implement the mobile order `Actual -> Detectado -> Nuevo` for each status and retain reduced-motion/focus behavior.
- [ ] Run board specs and the complete Tarifario component suite to prove route-editor behavior did not regress.

### Task 8: Render Dynamic AMBAS / IDA / VUELTA Editors and Candidate Decisions

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.html`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.css`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- Reuse: `src/app/components/shared/checkbox-multi-select/checkbox-multi-select.component.ts`
- Reuse: `src/app/components/shared/search-select/search-select.component.ts`
- Reuse: `src/app/components/shared/date-range-picker/date-range-picker.component.ts` with `mode="single"`
- Reuse: `src/app/components/shared/dialog/dialog.component.ts`

**Interfaces:**
- Consumes: pure groups/autocomplete from Task 6 and the board from Task 7.
- Produces: explicit candidate decisions with valid category/status/direction and optional confirmed start date.

- [ ] Build station options only from imported `detectedStations`; pass `badgeColor`/`iconColor` to the existing multi-select and set hint text that deselected stations receive independent editors.
- [ ] Rebuild editor groups on every selection change. Preserve singleton editors for deselected stations, including when the shared selection becomes empty.
- [ ] For `AMBAS`, render one board. For stations configured with directional tariffs, render both IDA and VUELTA boards in the same dialog. Never use tabs or navigate away.
- [ ] If explicit/lane context resolves a direction, preselect it. If only one `AMBAS` tariff family applies, preselect `AMBAS`. Otherwise render the existing searchable select with only IDA, VUELTA, and AMBAS and require a user choice.
- [ ] Render a candidate rail with station trace, provider category, calculated category/possible options, detected normalized amount, occurrence count, status, direction, validity evidence, and reason text.
- [ ] Let the operator assign one candidate to a specific allowed cell, confirm it as new, or mark it for review. Never assign by amount alone, and never let two distinct candidates silently replace the same `Nuevo` draft.
- [ ] Use the shared date picker only in `mode="single"`, labelled `Vigente desde`. Do not render or request an end-date control. Require the date only when at least one decision is `CONFIRM_NEW`.
- [ ] Keep `Nuevo` as the editable source of truth. Autocomplete writes a draft suggestion only; opening/reloading/grouping the dialog never calls a save RPC.
- [ ] Add accessible warnings for no compatible tariff, category/status/direction ambiguity, multiple prices, overlap rejection, missing permission, and `REVISAR` consequences.

### Task 9: Fan Out Shared Edits into Independent History Saves

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- Modify: `src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts`

**Interfaces:**
- Consumes: `EditorGroup[]`, board drafts, candidate decisions, and start-date values.
- Produces: a flat `TarifaRefreshDecision[]` with one element per station tariff identity.

- [ ] Write the required failing test that a shared amount for Dock Sud and Hudson produces two save elements with distinct station ids and later receives two distinct `tarifa_id` / `tarifa_importe_id` results.
- [ ] Assert grouping shares only value, status, direction, and selected start date; it never reuses a tariff id, current pointer, history id, cases snapshot, or station id.
- [ ] Compute `cases` per station/candidate from that station’s imported row indexes instead of copying a combined group count to every history row.
- [ ] For `CONFIRM_NEW`, require non-empty New, exact identity, and start date. For `MARK_REVIEW`, require exact identity and candidate amount but keep validity null.
- [ ] If one group contains both IDA and VUELTA changes, emit both direction-specific decision sets in one atomic RPC call.
- [ ] Keep empty New cells out of the payload. Reject duplicate identities in the client before the RPC and preserve typed RPC errors for overlap/validation feedback.
- [ ] After success, emit every independently saved row to Paso 9 and re-run analysis. Do not close the dialog on error or partially clear drafts.

### Task 10: Add the Five-Part Paso 9 Tariff Summary and Review Gate

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.html`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.css`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`

**Interfaces:**
- Consumes: expanded analysis summary and saved confirmed/review results.
- Produces: final review sections and a confirmation gate based on explicit decisions rather than “no unresolved rows exist.”

- [ ] Render separate sections for current matches, historical matches, category corrections, new confirmed tariffs, unresolved tariffs marked `REVISAR`, and validity changes.
- [ ] Show station names rather than UUIDs and show provider category beside calculated category for corrections: `Categoría proveedor 3 -> calculada 2`.
- [ ] For validity changes, render station, category, status, direction, previous price, new price, and `Vigente desde` in `dd/MM/yyyy`.
- [ ] Change the gate so unacknowledged candidates still block, while candidates explicitly persisted as `REVISAR` allow continuation. A silent close/cancel never counts as acknowledgement.
- [ ] Keep `peajes:manage` required for both confirmed and review history writes. A user without it can inspect candidates but cannot bypass the tariff decision gate.
- [ ] After document confirmation, associate current, historical, category-correction, newly confirmed, and review history ids to their exact persisted pasadas. Never update `pasadas.categoria`.
- [ ] Preserve omitted-document filtering, per-document row-index mapping, FC/NC sign normalization, duplicate consent, partial mass-import failures, and the existing post-confirm association warning.
- [ ] Add the required test that continuing an unresolved candidate creates/uses a `REVISAR` result and enables confirmation only after that explicit action.

### Task 11: Keep the Standalone Tarifario Compatible with Validity

**Files:**
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.html`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.css`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.spec.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-historial-dialog.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-historial-dialog.component.html`
- Modify: `src/app/components/peajes/models/tarifario.contracts.ts`

**Interfaces:**
- Consumes: expanded tariff editor/history RPC payloads.
- Produces: one explicit effective-start date for route-editor saves and a truthful validity/diagnostic history view.

- [ ] Add one shared `Vigente desde` single-date control for the route editor save batch; do not add an end-date input.
- [ ] Require the start date only when at least one New cell is non-empty and pass it with each change.
- [ ] Extend current/editor/history mappings with validity and diagnostic fields while preserving `fecha_aparicion` as observation time.
- [ ] Show `Desde`, `Hasta`, `Diagnóstico`, `Categoría calculada`, and `Vigente` in history. Use `—` / `Sin fecha conocida` for legacy nulls rather than inventing dates.
- [ ] Add tests that the standalone editor closes the previous validity through the same RPC behavior and still treats blank New cells as no-op.

### Task 12: Run Database, Unit, Integration, and Visual Acceptance Gates

**Files:**
- Verify: `supabase/tests/peajes_tarifa_vigencia_test.sql`
- Verify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Verify: all changed Angular specs
- Verify: local authenticated Paso 9 and Tarifario UI

- [ ] Run `npx supabase db reset --local --no-seed` and `npx supabase test db`. Record files/tests/pass counts and confirm all earlier Peajes suites remain green.
- [ ] Per the local backend workflow, run `pnpm seed:local` after the no-seed reset so the CLI environment is not left empty.
- [ ] Run focused Angular tests for refresh contracts/service/dialog/helpers, Paso 9, Tarifario, date picker, checkbox multi-select, search select, and dialog.
- [ ] Run `npx tsc --noEmit -p tsconfig.app.json`, `npx tsc --noEmit -p tsconfig.spec.json`, and `npm run build`.
- [ ] In the local authenticated browser, verify three grouped stations produce one editor; two grouped plus one independent produce two; none grouped produce three; and deselection never hides a station.
- [ ] Verify AMBAS produces one board and a directional station produces IDA and VUELTA boards simultaneously.
- [ ] Verify station colors remain stable while regrouping and are always accompanied by station text in chips, detected candidates, current values, and autocomplete suggestions.
- [ ] Verify the provider Category 3 / price 5300 example resolves uniquely to calculated Category 2 PICO, persists the pasada’s original category, and shows the correction in final Paso 9.
- [ ] Verify duplicate compatible 5300 tariffs stay ambiguous and require an explicit category decision or `REVISAR`.
- [ ] Verify a dated historical match does not create a tariff, an unknown-date legacy history match is labelled as such, and a non-covering known period does not match.
- [ ] Verify a new tariff closes the previous period exactly at the new start, keeps the previous amount unchanged, and appears in the final validity summary.
- [ ] Verify multiple unmatched prices stay individually visible; assigning one does not hide the others, and remaining candidates can be marked `REVISAR`.
- [ ] Verify grouped stations save the same amount/start date but receive independent parent/history ids and per-station case counts.
- [ ] Verify a user can explicitly continue with a `REVISAR` candidate and that cancelling/closing the dialog cannot silently confirm or acknowledge it.
- [ ] Verify keyboard focus, 200% zoom, mobile layout, screen-reader labels, reduced motion, and the persistent dialog footer.

### Task 13: Document Only Verified Behavior and Close F14-19

**Files:**
- Modify: `docs/06-components/peajes/tarifario.md`
- Modify: `docs/backend/peajes/refresh-tarifas-paso9.md`
- Modify: `docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- Modify: `docs/backend/peajes/tarifas-tarifa-importe.md`
- Modify: `feature_list.json`
- Modify: `docs/claude-progress.md`
- Modify: `docs/session-handoff.md`

**Interfaces:**
- Consumes: exact implementation and verification evidence from Tasks 2–12.
- Produces: canonical documentation and truthful feature status.

- [x] Document the final matching order, validity rules, legacy-null limitation, diagnostic domain, category-correction semantics, unresolved-review behavior, and association audit path.
- [x] Document the station grouping invariant and that checkbox deselection creates an independent editor.
- [x] Document RPC JSON shapes, transaction/locking order, interval constraint, and the only allowed historical update (`fecha_vigencia_fin NULL -> next start`).
- [x] Record exact local commands, exit codes, test counts, browser scenarios, and any pre-existing warnings.
- [x] Mark F14-19 `passing` only when every verification item is evidenced. Otherwise leave it `in_progress` or `blocked` with the exact missing gate.
- [x] Do not commit, push, or deploy unless the user separately requests it.

---

## Required Test Matrix

| Case | Expected result | Primary automated coverage |
|---|---|---|
| Three stations grouped | One editor containing all three station identities | `tarifa-refresh-dialog.helpers.spec.ts` |
| Two grouped + one independent | Two editors; shared pair plus singleton | `tarifa-refresh-dialog.helpers.spec.ts` |
| Three independent | Three singleton editors | `tarifa-refresh-dialog.helpers.spec.ts` |
| Deselect station | Station remains exactly once as singleton | helper + dialog component specs |
| Grouped save | Same amount/date, independent `tarifas.id`, `current_tarifa_id`, and `tarifa_importe.id` | dialog spec + pgTAP |
| Wrong provider category | Provider 3 remains; unique Category 2 match sets calculated 2 | service spec + pgTAP + Paso 9 spec |
| Ambiguous category | No automatic calculated category; options shown; explicit choice or REVISAR | service/dialog specs + pgTAP |
| Historical match | `HISTORICAL_TARIFF_MATCH`; no insert/current-pointer change | pgTAP + service spec |
| New confirmed tariff | Previous end equals new start; new end null; pointer advances; previous amount unchanged | validity pgTAP |
| Continue unresolved | Explicit review row has `diagnostico = REVISAR`, null validity, and no pointer promotion | pgTAP + dialog/Paso 9 specs |
| AMBAS | One editor and no unknown-direction semantics | helper/dialog specs + pgTAP |
| Separate IDA/VUELTA | Both direction editors visible in one dialog | dialog component spec |
| Multiple unmatched prices | All remain visible; no implicit status/direction/category assignment | helper/dialog specs |
| Safe autocomplete | Exactly one candidate/identity pre-fills New but does not persist | helper/dialog specs |
| IVA normalization | Existing adapter called once; SQL receives both direct/normalized amounts and chooses by flag | service spec + pgTAP |
| Exactly 1% relative error | Match accepted | pgTAP |
| More than 1% relative error | No safe match | pgTAP |
| Adjacent validity periods | `[a,b)` and `[b,c)` accepted | validity pgTAP |
| Overlapping validity periods | Whole save rejected without partial rows | validity pgTAP |
| Legacy unknown validity | Dates stay null and UI states unknown; no invented backfill | migration pgTAP + history component spec |

---

## Requirements Traceability Checklist

- [ ] 1. Existing Paso 9 architecture — documented above and updated in Tasks 5, 8, and 10.
- [ ] 2. `tarifa_importe` schema migration — Task 2.
- [ ] 3. `fecha_vigencia_inicio` — Tasks 2, 3, 8, and 11.
- [ ] 4. Automatic `fecha_vigencia_fin` — Tasks 2 and 3.
- [ ] 5. `diagnostico` — Tasks 2, 3, 4, and 10.
- [ ] 6. Existing historical data/backfill — Task 2.
- [ ] 7. Price normalization — Tasks 4 and 5.
- [ ] 8. Current tariff matching — Task 4.
- [ ] 9. Historical matching — Task 4.
- [ ] 10. Cross-category matching — Task 4.
- [ ] 11. `categoria_calculated` — Tasks 3–5 and 10.
- [ ] 12. Ambiguous category handling — Tasks 4, 6, and 8.
- [ ] 13. Multiple unmatched price candidates — Tasks 6 and 8.
- [ ] 14. IDA / VUELTA / AMBAS resolution — Tasks 4 and 8.
- [ ] 15. Tariff autocomplete — Tasks 6 and 8.
- [ ] 16. Station grouping state model — Task 6.
- [ ] 17. Dynamic number of tariff editors — Tasks 6 and 8.
- [ ] 18. Multi-station bulk updates — Task 9.
- [ ] 19. Independent database history per station — Tasks 3 and 9.
- [ ] 20. Tarifa Refresh Dialog UX — Tasks 7 and 8.
- [ ] 21. Editable input styling — Task 7.
- [ ] 22. Station color identification — Tasks 6–8.
- [ ] 23. Unresolved tariff workflow — Tasks 3, 8, and 10.
- [ ] 24. Paso 9 final summary — Task 10.
- [ ] 25. Required RPC/backend changes — Tasks 2–4.
- [ ] 26. Unit tests — Tasks 5–11.
- [ ] 27. Integration tests — Task 12.

## Final Acceptance Checklist

- [ ] All imported detected stations remain visible under every grouping state.
- [ ] Current, historical, category-corrected, new confirmed, and unresolved/review outcomes are visually and semantically distinct.
- [ ] Price comparisons always use the existing normalized representation and inclusive 1% tolerance.
- [ ] Unique cross-category matches set `categoria_calculated`; ambiguous matches never do so automatically.
- [ ] `pasadas.categoria` remains unchanged and auditability comes from the result plus `tarifa_importe_id` association.
- [ ] Confirmed saves close only the prior end date, append a new amount, and advance the same station’s current pointer.
- [ ] Review saves append `REVISAR` evidence without closing or promoting any tariff.
- [ ] IDA/VUELTA are never inferred from amount, and AMBAS never means unknown.
- [ ] Shared UI values fan out to independent database identities and histories.
- [ ] The dialog asks only for the start date and never asks the user to predict an end date.
- [ ] Paso 9 can continue only after every unresolved candidate has an explicit confirmed, assigned, or review decision.
- [ ] `tarifas_normalizadas` remains structurally and behaviorally intact.
- [x] Local database, Angular, TypeScript, build, integration, accessibility, and browser gates are recorded before F14-19 is marked passing.

## References

- [Supabase Postgres extensions](https://supabase.com/docs/guides/database/extensions)
- [PostgreSQL range types and exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html)
