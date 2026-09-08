# Task 6A GREEN review — Paso 8 shadow tariff diagnostics

Reviewer: task-scoped gate against Approved RED + GREEN brief. Diff only; `ng test` not re-run.

## Spec Compliance

- ✅ Spec compliant

GREEN product code matches the Approved RED contract. Specs were not in this GREEN diff. `tarifa-validation.service.spec.ts` remains the untracked RED file (not required here). `paso8-validacion.component.spec.ts` is unchanged in this pass.

## Spec / file-scope check

GREEN diff files only:

- `tarifa-validation.service.ts` (created)
- `paso8-validacion.component.ts` / `.html` / `.css`

No `*.spec.ts`. No migrations, ETL, adapter, or product docs. Types are exported from the service module as the specs import them.

Hard constraints held in the diff: `tarifas_normalizadas` writers untouched; tariff rows are not pushed into `resultado.errores`; `dentroTolerancia` / `puedeContinuar` still come from invoice + blocking errors; no `/ 1.21` in the new service/UI; `validar()` does not call `asociarTrasConfirmacion`.

Tests: implementer reported 35 SUCCESS + both `tsc --noEmit` configs PASS. This review did not re-run them (gate instruction).

## Strengths

- Service API names and batching match RED: one `peajes_resolver_tarifas_actuales`, then one `peajes_validar_tarifas_actuales` for resolved rows only; caller `idx` order preserved; association RPC never used from `validarLote`.
- Direction: `IDA`/`VUELTA` forwarded; missing `sentido` → `AMBAS`; Angular does not collapse IDA/VUELTA. Paso 8 maps source `SENTIDO` the same way and passes `state.toConfiguracionesPlantilla()`.
- IVA: `obtenerPrecioComparable` only when resolver `requiere_normalizacion_iva` is true; otherwise `precio_normalizado: null`. Adapter signature matches Task 5.
- Early resolver codes kept; `SIN_TARIFA` / `CATEGORIA_PENDIENTE` / `ESTADO_AMBIGUO` are not sent to the validator. Resolver RPC error rejects without validator/adapter.
- `asociarTrasConfirmacion` filters `AL_DIA`/`HISTORICA`, retries the same `p_asociaciones` payload, never sends `tarifa_normalizada_id`. `providedIn: 'root'` keeps existing TestBeds compiling.
- Paso 8 always appends diagnostic `id: 'tarifas'` (empty lote → `ok`), Spanish labels, warning copy via existing `Advertencia`, expandable `Detalles técnicos`, table columns including catalog station name. Invoice path stays continuable on tariff warning/throw.
- Duplicate-consent gating is unchanged (`permitirDuplicados` / `CLAVE_DUPLICADO`). The HTML tweak (`error || duplicadosConfirmados`) only keeps `Subir igualmente` visible after consent, which the RED shadow case asserts.

## Issues

### Critical

None.

### Important

None.

**Association after confirm (Paso 9 / `peajes-carga.service.ts`) — allowed deferral, not blocking.**

The plan checklist still says to invoke association after successful confirmation. This GREEN brief made that wiring optional when it would require spec edits, and it would:

- `peajes-carga.service.spec.ts` asserts `rpc` is called exactly twice (`peajes_confirmar_carga` then `peajes_normalizar_tarifas`).
- `paso9-revision.component.spec.ts` does not provide `TarifaValidationService`; injecting it into Paso 9 would construct the real `providedIn: 'root'` service unless the spec were edited.

Implementing `asociarTrasConfirmacion` on the service, not calling it from `validar()`, and leaving Paso 9 unwired matches the allowed GREEN path. Follow-up still needs to keep `peajes_normalizar_tarifas` and call association only after a successful confirm.

### Minor

1. **No wizard-state stash of pending associations.** The GREEN brief’s deferral path also said to stash `AL_DIA`/`HISTORICA` rows for a later patch. Paso 8 keeps results in component locals (`filasTarifaVista` / diagnostic response) only. The follow-up will still need idx → `tarifa_importe_id`/`codigo` to join with `pasada_ids` from `peajes_confirmar_carga` (Paso 8 usually has `PASADA_ID: null`).
2. **`asociarTrasConfirmacion` still RPCs when the filtered list is empty.** Harmless (`peajes_asociar_pasadas_tarifa_importe` no-ops on `[]`), but a skip would be cheaper. Not demanded by RED.
3. **Resolver payload omits `fecha_hora`.** Correct for Task 6 SQL (resolver does not use it; HISTORICA vs AL_DIA is the validator). Paso 8 still sends `fecha_hora` into `validarLote` as RED asserts.

## Assessment

**Task quality:** Approved

**Reasoning:** Service and Paso 8 UI implement the Approved RED contract without editing specs, and they keep invoice `errores` / `dentroTolerancia` / `puedeContinuar` / duplicate consent independent of tariff outcomes. Leaving Paso 9 association unwired is an allowed GREEN-brief deferral because wiring would require carga/Paso 9 spec edits; it is not a blocking Important finding for this pass.
