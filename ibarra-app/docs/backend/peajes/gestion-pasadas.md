# Gestión de pasadas (RPC)

## Summary

Listado paginado y CRUD de pasadas sobre la vista `pasadas_gestion` / tabla `pasadas`, con `documento_id` (F08 / F13).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Tables](#tables)
- [Functions](#functions)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Administrar pasadas ya persistidas fuera del wizard (`/peajes/pasadas`).

## Business Logic

- `peajes_listar_pasadas`: filtros, orden, paginación; lee joins de catálogo vía vista.
- CRUD valida FKs y recalcula neto cuando aplica; usa `documento_id`.
- La vista expone `documento_*` y alias `factura_*` de compatibilidad.

## Tables

| Tabla / vista | Rol |
|---------------|-----|
| `pasadas` | escritura CRUD |
| `pasadas_gestion` | lectura listado |
| `documentos` | FK lectura |

## Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `peajes_listar_pasadas` | RPC | Listado filtrado |
| `peajes_crear_pasada` | RPC | Alta |
| `peajes_actualizar_pasada` | RPC | Patch |
| `peajes_eliminar_pasada` | RPC | Baja |

**Ubicación:** `20260803190348_peajes_pasadas_audit_gestion.sql` + ajustes F13 en `20260807140000_peajes_documentos_tipo_nc.sql`.

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | suite peajes | CRUD + listado |
| UI | `/peajes/pasadas` | DataTable |

**Estado:** verificado parcial (F08-1 en curso / evidence en feature_list)

## Notes

- Servicio: `PeajesPasadasSupabaseService`.

---

> Última actualización: agosto 2026
