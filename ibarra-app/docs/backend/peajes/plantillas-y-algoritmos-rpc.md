# Plantillas y algoritmos — RPCs

## Summary

RPCs de sobrescritura transaccional de configuraciones de plantilla, validación/expansión/guardado de algoritmos combinados y snapshot de plantilla de importación (reconocimiento de estaciones).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Persistir definiciones de plantilla/algoritmo sin estados parciales (RN-18…RN-25) y guardar el snapshot usado en importaciones recurrentes (F09).

## Functions

| Función | Descripción |
|---------|-------------|
| `peajes_sobrescribir_configuraciones_plantilla` | Replace atómico de configs |
| `peajes_validar_algoritmo_combinado` | Códigos en catálogo + orden único |
| `peajes_expandir_algoritmo` | Pasos ordenados |
| `peajes_guardar_algoritmo_combinado` | Alta/edición + validación |
| `peajes_guardar_plantilla_importacion` | Plantilla + mapeos + estaciones reconocidas |

**Ubicación:** `20260730125534_peajes_rpc_y_auditoria.sql`, `20260804145440_peajes_plantillas_reconocimiento_estaciones.sql`.

## Validations

- Órdenes únicos por columna/pipeline.
- `algoritmo_codigo` ∈ `peajes_algoritmos_catalogo`.
- Transacción: fallo → rollback total.

## Catálogo atómico reciente

| Código | Migración | Rol |
|--------|-----------|-----|
| `CONVERTIR_NUMERO_ARS` | `20260806120000_peajes_algoritmo_convertir_numero_ars.sql` | Locale AR |
| `FILTRAR_COLUMNA` | `20260811190002_peajes_algoritmo_filtrar_columna.sql` | Conserva filas si columna = valor (pads numéricos `1` ≡ `0001`) |

`FILTRAR_COLUMNA` es un filtro de filas en el motor TypeScript (`aplicarPipeline` descarta no coincidentes); el catálogo SQL solo autoriza la referencia (RN-20).

## Testing

| Tipo | Archivo | Escenario |
|------|---------|-----------|
| `supabase_db_test` | `peajes_f01_test.sql` / F06 | Sobrescritura fallida sin parciales |

**Estado:** verificado (F01-7, F01-8)

## Notes

- UI: [plantillas-y-algoritmos.md](../../06-components/peajes/plantillas-y-algoritmos.md)

---

> Última actualización: agosto 2026 (FILTRAR_COLUMNA)
