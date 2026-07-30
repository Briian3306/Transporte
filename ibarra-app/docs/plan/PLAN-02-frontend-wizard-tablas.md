# PLAN 02 — Frontend Wizard y Tablas

## Objetivo

Construir el asistente de carga y los catálogos de Peajes sin invadir el motor de plantillas, consumiendo los contratos de 00 y el backend real o mocks tipados.

## Dependencias y ownership

- Requiere `F00-3` en `passing`. Las features de catálogo también requieren `F01-1`; las validaciones/finalización requieren sus F01 indicadas.
- Atiende `F02-1` a `F02-9` según `feature_list.json`.
- Su scope exclusivo es `src/app/components/peajes/wizard/**` y `src/app/components/peajes/catalogos/**`.

## Plan de ejecución

1. Leer la skill `peajes-wizard-tablas` cuando esté disponible, PRD §4 (pasos 1, 2 y 5–9), §§7.5, 8, 15 y §21; inspeccionar contratos de 00 y el handoff de 01.
2. Entregar primero carga XLSX, preview de 10 filas, tipos, selección y estado persistente. Usar datos locales/mocks tipados donde no haya backend.
3. Construir catálogos de peajes, estaciones, patentes y pases; sustituir mocks por servicios reales sólo al estar F01 correspondiente en `passing`.
4. Implementar mapeo, resolución de estación/peaje, formulario de factura, validaciones y revisión/confirmación en el orden de dependencias. No implementa estrategias ni editor de plantillas: consume la interfaz de 03.
5. Crear tests focalizados para cada paso y confirmar que los errores muestran fila, columna, valor y motivo. Mantener las rutas dentro del punto de extensión que dejó 00; no editar `peajes.routes.ts` fuera de la coordinación permitida.
6. Registrar evidencia y bloqueos por feature; enviar al handoff cualquier capacidad de servicio ausente y el contrato exacto esperado.

## Criterio de salida

El wizard puede procesar el ejemplo §21 hasta el límite de las dependencias backend/plantillas, preserva estado al volver atrás y los catálogos no quedan acoplados a Checklists.

## Prompt para Cursor

```text
Actuá como el agente 02 (Frontend Wizard y Tablas). Esperá F00-3 `passing`; leé `AGENTS.md`, `feature_list.json`, `docs/plan/peaje-prd-es.md`, `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`, el handoff y la skill `.agents/skills/peajes-wizard-tablas` si está instalada. Si esa skill falta, registrá el bloqueo exacto y no inventes su contenido.

Implementá únicamente F02-1…F02-9 dentro de `src/app/components/peajes/wizard/**` y `src/app/components/peajes/catalogos/**`. No edites modelos/contratos, servicios backend, plantillas, permiso ni rutas compartidas. Construí carga XLSX, preview máximo de 10 filas, selección/tipos, mapeo, relación estación→peaje, factura, validación con detalle de errores, revisión y estado persistente. Aplicá el ejemplo §21 como criterio funcional.

Consumí interfaces de 00. Mientras F01 no esté `passing`, usá mocks tipados compatibles y registrá en el handoff el método/campo que falta; reemplazalos por el servicio real sólo cuando la dependencia esté cumplida. No reutilices artefactos de Checklists.

Ejecutá los tests focalizados definidos por cada F02 y el build aplicable. Actualizá sólo F02 con evidencia, dejá handoff para 01/03/05 y hacé commit descriptivo sólo si pasan las verificaciones. Reportá PASS/FAIL/BLOCKED y no delegues ni lances otros agentes.
```
