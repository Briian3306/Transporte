# peajes_detectar_duplicados

## Summary

Detecta pasadas duplicadas dentro del lote y contra la base usando la clave de negocio RN-16. La detección **nunca se desactiva**: el consentimiento «Subir igualmente» solo cambia el persistido (`pasadas.duplicado = true`).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Informar colisiones en `PASE_ID + FECHA_HORA + ESTACION_ID + PATENTE_ID` (lote y tabla `pasadas`) y devolver datos legibles para el Paso 8.

## Business Logic

1. Recibe `p_pasadas jsonb` (arreglo).
2. Normaliza `fecha_hora` a timestamptz.
3. Detecta colisiones **dentro del lote** y **contra `pasadas` existentes** (incluye filas ya marcadas `duplicado = true`).
4. Devuelve errores con `fila`, `columna = CLAVE_DUPLICADO`, motivo y, en coincidencias reales:
   - `pase_nombre` / `patente_nombre` (catálogo)
   - `file_upload_name` de la pasada persistida (null si el choque es solo en el lote)
   - `duplicado: true`
5. Si faltan campos de clave: `duplicado: false` (siempre bloquea la confirmación).

## Functions

| Función | Tipo | Parámetros | Retorno |
|---------|------|------------|---------|
| `peajes_detectar_duplicados` | RPC | `p_pasadas jsonb` | `jsonb` (arreglo de errores) |

**Ubicación:** `supabase/migrations/20260825120000_peajes_duplicados_comparacion.sql` y `20260828120000_peajes_duplicados_permitidos.sql`.

## Validations

- Clave RN-16 completa; la hora debe preservarse.
- El índice único parcial `pasadas_duplicado_uk` (`WHERE duplicado = false`) no reemplaza esta detección.

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `peajes_f01_test.sql` | Clave repetida → rechazo |
| `supabase_db_test` | `peajes_duplicados_permitidos_test.sql` | Nombres, archivo, flag `duplicado` |
| `angular_spec` | paso8-validacion | Tabla con nombre de patente y «Subir igualmente» |

**Estado:** verificado (F01-6, F18-2)

## Notes

- Invocado desde `peajes_confirmar_carga` (siempre) y desde Paso 8 vía `PeajesCargaSupabaseService`.

---

> Última actualización: 2026-08-28
