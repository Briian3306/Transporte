# Importación masiva — ConsumosResumen (Telepase Plus)

Guía operativa para cargar `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (o archivos con la misma forma).

## Paso a paso

1. **Paso 1 — Cargar archivo**
   - Modo: **Importación masiva**
   - El Excel debe traer la columna exacta `FACTURA`
   - Empresa en Paso 1: opcional (se completa por documento desde `Concesion`)

2. **Pasos 2–4** — Selección de columnas, transformaciones y plantilla (compartidos para todo el workbook).

3. **Paso 5 — Mapear columnas** (stitch: `docs/templates-stich/.../paso_4_mapear_columnas/`)

   | Columna Excel | Destino estándar |
   |---|---|
   | `Tag Nº` | `PASE_ID` |
   | `Dominio` | `PATENTE_ID` |
   | `Estación` | `ESTACION_ID` |
   | `Fecha` (datetime) | `FECHA_HORA` |
   | `Importe Original` | `PRECIO` |
   | `Descuento Importe` | `BONIFICACION` |
   | `FACTURA` | metadata → número de documento (no Structure Goal) |
   | `Concesion` | metadata → empresa / peaje (no Structure Goal) |

4. **Paso 5–6 — Concesion → Peaje → Estaciones (RN-26)**
   - `Concesion` = **peaje** (no estación); Paso 5 muestra peajes recomendados
   - `Estación` = código proveedor → `ESTACION_ID`
   - Paso 6 lista solo estaciones del peaje identificado; el usuario puede corregir peaje/estación
   - No se muestran estaciones de peajes/empresas ajenos por defecto

5. **Paso 7 — Documentos**
   - Un accordion por valor de `FACTURA` (número autocompletado)
   - Tipo siempre **FC**
   - Empresa autocompletada desde `Concesion` (editable)
   - Por panel: **Quitar IVA** (/1,21 cabecera + pasadas) y **Agregar IVA** (21% + ×1,21 pasadas)

6. **Pasos 8–9** — Validación y confirmación por documento.

## Código

- Helpers: `models/consumos-resumen.helpers.ts`
- Aliases / recomendaciones: `wizard/services/column-recognition.ts`
- Docs relacionados: [reconocimiento-estaciones.md](./reconocimiento-estaciones.md)

## Feature

**F13-3** — ver `feature_list.json`.
