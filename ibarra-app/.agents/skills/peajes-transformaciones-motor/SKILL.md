---
name: peajes-transformaciones-motor
description: >-
  Transformation Engine for Peajes — Strategy, Builder, and Adapter patterns for
  column transformations and combined algorithms. Use when implementing or
  changing Paso3 transformaciones, StrategyRegistry, PipelineBuilder,
  PeajesMotorTransformacionService, algoritmos combinados, provider adapters,
  MVP_TRANSFORM_SPECS, or applying algorithms to Excel columns.
---

# Transformation Engine — Pattern-Driven Column Adaptation

## Purpose

Architecture guide for applying column transformations in **Module Automation Tool (Peajes)**. Raw Excel columns from heterogeneous providers are adapted into the standardized Pasada-Columns model across Angular (preview) and Supabase/PostgreSQL (persistence).

**Core principle:** *The column is the unit of adaptation. The pattern is selected by the column's semantic type, not by its raw name.*

**Never execute code from `jsonb`.** Only registered strategy codes run.

## When to use

- Paso 3 transformaciones / preview pipeline
- New atomic strategies or combined algorithms
- Wiring wizard ↔ motor
- Provider adapters (Demo today; new providers later)
- Mapping PRD RN/RF to enforcement points

Read first: `AGENTS.md`, PRD §§7.2–7.4, §15, §21, this skill’s [reference.md](reference.md).

## Project map (canonical paths)

```text
src/app/components/peajes/
├── plantillas/motor/
│   ├── peajes-motor-transformacion.service.ts   # Orchestration (Layer 2)
│   ├── pipeline-builder.ts                      # Builder → PasoEjecucion[]
│   ├── strategy-registry.ts                     # StrategyRegistry
│   ├── strategy.types.ts                        # AlgoritmoCodigo, TransformStrategy
│   └── strategies/estrategias-atomicas.ts       # Atomic strategies
├── plantillas/plantilla-builder.component.ts    # UI builder (not PipelineBuilder)
├── plantillas/algoritmo-builder.component.ts
├── wizard/paso3-transformaciones/               # Presentation (Layer 3)
├── wizard/fixtures/mvp-ejemplo.fixture.ts       # MVP_TRANSFORM_SPECS (Demo adapter fixture)
└── models/                                      # Contracts (agent 00)
```

Persistence (Layer 1): `plantillas_configuracion`, `configuraciones_plantilla`, `algoritmos_combinados`, `algoritmo_combinado_pasos`, `peajes_algoritmos_catalogo`, `pasadas`.

## Three core patterns

### 1. Strategy — runtime algorithm selection

`StrategyRegistry` maps stable codes → `TransformStrategy.ejecutar(ctx)`.

Atomic codes in this repo (`ALGORITMO_CODIGOS`):

| Code | Role |
|------|------|
| `BORRAR_ESPACIOS` | Trim |
| `ELIMINAR_GUIONES` | Strip hyphens |
| `CONVERTIR_MAYUSCULAS` | Uppercase |
| `COMBINAR_COLUMNAS` | Concat columns |
| `FORMATEAR_FECHA_HORA` | FECHA + HORA → datetime |
| `CALCULAR_IMPORTE_NETO` | PRECIO − BONIFICACION |
| `CONVERTIR_NUMERO` / `CONVERTIR_TEXTO` | Casts |
| `ASIGNAR_VALOR` | Constant (e.g. QUANTITY=1) |
| `COPIAR_COLUMNA` | Pass-through / mapeo |

**Not** registry codes (combined algorithm *names*): `NORMALIZAR_PATENTE`, `COMBINAR_FECHA_HORA`. They expand to atomic steps via `algoritmo_combinado_pasos`.

Unknown code → throw (RN-20). Keep SQL catalog `peajes_algoritmos_catalogo` aligned (`20260730140000_peajes_algoritmos_catalogo_align.sql`).

### 2. Builder — validated pipeline

Use `PipelineBuilder` (not the UI component):

```typescript
const pasos = new PipelineBuilder(registry)
  .conConfiguraciones(configuraciones)
  .conAlgoritmos(algoritmosCombinados)
  .build();
```

- Sort by `orden` ascending (RN-18).
- Expand `algoritmo_combinado_id` → flat `PasoEjecucion` (`orden * 1000 + paso.orden`).
- Reject missing combined alg / unregistered codes.
- Duplicate `orden` → `PeajesMotorTransformacionService.validarDefinicionPlantilla` (RN-18).

### 3. Adapter — provider-specific normalization

Today: `MVP_TRANSFORM_SPECS` + helpers in `mvp-ejemplo.fixture.ts` act as the **Demo** adapter (PRD §21).

Target interface (when extracting adapters):

```typescript
interface IProviderAdapter {
  readonly codigo: string;              // e.g. 'DEMO_PASADAS'
  readonly nombre: string;
  readonly columnasEsperadas: string[];
  readonly mapeoSemantico: Map<string, SemanticType>;
  readonly transformacionesDefault: /* ConfiguracionPlantilla-like */[];
  detectarCompatibilidad(columnas: string[]): CompatibilidadResult;
  sugerirMapeo(columna: string): string | null;
}
```

**Rule:** Adapter knows provider headers. Strategy transforms values. Builder orders execution.

## Decision matrix (semantic type → algorithms)

| Semantic type | Signals | Combined / flow | Atomic codes |
|---------------|---------|-----------------|--------------|
| DateTime | `FECHA` + `HORA` | Combined `COMBINAR_FECHA_HORA` *or* direct | `FORMATEAR_FECHA_HORA` / `COMBINAR_COLUMNAS` |
| Patente | `DOMINIO` / patente | Combined `NORMALIZAR_PATENTE` | `BORRAR_ESPACIOS` → `ELIMINAR_GUIONES` → `CONVERTIR_MAYUSCULAS` |
| Estación | station code | Catalog match (Paso 5) | Lookup via catálogo; not always a strategy code yet |
| Estación compuesta | `ESTACION` + `VIA` (Autopistas) | Join then catalog | `COMBINAR_COLUMNAS` `{ separador: '-' }` → match `codigos_proveedor` |
| Moneda | `TARIFA` / `BONIFICACION` | — | `CONVERTIR_NUMERO` |
| Importe neto | derived | — | `CALCULAR_IMPORTE_NETO` (omit if no discount; copy `PRECIO`) |
| Pase / dispositivo | `DISPOSITIVON` / `DISPOSITIVO` | — | `CONVERTIR_TEXTO` / `COPIAR_COLUMNA` |
| Quantity | always 1 | — | `ASIGNAR_VALOR` `{ valor: 1 }` |

Examples: Demo → `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`; Autopistas Urbanas → `docs/plan/ejemplo-autopistas-urbanas-pasadas.md`.

Full detection heuristics → [reference.md](reference.md).

## Frontend wiring (Paso 3)

`Paso3TransformacionesComponent` already injects `PeajesMotorTransformacionService` and uses `MVP_TRANSFORM_SPECS`.

Preferred application path:

```typescript
const motor = inject(PeajesMotorTransformacionService);
const pasos = motor.construirPipeline(configuraciones, algoritmos);
const filasOut = motor.aplicarPipeline(filasPreview, configuraciones, algoritmos);
const errores = motor.validarDefinicionPlantilla(configuraciones, columnas);
```

Preview cells may still use `aplicarTransformPreview` from the Demo fixture; new work should prefer the motor so RN-20/18 are enforced.

UI editor: `PlantillaBuilderComponent` / `AlgoritmoBuilderComponent` under `plantillas/` — persist via services; do not redefine contracts in `models/`.

## Backend

- Prefer existing RPCs / migrations under `supabase/migrations/*peajes*` (agent 01).
- Edge Function bulk processor is a **blueprint** (RNF-03) — only add if PRD scope + authorization; do not invent deploy to DESARROLLO.
- RN-16: unique on `pasadas (pase_id, fecha_hora, estacion_id, patente_id)`.
- RN-18: unique `(plantilla_id, nombre_columna, orden)` on `configuraciones_plantilla`.
- Catalog codes must match `StrategyRegistry`.

## New provider checklist (RNF-06)

1. Implement / extend adapter (or fixture specs).
2. Register in adapter registry (when extracted).
3. Add atomic strategies only if needed + catalog row + `ALGORITMO_CODIGOS`.
4. Persist reusable sequences in `algoritmos_combinados`.
5. Build default plantilla with `PipelineBuilder` validation.
6. Compatibility check (RF-13) before run.
7. Verify Paso 3 (10 rows) + `motor.verify.ts` / §21 E2E.

## Ownership

| Do | Don't |
|----|--------|
| Extend `plantillas/motor/**`, algorithms UI | Redefine agent-00 models |
| Wire Paso 3 to motor | Execute arbitrary `jsonb` |
| Align SQL catalog with registry | Use OrdenCompra Supabase refs |
| Document in `docs/` when behavior ships | Treat DESARROLLO as SQL test env |

Companion skills: `peajes-plantillas-builder` (agent 03 scope), `peajes-wizard-tablas` (Paso 3 UI), `peajes-testing-transformaciones` (test plan + suites), `backend-supabase-write` (SQL).

## Traceability (quick)

| Rule | Enforcement |
|------|-------------|
| RN-16 | `pasadas` unique index |
| RN-18 | `PipelineBuilder` + `validarDefinicionPlantilla` + SQL UK |
| RN-20 | `StrategyRegistry.resolve` / `tiene` |
| RN-21 | Adapter / RF-13 compatibility |
| RN-24 | `ErrorValidacionPasada` / rechazo detalle |
| RN-25 | RPC transactional plantilla overwrite |
| RF-32 | `registros_carga_peajes` audit |

Full matrix → [reference.md](reference.md).

## Verify

```powershell
cd ibarra-app
npx ng test --include=**/peajes/plantillas/**/*.spec.ts --watch=false
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
```
