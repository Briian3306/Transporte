# Vistas Power BI (`pwbi_*`)

## Summary

Vistas de solo lectura para consumir el dominio Peajes desde Power BI: dimensiones `pwbi_estacion`, `pwbi_patentes`, `pwbi_documentos`, `pwbi_tarifas`, y hecho `pwbi_pasadas` (aliases `*_ID` / `*_Nombre`). Lectura vía Data API con rol `anon`.

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
- `pwbi_patentes`: una fila por patente (`Patente_ID`, `Patente`, `created_at`).
- `pwbi_documentos`: una fila por documento FC|NC (importes de cabecera + empresa).
- `pwbi_pasadas`: hecho denormalizado (pasada + estación + peaje + empresa + patente + pase + documento) con FKs para relacionar dimensiones. Incluye `Tarifa_Status` (PICO/NO_PICO) y `Estacion_Geocodificacion_Status` (`OK`|`REVIEW`, calidad de coordenadas; no es tarifa).
- `pwbi_tarifas`: una fila por nivel de `tarifas_normalizadas`; `Status` es PICO/NO_PICO (sin `Tipo_Meta`); expone `Hora_Min` / `Hora_Max` / `Hora_Media`.
- Vistas con `security_invoker = false` y `GRANT SELECT` a `anon`, `authenticated`, `service_role`.
- Columnas PascalCase entrecomilladas en SQL para conservar el nombre exacto en el cliente.

## Relations

| Entidad | Relación en Power BI |
|---------|----------------------|
| `pwbi_estacion` | `Estacion_ID` ← `pwbi_pasadas.Estacion_ID` |
| `pwbi_patentes` | `Patente_ID` ← `pwbi_pasadas.Patente_ID` |
| `pwbi_documentos` | `Documento_ID` ← `pwbi_pasadas.Documento_ID` |
| `pwbi_tarifas` | `Tarifa_Normalizada_ID` ← `pwbi_pasadas.Tarifa_Normalizada_ID` |
| `pwbi_pasadas` | Hecho; también expone `Pase_ID`, `Peaje_ID`, `Empresa_ID` |

## Tables

| Vista | Rol | Fuentes |
|-------|-----|---------|
| `pwbi_estacion` | dimensión | `estaciones` JOIN `peajes` |
| `pwbi_patentes` | dimensión | `patentes` |
| `pwbi_documentos` | dimensión | `documentos` LEFT JOIN `empresas` |
| `pwbi_tarifas` | dimensión | `tarifas_normalizadas` JOIN `peajes` + `estaciones` |
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

### Columnas clave `pwbi_pasadas`

FKs: `Pasada_ID`, `Estacion_ID`, `Patente_ID`, `Pase_ID`, `Documento_ID`, `Peaje_ID`, `Empresa_ID`, `Tarifa_Normalizada_ID`.

Medidas / atributos: `fecha_hora`, `precio`, `bonificacion`, `quantity`, `importe_neto`, `file_upload_name`, `created_at`, `user_id`, `Categoria`, `Tarifa_Status` (PICO/NO_PICO; no confundir con geocodificación), `Estacion_Geocodificacion_Status` (`OK`\|`REVIEW` desde `estaciones.estado_geocodificacion`), nombres denormalizados (`Estacion_Nombre`, `Peaje_Nombre`, `Empresa_Nombre`, `Patente`, `Patente_Categoria`, `Pase`), geo (`Estacion_Latitud`, `Estacion_Longitud`), documento (`Documento_Numero`, `Documento_Tipo`, `Documento_Cuenta`, `fecha_factura`, `Documento_Importe_Sin_Iva`, `Documento_Importe_Total`).

## Policies

| Objeto | Rol | Privilegio |
|--------|-----|------------|
| `pwbi_*` | `anon`, `authenticated`, `service_role` | `SELECT` |

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `supabase/tests/peajes_pwbi_views_test.sql` | Existencia, columnas, GRANT anon |
| CLI | `npx supabase db reset --local --no-seed` + `npx supabase test db` | Rebuild + suite |

**Estado:** DESARROLLO con `pwbi_tarifas` + `Estacion_Geocodificacion_Status` (migración `20260818131012`; CLI 2026-08-18).

## Notes

- Migraciones: `20260810194113_peajes_pwbi_views.sql`, `20260811114646_peajes_pwbi_anon_api_access.sql`, `20260811121811_peajes_pwbi_documentos.sql`, `20260812140648_peajes_tarifas_vistas.sql`, `20260818131012_peajes_pwbi_tarifas.sql`.
- No reemplaza `pasadas_gestion` ni los RPC de la UI.
- Guía de conexión Power BI (**API URL + anon key** + tipos en Power Query): [docs/05-configuracion/powerbi-supabase.md](../../05-configuracion/powerbi-supabase.md).
- Lectura Data API: `security_invoker=false` + `GRANT SELECT` a `anon`.

---

> Última actualización: agosto 2026
