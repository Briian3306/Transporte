# Estaciones pendientes (RPC)

## Summary

Listado paginado y agregado de estaciones sin coordenadas (badge UI `PENDING`) que tienen pasadas asociadas, para completar ubicación desde `/peajes/pasadas-pendientes`.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Tables](#tables)
- [Functions](#functions)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Exponer un backlog de estaciones a geocodificar/completar (latitud + longitud), con cantidad y total de pasadas, sin recorrer el CRUD completo de pasadas.

## Business Logic

- Criterio PENDING: `estacion_latitud IS NULL OR estacion_longitud IS NULL` en `pasadas_gestion` (misma regla que `stationBadgeFromCoords` en UI).
- Agrupa por `estacion_id`: rango de fechas (`min`/`max` `fecha_hora`), `cantidad_pasadas`, `total_importe` (suma de `importe_neto`).
- Enriquecimiento desde `estaciones`: `ubicacion`, `camino`, coords actuales.
- Filtros opcionales: `fecha_desde`/`fecha_hasta`, `empresa_ids`, `q_estacion`, `q_empresa`.
- Orden permitido: `estacion_nombre`, `empresa_nombre`, `fecha_desde`, `fecha_hasta`, `cantidad_pasadas`, `total_importe`.
- El detalle de pasadas de una estación reutiliza `peajes_listar_pasadas` con `estacion_ids`.
- Guardar ubicación en UI llama `actualizarEstacion` (tabla `estaciones`) y setea `estado_geocodificacion` a `OK` si hay lat+lng, si no `REVIEW`.

## Tables

| Tabla / vista | Rol |
|---------------|-----|
| `pasadas_gestion` | lectura agregada |
| `estaciones` | join de ubicación / coords; escritura vía catálogo |

## Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `peajes_listar_estaciones_pendientes` | RPC | Listado agregado PENDING paginado |

**Ubicación:** `supabase/migrations/20260810142350_peajes_listar_estaciones_pendientes.sql`.

**Firma:** `(p_filters jsonb, p_sort text, p_dir text, p_limit integer, p_offset integer) → jsonb` con `{ rows, total, limit, offset }`.

**Seguridad:** `SECURITY INVOKER`; `EXECUTE` a `authenticated` y `service_role` (revocado de `PUBLIC`).

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `supabase/tests/peajes_estaciones_pendientes_test.sql` | Existe función, INVOKER, shape jsonb |
| CLI | `npx supabase db reset --local --no-seed` + `npx supabase test db` | Migración aplica |
| UI | `/peajes/pasadas-pendientes` | Expand + drawer ubicación |

**Estado:** verificado en CLI (suite peajes PASS).

## Notes

- Servicio Angular: `PeajesPasadasSupabaseService.listarEstacionesPendientes`.
- Badge UI: `OK` \| `PENDING` vía coords; DB `estado_geocodificacion` usa `OK` \| `REVIEW`.

---

> Última actualización: agosto 2026
