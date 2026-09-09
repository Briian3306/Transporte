# Validación de importes y documento

## Summary

RPCs de cálculo de neto, tolerancia monetaria y validación de subtotal de documento vs pasadas (RN-09, RN-11, RN-13, RN-17). Soportan FC (positivos) y NC (negativos). Incluyen **bonificación de cabecera** (`documentos.bonificacion`), distinta de la bonificación por fila en `pasadas`.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Garantizar integridad monetaria antes y después de persistir un documento.

## Business Logic

- `importe_neto = precio - bonificacion` (fila) con reglas de signo coherentes FC/NC.
- Bonificación de **cabecera** (`documentos.bonificacion`): dato manual de la factura PDF; no viene del Excel.
- Conciliación de documento (RN-13/17):

```text
Σ IMPORTE_NETO − bonificacion_documento ≈ importe_sin_iva
```

Equivalente en RPC:

```text
abs(Σ IMPORTE_NETO − (importe_sin_iva + bonificacion)) ≤ abs(importe_sin_iva) * 0.01
```

- Tolerancia de **fila** (RN-11): `peajes_tolerancia_importe()` = `0.01`.
- Tolerancia de **documento** (RN-13/17): si `p_tolerancia` es NULL, usa `abs(subtotal) * 0.01`.
- `peajes_validar_documento_id` lee subtotal, bonificación e importes de pasadas y delega en `peajes_validar_factura_pasadas`.
- `peajes_validar_factura_id` es alias de compatibilidad.

## Functions

| Función | Tipo | Parámetros | Retorno | Descripción |
|---------|------|------------|---------|-------------|
| `peajes_tolerancia_importe` | RPC | — | `numeric` | 0.01 |
| `peajes_calcular_importe_neto` | RPC | precio, bonificacion | `numeric` | Neto firmado (fila) |
| `peajes_validar_factura_pasadas` | RPC | importe, importes[], tolerancia?, bonificacion? | `jsonb` | Diff / ok vs subtotal+bonif |
| `peajes_validar_documento_id` | RPC | documento_id, tolerancia? | `jsonb` | Por id |
| `peajes_validar_factura_id` | RPC | factura_id, tolerancia? | `jsonb` | Alias |

**Ubicación:** migraciones F01 + `20260805113339_peajes_tolerancia_factura_uno_por_ciento.sql` + F13 `20260807140000_peajes_documentos_tipo_nc.sql` + `20260810191639_peajes_documentos_bonificacion.sql`.

## Validations

- `|bonificacion_fila| <= |precio|`.
- Signos de bonificación de fila alineados al signo de precio (NC).
- Bonificación de cabecera: default `0`; signo alineado al tipo FC/NC al confirmar.
- Diferencia absoluta ≤ tolerancia para aprobar.

## Testing

| Tipo | Archivo / comando esperado | Escenario |
|------|---------------------------|-----------|
| `supabase_db_test` | `peajes_f01_test.sql` | diff 0, diff > 1%, NC negativos, cabecera con bonificación > 0 |

**Estado:** verificado (F01-5, F11 evidencia parcial, F13-1; bonificación cabecera 2026-08-10)

## Notes

- Tabla canónica: `documentos` (no `facturas`).
- Columna: `documentos.bonificacion` (cabecera) ≠ `pasadas.bonificacion` (fila).
- UI Paso 7: input Bonificación; UI Paso 8: [validacion-carga.md](../../06-components/peajes/validacion-carga.md)

---

> Última actualización: agosto 2026
