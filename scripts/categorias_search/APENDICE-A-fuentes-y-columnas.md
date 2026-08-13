# APÉNDICE A — Fuentes y columnas

## DB exports (`categorias_search/`)

### `pasadas_rows.csv`

`id,fecha_hora,pase_id,patente_id,estacion_id,documento_id,precio,bonificacion,quantity,importe_neto,created_at,user_id,file_upload_name`

No patente text; no `categoria`.

### `pwbi_pasadas_rows.csv`

Includes `Patente`, `Peaje_Nombre`, `Empresa_Nombre`, `file_upload_name`, `precio`.  
`Patente_Categoria` is **not** toll category.

## Telepase CSV (`scripts/downloads/`)

Delimiter `;`. Variants:

| Variant | Patente col | Time cols | Notes |
|---|---|---|---|
| AUSA / AUSOL / AUTO-OESTE / CVSA / SANTAFE | `PATENTE` | `FECHA` + `HORA` (`HH:MM:SS` or `HHMMSS`) | AUSA `TARIFA` often `13.015,92` |
| MERCOSUR-like | `DOMINIO` | `FECHA` + `HORA` | |
| AUBASA | `PATENTE` | `FECHA` + `HORA` + `HORA_TRANSFORMADA` | Prefer `HORA_TRANSFORMADA` when present; `FECHA` may be `D/M/YYYY` |

All Telepase variants include **`CATEGORIA`** and **`TARIFA`**.

`concesion` for source extract = parent folder under `downloads/` (e.g. `AUSA`, `SANTAFE`).

## Telepase Plus XLSX

`scripts/telepeaje plus/202607-1/ConsumosResumen-202607-1.xlsx`  
`scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx`

Typical columns include `Dominio`, `Concesion`, `Fecha`, `Importe Original` — **no `CATEGORIA`**.  
`file_upload_name` in DB is basename only (`ConsumosResumen.xlsx`).

## Join keys

1. `file_name` = `file_upload_name` (basename)
2. `patente` (trim, upper)
3. `fecha_hora` (exact, then ±2s; try Argentina local→UTC). Note: export style `+00` must be parsed as `+00:00`.
4. Prefer `tarifa` ↔ `precio` (decimal-normalized).
5. **Fallback** (AUSA): when DB `precio` ≠ source `TARIFA` (European thousands), join on `file_name + patente + fecha_hora` if the category is unique. The update CSV still stores **DB `precio`** as `tarifa` so SQL can check `pasadas.precio`.
