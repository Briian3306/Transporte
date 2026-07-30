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
| `cuenta` | text | No | Cuenta asociada |
| `empresa_id` | text | No | Empresa (text, no uuid) |
| `fecha_factura` | date | No | — |
| `importe_sin_iva` | numeric(14,2) | No | ≥ 0 |
| `importe_total` | numeric(14,2) | No | ≥ 0 |
| `created_at` | timestamptz | No | — |

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
| `created_at` | timestamptz | No | — |

UK anti-duplicados: `(pase_id, fecha_hora, estacion_id, patente_id)`.

---

## Vista pasadas_con_peaje

Vista con `security_invoker = true` que une pasada → estación → peaje y expone `peaje_id`, `estacion_nombre`, `peaje_nombre`.

---

## Reglas de negocio

| RN | Comportamiento |
|----|----------------|
| RN-05 | Peaje derivado; no se persiste en pasada |
| RN-08/09 | Precio/bonificación validados en CHECK y en servicio/RPC |
| RN-13/17 | Suma de importes vs factura con tolerancia 0.01 |
| RN-16 | Duplicados por clave de negocio |

Confirmación atómica: RPC `peajes_confirmar_carga` (ver [auditoria-y-rpcs.md](./auditoria-y-rpcs.md)).

---

## Referencias

- SQL: `supabase/migrations/20260730125518_peajes_facturas_pasadas.sql`
- Servicio: `PeajesCargaSupabaseService`
- Wizard pasos 7–9: [docs/06-components/peajes/wizard.md](../../06-components/peajes/wizard.md)

---

> Última actualización: julio 2026
