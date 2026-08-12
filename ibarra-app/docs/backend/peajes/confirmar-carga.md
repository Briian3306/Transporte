# peajes_confirmar_carga

## Summary

RPC transaccional que persiste un documento (`documentos`, tipo FC|NC), sus pasadas y el registro de auditoría de carga. Consumido por el wizard (Paso 9) una vez por documento incluido en importación masiva.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Confirmar de forma atómica una carga válida (RN-12, RN-13/17, RN-16) sin estados parciales.

## Business Logic

1. Valida payload de documento (`p_factura` jsonb; nombre histórico del parámetro) y arreglo `p_pasadas`.
2. Normaliza `tipo` a `FC`|`NC`; para NC fuerza signos negativos en cabecera y líneas.
3. Detecta duplicados (`peajes_detectar_duplicados`).
4. Calcula/valida `importe_neto` por fila (`peajes_calcular_importe_neto`).
5. Valida suma vs (subtotal + bonificación de cabecera) (`peajes_validar_factura_pasadas`, tolerancia default 1%).
6. Inserta fila en `documentos` (incluye `bonificacion`), pasadas con `documento_id` y `categoria` cruda opcional (F14 / RN-15), y `registros_carga_peajes`.
7. Devuelve jsonb con ids y métricas de filas.
8. **Fuera de esta TX** (opción b): `PeajesCargaSupabaseService` invoca `peajes_normalizar_tarifas(documento_id)`; un fallo se registra y no invalida la carga.

En masiva, el frontend orquesta **una invocación por documento**; errores se aíslan por llamada.

## Relations

| Entidad | Relación |
|---------|----------|
| Wizard Paso 9 | `PeajesCargaSupabaseService.confirmarCarga` |
| `documentos` | Insert cabecera |
| `pasadas` | Insert líneas |
| `registros_carga_peajes` | Auditoría |

## Tables

| Tabla | Rol |
|-------|-----|
| `documentos` | escritura |
| `pasadas` | escritura |
| `registros_carga_peajes` | escritura |

## Functions

| Función | Tipo | Parámetros principales | Retorno |
|---------|------|------------------------|---------|
| `peajes_confirmar_carga` | RPC | `p_factura jsonb`, `p_pasadas jsonb`, plantilla/params/errores/archivo/tolerancia opcionales | `jsonb` |

**Ubicación canónica (F13 + bonificación cabecera):** `supabase/migrations/20260807140000_peajes_documentos_tipo_nc.sql` y `20260810191639_peajes_documentos_bonificacion.sql`.

## Validations

- Documento obligatorio (RN-12).
- `tipo` ∈ {FC, NC}.
- Duplicados RN-16 rechazan la carga.
- Conciliación: Σ neto − `documentos.bonificacion` ≈ `importe_sin_iva` (RN-13/17).

## Testing

| Tipo | Archivo / comando esperado | Escenario |
|------|---------------------------|-----------|
| `supabase_db_test` | `supabase/tests/peajes_f01_test.sql` | Confirmación FC/NC, tolerancia, duplicados |
| `angular_spec` | servicios carga / paso9 | Orquestación masiva por documento |

**Estado:** verificado (evidencia F01/F13 en `feature_list.json`)

**Comando ejecutado:** `npx supabase test db` (suite peajes; ver evidence F13-1)

**Evidencia:** `feature_list.json` → F01-9, F13-1

## Notes

- Parámetro `p_factura` conserva nombre histórico; el objeto incluye `tipo` y campos de documento.
- UI no debe hacer SELECTs de verificación post-commit que confundan éxito con fallo de lectura.

---

> Última actualización: agosto 2026
