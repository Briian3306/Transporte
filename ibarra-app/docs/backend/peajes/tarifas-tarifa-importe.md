# Tarifas v2 — `tarifas` / `tarifa_importe` (F14-16)

## Summary

Matching en sombra y readers de compatibilidad para el catálogo v2: configuración vigente (`tarifas`), historial inmutable (`tarifa_importe`) y RPCs batch. No sustituye el motor legado `peajes_normalizar_tarifas` ni borra `tarifas_normalizadas`. Esquema: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Functions](#functions)
- [Policies](#policies)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)
- [Límites y diferidos](#límites-y-diferidos)

## Purpose

Resolver y validar pasadas contra el importe auditado vigente (puntero `current_tarifa_id`) con sentido, flag de IVA y tolerancia relativa del 1%, sin mutar el historial ni aplicar aritmética de IVA en SQL.

## Business Logic

### Matching de dirección

1. El peaje se obtiene por `estaciones.peaje_id` (RN-05).
2. Se busca configuración por estación, categoría **calculada** (smallint 0–10), status y sentido.
3. `IDA` / `VUELTA`: coincidencia exacta de sentido primero; si no hay, `AMBAS`.
4. `AMBAS`: solo filas `AMBAS`. No hay fallback a IDA/VUELTA.
5. Status: `PICO` / `NO_PICO` tal cual, o un único candidato entre esos dos. Nunca se infiere desde `hora_*`. Si hay dos status posibles → `ESTADO_AMBIGUO`. Categoría no numérica / ausente → `CATEGORIA_PENDIENTE`. Sin configuración → `SIN_TARIFA`. Ninguno de estos códigos inserta historial.

### IVA

`requiere_normalizacion_iva` vive en `tarifas`. El adapter Angular (`TarifaComparisonAdapterService` / `precioComparable`) elige `precioDirecto` o el `IMPORTE_NETO` del pipeline de plantilla **una sola vez**. SQL **no** contiene `/ 1.21` ni reproduce `ELIMINAR_IVA`. El validador recibe ambos precios y elige según el flag.

### Tolerancia 1% (inclusiva)

`abs(precio_comparado - importe) / importe <= 0.01`.

| Código | Condición |
|--------|-----------|
| `AL_DIA` | El importe **current** cae dentro de la tolerancia |
| `HISTORICA` | El current no matchea; algún importe histórico inmutable del mismo padre sí (se elige el más reciente por `(fecha_aparicion, created_at, id)`). `error_relativo` se informa contra el importe **current**, no contra el histórico |
| `DESFASADO` | Ningún importe del padre entra en tolerancia |

Ejemplo de frontera observado en Cruzado: `31 427,15` vs `31 500,00` ≈ 0,23% → match.

### Paso 8 (sombra, no bloqueante)

`TarifaValidationService.validarLote` llama al resolver en batch, pide IVA al adapter solo en filas con flag `true`, y envía el lote al validador. Paso 8 muestra una tabla en español (fila, estación, categoría, sentido solicitado/aplicado, status, importe auditado, comparado, error relativo, resultado).

- `AL_DIA` → diagnóstico `ok`.
- `HISTORICA`, `DESFASADO`, `SIN_TARIFA`, `CATEGORIA_PENDIENTE`, `ESTADO_AMBIGUO` y fallos del servicio → `warning`.
- No agrega entradas a `ResultadoValidacionCarga.errores`. No cambia `dentroTolerancia` ni `puedeContinuar`.
- `SENTIDO` se lee si está en la fila mapeada; si falta o no es `IDA`/`VUELTA`/`AMBAS`, se usa `AMBAS`. No es destino de `PASADA_COLUMN_KEYS` ni columna obligatoria.

### Asociación post-confirmación (implementada, no cableada)

RPC `peajes_asociar_pasadas_tarifa_importe`: escribe `pasadas.tarifa_importe_id` solo para `AL_DIA` / `HISTORICA`; no toca `tarifa_normalizada_id`; no inserta historial; es idempotente. El método de servicio `asociarTrasConfirmacion` existe. **No** se invoca tras `peajes_confirmar_carga`: la carga sigue llamando `peajes_normalizar_tarifas`.

### Backfill de linaje

`peajes_backfill_pasadas_tarifa_importe()` actualiza `tarifa_importe_id` solo con linaje 1:1. Pasadas sin linaje o con linaje no único quedan `NULL`. Tras `db reset --local --no-seed`, `pasadas` está vacía (conteos 0/0/0). El volumen real no está verificado fuera de pgTAP.

## Relations

| Consumidor | Operación |
|------------|-----------|
| `TarifaValidationService` | `peajes_resolver_tarifas_actuales` + `peajes_validar_tarifas_actuales` (Paso 8) |
| `TarifaComparisonAdapterService` | Precio comparable vía pipeline de plantilla existente |
| `asociarTrasConfirmacion` | RPC de asociación (servicio listo; no cableado en carga) |
| Power BI `pwbi_tarifas_v2` | Dimensión paralela; no reemplaza `pwbi_tarifas` |
| Motor legado | `peajes_normalizar_tarifas` / `peajes_recalcular_tarifas` / `peajes_confirmar_status_tarifa` **sin cambio de firma** |

## Tables

| Tabla / vista | Rol |
|---------------|-----|
| `tarifas` | Configuración vigente (sin dinero) |
| `tarifa_importe` | Historial inmutable de importes |
| `pasadas.sentido` / `pasadas.tarifa_importe_id` | Dirección default `AMBAS`; FK sombra v2 |
| `tarifas_normalizadas` | Camino de compatibilidad retenido |
| `_stg_precio_last` | Staging local de `PRECIO_LAST`; no es catálogo de producto |
| `pwbi_tarifas_v2` | Reader Power BI paralelo (LEFT JOIN al importe current) |

Detalle de columnas: [06-tablas/peajes/tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md).

## Functions

| Función | Tipo | Parámetros | Retorno | Descripción |
|---------|------|------------|---------|-------------|
| `_peajes_tarifas_montos_candidatos` | helper STABLE | estación, categoría, status, sentido | relation | Montos vigente+historial con precedencia de sentido. Usado por F14-16 y F14-18. No es API. |
| `peajes_resolver_tarifas_actuales` | RPC STABLE | `p_pasadas jsonb` (arreglo) | jsonb arreglo | Resuelve config + puntero + `importe` + flag IVA. Conserva `idx` / orden. No muta. Firma pública intacta. |
| `peajes_validar_tarifas_actuales` | RPC STABLE | `p_pasadas jsonb` | jsonb arreglo | Elige precio según flag; aplica 1% inclusivo. No divide por 1,21. Firma pública intacta. |
| `peajes_asociar_pasadas_tarifa_importe` | RPC VOLATILE | `p_asociaciones jsonb` | void | Asocia solo `AL_DIA`/`HISTORICA`. Idempotente. |
| `peajes_backfill_pasadas_tarifa_importe` | RPC VOLATILE | — | void | Backfill por linaje único. |
| `peajes_trg_tarifa_importe_immutable` | trigger | — | trigger | Bloquea DELETE y UPDATE de negocio. |
| `peajes_trg_tarifa_importe_promote` | trigger | — | trigger | Promociona puntero si la tupla es estrictamente posterior. |

### Detalle: `peajes_resolver_tarifas_actuales`

**Ubicación:** `supabase/migrations/20260907102000_peajes_tarifas_v2_shadow_matching.sql`. Cuerpo actual (helper compartido): `20260908150000_peajes_refresh_tarifas_paso9.sql`. Firma pública sin cambio.

**Entrada (cada elemento):** `idx`, `estacion_id`, `categoria` (número o string dígitos), `status` opcional, `sentido` (default `AMBAS`).

**Salida exitosa:** `idx`, `tarifa_id`, `current_tarifa_id`, `importe`, `peaje_id`, `sentido_aplicado`, `requiere_normalizacion_iva`.

**Códigos tempranos:** `{ idx, codigo }` con `CATEGORIA_PENDIENTE` \| `SIN_TARIFA` \| `ESTADO_AMBIGUO`.

**Errores:** `p_pasadas` que no sea arreglo JSON.

### Detalle: `peajes_validar_tarifas_actuales`

**Entrada:** `idx`, `tarifa_id`, `current_tarifa_id`, `importe`, `requiere_normalizacion_iva`, `precio_directo`, `precio_normalizado`.

**Salida:** `codigo` (`AL_DIA` \| `HISTORICA` \| `DESFASADO`), `tarifa_importe_id` (solo AL_DIA/HISTORICA), `importe`, `precio_comparado`, `error_relativo`.

### Detalle: `peajes_asociar_pasadas_tarifa_importe`

**Entrada:** `{ pasada_id, tarifa_importe_id, codigo }`. Filtra `AL_DIA` / `HISTORICA`. Arreglo vacío = no-op.

## Policies

| Política | Tabla | Rol | Condición |
|----------|-------|-----|-----------|
| `tarifas_authenticated_all` | `tarifas` | authenticated | `USING (true) WITH CHECK (true)` |
| `tarifa_importe_authenticated_all` | `tarifa_importe` | authenticated | igual (patrón plano del proyecto) |
| GRANT SELECT | `pwbi_tarifas_v2` | anon, authenticated, service_role | vista `security_invoker = false` |

## Validations

- CHECK `tarifas.status` ∈ `PICO`/`NO_PICO`; `categoria` 0–10; `sentido` ∈ `IDA`/`VUELTA`/`AMBAS`.
- CHECK `tarifa_importe.importe > 0`.
- Unique configuración `(peaje_id, estacion_id, status, categoria, sentido)`.
- FK compuesto: el puntero pertenece al mismo `tarifas.id`.
- Historial append-only (trigger).
- SQL del validador sin división por 1,21.

## Testing

| Tipo | Archivo / comando | Escenario |
|------|-------------------|-----------|
| `supabase_db_test` | `supabase/tests/peajes_f14_tarifas_importe_test.sql` | Schema, puntero, matching, linaje, cutover, backfill |
| `supabase_db_test` | `supabase/tests/peajes_pwbi_views_test.sql` | `pwbi_tarifas` intacta + `pwbi_tarifas_v2` |
| Node | `scripts/peajes-catalogo-audit/*.test.mjs` | ETL, linaje, tolerancia 0,23% / 1% / >1% |
| `angular_spec` | adapter + `tarifa-validation.service` + `paso8-validacion` | Flag IVA, batch, no bloqueo |

**Estado:** verificado en CLI local (Task 9, 2026-09-08). No DESARROLLO.

**Comando ejecutado:** desde `ibarra-app/`: `npx supabase start`; `npx supabase db reset --local --no-seed`; `npx supabase test db`; `node --test scripts/peajes-catalogo-audit/*.test.mjs`; `pnpm.cmd exec ng test` adapter+validation+paso8 y `**/peajes/auditoria-tarifas/**/*.spec.ts`; `tsc --noEmit` app+spec.

**Resultado:** pgTAP Files=14 Tests=412 EXIT 0; Node 53/53 skipped 0; Angular 35 + 52 SUCCESS; tsc EXIT 0.

**Evidencia:** `feature_list.json` → F14-16; `.superpowers/sdd/task-9-report.md`.

## Notes

- Código: `supabase/migrations/20260907*_peajes_tarifas_v2_*.sql`, `20260908100000_peajes_backfill_pasadas_tarifa_importe.sql`, helper reescrito en `20260908150000_peajes_refresh_tarifas_paso9.sql`
- Refresh Paso 9: [refresh-tarifas-paso9.md](./refresh-tarifas-paso9.md)
- Angular: `src/app/components/peajes/services/tarifa-comparison-adapter.service.ts`, `tarifa-validation.service.ts`, `wizard/paso8-validacion/`
- Legado: [auditoria-tarifas.md](./auditoria-tarifas.md)
- Tablas: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md)
- Power BI: [pwbi-views.md](./pwbi-views.md)
- Paso 8 UI: [validacion-carga.md](../../06-components/peajes/validacion-carga.md)

## Límites y diferidos

1. **`asociarTrasConfirmacion` no está cableado** después de confirmar la carga. El hook de `peajes_confirmar_carga` sigue llamando `peajes_normalizar_tarifas`.
2. **Backfill de volumen real** de `pasadas.tarifa_importe_id` no está probado fuera de fixtures pgTAP (`--no-seed` deja pasadas 0/0/0).
3. **`pwbi_tarifas_v2` no es un clon** de `pwbi_tarifas`: no expone `Peaje_Nombre`, `Estacion_Nombre`, `hora_*` ni `fecha_aparicion` del current. El LEFT JOIN puede dejar `Importe` NULL si el puntero falta o no pertenece al padre. `pwbi_tarifas` **no** fue reemplazada.
4. **`_stg_precio_last`** es staging local, no catálogo de runtime.
5. **No hay DROP** de readers, tablas, triggers, FKs ni firmas RPC legado. `tarifas_normalizadas` permanece queryable con su FK original.

---

> Última actualización: 2026-09-08
