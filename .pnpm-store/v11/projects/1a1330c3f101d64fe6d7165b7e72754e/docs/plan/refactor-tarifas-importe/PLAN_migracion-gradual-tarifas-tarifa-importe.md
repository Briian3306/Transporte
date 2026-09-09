# Gradual Tariffs and Tariff Amount History Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the direction-aware `tarifas` current-configuration table and immutable `tarifa_importe` price history while preserving the audited `PRECIO_LAST` values, existing tariff behavior, and the `tarifas_normalizadas` compatibility path.

**Architecture:** This is an additive, four-wave migration. `tarifas` identifies a current tariff by toll, station, PICO/NO_PICO classification, calculated category, and direction; `tarifa_importe` appends immutable audited prices; a protected pointer selects the current row. New matching runs in shadow mode beside the legacy normalizer, then only readers are cut over after reconciliation is clean.

**Tech Stack:** PostgreSQL 17 / Supabase migrations, pgTAP, Supabase CLI, Angular 19, TypeScript, Node `node:test`, the existing Peajes template transformation engine, and `tarifario-last-cruzado.xlsx`.

**Spec:** User-approved design in this task and this canonical implementation plan. Historical fixture scope remains documented in [PLAN_refactor_tarifas_importe.md](./PLAN_refactor_tarifas_importe.md).

## Global Constraints

- This plan is for a new feature `F14-16`; retain the delivered F14-11 fixture evidence unchanged.
- Supersede the unimplemented F14-12 through F14-15 proposal only after registering F14-16; never rewrite historical evidence.
- Do not modify, delete, rename, or remove foreign keys from `tarifas_normalizadas` during any migration wave.
- Do not edit an already-applied migration. All database changes use the new migration files named in this plan.
- `PRECIO_LAST` is the audited source of truth for `tarifa_importe.importe`; it is never changed to make a comparison pass.
- A price matches when `abs(compared_price - importe) / importe <= 0.01`. The boundary is inclusive.
- `sentido` is mandatory and restricted to `IDA`, `VUELTA`, or `AMBAS`; `AMBAS` is a real tariff value, not unknown direction data.
- `requiere_normalizacion_iva` is a separate boolean on `tarifas`; it does not change the meaning of PICO/NO_PICO `status`.
- SQL must not reproduce `ELIMINAR_IVA`. Angular's existing `eliminarIvaStrategy` and `PeajesMotorTransformacionService` are the sole IVA implementation.
- Supabase CLI local is the only SQL test environment. DESARROLLO (`kfffigvyvtzyczeiadxh`) receives no migration, data, or reset in this work without a later explicit user authorization.
- Do not commit or push unless the user explicitly requests it.
- UI strings remain Spanish. This plan extends the existing Paso 8 validation screen; it creates no new screen and does not change invoice-reconciliation blocking rules during the shadow phase.

---

## 1. Current Tariff Flow

The current post-upload path is:

```text
Excel input -> template pipeline -> peajes_confirmar_carga -> pasadas
  -> peajes_normalizar_tarifas -> tarifas_normalizadas
  -> pasadas.tarifa_normalizada_id + pasadas.tarifa_status
```

`peajes_normalizar_tarifas` currently uses an exact `(estacion_id, categoria, precio)` lookup and creates or updates a mutable observed level in `tarifas_normalizadas`. The toll is derived from `estaciones.peaje_id`, not stored on `pasadas`. `peajes_confirmar_carga` preserves that public behavior and its hook calls the legacy normalizer after a successful load.

The existing IVA behavior is application-side only: `eliminarIvaStrategy` divides by 1.21 and rounds to two decimals when the selected template pipeline contains `ELIMINAR_IVA`. Therefore the database cannot safely infer or rerun IVA normalization from persisted `pasadas.precio`.

The source workbook at `scripts/peajes-catalogo-audit/out/tarifario-last-cruzado.xlsx` contains 546 configuration rows (492 `AMBAS`, 27 `IDA`, 27 `VUELTA`) and 1,079 amount-history rows. `Cruzado.PRECIO_LAST` is the audited current amount. Its observed 0.23% example (`31,427.15` versus `31,500.00`) confirms that the new comparator must use the approved 1% relative tolerance rather than equality.

## 2. Proposed Schema

### `public.tarifas`

| Column | Type and rule | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Workbook configuration ID; new namespace, distinct from legacy amount IDs. |
| `peaje_id` | `uuid not null` FK `peajes(id)` | Toll owner. |
| `estacion_id` | `uuid not null` FK `estaciones(id)` | Station owner. |
| `status` | `text not null check (status in ('PICO','NO_PICO'))` | Tariff classification. |
| `categoria` | `smallint not null check (categoria between 0 and 10)` | Calculated tariff category used for matching. |
| `sentido` | `text not null default 'AMBAS' check (sentido in ('IDA','VUELTA','AMBAS'))` | Direction applicability. |
| `requiere_normalizacion_iva` | `boolean not null default false` | Requires an adapter-produced normalized comparison price. |
| `current_tarifa_id` | `uuid` during bootstrap, then `not null` | Current historical amount for this exact tariff configuration. |
| `fecha_actualizacion` | `timestamptz not null` | `fecha_aparicion` of the selected current amount. |
| `created_at`, `updated_at` | `timestamptz not null default now()` | Audit timestamps. |

### `public.tarifa_importe`

| Column | Type and rule | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Legacy `tarifas_normalizadas.id` when a lineage row exists; generated UUID for audited Cross-only entries. |
| `tarifa_id` | `uuid not null` FK `tarifas(id)` | Parent configuration. |
| `importe` | `numeric(14,2) not null check (importe > 0)` | Immutable audited amount from `PRECIO_LAST` or the historical worksheet. |
| `importe_base`, `desvio` | legacy-compatible `numeric` | Historic classification statistics. |
| `hora_min`, `hora_max`, `hora_media` | `numeric(5,2)` nullable | Historic time distribution statistics. |
| `categoria_calculated` | `smallint nullable check (between 0 and 10)` | Preserved legacy calculation metadata. |
| `fecha_aparicion` | `timestamptz not null` | First appearance for this price record. |
| `tarifas_normalizadas_id` | nullable `uuid` FK, unique when non-null | Explicit legacy lineage; null only for a Cross-only or later detected amount. |
| `created_at`, `updated_at` | `timestamptz not null default now()` | Insert audit only; application updates are forbidden. |

`status` and `categoria` deliberately live only on `tarifas`, not duplicated in `tarifa_importe`. This prevents history rows from drifting from their configuration key; a view can project them for reporting.

## 3. Relationships

```text
peajes 1--N tarifas N--1 estaciones
tarifas 1--N tarifa_importe
tarifas.current_tarifa_id --(must belong to same tarifas.id)--> tarifa_importe
tarifa_importe.tarifas_normalizadas_id --(optional lineage)--> tarifas_normalizadas
pasadas.tarifa_importe_id --(shadow/current history link)--> tarifa_importe
pasadas.tarifa_normalizada_id --(legacy link retained)--> tarifas_normalizadas
```

The migration adds a composite FK `(tarifas.id, tarifas.current_tarifa_id) -> tarifa_importe(tarifa_id, id)`. It prevents selecting an amount belonging to a different tariff. Add a matching unique constraint on `(tarifa_id, id)` to make that composite target referenceable.

## 4. Gradual Migration Strategy

1. Create the new schema, indexes, RLS policies, and immutable/current-pointer triggers. The pointer may be null only inside the initial bootstrap transaction.
2. Validate and import the workbook with a Node ETL plus staging assertions. Preserve IDs, source values, and lineage; do not use an Excel data migration.
3. Add `pasadas.sentido` and nullable `pasadas.tarifa_importe_id`; introduce a v2 resolver and application comparison adapter. Preserve all legacy writers, RPC signatures, and views.
4. Run shadow comparisons and backfill only lineage-proven `pasadas.tarifa_importe_id` values. Compare v2 and legacy outcomes, report mismatches, and block cutover on unexplained differences.
5. Once the verification gates are green, change new readers to v2 compatibility functions/views. Keep `tarifas_normalizadas` and its existing links until a separately approved retirement project.

## 5. ID Strategy

Preserve IDs where the workbook establishes a safe relationship:

- Keep `tarifas.id` from the `tarifas` worksheet after validating UUID syntax and uniqueness.
- Keep `tarifa_importe.id = tarifas_normalizadas.id` for every row with a `tarifas_normalizadas_id` lineage value.
- Create a fresh UUID only for a `Cruzado` current amount that has no exact historical line. Its lineage remains null.
- Reject the ETL if one legacy ID maps to more than one amount row, one history ID maps to more than one parent, a workbook parent ID collides with a different configuration key, or a Cross `TARIFA_ID` does not exist.

Using the same UUID in different table namespaces is safe; retaining it makes the `pasadas` backfill deterministic. The ETL creates an explicit CSV/JSON reconciliation report containing every `tarifas_normalizadas -> tarifa_importe -> tarifas` mapping.

## 6. Constraints and Indexes

- `tarifas`: unique `(peaje_id, estacion_id, status, categoria, sentido)`.
- `tarifa_importe`: unique `(tarifa_id, id)` for the composite pointer FK; unique partial `tarifas_normalizadas_id where tarifas_normalizadas_id is not null` for one-to-one lineage.
- `tarifa_importe`: index `(tarifa_id, fecha_aparicion desc, created_at desc, id desc)` for promotion and history queries.
- `pasadas`: index `(tarifa_importe_id)` and partial shadow-backlog index `(estacion_id, categoria, tarifa_status, sentido, precio) where tarifa_importe_id is null`.
- Do not create redundant standalone indexes for left prefixes already covered by the configuration unique index.
- RLS follows the existing authenticated-all project policy pattern during gradual migration. Grants match the existing tariff tables. A later authorization-hardening effort may replace this project-wide flat policy.
- A `BEFORE UPDATE OR DELETE` trigger rejects changes to immutable `tarifa_importe` business columns and deletion. Corrections append a new row.

## 7. Required Backend Changes

- Create the four new migrations named in Task 2, Task 3, Task 6, and Task 8 below.
- Add `pasadas.sentido text not null default 'AMBAS'` without adding `pasadas.peaje_id`.
- Add `pasadas.tarifa_importe_id uuid null` with a FK and index; retain `tarifa_normalizada_id` indefinitely in this feature.
- Create batch RPCs `peajes_resolver_tarifas_actuales(p_pasadas jsonb)` and `peajes_validar_tarifas_actuales(p_pasadas jsonb)`. They preserve the caller row index, resolve the configuration/current pointer/audited `importe`/`requiere_normalizacion_iva`, and validate all supplied rows without an N+1 query pattern.
- The resolver accepts a calculated numeric category, optional `PICO`/`NO_PICO` status, and `sentido`. When status is absent or `PENDIENTE`, it may return a single unambiguous status candidate but must return `ESTADO_AMBIGUO` rather than infer status from `hora_*`.
- The validator selects the already-computed direct or normalized price according to the returned flag, applies the 1% rule against immutable `importe`, and never divides by 1.21.
- Do not modify `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`, or their public signatures during the shadow phase.

## 8. Tariff Matching Logic

1. Resolve `peaje_id` through the selected station.
2. Resolve a configuration by station, calculated category, status, and direction. For `IDA` or `VUELTA`, select the exact direction first; if absent, select `AMBAS`. For `AMBAS`, select only `AMBAS`. The source status must be `PICO`/`NO_PICO`, or be uniquely resolvable across those two values; it is never guessed from historical `hora_*` values.
3. Read the candidate’s protected `current_tarifa_id` and audited `tarifa_importe.importe`.
4. Obtain the price chosen by the IVA protocol below.
5. Calculate `relative_error = abs(compared_price - importe) / importe`.
6. Return `AL_DIA` only when `relative_error <= 0.01`. If a non-current immutable history amount matches within tolerance, return `HISTORICA`; otherwise return `DESFASADO` with the audited amount, compared amount, and relative error.
7. A missing configuration returns `SIN_TARIFA`; missing/non-numeric calculated category returns `CATEGORIA_PENDIENTE`; unresolved status returns `ESTADO_AMBIGUO`. None of these outcomes mutates history. A later explicit detection workflow appends a new amount and lets the promotion trigger update the pointer.

## 9. IVA Normalization Logic

The price adapter resolves the v2 tariff first, then makes one of two calls:

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

`precioNormalizado` is produced once by the selected template’s existing `PeajesMotorTransformacionService` / `eliminarIvaStrategy` path. The adapter must not reapply normalization to a value already normalized by the template. The SQL validator receives both values, chooses according to the returned boolean, and does no IVA arithmetic. Historical `pasadas` are backfilled by lineage rather than re-evaluated through a possibly unavailable old template.

## 10. Current Pointer Update Rule

`AFTER INSERT` on `tarifa_importe` compares `(fecha_aparicion, created_at, id)` with the configured parent’s current row. It promotes only a strictly later tuple and copies the selected row’s `fecha_aparicion` to `tarifas.fecha_actualizacion`. An earlier insert never demotes the pointer.

During bootstrap, the ETL resolves `Cruzado.TARIFA_ID + PRECIO_LAST` explicitly. If an exact amount is already present, that row becomes current. If not, it appends a Cross-audited history row using `LAST_UPDATED` as its `fecha_aparicion`, then selects it. This explicit selection resolves equal-date source ambiguity. After successful import, reject any `tarifas` row with a null current pointer.

## 11. Backward Compatibility

- Keep all existing legacy tables, FKs, triggers, RPC signatures, audit UI, and `pwbi_tarifas` unchanged until shadow verification passes.
- Populate `pasadas.tarifa_importe_id` only where `pasadas.tarifa_normalizada_id` has exactly one history lineage mapping.
- Keep unmatched or non-lineage historical pasadas linked only to `tarifa_normalizada_id`; report them for manual review rather than fabricating a price record.
- Add `pwbi_tarifas_v2` first only if reporting needs it. Alter the existing view only after consumers have migrated and the user approves the cutover.

## Paso 8 Tariff-Validation Contract

Paso 8 remains the owner of invoice reconciliation, duplicate consent, required-column, station, and patent diagnostics. Tariff validation is an additional, separately reported diagnostic group; during this feature's shadow phase it must not add entries to `ResultadoValidacionCarga.errores`, change `dentroTolerancia`, or change `puedeContinuar`.

- Add optional source mapping `SENTIDO`; do not make it a mandatory column. Missing source direction becomes `AMBAS`, rather than null or an unknown direction.
- Preserve the legacy raw provider `categoria` on `tarifas_normalizadas`. The v2 resolver receives the calculated numeric category used by the workbook and `tarifas`; it must report `CATEGORIA_PENDIENTE` instead of inventing a numeric category.
- Send standardized Paso 8 rows in batches to the resolver. After it returns `requiere_normalizacion_iva`, invoke the existing selected-template transformation pipeline exactly once only for flagged rows, then send direct and normalized amounts to the validator in a batch. This prevents both database N+1 calls and double IVA normalization.
- Render a Spanish tariff table with: row, station, category, requested/applied direction, status, audited amount, compared amount, relative error, and outcome. Preserve the existing expandable technical diagnostic area for RPC/request/response failure details.
- Render `AL_DIA` as `ok`; render `HISTORICA`, `DESFASADO`, `SIN_TARIFA`, `CATEGORIA_PENDIENTE`, `ESTADO_AMBIGUO`, and tariff-service failures as non-blocking `warning` diagnostics. A later, explicitly approved policy may make selected outcomes blocking; that is outside F14-16.
- After successful confirmation, associate only `AL_DIA` or `HISTORICA` persisted rows with `pasadas.tarifa_importe_id`. This association must retain the original `tarifa_normalizada_id`, never create price history from a warning, and be idempotent for retrying the same document.

## 12. Required Tests Before Replacing the Current Implementation

- Schema, defaults, FKs, RLS/grants, check constraints, direction priority, current-pointer ownership, and append-only behavior in a new pgTAP suite.
- Workbook ETL integrity: row counts, ID maps, canonical `PRECIO_LAST`, deterministic pointer selection, and no mutation of `tarifas_normalizadas`.
- 1% comparator boundaries: exact, 0.23%, exactly 1%, and greater than 1%.
- Angular adapter tests prove the real template engine supplies the normalized price only when the returned flag is true; no SQL IVA arithmetic is allowed.
- Paso 8 tests prove the complete tariff result contract, exact-direction priority, `AMBAS` fallback/default, non-blocking warning behavior, no invoice-validation regression, and idempotent post-confirmation association.
- Shadow parity report for legacy links, v2 links, missing lineages, and current amount differences.
- Existing F14, Power BI, Angular audit, and full Supabase regressions remain green before reader cutover.

---

## Planned File Structure

| Path | Responsibility | Owner |
|---|---|---|
| `supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql` | Tables, FKs, RLS, indexes, `pasadas.sentido`, shadow link. | Backend write |
| `supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql` | History immutability and pointer promotion. | Backend write |
| `supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql` | Batch resolver, 1% validator, and idempotent v2 association RPC, without IVA arithmetic. | Backend write |
| `supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql` | Backfill/compatibility readers after shadow approval. | Backend write |
| `supabase/tests/peajes_f14_tarifas_importe_test.sql` | New schema, matching, lineage, pointer, and cutover pgTAP tests. | Backend tester |
| `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs` | Read-only/explicit ETL command and reconciliation report. | Backend write |
| `scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs` | Workbook fixtures and ETL validations. | Backend tester |
| `scripts/peajes-catalogo-audit/match-tarifario-last.mjs` | 1% Cruzado comparison rule. | Backend write |
| `scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs` | 0.23%, 1%, and >1% cases. | Backend tester |
| `src/app/components/peajes/services/tarifa-comparison-adapter.service.ts` | Uses existing template pipeline once and selects comparable price. | Backend write |
| `src/app/components/peajes/services/tarifa-comparison-adapter.service.spec.ts` | IVA-flag and no-double-normalization tests. | Backend tester |
| `src/app/components/peajes/services/tarifa-validation.service.ts` | Batch RPC orchestration and Paso 8 tariff-result contract. | Frontend experience |
| `src/app/components/peajes/services/tarifa-validation.service.spec.ts` | Batch, status, direction, and outcome mapping tests. | Backend tester |
| `src/app/components/peajes/models/peajes.types.ts` | Optional `SENTIDO` mapping and v2 tariff validation types. | Frontend experience |
| `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.ts` | Non-blocking tariff diagnostics and post-confirmation association handoff. | Frontend experience |
| `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.html` | Spanish tariff-result presentation. | Frontend experience |
| `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts` | No-blocking and existing validation-regression coverage. | Backend tester |
| `feature_list.json` | Register F14-16 and verified evidence. | Documentation |
| `docs/claude-progress.md`, `docs/session-handoff.md` | Milestone evidence and handoff. | Documentation |
| `docs/backend/peajes/tarifas-tarifa-importe.md` | Implemented backend contract after verification. | Documentation |
| `docs/06-tablas/peajes/tarifas-tarifa-importe.md` | Implemented schema and migration contract after verification. | Documentation |

## Multi-Agent Ownership and Handoffs

| Role | Required skills | Owns | Must not modify |
|---|---|---|---|
| Backend write | `backend-supabase-write`, `supabase:supabase`, `supabase-postgres-best-practices`, TDD | Migrations, ETL, adapter service, and RPC contract. | Tests while tester owns them; product docs. |
| Backend tester | `backend-tester`, TDD | pgTAP, Node, and Angular tests; verification report. | SQL production logic, ETL logic, docs. |
| Frontend experience | TDD, existing Peajes patterns | Paso 8 orchestration, types, and Spanish diagnostic UI. | Migrations, ETL, product docs. |
| Documentation | `documentacion-proyecto` | Feature registration, progress/handoff, canonical docs and indexes after behavior passes. | Product SQL/TypeScript. |
| Coordinator | `superpowers:subagent-driven-development` | Task dispatch, file ownership, review gates, compatibility decisions. | Direct feature implementation. |

Each implementation task is assigned to one owner at a time. The documentation agent starts only after the tester records green evidence; the coordinator does not move to the next task while a critical review finding remains open.

---

## Execution Checklist

### Task 1: Register F14-16 and Freeze the Superseded Scope

**Owner:** Documentation agent  
**Required skills:** `documentacion-proyecto`  
**Files:**
- Modify: `feature_list.json`
- Modify: `docs/plan/refactor-tarifas-importe/INDEX.md`
- Modify: `docs/plan/INDEX.md`
- Modify: `docs/claude-progress.md`
- Modify: `docs/session-handoff.md`

**Produces:** F14-16 as `in_progress`; F14-12–F14-15 explicitly recorded as “superseded by F14-16, never implemented”; F14-11 untouched.

- [ ] Add F14-16 with the approved title, dependency `F14-11`, owner `01-backend-supabase`, and the verification gates in Tasks 2–9.
- [ ] Leave F14-11 status, evidence, fixture paths, and its “no SQL” history unchanged.
- [ ] Record that the new plan supersedes the unstarted F14-12–F14-15 contract because it adds direction, current pointer, audited Cross data, IVA flag, and immutable history.
- [ ] Link this plan from both plan indexes without creating product documentation that claims unimplemented behavior.
- [ ] Do not mark F14-16 passing and do not commit.

### Task 2: Add Schema and Direction-Aware Shadow Columns

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, `supabase:supabase`, `supabase-postgres-best-practices`, TDD  
**Files:**
- Create: `supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql`
- Create: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Consumes:** Workbook contracts and the schema in sections 2–6.  
**Produces:** Empty v2 tables, indexed FKs, RLS/grants, `pasadas.sentido`, and nullable `pasadas.tarifa_importe_id`; no legacy behavior changes.

- [ ] Write pgTAP assertions that the new tables/columns exist; `pasadas.sentido` defaults to `AMBAS`; invalid direction/status/category values fail; and `tarifas_normalizadas` still exists with its legacy FK intact.
- [ ] Run `npx supabase db reset --local --no-seed` and `npx supabase test db`; confirm the test fails because the v2 schema does not exist.
- [ ] Create `tarifas`, `tarifa_importe`, FKs, checks, RLS/grants, the configuration unique key, lineage unique partial index, history index, and shadow `pasadas` columns exactly as specified above.
- [ ] Re-run the same local rebuild and test suite; confirm it passes without applying anything to DESARROLLO.
- [ ] Record the exact local command and result for Task 9; do not commit.

### Task 3: Protect Immutable History and Maintain the Current Pointer

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, `supabase-postgres-best-practices`, TDD  
**Files:**
- Create: `supabase/migrations/20260907101000_peajes_tarifas_v2_current_pointer.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Consumes:** Task 2 schema.  
**Produces:** Append-only history, composite parent-pointer FK, and deterministic promotion.

- [ ] Add failing pgTAP cases for a cross-parent pointer, a rejected history update/delete, later promotion, earlier non-demotion, and stable equal-date ordering.
- [ ] Run the local database test suite and confirm the cases fail for the missing trigger/constraint behavior.
- [ ] Add the composite FK, immutable-history trigger, and insert-promotion trigger. Compare `(fecha_aparicion, created_at, id)` and set `fecha_actualizacion` from the selected amount’s appearance date.
- [ ] Re-run the local database test suite and confirm the new cases pass.
- [ ] Verify with a targeted SQL query that no `tarifas` row can reference an amount belonging to another tariff.

### Task 4: Build and Validate the Workbook ETL

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, `spreadsheets:Spreadsheets`, TDD  
**Files:**
- Create: `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs`
- Create: `scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs`
- Create: `supabase/scripts/validar_migracion_tarifario_v2.sql`
- Modify: `scripts/peajes-catalogo-audit/match-tarifario-last.mjs`
- Modify: `scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs`

**Consumes:** `tarifario-last-cruzado.xlsx`, Task 2 schema, Task 3 pointer rule.  
**Produces:** A repeatable, fail-closed import payload and reconciliation report; it does not run a remote data write.

- [ ] Write failing Node tests for workbook IDs, direction values, one-to-one lineage, `PRECIO_LAST` preservation, Cross-only audited amount creation, and the 0.23%/1%/>1% tolerance cases.
- [ ] Run `node --test scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs scripts/peajes-catalogo-audit/match-tarifario-last.test.mjs`; confirm the new assertions fail.
- [ ] Implement the parser so `tarifas` sheet IDs remain parent IDs; lineage rows preserve legacy amount IDs; Cross rows select/append canonical audited `PRECIO_LAST` using `LAST_UPDATED`; and mismatched IDs/keys fail closed.
- [ ] Emit a reconciliation report with parent ID, historical ID, legacy ID, audited amount, chosen pointer, and source timestamp. Keep the report out of migrations and do not overwrite the reviewed audit workbook.
- [ ] Run Node tests again and run `supabase/scripts/validar_migracion_tarifario_v2.sql` only against local CLI data; confirm all integrity counts are zero-mismatch.

### Task 5: Add IVA-Safe Application Comparison Adapter

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, TDD  
**Files:**
- Create: `src/app/components/peajes/services/tarifa-comparison-adapter.service.ts`
- Create: `src/app/components/peajes/services/tarifa-comparison-adapter.service.spec.ts`

**Consumes:** existing `PeajesMotorTransformacionService`, `eliminarIvaStrategy`, and v2 resolver metadata.  
**Produces:** `TarifaComparisonInput` and one computed comparable price, without duplicating IVA arithmetic.

- [ ] Write a failing Angular test proving that `requiere_normalizacion_iva = false` passes raw `precioDirecto`, while `true` requests a pipeline-produced normalized price exactly once.
- [ ] Run `pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless`; confirm the test fails because the adapter is absent.
- [ ] Implement the adapter using the existing transformation engine; it must throw a controlled error if a flagged tariff lacks a normalized pipeline result.
- [ ] Re-run the focused Angular test and confirm the adapter never contains `/ 1.21` or a duplicate rounding implementation.
- [ ] Run TypeScript checking for app and spec configurations.

### Task 6: Add Shadow Resolver and 1% Validator

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, `supabase-postgres-best-practices`, TDD  
**Files:**
- Create: `supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Consumes:** Tasks 2, 3, and 5.  
**Produces:** New v2 resolver/validator RPCs; legacy normalizer remains untouched.

- [ ] Add failing pgTAP tests for batch row-order preservation, `IDA` exact priority, `VUELTA -> AMBAS` fallback, `AMBAS` exact-only matching, missing configuration, ambiguous/missing status, historical-price recognition, and inclusive 1% comparison.
- [ ] Add a failing pgTAP test that verifies the validator selects the supplied normalized price only when the returned flag is true; the SQL source must contain no division by 1.21.
- [ ] Run the local pgTAP suite and confirm the new resolver/validator tests fail before the migration exists.
- [ ] Implement `peajes_resolver_tarifas_actuales` and `peajes_validar_tarifas_actuales` using `estaciones.peaje_id`, the approved direction precedence, the current pointer, and `abs(...) / importe <= 0.01`; return the documented result codes without creating history.
- [ ] Implement an idempotent post-confirmation association RPC that only writes a matching v2 `tarifa_importe_id` to the identified `pasadas` rows and never updates the legacy FK or tariff history.
- [ ] Re-run `npx supabase db reset --local --no-seed` and `npx supabase test db`; confirm all v2 and legacy suites pass.

### Task 6A: Surface Shadow Tariff Results in Paso 8

**Owner:** Frontend experience agent, with backend tester coverage  
**Required skills:** TDD; existing Peajes validation patterns  
**Files:**
- Create: `src/app/components/peajes/services/tarifa-validation.service.ts`
- Create: `src/app/components/peajes/services/tarifa-validation.service.spec.ts`
- Modify: `src/app/components/peajes/models/peajes.types.ts`
- Modify: `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.ts`
- Modify: `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.html`
- Modify: `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts`

**Consumes:** Task 5 adapter and Task 6 batch RPC contract.  
**Produces:** Visible, non-blocking tariff validation in the existing validation step; no invoice-validation policy change.

- [ ] Write failing component tests showing `AL_DIA` produces an `ok` tariff diagnostic, while `HISTORICA`, `DESFASADO`, `SIN_TARIFA`, `CATEGORIA_PENDIENTE`, `ESTADO_AMBIGUO`, and RPC failure produce warnings without changing `dentroTolerancia`, duplicate-consent handling, or `puedeContinuar`.
- [ ] Write failing service tests proving rows are resolved and validated in batches; `IDA`/`VUELTA` use exact-first then `AMBAS`, missing mapped direction defaults to `AMBAS`, and IVA normalization is requested exactly once only when the resolver flag is true.
- [ ] Add optional `SENTIDO` mapping/types and the tariff result contract without making source direction or calculated category silently optional for the v2 resolver.
- [ ] Implement the existing Paso 8 Spanish diagnostic table and preserve its expandable technical RPC/request/response details. Do not add tariff conditions to `ResultadoValidacionCarga.errores` during the shadow phase.
- [ ] Invoke the association RPC only after successful confirmation, only for `AL_DIA`/`HISTORICA` rows, and make retry safe; retain all `tarifa_normalizada_id` values.
- [ ] Run the focused Paso 8, tariff-validation-service, and adapter Angular tests plus both TypeScript configurations before handing the parity work to Task 7.

### Task 7: Local ETL Load, Shadow Backfill, and Parity Report

**Owner:** Backend write agent, reviewed by backend tester  
**Required skills:** `backend-supabase-write`, `backend-tester`  
**Files:**
- Modify: `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs`
- Modify: `supabase/scripts/validar_migracion_tarifario_v2.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Consumes:** Tasks 2–6 and 6A.  
**Produces:** Local-only imported records, non-destructive `pasadas.tarifa_importe_id` backfill, and a parity report.

- [ ] Write failing tests for a one-to-one lineage backfill, an unmatched legacy line left null, and zero mutation of `tarifas_normalizadas`.
- [ ] Load only the local CLI instance using the ETL’s explicit local connection configuration; do not call `apply_migration`, `db push --linked`, or any DESARROLLO command.
- [ ] Backfill `pasadas.tarifa_importe_id` only through unique legacy lineage. Preserve every original `tarifa_normalizada_id` value.
- [ ] Produce counts for legacy links, v2 links, unmapped links, current-pointer mismatches, and price comparison mismatches. Treat any unexplained mismatch as a cutover blocker.
- [ ] Run local pgTAP and Node tests; record command, date, exit code, and counts for Task 9.

### Task 8: Add Compatibility Readers Only After Shadow Approval

**Owner:** Backend write agent  
**Required skills:** `backend-supabase-write`, `supabase-postgres-best-practices`, TDD  
**Files:**
- Create: `supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Modify only if needed after consumer approval: `supabase/tests/peajes_pwbi_views_test.sql`

**Consumes:** Task 7 parity report approved by the coordinator.  
**Produces:** Read-compatible v2 functions/views; no destructive legacy change.

- [ ] Write failing tests for v2 read results, legacy RPC signature availability, and a `pwbi_tarifas_v2` result if reporting support is required.
- [ ] Run tests and confirm they fail before compatibility readers exist.
- [ ] Create compatibility readers or `pwbi_tarifas_v2`; retain `pwbi_tarifas` unchanged unless its consumers explicitly approve the switch.
- [ ] Re-run all local database tests and the targeted Power BI view tests only when a v2 reporting view was created.
- [ ] Stop before removing a legacy reader, table, trigger, FK, or view; those actions are outside F14-16.

### Task 9: Independent Verification and Evidence Gate

**Owner:** Backend tester agent  
**Required skills:** `backend-tester`, TDD  
**Files:**
- Verify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Verify: `scripts/peajes-catalogo-audit/*.test.mjs`
- Verify: `src/app/components/peajes/services/tarifa-comparison-adapter.service.spec.ts`
- Verify: `src/app/components/peajes/services/tarifa-validation.service.spec.ts`
- Verify: `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts`
- Modify after all checks pass: `feature_list.json`, `docs/claude-progress.md`

**Consumes:** Tasks 2–8.  
**Produces:** Evidence only after all local gates are green; F14-16 remains `in_progress` when any gate fails.

- [ ] Run `npx supabase start`, `npx supabase db reset --local --no-seed`, and `npx supabase test db` from `ibarra-app`.
- [ ] Run Node ETL/matcher tests and focused Angular adapter, tariff-validation, and Paso 8 tests; then run the appropriate F14/audit regression tests and `npx tsc --noEmit -p tsconfig.app.json` plus `npx tsc --noEmit -p tsconfig.spec.json`.
- [ ] Review the local parity report: zero unexplained pointer, lineage, direction-precedence, and price-tolerance mismatches is mandatory.
- [ ] Record exact commands, dates, exit codes, target environment `local`, and concise outcomes in the F14-16 evidence entries and progress log.
- [ ] Do not use DESARROLLO as test evidence, do not run `db reset --linked`, and do not mark passing if any required result is absent.

### Task 10: Document Verified Behavior and Close the Feature

**Owner:** Documentation agent  
**Required skills:** `documentacion-proyecto`  
**Files:**
- Create: `docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- Create: `docs/backend/peajes/tarifas-tarifa-importe.md`
- Modify: `docs/06-tablas/peajes/INDEX.md`
- Modify: `docs/backend/peajes/index.md`
- Modify: `docs/06-tablas/peajes/tarifas-normalizadas.md`
- Modify when implemented: `docs/06-tablas/peajes/modelo-datos.md`, `docs/06-tablas/peajes/documentos-pasadas.md`, `docs/backend/functions/index.md`, `docs/backend/peajes/pwbi-views.md`, `docs/modulos/peajes.md`, `docs/session-handoff.md`

**Consumes:** Task 9 evidence and the implemented migrations/RPCs only.  
**Produces:** Canonical documentation and F14-16 completion evidence without restating unimplemented scope.

- [ ] Document the implemented columns, protected pointer, ID lineage, immutable history, direction precedence, IVA flag protocol, 1% tolerance, batch RPC result codes, and Paso 8 non-blocking shadow behavior.
- [ ] Update `tarifas-normalizadas.md` only to identify its legacy raw-category/earliest-date semantics and retained compatibility role, then link the v2 table document. Do not rewrite legacy definitions as though the tables were deleted or their columns had changed.
- [ ] Update only indexes whose child documents were actually created or changed.
- [ ] Add the verification evidence from Task 9 and mark F14-16 `passing` only when all migration, ETL, adapter, parity, and regression gates passed.
- [ ] Do not commit unless the user asks.

## Final Release Gate

- [ ] F14-11 remains unchanged and F14-16 carries the new migration evidence.
- [ ] No applied migration was edited and `tarifas_normalizadas` remains queryable with its original FK.
- [ ] Paso 8 shows shadow tariff outcomes without altering its established invoice reconciliation or continuation decisions.
- [ ] Every `tarifas.current_tarifa_id` belongs to its own tariff and has a non-null audited amount.
- [ ] `tarifa_importe.importe` equals the audited source amount; price comparison never rewrites it.
- [ ] Direction and IVA flag tests pass, including `IDA`/`VUELTA` fallback precedence and no double normalization.
- [ ] The 1% boundary and the `31,427.15 / 31,500.00` example pass.
- [ ] Local Supabase rebuild, pgTAP, Node, Angular, TypeScript, and affected regression tests pass.
- [ ] No DESARROLLO write occurred without a separate explicit authorization.
