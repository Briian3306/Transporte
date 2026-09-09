# PLAN 04 — Documentación verificada

## Objetivo

Documentar el comportamiento realmente implementado de Peajes y enlazarlo en los índices, sin convertir planes o supuestos en documentación de producto.

## Dependencias y ownership

- Comienza después de 01, 02 y 03, y sólo documenta features cuyo estado sea `passing` con evidencia.
- Atiende `F04-1` a `F04-4`.
- Puede editar `docs/06-components/peajes/**`, `docs/06-tablas/peajes/**`, `docs/modulos/peajes.md` e índices relacionados.

## Plan de ejecución

1. Leer la skill `documentacion-proyecto`, PRD y `feature_list.json`; inspeccionar código, migraciones y pruebas ya implementados.
2. Crear documentación canónica de tablas, wizard/catálogos y plantillas/algoritmos; explicar propósito, entradas/salidas, dependencias, reglas y verificación efectivamente ejecutada.
3. Actualizar los índices padre y las referencias cruzadas. Referenciar PRD y código, sin duplicar en los documentos el contenido completo del PRD.
4. Marcar F04 sólo cuando los enlaces y archivos existan. Si una dependencia sigue en progreso, documentar sólo la parte lista y dejar el resto pendiente sin inventar.

## Prompt para Cursor

```text
Actuá como el agente 04 (Documentador). No implementes código ni documentación hipotética. Leé la skill `.agents/skills/documentacion-proyecto`, `AGENTS.md`, `feature_list.json`, el PRD y los handoffs. Inspeccioná directamente las features F01/F02/F03 y sus pruebas antes de documentarlas.

Trabajá sólo en `docs/06-components/peajes/**`, `docs/06-tablas/peajes/**`, `docs/modulos/peajes.md` e índices relacionados. Ejecutá F04-1…F04-4 únicamente para dependencias que estén `passing` con evidencia. Describí comportamiento real, contratos, datos, reglas, limitaciones y comandos de verificación; actualizá índices y enlaces cruzados. No corrijas código ni cambies estados de otros agentes.

Actualizá sólo F04 con evidencia de archivos/enlaces, dejá un handoff de lo diferido y hacé commit descriptivo. Reportá PASS/FAIL/BLOCKED.
```
