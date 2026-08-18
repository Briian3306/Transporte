# Tablas — Tarifas normalizadas (F14)

## Resumen

Esquema de normalización / auditoría tarifaria. Detalle de RPCs y reglas: [auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md). Plan: [auditoria-pasadas-patrones](../../plan/auditoria-pasadas-patrones/INDEX.md).

## tarifas_parametros_peaje

Parámetros por peaje: `umbral_muestra_minima` (default 15), `umbral_dispersion` (default 4.100), `auto_confirmar_horario` (default `false` — MVP siempre exige confirmación humana).

## tarifas_status_catalogo

Vocabulario de status por peaje (`codigo`, `etiqueta`, `color`, `tipo_meta` ∈ `PICO|NO_PICO|NEUTRO`, `orden`). Unique `(peaje_id, codigo)`. Al insertar un peaje, el trigger `trg_peajes_seed_status_catalogo` crea `NO_PICO` y `PICO` si aún no hay filas.

## tarifas_normalizadas

Familias `(peaje_id, estacion_id, categoria, importe)` con `diagnostico` (capa 1 algorítmica), `status` (capa 2 humana) y `categoria_calculated` (capa 3 opcional, Patrón A: smallint 0–10). Unique `NULLS NOT DISTINCT` sobre esa cuádruple. Trigger valida `status` contra universales `PENDIENTE`/`POSIBLE_HORARIO` o el catálogo del peaje.

`categoria` aquí es el mismo texto crudo del proveedor que `pasadas.categoria` (RN-15); `NULL` ⇒ Patrón A. `categoria_calculated` no es esa columna: es la clase que anota el analista cuando el archivo no trajo categoría. Recálculo no la pisa.

## Columnas nuevas en pasadas

Ver [documentos-pasadas.md](./documentos-pasadas.md): `categoria`, `tarifa_normalizada_id`, `tarifa_status`.

---

> Última actualización: 2026-08-18
