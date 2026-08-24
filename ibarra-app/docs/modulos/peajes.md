# Módulo Peajes

## Resumen

Peajes automatiza la carga de archivos Excel/CSV, reconocimiento, transformación, mapeo, relación con catálogos, validación de **documentos** (FC|NC) y persistencia/auditoría en Supabase. Soporta carga simple e **importación masiva** (columna `FACTURA`). Es un dominio aislado de Checklists.

## Flujo implementado

`/peajes` → `/wizard` (9 pasos) → `/catalogos` → `/plantillas` → `/pasadas` → `/auditoria-tarifas` (F14).

El wizard conserva estado, muestra preview de hasta 10 filas, recomienda columnas y transformaciones (incluye categoría del proveedor opcional → Patrón B), permite pipeline editable, resuelve estaciones (RN-26) y patentes, valida **Σ pasadas − bonificación de cabecera** vs subtotal con tolerancia del 1%, confirma por documento (`peajes_confirmar_carga`) y en masiva permite omitir documentos inválidos. En importación simple, un PDF opcional alimenta [sugerencias IA de factura](../06-components/peajes/ia-factura.md) (el operador aplica o ignora candidatos). Tras la carga, el motor de tarifas normaliza niveles; el analista confirma status en [auditoría de tarifas](../06-components/peajes/auditoria-tarifas.md).

## Permisos y vistas

El acceso se resuelve mediante permisos granulares del módulo `peajes`, no por el nombre literal del rol.

| Permiso | Significado |
| --- | --- |
| `peajes:read` | Consultar y revisar información del módulo. |
| `peajes:create` | Subir y procesar archivos de pasadas. |
| `peajes:manage` | Administrar todas las secciones, catálogos, plantillas y documentos. |

El home `/peajes` requiere `peajes:manage` o la combinación `peajes:read` + `peajes:create`. Su contenido se filtra de la siguiente manera:

| Vista | Permiso requerido |
| --- | --- |
| Asistente de carga (`/peajes/wizard`) | `peajes:read` + `peajes:create` |
| Pasadas (`/peajes/pasadas`) | `peajes:read` + `peajes:create` |
| Ubicaciones pendientes (`/peajes/pasadas-pendientes`) | `peajes:read` + `peajes:create` |
| Auditoría de tarifas (`/peajes/auditoria-tarifas`) | `peajes:read` + `peajes:create` |
| Catálogos | `peajes:manage` |
| Plantillas y algoritmos | `peajes:manage` |
| Carga rápida | `peajes:manage` |
| Documentos | `peajes:manage` |

Los usuarios administrativos ven todas las tarjetas del home. Los usuarios operativos de carga y revisión ven únicamente las cuatro vistas operativas. Ocultar una tarjeta es solo una mejora de navegación: las rutas también están protegidas por `PermissionGuard`, por lo que una navegación directa sin permisos termina en `/access-denied`.

## Estructura

- `src/app/components/peajes/wizard`: carga e importación (simple/masiva).
- `catalogos`: empresas, peajes, estaciones, patentes y pases.
- `plantillas`: Builder/Strategy, algoritmos combinados y motor.
- `services`: carga, catálogos, pasadas y plantillas contra Supabase.
- `supabase/migrations`: esquema, RPC, auditoría.
- Docs UI: `docs/06-components/peajes/`
- Docs tablas: `docs/06-tablas/peajes/`
- Docs backend/RPC: `docs/backend/`

## Estado

Según `feature_list.json` (2026-08-12): F00–F05 y F13 en `passing`. F14-0…F14-5 (auditoría tarifaria: contrato CATEGORIA, tablas/RPCs CLI, wizard detección, pantalla, docs) en `passing`. F14-6 (QA dataset DESARROLLO) diferido sin remote. Ampliar catálogos Acceso Oeste/AUSOL (F06/F07) y gestión pasadas (F08) según evidence. F11 desglose factura permanece en seguimiento.

## Referencias

- [PRD](../plan/peaje-prd-es.md)
- [Plan F14 auditoría patrones](../plan/auditoria-pasadas-patrones/INDEX.md)
- [Backend RPCs](../backend/index.md)
- [Componentes](../06-components/peajes/INDEX.md)
- [IA de factura (F17)](../06-components/peajes/ia-factura.md)
- [IA de factura (F17)](../06-components/peajes/ia-factura.md)
- [Auditoría de tarifas](../06-components/peajes/auditoria-tarifas.md)
- [Importación masiva ConsumosResumen](../06-components/peajes/importacion-masiva-consumos-resumen.md)
- [AUSOL/AUSA fecha_hora −1 día (evidencia + SQL)](../plan/ausa-ausol-fecha-hora-minus-one-day.md)
- [AUBASA plantilla FECHA_HORA HHMMSS](../plan/aubasa-plantilla-fecha-hora.md)
- [Ejemplo MERCOSUR + FILTRAR_COLUMNA](../plan/ejemplo-mercosur-procesamiento-pasadas.md)
- [Tablas](../06-tablas/peajes/INDEX.md)
- [Features](../../feature_list.json)
- [Progreso](../claude-progress.md)
- [Handoff](../session-handoff.md)

---

> Última actualización: 2026-08-24
