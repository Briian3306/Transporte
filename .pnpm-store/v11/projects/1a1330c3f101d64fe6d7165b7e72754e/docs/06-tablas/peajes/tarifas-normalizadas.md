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

`fecha_aparicion` (`timestamptz`, nullable) es la **primera** `pasadas.fecha_hora` vinculada al nivel (`MIN` histórico). El backfill de la migración `20260902163000` la calcula sobre las pasadas ya matcheadas. El trigger `trg_pasadas_fecha_aparicion` (`AFTER INSERT OR UPDATE OF tarifa_normalizada_id, fecha_hora` en `pasadas`) la setea si está `NULL` o si llega una fecha más temprana; nunca la mueve hacia adelante. No depende de `confirmado_manual`. `NULL` = nivel todavía sin pasadas matcheadas.

Esta tabla **permanece** como camino de compatibilidad (F14-16): no se elimina, no se renombra y conserva FKs, writers (`peajes_normalizar_tarifas` / `peajes_recalcular_tarifas`) y `pasadas.tarifa_normalizada_id`. El catálogo v2 (`tarifas` + `tarifa_importe`) usa categoría **calculada** (smallint) y `fecha_aparicion` del registro de importe, no estas semánticas de texto crudo / fecha más temprana. Ver [tarifas-tarifa-importe.md](./tarifas-tarifa-importe.md).

## Columnas nuevas en pasadas

Ver [documentos-pasadas.md](./documentos-pasadas.md): `categoria`, `tarifa_normalizada_id`, `tarifa_status`. F14-16 agrega `sentido` y `tarifa_importe_id` (sombra v2) sin quitar el FK legado.

---

> Última actualización: 2026-09-08
