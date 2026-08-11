# Módulo Peajes

## Resumen

Peajes automatiza la carga de archivos Excel/CSV, reconocimiento, transformación, mapeo, relación con catálogos, validación de **documentos** (FC|NC) y persistencia/auditoría en Supabase. Soporta carga simple e **importación masiva** (columna `FACTURA`). Es un dominio aislado de Checklists.

## Flujo implementado

`/peajes` → `/wizard` (9 pasos) → `/catalogos` → `/plantillas` → `/pasadas`.

El wizard conserva estado, muestra preview de hasta 10 filas, recomienda columnas y transformaciones, permite pipeline editable, resuelve estaciones (RN-26) y patentes, valida **Σ pasadas − bonificación de cabecera** vs subtotal con tolerancia del 1%, confirma por documento (`peajes_confirmar_carga`) y en masiva permite omitir documentos inválidos. La bonificación de cabecera se carga a mano en Paso 7 (dato de la factura; no viene del Excel).

## Estructura

- `src/app/components/peajes/wizard`: carga e importación (simple/masiva).
- `catalogos`: empresas, peajes, estaciones, patentes y pases.
- `plantillas`: Builder/Strategy, algoritmos combinados y motor.
- `services`: carga, catálogos, pasadas y plantillas contra Supabase.
- `supabase/migrations`: esquema, RPC, auditoría.
- Docs UI: `docs/06-components/peajes/`
- Docs tablas: `docs/06-tablas/peajes/`
- Docs backend/RPC: `docs/backend/`

## Estado

Según `feature_list.json` (2026-08-10): F00–F05 y F13 (documentos/masiva/RN-16 fecha/omitir) en `passing`. Ampliar catálogos Acceso Oeste/AUSOL (F06/F07) y gestión pasadas (F08) según evidence. F11 desglose factura permanece en seguimiento.

## Referencias

- [PRD](../plan/peaje-prd-es.md)
- [Backend RPCs](../backend/index.md)
- [Componentes](../06-components/peajes/INDEX.md)
- [Importación masiva ConsumosResumen](../06-components/peajes/importacion-masiva-consumos-resumen.md)
- [AUSOL/AUSA fecha_hora −1 día (evidencia + SQL)](../plan/ausa-ausol-fecha-hora-minus-one-day.md)
- [Tablas](../06-tablas/peajes/INDEX.md)
- [Features](../../feature_list.json)
- [Progreso](../claude-progress.md)
- [Handoff](../session-handoff.md)

---

> Última actualización: agosto 2026
