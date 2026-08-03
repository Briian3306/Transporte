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
| `created_at` | timestamptz | No | Default `now()` |

Índice: `nombre`. Relación lógica: `peajes.empresa_id` / `facturas.empresa_id` / plantillas y algoritmos usan `empresas.id::text` o `'__global__'` (sin FK uuid; RN-23).

---

## peajes

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `nombre` | text | No | Nombre del peaje/corredor |
| `ubicacion` | text | Sí | — |
| `descripcion` | text | Sí | — |
| `empresa_id` | text | Sí | `empresas.id::text` o `'__global__'` |
| `created_at` | timestamptz | No | Default `now()` |

Índices: `empresa_id`, `nombre`.

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

## Referencias

- SQL: `supabase/migrations/20260730125513_peajes_catalogos.sql`, `supabase/migrations/20260731124502_peajes_empresas.sql`
- SQL task: [docs/08-sql/peajes/empresas/](../../08-sql/peajes/empresas/README.md)
- Servicio: `src/app/components/peajes/services/peajes-catalogo.service.ts`
- UI catálogos: [docs/06-components/peajes/catalogos.md](../../06-components/peajes/catalogos.md)
- Companion: [docs/08-sql/peajes/F01-schema/](../../08-sql/peajes/F01-schema/README.md)

---

> Última actualización: julio 2026
