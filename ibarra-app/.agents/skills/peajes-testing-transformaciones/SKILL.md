---
name: peajes-testing-transformaciones
description: >-
  Testing strategy for the Peajes Transformation Engine (Strategy, Builder,
  Adapter) and wizard validation. Use when writing or updating unit,
  integration, or pipeline tests for PeajesMotorTransformacionService,
  PipelineBuilder, StrategyRegistry, Paso3TransformacionesComponent, column
  mapping, invoice validation, or Demo/Autopistas Urbanas fixtures.
---

# Testing the Transformation Engine — Pattern & Validation

## Purpose

Test strategy for **Excel/CSV transformation logic**, pipelines, mapping, validation, and error handling in the Peajes MVP wizard + motor services.

**Principle:** *Every transformation needs a deterministic I/O pair. Every validation needs a boundary case. Every provider needs a fixture from the plan examples.*

**Sources of truth:** PRD `docs/plan/peaje-prd-es.md`, [ejemplo-mvp-procesamiento-pasadas.md](../../../docs/plan/ejemplo-mvp-procesamiento-pasadas.md), [ejemplo-autopistas-urbanas-pasadas.md](../../../docs/plan/ejemplo-autopistas-urbanas-pasadas.md), plan [testing_plan.md](../../../docs/plan/testing_plan.md).

Companion architecture: [peajes-transformaciones-motor](../peajes-transformaciones-motor/SKILL.md).

## Scope (MVP)

| In scope | Out of scope |
|----------|--------------|
| Strategies / registry (RN-20) | Full Playwright wizard UI |
| `PipelineBuilder` + expand combinados | Catalogos CRUD UI |
| Motor `aplicarPipeline` / `validarDefinicionPlantilla` | Netlify / DESARROLLO E2E |
| Paso 3 (+ related wizard services for transform/validate) | Auth / RBAC |
| Column mapping & output shape | Performance load tests |
| Invoice sum / RN-16 / RN-24 error shape | Edge Function deploy |
| Demo + Autopistas ground-truth rows | Non-Peajes modules |

## Tooling (this repo)

| Layer | Tool | Command |
|-------|------|---------|
| Unit / integration | **Karma + Jasmine** (`ng test`) | `npx ng test --include="**/peajes/**/*.spec.ts" --watch=false` |
| Pipeline verify (Node) | `tsx` scripts | `npx tsx src/app/components/peajes/plantillas/motor.verify.ts` |
| §21 E2E logic | `e2e-prd21.verify.ts` | `npx tsx src/app/components/peajes/e2e-prd21.verify.ts` |
| SQL rules (RN-16 UK, etc.) | **Supabase CLI** + pgTAP | `npx supabase test db` |

Do **not** assume Jest/Vitest/Playwright unless the repo adds them. Prefer extending existing `*.spec.ts` under `plantillas/` and `wizard/`.

## Ground-truth files

| Provider | Plan doc | Data under `docs/plan/csv/` |
|----------|----------|------------------------------|
| Demo | `ejemplo-mvp-procesamiento-pasadas.md` | `1947768.xlsx` (+ fixture `mvp-ejemplo.fixture.ts`) |
| Autopistas Urbanas | `ejemplo-autopistas-urbanas-pasadas.md` | `autopistas_urbanas.csv` |

Acceptance totals (10-row preview):

- Demo: sum `IMPORTE_NETO` = **102060.00**
- Autopistas: sum `IMPORTE_NETO` = **132940.19**

## Pyramid

```text
        E2E / verify scripts   ← Demo + Autopistas pipelines (tsx)
        Integration (TestBed)  ← Paso3 + Motor + WizardState
        Unit (Jasmine)         ← strategies, builder, validators
```

## Where to put tests

```text
src/app/components/peajes/
├── plantillas/
│   ├── motor.spec.ts              # registry + §21 row (extend)
│   ├── builder.spec.ts            # RN-18 / missing cols (extend)
│   ├── algoritmos.spec.ts
│   ├── motor.verify.ts
│   └── motor/strategies/…         # optional *.spec.ts colocated
├── wizard/
│   ├── fixtures/mvp-ejemplo.fixture.ts
│   ├── fixtures/autopistas-urbanas.fixture.ts   # add when implementing AU tests
│   ├── paso3-transformaciones/*.spec.ts         # add
│   └── paso8-validacion/*.spec.ts               # invoice / errors
└── e2e-prd21.verify.ts
```

Future fixture pack (optional, do not invent until needed):

```text
src/app/components/peajes/testing/fixtures/
├── providers/     # raw 10 rows Demo + Autopistas
├── algorithms/    # NORMALIZAR_PATENTE, COMBINAR_FECHA_HORA defs
├── templates/     # plantilla configs
└── invoices/      # 102060 / 132940.19 mocks
```

## Pattern unit tests (must cover)

| Area | Cases |
|------|--------|
| **StrategyRegistry** | Unknown code throws (RN-20); `BORRAR_ESPACIOS`; `CONVERTIR_MAYUSCULAS`; `FORMATEAR_FECHA_HORA` pads Demo `85557`→`08:55:57`; `COMBINAR_COLUMNAS` Demo date join + Autopistas `VAR`+`02C`→`VAR-02C`; `CONVERTIR_NUMERO` AR `19.985,09`→`19985.09`; `CALCULAR_IMPORTE_NETO` `17400-5220=12180`; `ASIGNAR_VALOR` → `1` |
| **Expander / Builder** | `NORMALIZAR_PATENTE` → 3 atomics; effective orden `config.orden*1000+paso.orden`; sequential `" ad-625-qb "`→`AD625QB` |
| **Builder validation** | Duplicate `orden` (RN-18); missing columns; unknown `algoritmo_codigo`; sorted ascending |
| **Adapter / fixture** | Demo `tieneColumnasMvp`; Autopistas requires `VIA`; semantic map `DOMINIO`/`PATENTE`→`PATENTE_ID` |

**Note:** There is **no** `RELLENAR_CEROS_IZQUIERDA` in `ALGORITMO_CODIGOS`. Padding is inside `FORMATEAR_FECHA_HORA` — test that strategy, not a phantom code.

Use project APIs: `registry.obtener` / `tiene`, `TransformStrategy.ejecutar(ctx)`, `PipelineBuilder`, `PeajesMotorTransformacionService` — not invented `execute(valor, params).valor` shapes unless you add them.

## Integration (Paso 3)

- Column detection true/false for Demo headers
- Spec selection (card / column)
- Preview: Demo row1 `FECHA_HORA=2026-06-25 20:50:05`, `IMPORTE_NETO=12180`
- Error list rendering when `validarDefinicionPlantilla` returns errors
- `completado` / `atras` emitters

## Validation rules

| Rule | Assert |
|------|--------|
| RN-16 | Same pase+fecha_hora+estación+patente = duplicate; different time or station = OK |
| Invoice | Demo sum 102060; Autopistas 132940.19; mismatch → reject; negative neto → reject |
| RN-24 | Error has fila/columna/valor/motivo; no SQL/stack in UI message |

## E2E pipeline (both providers)

1. Load 10 ground-truth rows from fixture/doc.
2. Build plantilla configs for that adapter.
3. `aplicarPipeline` → assert each standardized field.
4. Sum `IMPORTE_NETO` vs invoice mock.

## Coverage targets (aspirational)

| Module | Min |
|--------|-----|
| Strategies / motor | 95% |
| PipelineBuilder | 90% |
| Fixtures / adapters | 90% |
| Paso3 | 80% |
| Validations (paso8 / motor validate) | 95% |

## Agent checklist

```text
- [ ] Read PRD + both example docs
- [ ] Extend existing *.spec.ts (Karma/Jasmine)
- [ ] Ground-truth from fixtures / csv docs — no invented rows
- [ ] Atomic codes only from ALGORITMO_CODIGOS
- [ ] Run ng test peajes + motor.verify / e2e-prd21 when touching motor
- [ ] SQL uniqueness → supabase test db (not Angular)
- [ ] Update docs/plan/testing_plan.md evidence if plan changes
```

## Verify commands

```powershell
cd ibarra-app
npx ng test --include="**/peajes/**/*.spec.ts" --watch=false
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
npx tsx src/app/components/peajes/e2e-prd21.verify.ts
npx supabase test db
```

## More detail

- Full plan + matrices: [docs/plan/testing_plan.md](../../../docs/plan/testing_plan.md)
- Suite sketches / fixtures: [reference.md](reference.md)
