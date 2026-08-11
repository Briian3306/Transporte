# Paso 1 — Cargar archivo (Stitch reference)

Plantilla visual Stitch para el wizard Peajes (`code.html` + `screen.png`).

## Importación masiva multi-empresa

- Modo **Importación masiva** en el wizard Angular: requiere columna Excel exacta `FACTURA`.
- El archivo puede mezclar documentos de distintas empresas (caso típico: `scripts/telepeaje plus/.../ConsumosResumen.xlsx`).
- Empresa en Paso 1: opcional (default). En **Paso 7 Documento** cada panel del accordion permite elegir/cambiar la empresa y saltar a:
  - Paso 5 — Mapear columnas
  - Paso 6 — Estaciones

## Tracking

- Feature canónica: `ibarra-app/feature_list.json` → `F13-2`
- Bitácora: `ibarra-app/docs/claude-progress.md`
- XREF scripts (sample Excel): `scripts/feature-list-script.json` → `TS-XREF-F13-2`
