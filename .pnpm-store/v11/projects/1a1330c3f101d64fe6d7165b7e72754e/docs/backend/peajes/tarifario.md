# Tarifario — RPCs de precios actuales (F14-17)

## Summary

Cuatro RPCs INVOKER para el editor `/peajes/tarifario`. Leen y escriben `tarifas` + `tarifa_importe` (F14-16). No recrean tablas. El listado muestra **solo** el importe vigente (`current_tarifa_id`). Guardar **append** una fila de historial; el trigger `trg_tarifa_importe_promote` mueve el puntero.

UI: [tarifario.md](../../06-components/peajes/tarifario.md). Tablas: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md). Angular: `PeajesTarifarioSupabaseService`.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Save semantics](#save-semantics)
- [Policies](#policies)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Sustituir el mock de Tarifario por el catálogo v2 local, sin mutar `tarifas_normalizadas` ni escribir DESARROLLO.

## Functions

Migración: `supabase/migrations/20260908140000_peajes_tarifario_rpcs.sql`. `SECURITY INVOKER`, `SET search_path = public`. `GRANT EXECUTE` a `authenticated, service_role`. `REVOKE ALL FROM PUBLIC`.

| RPC | Args | Returns |
|-----|------|---------|
| `peajes_listar_tarifas_actuales` | `p_filtros jsonb`, `p_page integer`, `p_page_size integer`, `p_sort text` | `{ rows, total, page, page_size }` |
| `peajes_obtener_tarifario_editor` | `p_peaje_id uuid`, `p_estacion_id uuid`, `p_sentido text` | `{ context, existentes }` |
| `peajes_guardar_tarifas_actuales` | `p_peaje_id uuid`, `p_estacion_id uuid`, `p_sentido text`, `p_cambios jsonb` | `{ actualizadas }` |
| `peajes_listar_tarifa_historial` | `p_tarifa_id uuid` | `[{ id, importe, fecha_aparicion, es_actual }]` |

### Filtros del listado (`p_filtros`)

`peaje_ids` uuid[], `estacion_ids` uuid[], `categorias` smallint[], `status` (`PICO`\|`NO_PICO`)[], `sentidos` (`IDA`\|`VUELTA`\|`AMBAS`)[], `q_estacion` text (ILIKE sobre `estaciones.nombre`).

`p_sort`: `campo:asc|desc`. Campos: `estacion_nombre`, `peaje_nombre`, `categoria`, `importe`, `fecha_actualizacion`, `status`, `sentido`. Default `estacion_nombre:asc`. `page_size` máx 100.

Fila: `tarifa_id`, `peaje_id`, `peaje_nombre`, `estacion_id`, `estacion_nombre`, `categoria`, `status`, `sentido`, `importe` (nullable), `fecha_actualizacion`, `current_tarifa_importe_id`. Sin puntero vigente → `importe` JSON `null`, nunca `0`.

### Editor

Sentido exacto (`IDA` no carga `VUELTA` ni `AMBAS`). Contexto sin filas `tarifas` → éxito con `existentes: []` y nombres desde `peajes`/`estaciones` (o el UUID como texto si no hay fila de catálogo). Sentido inválido → `22023`.

### Historial

Orden: `fecha_aparicion DESC`, `id DESC`. `es_actual` si `id` = `tarifas.current_tarifa_id`.

## Save semantics

`p_cambios`: `[{ categoria, status, importe }, ...]`. Categoría 0–10; status `PICO`\|`NO_PICO`; `importe > 0` (CHECK F14-16; `<= 0` → `23514`).

Por cada cambio:

1. Busca `tarifas` por `(peaje_id, estacion_id, status, categoria, sentido)` `FOR UPDATE`.
2. Si no existe: INSERT con `requiere_normalizacion_iva = false`, `current_tarifa_id = NULL`, `fecha_actualizacion = now()`.
3. INSERT `tarifa_importe (tarifa_id, importe, fecha_aparicion = now())`.
4. El trigger promociona el puntero. No hay UPDATE de importes históricos.

La UI omite NUEVO vacío (`collectCambios`). El RPC no recibe esos vacíos.

## Policies

RLS de `tarifas` / `tarifa_importe` es ALL para `authenticated` (F14-16). Los RPC heredan el rol del invocador.

## Testing

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
pnpm exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless
pnpm exec ng test --include="**/peajes/tarifario/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
pnpm seed:local
```

pgTAP: `supabase/tests/peajes_tarifario_rpc_test.sql` (namespace `17400000-…`). Seed de catálogo v2: `npm run seed:tarifario-v2` (`migrate-tarifario-v2.mjs --load-local`).

## Notes

- No `db push --linked`. No DESARROLLO.
- Matching de pasadas (`peajes_resolver_tarifas_actuales` etc.) no cambia.
- `tarifas_normalizadas` se retiene.

---

> Última actualización: 2026-09-08
