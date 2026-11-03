# Tablas — Catálogos Peajes

## Resumen

Catálogos base del módulo (F01-1): peajes/corredores, estaciones, patentes y pases. Migración `20260730125513_peajes_catalogos.sql`. Catálogo `empresas`: `20260731124502_peajes_empresas.sql`.

## Índice

- [Resumen](#resumen)
- [empresas](#empresas)
- [peajes](#peajes)
- [estaciones](#estaciones)
- [patentes](#patentes)
- [pases](#pases)
- [RLS y permisos](#rls-y-permisos)
- [system_modules](#system_modules)
- [Referencias](#referencias)

---

## empresas

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `nombre` | text UNIQUE | No | Nombre de la empresa |
| `descripcion` | text | Sí | — |
| `tarifa_url` | text | Sí | URL pública de tarifas (`http`/`https`). CHECK `empresas_tarifa_url_http_chk` |
| `created_at` | timestamptz | No | Default `now()` |

Índice: `nombre`. `peajes.empresa_id` referencia `empresas.id` mediante FK UUID. `documentos.empresa_id`, plantillas y algoritmos conservan identificadores text (`empresas.id::text` o `'__global__'`; RN-23). `tarifa_url` se edita desde Auditoría de tarifas (lápiz junto al nombre del peaje). Seed: AUSA → `https://www.ausa.com.ar/sections/tarifas.html`. Migración: `20260813195728_peajes_empresas_tarifa_url.sql`.

---

## peajes

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `nombre` | text | No | Nombre del peaje/corredor |
| `ubicacion` | text | Sí | — |
| `descripcion` | text | Sí | — |
| `empresa_id` | uuid FK → empresas | Sí | ON DELETE RESTRICT; `NULL` = visible para todas las empresas |
| `created_at` | timestamptz | No | Default `now()` |

Índices: `empresa_id`, `nombre`.

Migración `20261006141041_peajes_empresa_id_fk.sql`: convierte únicamente `peajes.empresa_id` a UUID. Los valores anteriores `'__global__'`, vacíos, UUID inválidos y referencias a empresas inexistentes pasan a `NULL`. Conserva `idx_peajes_empresa_id`; rechaza nuevos UUID sin empresa y elimina el marcador text en este catálogo.

El matching masivo sigue `pasada.estacion_id → estaciones.peaje_id → peajes.empresa_id → documento.empresa_id`. Un peaje con empresa asignada pertenece únicamente a esa empresa; `NULL` permite usarlo en cada empresa. Las vistas dependientes se recrean preservando definición, opciones de seguridad, propietarios, comentarios y permisos. Sus columnas de empresa y la firma de `peajes_auditoria_estaciones_universo` continúan siendo text mediante conversión de salida; los joins a `empresas` usan UUID.

Seeds CLI: `seed_peajes_f14.sql` usa `NULL` en el peaje global y conserva `'__global__'` en documentos. `seed_peajes_desarrollo.sql` resuelve la empresa por nombre cuando las migraciones locales ya crearon otro UUID; `seed_peajes_matching.sql` convierte a UUID únicamente las referencias de peajes.

---

## estaciones

Pertenece a un peaje. La pasada referencia estación (RN-04/RN-05).

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `peaje_id` | uuid FK → peajes | No | ON DELETE RESTRICT |
| `nombre` | text | No | — |
| `ubicacion` | text | Sí | — |
| `descripcion` | text | Sí | — |
| `codigos_proveedor` | text[] | Sí | Match/sugerencia RF-17 |
| `created_at` | timestamptz | No | — |

Índices: `peaje_id`, `nombre`, GIN sobre `codigos_proveedor`.

Servicio: `PeajesCatalogoSupabaseService.sugerirEstacion(valorProveedor)`.

---

## patentes

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `patente` | text UNIQUE | No | Identificador interno |
| `categoria` | text | No | `TRANSPORTE` \| `REMIS` |
| `created_at` | timestamptz | No | — |

---

## pases

Dispositivos/pases reutilizables (RN-02).

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `pase` | text UNIQUE | No | Código del pase |
| `patente_id` | uuid FK → patentes | No | ON DELETE RESTRICT |
| `created_at` | timestamptz | No | — |

---

## RLS y permisos

- RLS habilitado en `empresas`, `peajes`, `estaciones`, `patentes` y `pases`.
- Policy `*_authenticated_all`: ALL para rol `authenticated`.
- Grants SELECT/INSERT/UPDATE/DELETE a `authenticated`; ALL a `service_role`.

---

## system_modules

La misma migración intenta insertar `system_modules.name = 'peajes'` + acción `read` (patrón stock) **solo si** existen las tablas host RBAC. En `db reset` CLI vacío se omite con NOTICE. Repair idempotente: `20260730150000_peajes_system_module_admin_permissions.sql` (módulo + read/create/manage → roles admin/administrador). Aplicar en DESARROLLO con `db push --linked` autorizado.

---

## UI listado / búsqueda

Sin cambios de esquema. Los listados CRUD consumen las mismas tablas vía `PeajesCatalogoService` y renderizan con:

- `app-data-table` — filas paginadas en el host
- `app-search-multi-select` — filtro por ids del catálogo (vacío = todos)

Detalle UI: [docs/06-components/peajes/catalogos.md](../../06-components/peajes/catalogos.md) · [docs/06-components/shared/filter-system.md](../../06-components/shared/filter-system.md).

## Referencias

### Estaciones y aliases de proveedor

`estaciones` incorpora coordenadas, camino y estado geográfico `OK`/`REVIEW`. `estaciones_alias_proveedor` conserva equivalencias normalizadas y confirmadas por empresa; es la fuente de resolución reutilizable antes de sugerir coincidencias parciales.

- SQL: `supabase/migrations/20260730125513_peajes_catalogos.sql`, `supabase/migrations/20260731124502_peajes_empresas.sql`, `supabase/migrations/20260813195728_peajes_empresas_tarifa_url.sql`
- SQL fuente: `supabase/migrations/`.
- Servicio: `src/app/components/peajes/services/peajes-catalogo.service.ts`
- UI catálogos: [docs/06-components/peajes/catalogos.md](../../06-components/peajes/catalogos.md)
- Migraciones fuente: `supabase/migrations/`.

---

> Última actualización: 2026-08-04
