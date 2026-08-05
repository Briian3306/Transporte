# Tablas — Facturas y pasadas

## Resumen

Persistencia de factura (Bill) y pasadas estandarizadas (F01-2). Migración `20260730125518_peajes_facturas_pasadas.sql`.

## Índice

- [Resumen](#resumen)
- [facturas](#facturas)
- [pasadas](#pasadas)
- [Vista pasadas_con_peaje](#vista-pasadas_con_peaje)
- [Reglas de negocio](#reglas-de-negocio)
- [Referencias](#referencias)

---

## facturas

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `factura` | text | No | Número / identificador de factura |
| `cuenta` | text | **Sí** | Cuenta asociada (**opcional**) |
| `empresa_id` | text | No | Empresa (text, no uuid); en wizard = empresa del Paso 1 |
| `fecha_factura` | date | No | — |
| `importe_sin_iva` | numeric(14,2) | No | ≥ 0 |
| `importe_total` | numeric(14,2) | No | ≥ 0 |
| `created_at` | timestamptz | No | — |

Migración cuenta opcional: `20260804141122_peajes_facturas_cuenta_nullable.sql`. `peajes_confirmar_carga` normaliza vacío → NULL.

---

## pasadas

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `fecha_hora` | timestamptz | No | Momento de la pasada |
| `pase_id` | uuid FK → pases | No | RESTRICT |
| `patente_id` | uuid FK → patentes | No | RESTRICT |
| `estacion_id` | uuid FK → estaciones | No | RESTRICT — **sin peaje_id** |
| `factura_id` | uuid FK → facturas | No | FK técnica (§13.5) |
| `precio` | numeric(14,2) | No | ≥ 0 |
| `bonificacion` | numeric(14,2) | No | Default 0; 0 ≤ bonif ≤ precio |
| `quantity` | integer | No | Default 1; ≥ 1 |
| `importe_neto` | numeric(14,2) | No | CHECK = `precio - bonificacion` |
| `created_at` | timestamptz | No | Default `now()` |
| `user_id` | uuid FK → auth.users | Sí | Usuario que creó la pasada (`auth.uid()` en confirmación/CRUD) |
| `file_upload_name` | text | Sí | Nombre del archivo de carga (denormalizado) |

UK anti-duplicados: `(pase_id, fecha_hora, estacion_id, patente_id)`.

Índices adicionales (F08-1): `created_at DESC`, `user_id`, `file_upload_name`.

---

## Vista pasadas_con_peaje

Vista con `security_invoker = true` que une pasada → estación → peaje y expone `peaje_id`, `estacion_nombre`, `peaje_nombre`.

## Vista pasadas_gestion (F08-1)

Vista de gestión con joins a estaciones (lat/lng), peajes, empresas, patentes, pases y facturas. El badge de estación en UI se deriva **solo de coordenadas** (`latitud` + `longitud`).

Listado paginado: RPC `peajes_listar_pasadas`. CRUD: `peajes_crear_pasada`, `peajes_actualizar_pasada`, `peajes_eliminar_pasada`. Migración `20260803190348_peajes_pasadas_audit_gestion.sql`.

---

## Reglas de negocio

| RN | Comportamiento |
|----|----------------|
| RN-05 | Peaje derivado; no se persiste en pasada |
| RN-08/09 | Precio/bonificación validados en CHECK y en servicio/RPC |
| RN-13/17 | Suma de importes vs subtotal con tolerancia 1% del subtotal |
| RN-16 | Duplicados por clave de negocio |

Confirmación atómica: RPC `peajes_confirmar_carga` (ver [auditoria-y-rpcs.md](./auditoria-y-rpcs.md)).

---

## Referencias

- SQL: `supabase/migrations/20260730125518_peajes_facturas_pasadas.sql`
- SQL cuenta opcional: `supabase/migrations/20260804141122_peajes_facturas_cuenta_nullable.sql`
- SQL F08-1: `supabase/migrations/20260803190348_peajes_pasadas_audit_gestion.sql`
- Task SQL: [docs/08-sql/peajes/facturas-cuenta-opcional/README.md](../../08-sql/peajes/facturas-cuenta-opcional/README.md)
- Servicio: `PeajesCargaSupabaseService`, `PeajesPasadasSupabaseService`
- UI: `/peajes/pasadas`
- Wizard pasos 7–9: [docs/06-components/peajes/wizard.md](../../06-components/peajes/wizard.md)
  - Paso 7: `cuenta` opcional; empresa vía `app-search-multi-select` (single, locked Paso 1); fecha vía `app-date-range-picker` (`mode="single"`)

---

> Última actualización: 2026-08-04
