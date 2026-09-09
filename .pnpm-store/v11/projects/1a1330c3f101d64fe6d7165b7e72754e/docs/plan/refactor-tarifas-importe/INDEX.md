# Índice — Refactor catálogo `tarifas` + `tarifa_importe`

## Resumen

Plan para separar el catálogo tarifario (`PEAJE + ESTACIÓN + STATUS + CATEGORY`) de la línea de tiempo de importes. **Wave 0 (hecho, F14-11):** fixtures CSV + Excel de prueba. **No** crea tablas en Supabase.

**F14-16 (hecho en CLI local, `passing`):** schema + puntero + RPCs sombra + `pwbi_tarifas_v2` paralela + backfill de linaje. Additive: `tarifas_normalizadas` permanece como camino de compatibilidad (tabla, columnas, FKs, writers, firmas RPC existentes, vistas y `pasadas.tarifa_normalizada_id`). No se elimina, renombra ni reemplaza. F14-12..F14-15 superseded by F14-16, never implemented. Docs: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md) / [backend](../../backend/peajes/tarifas-tarifa-importe.md).

**F14-18 (`passing` en CLI local):** Refresh Tarifas durante Paso 9. Contrasta candidatos distintos contra precio vigente e historial con tolerancia inclusiva de 1%, exige confirmación explícita para un importe nuevo y reutiliza el editor PICO/NO_PICO dentro de un diálogo. Migración `20260908150000_peajes_refresh_tarifas_paso9.sql`. Docs: [refresh-tarifas-paso9.md](../../backend/peajes/refresh-tarifas-paso9.md).

## Documentos

| Documento | Descripción |
|---|---|
| [PLAN_refactor_tarifas_importe.md](./PLAN_refactor_tarifas_importe.md) | Wave 0 fixtures (F14-11); alcance histórico F14-12..F14-15 (superseded, never implemented) |
| [PLAN_migracion-gradual-tarifas-tarifa-importe.md](./PLAN_migracion-gradual-tarifas-tarifa-importe.md) | Plan ejecutable F14-16 (schema, puntero current, ETL, adapter, RPC shadow, Paso 8, paridad). `tarifas_normalizadas` sigue como camino de compatibilidad. |
| [PLAN_refresh-tarifas-paso9.md](./PLAN_refresh-tarifas-paso9.md) | Plan ejecutable F14-18: detección current/histórica/nueva, refresco explícito en diálogo y resumen final de Paso 9. |

## Fuente de datos

- `tarifas.csv`: [`scripts/peajes-catalogo-audit/fixtures/tarifas.csv`](../../../scripts/peajes-catalogo-audit/fixtures/tarifas.csv) — todas las claves PICO/NO_PICO
- `tarifas_importe.csv`: [`scripts/peajes-catalogo-audit/fixtures/tarifas_importe.csv`](../../../scripts/peajes-catalogo-audit/fixtures/tarifas_importe.csv) — todos los importes
- Excel (2 pestañas): [`scripts/peajes-catalogo-audit/out/tarifas-tarifas-importe.xlsx`](../../../scripts/peajes-catalogo-audit/out/tarifas-tarifas-importe.xlsx)
- Excel revisado completo (no sobrescribir): [`scripts/peajes-catalogo-audit/out/auditoria-catalogo-20260904.xlsx`](../../../scripts/peajes-catalogo-audit/out/auditoria-catalogo-20260904.xlsx)
- Auditoría Fase 1: [`docs/06-components/peajes/catalogo-tarifas-audit.md`](../../06-components/peajes/catalogo-tarifas-audit.md)

## Referencias

- [Índice general de planes](../INDEX.md)
- [Normalización tarifaria](../normalizacion-tarifa/INDEX.md)

---

> Última actualización: 2026-09-08
