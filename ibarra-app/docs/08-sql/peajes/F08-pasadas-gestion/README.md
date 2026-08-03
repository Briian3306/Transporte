# F08 — Gestión de pasadas (vista + RPCs)

## Migración

`supabase/migrations/20260803190348_peajes_pasadas_audit_gestion.sql`

## Artefactos (sin tablas nuevas)

| Tipo | Nombre | Rol |
|------|--------|-----|
| ALTER | `pasadas.user_id`, `pasadas.file_upload_name` | Auditoría por fila |
| ALTER | `registros_carga_peajes.user_id` | Auditoría de lote |
| VIEW | `pasadas_gestion` | Joins para UI (coords, empresa, patente, factura) |
| VIEW | `pasadas_con_peaje` | Recreada con `DROP VIEW` + `CREATE VIEW` (no `CREATE OR REPLACE`) para incluir columnas nuevas de `p.*` sin 42P16 |
| FN | `peajes_confirmar_carga` | Popula `user_id` + `file_upload_name` |
| FN | `peajes_listar_pasadas` | Listado paginado/filtrado |
| FN | `peajes_crear_pasada` | Alta manual |
| FN | `peajes_actualizar_pasada` | Edición (no toca auditoría) |
| FN | `peajes_eliminar_pasada` | Baja |

## Badge estación

UI: OK solo si `estacion_latitud` y `estacion_longitud` están informados; si no, PENDING.
