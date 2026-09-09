# Vistas Power BI (`pwbi_*`)

## Summary

Vistas de solo lectura para consumir el dominio Peajes desde Power BI: dimensiones `pwbi_estacion`, `pwbi_patentes`, `pwbi_documentos`, `pwbi_tarifas`, **`pwbi_tarifas_v2` (paralela, F14-16)**, y hecho `pwbi_pasadas` (aliases `*_ID` / `*_Nombre`). Lectura vía Data API con rol `anon`. `pwbi_tarifas` **no** fue reemplazada.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Policies](#policies)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Exponer un esquema estrella estable para relaciones en Power BI sin alterar las vistas de gestión de la app (`pasadas_gestion`).

## Business Logic

- `pwbi_estacion`: una fila por estación; `Status` = `estaciones.estado_geocodificacion` (`OK` | `REVIEW`); incluye `Peaje_ID` / `Peaje_Nombre` y `Latitud` / `Longitud`.
- `pwbi_patentes`: una fila por patente (`Patente_ID`, `Patente`, `Patente_Categoria`, `Patente_Tipo_Trabajo`, `Patente_Activa`, `created_at`).
- `pwbi_documentos`: una fila por documento FC|NC (importes de cabecera + empresa).
- `pwbi_pasadas`: hecho denormalizado (pasada + estación + peaje + empresa + patente + pase + documento) con FKs para relacionar dimensiones. Incluye `Patente_Categoria`, `Patente_Tipo_Trabajo` y `Patente_Activa`, además de `Tarifa_Status` (PICO/NO_PICO) y `Estacion_Geocodificacion_Status` (`OK`|`REVIEW`, calidad de coordenadas; no es tarifa). `Categoria_Calculated` / `Categoria_Calculated_Boolean`: si `Categoria` es NULL se copia `tarifas_normalizadas.categoria_calculated` (Patrón A) y el boolean es TRUE; si hay categoría de proveedor, calculated queda NULL y el boolean es FALSE.
- `pwbi_tarifas`: una fila por nivel de `tarifas_normalizadas`; `Status` es PICO/NO_PICO (sin `Tipo_Meta`); expone `Hora_Min` / `Hora_Max` / `Hora_Media` y `fecha_aparicion` (primera `pasadas.fecha_hora` del nivel). **Sigue vigente**; F14-16 no la reescribe.
- `pwbi_tarifas_v2`: una fila por configuración `tarifas` + importe current vía puntero. Más delgada que `pwbi_tarifas`. LEFT JOIN puede dejar `Importe` NULL. No es un clon drop-in.
- Vistas con `security_invoker = false` y `GRANT SELECT` a `anon`, `authenticated`, `service_role`.
- Columnas PascalCase entrecomilladas en SQL para conservar el nombre exacto en el cliente.

## Relations

| Entidad | Relación en Power BI |
|---------|----------------------|
| `pwbi_estacion` | `Estacion_ID` ← `pwbi_pasadas.Estacion_ID` |
| `pwbi_patentes` | `Patente_ID` ← `pwbi_pasadas.Patente_ID` |
| `pwbi_documentos` | `Documento_ID` ← `pwbi_pasadas.Documento_ID` |
| `pwbi_tarifas` | `Tarifa_Normalizada_ID` ← `pwbi_pasadas.Tarifa_Normalizada_ID` |
| `pwbi_tarifas_v2` | Dimensión paralela por `Tarifa_ID` / `Current_Tarifa_ID`. `pwbi_pasadas` **no** expone aún `Tarifa_Importe_ID`. |
| `pwbi_pasadas` | Hecho; también expone `Pase_ID`, `Peaje_ID`, `Empresa_ID` |

## Tables

| Vista | Rol | Fuentes |
|-------|-----|---------|
| `pwbi_estacion` | dimensión | `estaciones` JOIN `peajes` |
| `pwbi_patentes` | dimensión | `patentes` |
| `pwbi_documentos` | dimensión | `documentos` LEFT JOIN `empresas` |
| `pwbi_tarifas` | dimensión | `tarifas_normalizadas` JOIN `peajes` + `estaciones` |
| `pwbi_tarifas_v2` | dimensión paralela | `tarifas` LEFT JOIN `tarifa_importe` (puntero current) |
| `pwbi_pasadas` | hecho | `pasadas` + catálogos + `documentos` (mismo patrón que `pasadas_gestion`) |

### Columnas `pwbi_estacion`

| Columna | Origen |
|---------|--------|
| `Estacion_ID` | `estaciones.id` |
| `Estacion_Nombre` | `estaciones.nombre` |
| `Peaje_ID` | `estaciones.peaje_id` |
| `Peaje_Nombre` | `peajes.nombre` |
| `Ubicacion` | `estaciones.ubicacion` |
| `Latitud` | `estaciones.latitud` |
| `Longitud` | `estaciones.longitud` |
| `Status` | `estaciones.estado_geocodificacion` |
| `created_at` | `estaciones.created_at` |

### Columnas `pwbi_patentes`

| Columna | Origen |
|---------|--------|
| `Patente_ID` | `patentes.id` |
| `Patente` | `patentes.patente` |
| `Patente_Categoria` | `patentes.categoria` (`FLOTA CAMIONES`, `FLOTA UTILITARIA`, `REMIS`, `OBRA`, `AUTO`) |
| `Patente_Tipo_Trabajo` | `patentes.tipo_trabajo` |
| `Patente_Activa` | `patentes.activa` |
| `created_at` | `patentes.created_at` |

### Columnas `pwbi_documentos`

| Columna | Origen |
|---------|--------|
| `Documento_ID` | `documentos.id` |
| `Documento_Numero` | `documentos.factura` |
| `Documento_Tipo` | `documentos.tipo` (`FC` \| `NC`) |
| `Documento_Cuenta` | `documentos.cuenta` |
| `Empresa_ID` | `documentos.empresa_id` |
| `Empresa_Nombre` | `empresas.nombre` |
| `fecha_factura` | `documentos.fecha_factura` |
| `Documento_Importe_Sin_Iva` | `documentos.importe_sin_iva` |
| `Documento_Bonificacion` | `documentos.bonificacion` |
| `Documento_Percepciones` | `documentos.percepciones` |
| `Documento_Iva` | `documentos.iva` |
| `Documento_Importe_Total` | `documentos.importe_total` |
| `created_at` | `documentos.created_at` |

### Columnas `pwbi_tarifas`

| Columna | Origen |
|---------|--------|
| `Tarifa_Normalizada_ID` | `tarifas_normalizadas.id` |
| `Peaje_ID` | `tarifas_normalizadas.peaje_id` |
| `Peaje_Nombre` | `peajes.nombre` |
| `Estacion_ID` | `tarifas_normalizadas.estacion_id` |
| `Estacion_Nombre` | `estaciones.nombre` |
| `Categoria` | texto crudo proveedor (NULL = Patrón A) |
| `Categoria_Calculated` | clase opcional Patrón A 0–10 |
| `Importe` | `tarifas_normalizadas.importe` |
| `Importe_Base` | `tarifas_normalizadas.importe_base` |
| `Cases` | `tarifas_normalizadas.cases` |
| `Multiplicador` | `tarifas_normalizadas.multiplicador` |
| `Desvio` | `tarifas_normalizadas.desvio` |
| `Hora_Min` / `Hora_Max` / `Hora_Media` | horas decimales UTC del nivel |
| `Patron` | `A` \| `B` |
| `Diagnostico` | capa 1 |
| `Status` | capa 2 (`PICO` / `NO_PICO` / `PENDIENTE` / `POSIBLE_HORARIO`). No hay `Tipo_Meta`. |
| `Muestra_Confiable` | `tarifas_normalizadas.muestra_confiable` |
| `Confirmado_Manual` | `tarifas_normalizadas.confirmado_manual` |
| `created_at` | `tarifas_normalizadas.created_at` |
| `fecha_aparicion` | `tarifas_normalizadas.fecha_aparicion` (`timestamptz`; primera `pasadas.fecha_hora` del nivel; NULL si aún no hay match). Snake_case como `created_at`. |

### Columnas `pwbi_tarifas_v2`

Vista paralela (migración `20260907103000`). JOIN: `tarifas` LEFT JOIN `tarifa_importe` ON `ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id`. No usa `MAX(fecha_aparicion)`. PascalCase entrecomillado.

| Columna | Origen |
|---------|--------|
| `Tarifa_ID` | `tarifas.id` |
| `Peaje_ID` | `tarifas.peaje_id` |
| `Estacion_ID` | `tarifas.estacion_id` |
| `Categoria` | `tarifas.categoria` (**smallint** calculada, no texto crudo) |
| `Sentido` | `tarifas.sentido` |
| `Status` | `tarifas.status` (`PICO` / `NO_PICO`) |
| `Importe` | `tarifa_importe.importe` del puntero current. **NULL** si el puntero falta o no pertenece al padre |
| `Current_Tarifa_ID` | `tarifas.current_tarifa_id` |

No expone `Peaje_Nombre`, `Estacion_Nombre`, `hora_*`, `fecha_aparicion`, diagnóstico ni `Tarifa_Normalizada_ID`. No sustituye `pwbi_tarifas`.

### Columnas clave `pwbi_pasadas`

FKs: `Pasada_ID`, `Estacion_ID`, `Patente_ID`, `Pase_ID`, `Documento_ID`, `Peaje_ID`, `Empresa_ID`, `Tarifa_Normalizada_ID`.

Medidas / atributos: `fecha_hora`, `precio`, `bonificacion`, `quantity`, `importe_neto`, `file_upload_name`, `created_at`, `user_id`, `Categoria` (texto crudo proveedor; NULL = Patrón A), `Categoria_Calculated` (smallint 0–10 desde `tarifas_normalizadas` **solo si** `Categoria` es NULL; si hay categoría de proveedor queda NULL), `Categoria_Calculated_Boolean` (`TRUE` si se rellenó con esa clase, `FALSE` si no), `Tarifa_Status` (PICO/NO_PICO; no confundir con geocodificación), `Estacion_Geocodificacion_Status` (`OK`\|`REVIEW` desde `estaciones.estado_geocodificacion`), nombres denormalizados (`Estacion_Nombre`, `Peaje_Nombre`, `Empresa_Nombre`, `Patente`, `Patente_Categoria`, `Patente_Tipo_Trabajo`, `Patente_Activa`, `Pase`), geo (`Estacion_Latitud`, `Estacion_Longitud`), documento (`Documento_Numero`, `Documento_Tipo`, `Documento_Cuenta`, `fecha_factura`, `Documento_Importe_Sin_Iva`, `Documento_Importe_Total`).

## Policies

| Objeto | Rol | Privilegio |
|--------|-----|------------|
| `pwbi_*` | `anon`, `authenticated`, `service_role` | `SELECT` |

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `supabase/tests/peajes_pwbi_views_test.sql` | Existencia, columnas, GRANT anon; tests 42–45 `pwbi_tarifas_v2` |
| CLI | `npx supabase db reset --local --no-seed` + `npx supabase test db` | Rebuild + suite (2026-09-08: Files=14 Tests=412) |

**Estado:** DESARROLLO con `pwbi_tarifas.fecha_aparicion` (snake_case, migración `20260902185000` / MCP). `Estacion_Geocodificacion_Status` + `Patente_Categoria` / `Patente_Tipo_Trabajo` / `Patente_Activa` + `Categoria_Calculated` / `Categoria_Calculated_Boolean` en `pwbi_pasadas` (migración `20260818171958`). `pwbi_tarifas_v2` verificado en CLI local (2026-09-08, Files=14 Tests=412); **no** aplicado a DESARROLLO en F14-16.

## Notes

- Migraciones: `20260810194113_peajes_pwbi_views.sql`, `20260811114646_peajes_pwbi_anon_api_access.sql`, `20260811121811_peajes_pwbi_documentos.sql`, `20260812140648_peajes_tarifas_vistas.sql`, `20260818131012_peajes_pwbi_tarifas.sql`, `20260818144011_peajes_pwbi_pasadas_categoria_calculated.sql`, `20260818171958_peajes_patentes_categoria_tipo_trabajo_estado.sql`, `20260902163000_peajes_tarifas_fecha_aparicion.sql`, `20260902185000_peajes_pwbi_tarifas_fecha_aparicion.sql`, `20260907103000_peajes_tarifas_v2_compat_cutover.sql` (`pwbi_tarifas_v2` paralela; no DROP de `pwbi_tarifas`).
- No reemplaza `pasadas_gestion` ni los RPC de la UI.
- Detalle v2: [tarifas-tarifa-importe.md](./tarifas-tarifa-importe.md).
- Guía de conexión Power BI (**API URL + anon key** + tipos en Power Query): [docs/05-configuracion/powerbi-supabase.md](../../05-configuracion/powerbi-supabase.md). La guía de tipos M cubre `pwbi_tarifas` legado; `pwbi_tarifas_v2` aún no está en ese workbook.
- Lectura Data API: `security_invoker=false` + `GRANT SELECT` a `anon`.

---

> Última actualización: 2026-09-08
