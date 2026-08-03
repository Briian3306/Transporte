---
name: peajes-plantillas-builder
description: >-
  Guía al agente 03 (Frontend Plantillas & Motor) del módulo Peajes: Builder +
  Strategy, editor de plantillas, algoritmos combinados y aplicación en el
  wizard. Scope exclusivo plantillas/**. Consumir contratos de agente 00;
  mocks tipados hasta F01. No tocar wizard/catálogos ni Checklists.
---

# Peajes — Plantillas y Builder/Strategy (Agente 03)

## Cuándo usar

Implementar `F03-*` bajo:

- `src/app/components/peajes/plantillas/**`

Leer antes: `AGENTS.md`, PRD §4 pasos 3–4, §§7.2–7.4, §§14.2–15, §21, `docs/session-handoff.md`, modelos/contratos de 00.

## Ownership — no salir

| Permitido | Prohibido |
|-----------|-----------|
| `plantillas/**` (UI + motor TS) | `wizard/**`, `catalogos/**` (02) |
| Registry de estrategias, Builder de pipeline | Editar contratos/modelos de 00 |
| Mocks tipados de interfaces 00 | Migraciones / RPC (01) |
| Tests bajo `plantillas/**` | `ChecklistTemplateService` / `checklist_templates` |

## Patrón UI

Mismo kit del host: Angular 19 standalone, CSS/SCSS propio, Font Awesome, español, look de paneles/forms existentes. Ver skill `peajes-wizard-tablas` para la tabla de convenciones.

## Motor Builder + Strategy (PRD)

Implementar paso a paso (detalle de arquitectura: skill
`peajes-transformaciones-motor`):

1. **StrategyRegistry** — códigos registrados; rechazar referencias inexistentes.
2. **Estrategias atómicas** — p. ej. unir fecha/hora, borrar espacios, eliminar guiones, convertir mayúsculas, calcular importe neto, etc. (catálogo del PRD §7).
3. **Builder** — `PipelineBuilder` arma el pipeline ordenado por `orden` determinista.
4. **Algoritmo combinado** — expandir pasos (`algoritmo_codigo` + `parametros` jsonb) sin mutar el registry. Nombres como `NORMALIZAR_PATENTE` / `COMBINAR_FECHA_HORA` son combinados, no códigos atómicos.
5. **Preview** — aplicar pipeline a filas de muestra (caso §21) vía `PeajesMotorTransformacionService`.

Caso de aceptación §21 debe producir correctamente: `FECHA_HORA`, `PATENTE_ID`, `PASE_ID`, `IMPORTE_NETO`.

## Persistencia (vía contratos 00 / servicios 01)

- `PlantillaConfiguracion`, `ConfiguracionPlantilla`
- `AlgoritmoCombinado`, `AlgoritmoCombinadoPaso`
- Sobrescritura de configuraciones en una sola operación (RN-19 / F01-7)
- Alcance por `empresa_id` (RN-22/23)

Hasta F01 `passing`, mocks tipados + nota en handoff.

## Validaciones antes de publicar

- Orden duplicado → error
- Columna obligatoria ausente → error
- `algoritmo_codigo` no registrado → error
- Compatibilidad de plantilla con columnas del archivo (RF-13)

## Entornos

No aplicar SQL. El backend valida en **Supabase CLI**. DESARROLLO no sustituye tests.

## Verificación

Tests F03 focalizados + build. Solo actualizar features F03 con evidencia.
