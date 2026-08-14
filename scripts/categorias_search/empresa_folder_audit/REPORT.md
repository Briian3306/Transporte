# Pasadas empresa vs download folders

Audit snapshot **2026-08-14** (read-only). DESARROLLO `kfffigvyvtzyczeiadxh`.

`pasadas` has no `empresa_id`. UI **Empresa** = `estacion_id → peajes.empresa_id` (`pasadas_gestion`).

## Data fix (2026-08-14, DESARROLLO)

The 244 mismatch rows were moved to Zarate `c9ed477b-11e7-4698-a81d-97813a9ae538` (Autovía del Mercosur). Then `peajes_recalcular_tarifas` on Mercosur (244 pasadas rematched) and AUBASA.

Wizard prevention is **done** (F02-17): Paso 1 `empresaId` scopes Paso 6 `reconocerEstacion`. A plantilla that restores another company's estación opens Paso 6 instead of skipping to Factura. See [reconocimiento-estaciones.md](../../../ibarra-app/docs/06-components/peajes/reconocimiento-estaciones.md).

## Result (pre-fix)

**3 Telepase files were wrong. 244 pasadas sat on AUBASA / DOCK SUD but the files live under `MERCOSUR/`.**

| file_upload_name | Folder | Expected | DB (estación → peaje) | Rows | Wizard documento |
|---|---|---|---|---|---|
| `pasadas_2026-07-16_86802.csv` | `MERCOSUR/julio/` | AUTOVIA DEL MERCOSUR | AUBASA / DOCK SUD | 148 | AUTOVIA DEL MERCOSUR (correct) |
| `pasadas_2026-07-16_86803.csv` | `MERCOSUR/julio/` | AUTOVIA DEL MERCOSUR | AUBASA / DOCK SUD | 47 | AUTOVIA DEL MERCOSUR (correct) |
| `pasadas_2026-07-01_79158.csv` | `MERCOSUR/julio/` | AUTOVIA DEL MERCOSUR | AUBASA / DOCK SUD | 49 | AUTOVIA DEL MERCOSUR (correct) |

Contrast: `pasadas_2026-07-01_79157.csv` in the same folder maps to **Zarate / Autovía del Mercosur** (164 rows, OK).

These 244 rows mix Mercosur prices (e.g. 18 829.29 on DOCK SUD) into AUBASA `tarifas_normalizadas`.

Full table: [mismatches.csv](./mismatches.csv).

## Why (fixed in wizard F02-17)

Provider code `0001` is on **both** Zarate (MERCOSUR) and DOCK SUD (AUBASA). MERCOSUR CSVs use `ESTACION=0001`. Paso 6 now scopes recognition to Paso 1 company; a plantilla that pins DOCK SUD on a MERCOSUR load opens Paso 6 instead of skipping to Factura.

## Counts

| | N |
|---|---|
| DESARROLLO pasadas | 4900 |
| Distinct `file_upload_name` in DB | 36 |
| Inventory rows (disk) | 162 |
| Mapped to a catalog empresa | 160 |
| Telepase loaded, empresa matches folder | 31 files |
| Telepase loaded, empresa **mismatch** | **3 files / 244 rows** |
| ConsumosResumen loaded (not flagged) | 2 files (`ConsumosResumen-202607-1.xlsx` 696, `ConsumosResumen.xlsx` 1015) |
| On disk, not in `pasadas` | 124 (historical MERCOSUR + SANTAFE + `Consumos.xlsx`) |
| In `pasadas`, not on disk | 0 |
| Ambiguous filename in two folders | 0 |

## ConsumosResumen (not a mismatch)

`scripts/telepeaje plus/**/*.xlsx` → expected source **TELEPEAJE-PLUS** (`8b5414f2-3a0a-45ee-abb2-69cac0e2920f`).

Those books are multi-concession. Station empresas (CORREDORES VIALES SA, RUTAS SUR ATLANTICO, CORREDOR VIAL 5, CONEXION ALTO DELTA) are **not** treated as folder errors.

Informational: `documentos.empresa_id` on those loads is the concession, not TELEPEAJE-PLUS.

`Consumos.xlsx` is on disk and not loaded.

## Folder → catalog (used)

- `AUBASA` → AUBASA
- `AUSA` → AUSA
- `AUSOL` → AUSOL
- `AUTO-OESTE` (aliases AUTO-ESTE, AU-OESTE) → AUTOPISTA DEL OESTE
- `CVSA` (alias CSVA) → CORREDORES VIALES SA
- `MERCOSUR` → AUTOVIA DEL MERCOSUR
- `SANTAFE` (alias SANTA FE) → UNIDAD EJECUTORA (SANTA FE) (catalog name; not “UNION EJECUTADORA SANTAFE”)
- `telepeaje plus` xlsx → TELEPEAJE-PLUS

Skipped: `errors.csv`, `*_testing.csv`.

## Files

- [file_folder_empresa.csv](./file_folder_empresa.csv) — every source file + expected `empresa_id`
- [mismatches.csv](./mismatches.csv) — the 3 wrong loads only
- [build_audit.mjs](./build_audit.mjs) — how the inventory was built

> Última actualización: 2026-08-14. Data fix applied on DESARROLLO (Zarate). Wizard `0001` collision fixed (F02-17).
