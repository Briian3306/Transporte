# Usuarios y permisos

## Resumen

Peajes utiliza las acciones `read`, `create` y `manage`; el acceso se resuelve por permisos asignados y no por el texto literal del rol (`admin`, `administrador`, etc.).

## Permisos de Peajes

| Permiso | Uso |
| --- | --- |
| `peajes:read` | Consulta y revisión de pasadas, ubicaciones y auditoría. |
| `peajes:create` | Carga y procesamiento de archivos. |
| `peajes:manage` | Acceso administrativo completo al módulo. |

## Matriz de acceso

| Sección | Administrador (`manage`) | Operador de carga y revisión (`read` + `create`) |
| --- | ---: | ---: |
| Home `/peajes` | Sí, todas las tarjetas | Sí, solo las cuatro vistas operativas |
| Asistente de carga | Sí | Sí |
| Pasadas | Sí | Sí |
| Ubicaciones pendientes | Sí | Sí |
| Auditoría de tarifas | Sí | Sí |
| Catálogos | Sí | No |
| Plantillas y algoritmos | Sí | No |
| Carga rápida | Sí | No |
| Documentos | Sí | No |

La combinación `read` + `create` es obligatoria para el perfil operativo. Tener solo `read` no habilita el asistente ni las cuatro vistas operativas. Las tarjetas no autorizadas se ocultan en el home y las rutas se validan nuevamente mediante `PermissionGuard` para impedir acceso directo.

## Configuración recomendada de roles

- Administrador: asignar `peajes:read`, `peajes:create` y `peajes:manage`.
- Operador de carga y revisión: asignar `peajes:read` y `peajes:create`.
- Usuario de consulta sin carga: no obtiene acceso a las vistas operativas de Peajes con esta política; requiere una definición funcional adicional antes de asignarle un permiso parcial.

Administra usuarios, roles y permisos granulares por módulo y acción.

## Código y relaciones

Se implementa en `src/app/components/user-management`, `role-management`, `role-permission-management` y `role-permissions-edit`. Peajes se integra mediante el módulo `peajes` y las acciones `read`, `create` y `manage`, documentadas en esta página.
