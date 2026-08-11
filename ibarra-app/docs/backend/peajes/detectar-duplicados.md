# peajes_detectar_duplicados

## Summary

Detecta pasadas duplicadas dentro del lote y contra la base usando la clave de negocio RN-16.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Impedir cargas que colisionen en `PASE_ID + FECHA_HORA + ESTACION_ID + PATENTE_ID`.

## Business Logic

1. Recibe `pasadas jsonb` (arreglo).
2. Normaliza `FECHA_HORA` a timestamptz (helper de parseo en migraciones).
3. Detecta colisiones **dentro del lote** y **contra `pasadas` existentes**.
4. Devuelve errores con fila/columna/`CLAVE_DUPLICADO` / motivo.

## Functions

| Función | Tipo | Parámetros | Retorno |
|---------|------|------------|---------|
| `peajes_detectar_duplicados` | RPC | `pasadas jsonb` | `jsonb` (errores) |

**Ubicación:** `supabase/migrations/20260730125534_peajes_rpc_y_auditoria.sql` (+ ajustes de fecha en migraciones posteriores).

## Validations

- Clave RN-16 completa; la hora debe preservarse (truncar a `00:00:00` genera falsos positivos).

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `peajes_f01_test.sql` | Clave repetida → rechazo |
| `angular_spec` | peajes-fecha / excel | Excel Date conserva HMS |

**Estado:** verificado (F01-6, F13-RN16-FECHA)

## Notes

- Invocado desde `peajes_confirmar_carga` y desde Paso 8 vía servicio de carga.

---

> Última actualización: agosto 2026
