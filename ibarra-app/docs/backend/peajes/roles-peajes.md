# Roles Peajes — Full y Básico

## Summary

El módulo Peajes se abre con roles propios. Ya no hace falta asignar `admin` o `administrador` para usarlo.

## Purpose

El rol legado `peajes` existía sin `role_permissions`. El guard exige `peajes:read` (y `peajes:create` en las pantallas operativas), así que esos usuarios veían acceso denegado salvo que también tuvieran Admin.

## Business Logic

| Rol | Acciones `peajes` | Pantallas |
|---|---|---|
| `peajes - full` | todas las del módulo, incluida `manage` | Todas las rutas de Peajes, incluidas plantillas y algoritmos |
| `peajes - basico` | `read`, `create`, `update` | Carga rápida, Documentos (solo facturas), Catálogos y Pasadas |
| `peajes` (legado) | las mismas que Básico | Igual que Básico, para los usuarios que ya lo tienen |

Documentos con Básico no muestra Listado, Builder, Aplicar ni Algoritmos. Esas vistas quedan en Full (`peajes:manage`).

La migración `20261013151209_peajes_roles_full_basico.sql` es idempotente y no hace nada si las tablas RBAC del host todavía no existen. El seed local `seed_rbac.sql` crea los mismos roles.

## Notes

No se aplica con `db push` mientras el historial remoto tenga versiones sin archivo local (`20261002174636`, `20261002174639`). El 2026-10-13 los roles y permisos se insertaron en el remoto Peajes `kfffigvyvtzyczeiadxh` (el que usa `npm start`), y la versión `20261013151209` quedó registrada en `schema_migrations`.
