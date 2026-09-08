# Task 6A GREEN — Paso 8 shadow tariff diagnostics (Frontend)

Read this first. Task 6A RED is review-Approved. Implement product code only. Do **not** edit specs.

**Owner:** Frontend experience  
**Skills (read first):** `ibarra-app/.agents/skills/peajes-wizard-tablas/SKILL.md`, TDD (make specs pass; do not rewrite them).

## Files you may create/modify

- Create: `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.ts`
- Modify: `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.ts`
- Modify: `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.html`
- Modify: `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.css` (only if needed for the Spanish table)
- Optional: `ibarra-app/src/app/components/peajes/models/peajes.types.ts` **only if** types cannot live in the service module. Specs import types from `tarifa-validation.service.ts`. Prefer exporting types from that service file so specs keep compiling.
- Optional wiring after confirm: `paso9-revision.component.ts` and/or `peajes-carga.service.ts` for `asociarTrasConfirmacion`. If you touch those, run their existing specs. Do **not** edit those spec files unless a new provider is strictly required to compile — prefer `providedIn: 'root'` so existing TestBeds keep working.

## Files you must not edit

- `tarifa-validation.service.spec.ts`
- `paso8-validacion.component.spec.ts`
- Any other `*.spec.ts`
- Migrations, ETL, product docs (`docs/06-tablas`, `docs/backend`, `feature_list.json`, `claude-progress.md`)
- Task 5 adapter implementation (reuse it)
- Legacy `peajes_normalizar_tarifas` / `tarifas_normalizadas` writers

## Contract (make the existing specs pass)

Read:

- `.superpowers/sdd/task-6a-report.md` (wished-for API + GREEN notes)
- `ibarra-app/src/app/components/peajes/services/tarifa-validation.service.spec.ts`
- `ibarra-app/src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.spec.ts` (`describe` shadow + UUID case expecting **6** diagnostic groups including `id: 'tarifas'`)
- Task 5 adapter: `tarifa-comparison-adapter.service.ts`
- Task 6 RPC names: `peajes_resolver_tarifas_actuales`, `peajes_validar_tarifas_actuales`, `peajes_asociar_pasadas_tarifa_importe`
- Existing Paso 8 diagnostic HTML (`Detalles técnicos`, `paso8__check--warning`)
- `PeajesWizardStateService.toConfiguracionesPlantilla()` for the second `validarLote` argument

### Service

Exports used by specs (names must match):

- `TarifaValidationService` (`providedIn: 'root'`)
- `validarLote(pasadas, configuraciones)` → `{ filas }`
- `asociarTrasConfirmacion(asociaciones)`
- Types: `PasadaValidacionTarifaInput`, `ResultadoFilaValidacionTarifa`, `ResultadoValidacionTarifa`, `CodigoResultadoTarifa`, `AsociacionTarifaImporte`

Behavior:

1. One `peajes_resolver_tarifas_actuales` then one `peajes_validar_tarifas_actuales` (no N+1). Preserve caller `idx` order.
2. `validarLote` never calls `peajes_asociar_pasadas_tarifa_importe`.
3. Resolver payload: forward `IDA`/`VUELTA`; missing `sentido` → `AMBAS`. Do not collapse IDA/VUELTA to AMBAS in Angular.
4. Call `TarifaComparisonAdapterService.obtenerPrecioComparable` **exactly once per row where resolver `requiere_normalizacion_iva` is true**. Pass that row’s `fila` + template `configuraciones`. Non-flagged rows: `precio_normalizado: null`. No `/ 1.21`.
5. Keep early resolver codes (`SIN_TARIFA`, etc.); validator batch only resolved rows; merge results by `idx`.
6. Resolver RPC error → reject; do not call validator or adapter.
7. `asociarTrasConfirmacion`: RPC `p_asociaciones` with only `AL_DIA`/`HISTORICA`; same payload on retry; never include `tarifa_normalizada_id`.
8. Use `SupabaseService.getClient()` + `rpc`, same pattern as other Peajes services.

### Paso 8 UI

1. Inject `TarifaValidationService`. Call `validarLote` during `validar()` with mapped rows + `state.toConfiguracionesPlantilla()`.
2. Map each standardized pasada: `estacion_id`, `precio_directo` (PRECIO/IMPORTE_NETO as specs expect 1840), `categoria`, `fecha_hora`, `sentido` from source `SENTIDO` or `'AMBAS'`, `idx`/`fila` as needed for the service.
3. Always append diagnostic `id: 'tarifas'` (empty lote → `ok`). Title contains `Tarifas`. Existing UUID-error case expects `diagnosticos.length === 6`.
4. `AL_DIA` → `estado: 'ok'`, label `Al día`. `HISTORICA`/`DESFASADO`/`SIN_TARIFA`/`CATEGORIA_PENDIENTE`/`ESTADO_AMBIGUO` → `warning` + labels `Histórica`, `Desfasado`, `Sin tarifa`, `Categoría pendiente`, `Estado ambiguo`. Warning copy includes `Advertencia`.
5. Service throw → non-blocking `warning`; `tecnico.rpc` from the error if present (`peajes_resolver_tarifas_actuales`); keep `Detalles técnicos`. Invoice path still continuable: do **not** push tariff outcomes into `resultado.errores`; do **not** change `dentroTolerancia` or `puedeContinuar`.
6. Do **not** call `asociarTrasConfirmacion` from `validar()`.
7. Spanish table columns (visible text): Fila, Estación (catalog name e.g. Hudson), Categoría, Sentido solicitado, Sentido aplicado, Estado, Importe auditado, Importe comparado, Error relativo, Resultado. Reuse existing expandable `Detalles técnicos`; `tecnico.rpc` must match `/peajes_(resolver|validar)_tarifas_actuales/`.
8. Duplicate consent (`Subir igualmente`) unchanged.
9. UI strings in Spanish. Follow existing Paso 8 look (no new design system).

### After confirmation (plan item)

If you wire association: only after successful `peajes_confirmar_carga`, only `AL_DIA`/`HISTORICA`, retry-safe. **Keep** the existing `peajes_normalizar_tarifas` call. Do not DROP or stop writing `tarifas_normalizadas`. If wiring would require editing Paso 9 specs, implement the service method now and stash pending associations on wizard state for a later small patch — but prefer wiring without spec edits.

## Verify GREEN

From `ibarra-app`:

```
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --include="**/tarifa-comparison-adapter.service.spec.ts" --watch=false --browsers=ChromeHeadless
pnpm.cmd exec npx tsc --noEmit -p tsconfig.app.json
pnpm.cmd exec npx tsc --noEmit -p tsconfig.spec.json
```

All must PASS. If you touch Paso 9 / carga, also run those focused specs.

No DESARROLLO. No commit. Do not remove `tarifas_normalizadas`.

## Report

Write `.superpowers/sdd/task-6a-green-report.md` with commands, pass counts, and files changed.
