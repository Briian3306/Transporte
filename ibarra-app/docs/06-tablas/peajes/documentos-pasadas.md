# Tablas — Documentos y pasadas

## Resumen

Persistencia de **documentos** (ex `facturas`; tipo `FC`|`NC`) y pasadas estandarizadas. Base F01-2; rename F13 en `20260807140000_peajes_documentos_tipo_nc.sql`.

## Índice

- [Resumen](#resumen)
- [documentos](#documentos)
- [pasadas](#pasadas)
- [Vista pasadas_con_peaje](#vista-pasadas_con_peaje)
- [Vista pasadas_gestion](#vista-pasadas_gestion-f08-1)
- [Reglas de negocio](#reglas-de-negocio)
- [Referencias](#referencias)

---

## documentos

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `factura` | text | No | Número / identificador visible del documento |
| `tipo` | text | No | `FC` \| `NC` (default `FC`) |
| `cuenta` | text | **Sí** | Cuenta asociada (**opcional**) |
| `empresa_id` | text | No | Empresa (text); wizard Paso 1 o por panel en masiva |
| `fecha_factura` | date | No | Fecha del documento |
| `importe_sin_iva` | numeric(14,2) | No | Subtotal; **negativo si NC** |
| `bonificacion` | numeric(14,2) | No | Default 0; cabecera manual (no del Excel); **negativo si NC** |
| `percepciones` | numeric | Según migraciones F11 | Desglose |
| `iva` | numeric | Según migraciones F11 | Desglose |
| `importe_total` | numeric(14,2) | No | Total declarado; **negativo si NC** |
| `created_at` | timestamptz | No | — |

Migraciones relevantes: cuenta opcional `20260804141122_*`; percepciones/IVA `20260804172030_*` / `20260804175001_*`; rename F13; bonificación cabecera `20260810191639_*`.

Conciliación: `Σ pasadas.importe_neto − documentos.bonificacion ≈ importe_sin_iva` (±1%).

---

## pasadas

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `fecha_hora` | timestamptz | No | Momento (hora completa; RN-16) |
| `pase_id` | uuid FK → pases | No | RESTRICT |
| `patente_id` | uuid FK → patentes | No | RESTRICT |
| `estacion_id` | uuid FK → estaciones | No | RESTRICT — **sin peaje_id** |
| `documento_id` | uuid FK → documentos | No | FK técnica |
| `precio` | numeric(14,2) | No | Firmado (NC negativo) |
| `bonificacion` | numeric(14,2) | No | Default 0; \|bonif\| ≤ \|precio\| |
| `quantity` | integer | No | Default 1; ≥ 1 |
| `importe_neto` | numeric(14,2) | No | `precio - bonificacion` |
| `created_at` | timestamptz | No | Default `now()` |
| `user_id` | uuid FK → auth.users | Sí | Creador |
| `file_upload_name` | text | Sí | Nombre archivo de carga |
| `duplicado` | boolean | No | Default `false`. `true` si se insertó con consentimiento (F18-2) |
| `categoria` | text | Sí | Texto crudo del proveedor (F14 / RN-15). **No** es `patentes.categoria`. Vacío → `NULL` = Patrón A |
| `tarifa_normalizada_id` | uuid FK → tarifas_normalizadas | Sí | Familia tarifaria asignada por el motor |
| `tarifa_status` | text | No | Copiado desde `tarifas_normalizadas.status` (default `PENDIENTE`) |

UK anti-duplicados: índice único parcial `(pase_id, fecha_hora, estacion_id, patente_id) WHERE duplicado = false` — **sin** `categoria` (RN-16 / F18-2).

Tablas de auditoría tarifaria (`tarifas_normalizadas`, `tarifas_parametros_peaje`, `tarifas_status_catalogo`): ver [auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md) y [tarifas-normalizadas.md](./tarifas-normalizadas.md).

---

## Vista pasadas_con_peaje

Vista con `security_invoker = true` que une pasada → estación → peaje y expone `peaje_id`, `estacion_nombre`, `peaje_nombre`.

## Vista pasadas_gestion (F08-1)

Joins a estaciones, peajes, empresas, patentes, pases y **documentos**. Expone `documento_*` y alias `factura_*` de compatibilidad.

Listado: RPC `peajes_listar_pasadas`. CRUD: ver [gestion-pasadas](../../backend/peajes/gestion-pasadas.md).

---

## Reglas de negocio

| RN | Comportamiento |
|----|----------------|
| RN-05 | Peaje derivado; no se persiste en pasada |
| RN-08/09 | Precio/bonificación (absolutos / signos NC) |
| RN-12 | Asociación con documento |
| RN-13/17 | Suma netos vs subtotal; tolerancia 1% del subtotal |
| RN-16 | Duplicados por clave de negocio (hora completa) |
| RN-15 | `pasadas.categoria` = texto del proveedor; nunca join con `patentes.categoria` |

Confirmación: [confirmar-carga](../../backend/peajes/confirmar-carga.md).

---

## Referencias

- SQL base: `supabase/migrations/20260730125518_peajes_facturas_pasadas.sql`
- SQL F13: `supabase/migrations/20260807140000_peajes_documentos_tipo_nc.sql`
- SQL F14: `supabase/migrations/2026081212*_peajes_tarifas_*` (ver backend)
- Backend RPC: [docs/backend/](../../backend/index.md)
- Servicio: `PeajesCargaSupabaseService`, `PeajesPasadasSupabaseService`
- Wizard: [wizard.md](../../06-components/peajes/wizard.md)

---

> Última actualización: 2026-08-12
