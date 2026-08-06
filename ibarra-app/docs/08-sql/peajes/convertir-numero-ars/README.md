# SQL — CONVERTIR_NUMERO_ARS

## Objetivo

Registrar el algoritmo atómico `CONVERTIR_NUMERO_ARS` en `peajes_algoritmos_catalogo` para montos con formato argentino (`19.985,09` → `19985.09`).

## Migración

`supabase/migrations/20260806120000_peajes_algoritmo_convertir_numero_ars.sql`

## DESARROLLO

- Catálogo aplicado vía migración.
- Plantilla `AUSA-8-2026` (`efec4fd3-afea-478c-8350-0b7cbfedc3d2`): paso `TARIFA → PRECIO` actualizado a `CONVERTIR_NUMERO_ARS`.

## Motor

Implementación TS: `convertirNumeroArsStrategy` / `parseNumeroArs` en `plantillas/motor/strategies/estrategias-atomicas.ts`.

## CSV loader

SheetJS (`XLSX.read` CSV) convertía `19.985,09` al number `19.98509` antes del motor. `PeajesExcelService.parsearCsvComoTexto` conserva strings; sin eso `CONVERTIR_NUMERO_ARS` no puede recuperar el monto.
