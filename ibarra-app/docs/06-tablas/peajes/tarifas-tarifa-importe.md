# Tablas — `tarifas` y `tarifa_importe` (F14-16)

## Resumen

Catálogo v2 de configuración vigente (`tarifas`) e historial inmutable de importes (`tarifa_importe`). Es **aditivo**: no reemplaza ni borra [`tarifas_normalizadas`](./tarifas-normalizadas.md). El peaje se deriva por estación (RN-05); no hay `pasadas.peaje_id`. Detalle de RPCs: [tarifas-tarifa-importe.md](../../backend/peajes/tarifas-tarifa-importe.md). Plan: [migración gradual](../../plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md).

## Índice

- [Resumen](#resumen)
- [Relaciones](#relaciones)
- [tarifas](#tarifas)
- [tarifa_importe](#tarifa_importe)
- [Columnas nuevas en pasadas](#columnas-nuevas-en-pasadas)
- [Puntero current e inmutabilidad](#puntero-current-e-inmutabilidad)
- [Linaje de IDs](#linaje-de-ids)
- [Staging local](#staging-local)
- [Referencias](#referencias)

---

## Relaciones

```text
peajes 1──N tarifas N──1 estaciones
tarifas 1──N tarifa_importe
tarifas.(id, current_tarifa_id) ──→ tarifa_importe.(tarifa_id, id)
tarifa_importe.tarifas_normalizadas_id ──→ tarifas_normalizadas (linaje opcional)
pasadas.tarifa_importe_id ──→ tarifa_importe          (v2 / sombra)
pasadas.tarifa_normalizada_id ──→ tarifas_normalizadas (legado, se retiene)
```

`status` y `categoria` viven solo en `tarifas`. No se duplican en `tarifa_importe`.

---

## tarifas

Configuración vigente **sin importe**. El monto vive en `tarifa_importe`.

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | ID de configuración (workbook / ETL). Namespace distinto del ID de importe. |
| `peaje_id` | uuid FK → peajes | No | Dueño. `ON DELETE RESTRICT` |
| `estacion_id` | uuid FK → estaciones | No | Estación. `ON DELETE RESTRICT` |
| `status` | text | No | `PICO` \| `NO_PICO` |
| `categoria` | smallint | No | Categoría calculada 0–10 usada para matching v2. **No** es el texto crudo de `pasadas.categoria` / `tarifas_normalizadas.categoria`. |
| `sentido` | text | No | `IDA` \| `VUELTA` \| `AMBAS`. Default `AMBAS`. `AMBAS` es aplicabilidad real, no “dirección desconocida”. |
| `requiere_normalizacion_iva` | boolean | No | Default `false`. Si `true`, la comparación usa el precio ya normalizado por el pipeline Angular. SQL no reproduce `ELIMINAR_IVA`. |
| `current_tarifa_id` | uuid | Sí en bootstrap | Puntero al `tarifa_importe` vigente. FK compuesto al mismo padre. |
| `fecha_actualizacion` | timestamptz | No | `fecha_aparicion` del importe seleccionado como current. |
| `created_at` / `updated_at` | timestamptz | No | Default `now()` |

Unique: `(peaje_id, estacion_id, status, categoria, sentido)`.

Índice adicional: `idx_tarifas_estacion_id` (`estacion_id` no es prefijo izquierdo del unique).

RLS: `tarifas_authenticated_all` (`FOR ALL TO authenticated`). Grants: `authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` ALL.

---

## tarifa_importe

Historial de importes auditados de una configuración. `status` / `categoria` no se copian aquí.

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | Con linaje: igual a `tarifas_normalizadas.id`. Sin linaje (Cruzado-only): UUID nuevo. |
| `tarifa_id` | uuid FK → tarifas | No | Padre. `ON DELETE RESTRICT` |
| `importe` | numeric(14,2) | No | Monto auditado (`PRECIO_LAST` o hoja histórica). `CHECK (importe > 0)`. Inmutable. |
| `importe_base`, `desvio` | numeric | Sí | Estadísticas históricas de clasificación. |
| `hora_min`, `hora_max`, `hora_media` | numeric(5,2) | Sí | Distribución horaria histórica. |
| `categoria_calculated` | smallint | Sí | Metadato legado 0–10. |
| `cases` | integer | No | Snapshot inmutable de pasadas que evidenciaron el importe. Default `0` para catálogo/manual sin evidencia de pasadas. |
| `fecha_aparicion` | timestamptz | No | Primera aparición de este registro de precio. |
| `fecha_vigencia_inicio` | date | Sí | Inicio calendario **inclusivo** de vigencia confirmada. `NULL` = desconocida o fila `REVISAR`. **No** se backfill desde `fecha_aparicion`. |
| `fecha_vigencia_fin` | date | Sí | Fin calendario **exclusivo**. `NULL` = intervalo abierto o desconocido. Solo puede cerrarse una vez vía UPDATE permitido por trigger. |
| `diagnostico` | text | Sí | Snapshot: `MUESTRA_INSUFICIENTE` \| `TARIFA_UNICA` \| `CATEGORIA` \| `POSIBLE_HORARIO` \| `REVISAR` \| `CONFIRMADO`. Backfill único desde `tarifas_normalizadas.diagnostico` en migración F14-19. |
| `tarifas_normalizadas_id` | uuid FK | Sí | Linaje 1:1 hacia `tarifas_normalizadas`. `NULL` = monto solo en el tarifario cruzado o detectado después. `ON DELETE SET NULL`. Unique parcial cuando no es NULL. |
| `created_at` / `updated_at` | timestamptz | No | Auditoría de insert. `updated_at` permanece escribible; columnas de negocio no. |

Constraints / índices:

- Unique `(tarifa_id, id)` — destino del FK compuesto del puntero.
- Unique parcial `tarifas_normalizadas_id WHERE tarifas_normalizadas_id IS NOT NULL`.
- CHECK `diagnostico` ∈ dominio F14-19; CHECK fechas (`fin` null o `inicio < fin`).
- EXCLUDE GiST `tarifa_importe_vigencia_confirmada_excl` (F14-19): periodos `CONFIRMADO` con inicio conocido no se solapan por `tarifa_id`.
- Índice de historia `(tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC)`.

RLS: `tarifa_importe_authenticated_all` (mismo patrón plano que el legado).

---

## Columnas nuevas en pasadas

Ver también [documentos-pasadas.md](./documentos-pasadas.md).

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `sentido` | text | No | `IDA` \| `VUELTA` \| `AMBAS`. Default `AMBAS`. CHECK `pasadas_sentido_chk`. |
| `tarifa_importe_id` | uuid FK → tarifa_importe | Sí | Match v2 / sombra. `ON DELETE SET NULL`. El FK legado `tarifa_normalizada_id` se retiene. |

Índices: `idx_pasadas_tarifa_importe_id`; backlog parcial `(estacion_id, categoria, tarifa_status, sentido, precio) WHERE tarifa_importe_id IS NULL`.

No se agrega `pasadas.peaje_id`.

---

## Puntero current e inmutabilidad

FK compuesto `tarifas_current_pointer_fkey`: `(tarifas.id, current_tarifa_id) → tarifa_importe(tarifa_id, id)` con `MATCH SIMPLE`. Un puntero NULL está permitido durante el bootstrap; un puntero no NULL no puede apuntar al importe de otra tarifa.

Trigger `trg_tarifa_importe_immutable` (`BEFORE UPDATE OR DELETE`):

- Prohíbe `DELETE`.
- Prohíbe `UPDATE` de columnas de negocio (`id`, `tarifa_id`, `importe`, estadísticas incluido `cases`, `fecha_aparicion`, `diagnostico`, `fecha_vigencia_inicio`, linaje, `created_at`).
- **Permite** un único cierre: `fecha_vigencia_fin` de `NULL` a fecha (F14-19). Cualquier otro cambio de fin → excepción.

Trigger `trg_tarifa_importe_promote` (`AFTER INSERT`):

- Promociona puntero **solo** si `diagnostico = 'CONFIRMADO'` **y** `fecha_vigencia_inicio IS NOT NULL`.
- Si `current_tarifa_id` es NULL, lo rellena con el INSERT y copia `fecha_aparicion` a `tarifas.fecha_actualizacion`.
- Si ya hay puntero, promociona solo si el nuevo `fecha_vigencia_inicio` es **estrictamente posterior** al vigente (F14-19). Filas `REVISAR` o legado sin inicio **nunca** mueven el puntero.

---

## Linaje de IDs

Implementado por el ETL `scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs` (carga explícita local; no es migración SQL de datos):

- `tarifas.id` se conserva del workbook tras validar UUID y unicidad.
- Si hay `tarifas_normalizadas_id`, `tarifa_importe.id = tarifas_normalizadas_id`.
- Si el importe current de Cruzado no tiene línea histórica exacta, se genera un UUID nuevo y el linaje queda `NULL`.
- El ETL conserva `cases` de la fuente auditada; si un importe no tiene evidencia de pasadas, guarda `0`.
- El ETL rechaza un ID legado mapeado a más de un importe, un historial con más de un padre, o un `TARIFA_ID` de Cross inexistente.

El backfill `peajes_backfill_pasadas_tarifa_importe()` escribe `pasadas.tarifa_importe_id` **solo** cuando `pasadas.tarifa_normalizada_id` tiene exactamente un `tarifa_importe.tarifas_normalizadas_id`. No inventa historial. No reescribe `tarifa_normalizada_id`. Volumen real de pasadas no está probado fuera de fixtures pgTAP: un `db reset --local --no-seed` deja `pasadas` vacía (0/0/0).

---

## Staging local

`public._stg_precio_last` (`tarifa_id`, `precio_last`, `source_timestamp`) es staging CLI para validar `PRECIO_LAST` del Cruzado. **No** es catálogo de runtime. RLS habilitado; grants solo `postgres` / `service_role`. Tras un reset `--no-seed` queda vacía.

---

## Referencias

- Migraciones: `supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql`, …, `20260908100000_peajes_backfill_pasadas_tarifa_importe.sql`, **`20260909181737_peajes_tarifa_vigencia_diagnostico.sql`**, **`20260909192938_peajes_tarifa_matching_correcciones.sql`**
- Compatibilidad legado: [tarifas-normalizadas.md](./tarifas-normalizadas.md)
- RPCs y Paso 8: [backend/peajes/tarifas-tarifa-importe.md](../../backend/peajes/tarifas-tarifa-importe.md)
- Vista Power BI paralela: [pwbi-views.md](../../backend/peajes/pwbi-views.md)
- Tests: `supabase/tests/peajes_f14_tarifas_importe_test.sql`, **`peajes_tarifa_vigencia_test.sql`**

---

> Última actualización: 2026-09-10 (F14-19 vigencia/diagnóstico)
