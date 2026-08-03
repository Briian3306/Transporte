# Pipeline editable (Paso 3)

> **Estado:** implementado (F02-10 / F03-9 `passing`, 2026-07-31). Contrato de sesión: `docs/session-handoff.md` (entrada 2026-07-31).

## Resumen

El Paso 3 del wizard (`paso3-transformaciones`) permite armar, reordenar (CDK DnD), habilitar/omitir y previsualizar pasos de transformación sobre ≤10 filas de preview, y persistir el pipeline como plantilla vía `PeajesPlantillasService`. El motor (agente 03) expone descriptores, validación de dependencias y preview por orden; el wizard (agente 02) posee el draft en `PeajesWizardStateService`.

## Propósito

1. Editar la secuencia de pasos del pipeline (no solo inspeccionar una plantilla fija).
2. Validar dependencias (sources, use-before-create, ciclos) antes de continuar.
3. Previsualizar el efecto hasta un orden dado (`previsualizarPaso`).
4. Omitir pasos con `configuracion.habilitado === false` sin borrarlos.
5. Guardar / cargar / descartar plantilla con indicador dirty.

## Estado draft (wizard)

En `PeajesWizardStateService`:

| Campo | Rol |
|-------|-----|
| `configuracionesDraft` | Pasos editables (`clientId` local, no persistir) |
| `plantillaMeta` | id/nombre/empresa/estado de plantilla asociada |
| `pipelineSnapshotSaved` | JSON snapshot para dirty / discard |

`configuracion` jsonb por paso: `algoritmo_codigo`, `columnas_entrada` (alias legacy `columnas`), `parametros`, `habilitado` (default true).

APIs: `add/update/remove/duplicate/reorderDraftSteps`, `setStepHabilitado`, `seedDemoPipelineIfEmpty`, `toConfiguracionesPlantilla`, `markPipelineSaved`, `isPipelineDirty`, `discardPipelineChanges`.

Seed MVP (§21): `FORMATEAR_FECHA_HORA` → `COPIAR_COLUMNA` (PASE) → normalización patente (3 atómicos) → `ASIGNAR_VALOR` QUANTITY → `CALCULAR_IMPORTE_NETO`.

## APIs del motor consumidas

| API | Uso en Paso 3 |
|-----|----------------|
| `getAlgorithmDescriptors()` | Picker de algoritmos (10 códigos) |
| `validarDependenciasPipeline` | Errores en cards / banner |
| `previsualizarPaso` | Tabla I/O hasta orden del paso seleccionado |
| `aplicarPipeline` | Preview completo; Paso 4 sobre `filasOrigen` (omite `habilitado === false`) |

## Estructura de UI

```text
Toolbar: Añadir | Validar | Guardar / Cargar / Descartar | dirty badge
Columnas (rail) → Pipeline DnD (cards) → Panel config del paso
Preview I/O (máx 10 filas) — al confirmar se aplica a filasOrigen
```

Cada card: orden, nombre, sources, output, resumen, badge validación, edit/duplicate/enable-disable/delete, drag handle.

## Ejecución (Paso 4)

Si hay `configuracionesDraft` y no se elige plantilla remota, Paso 4 aplica el draft con el motor sobre **filasOrigen** (fallback `filasPreview`). `construirPasadasDesdeMapeo` conserva salidas del motor cuando existe draft.

## Referencias de testing

- Plan: `docs/plan/testing_plan.md` §10b (U-P / I-P / V-P / E-P)
- Skill: `.agents/skills/peajes-testing-transformaciones/`
- Demo suma `IMPORTE_NETO` = **102060**; Autopistas = **132940.19**
- Verify: `npx tsx src/app/components/peajes/plantillas/motor.verify.ts`, `e2e-prd21.verify.ts`

## Ownership

| Agente | Path |
|--------|------|
| 02 | `wizard/**` |
| 03 | `plantillas/**` |
| 04 | este documento |

## Referencias

- PRD: `docs/plan/peaje-prd-es.md`
- Demo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Autopistas: `docs/plan/ejemplo-autopistas-urbanas-pasadas.md`
- Handoff: `docs/session-handoff.md`
