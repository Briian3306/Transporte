# Refresh de tarifas en Paso 9 (F14-18)

## Summary

Tres RPCs INVOKER para contrastar precios de pasadas incluidas contra el catálogo v2 (`tarifas.current_tarifa_id` → `tarifa_importe.importe`) y, si el operador confirma, **append** historial inmutable. No pisan filas históricas. No aplican `/ 1.21`. Las firmas públicas de F14-16 (`peajes_resolver_tarifas_actuales` / `peajes_validar_tarifas_actuales`) se conservan; internamente usan el helper `_peajes_tarifas_montos_candidatos`.

UI: diálogo xl/top en Paso 9 reutilizando el tablero del Tarifario. Tablas: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md).

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

## Purpose

Impedir que una carga confirme un precio nuevo (o un status ambiguo) sin decisión explícita, y reconocer matches vigentes o históricos con tolerancia relativa inclusiva del 1%.

## Business Logic

1. El frontend extrae candidatos **distintos** de las pasadas incluidas (`PRECIO`; `IMPORTE_NETO` solo si falta PRECIO). Conserva `rowIndexes` del Excel.
2. `peajes_preparar_refresco_tarifas` resuelve identidades PICO/NO_PICO del contexto (peaje vía estación, categoría, sentido) y el flag IVA. **No** hace aritmética monetaria.
3. El adapter Angular (`PeajesMotorTransformacionService`) produce `precio_normalizado` **solo** si alguna identidad preparada tiene `requiere_normalizacion_iva = true`. SQL elige `precio_normalizado` o `precio_directo` según ese flag. Nunca divide por 1,21.
4. `peajes_detectar_refresco_tarifas` clasifica cada candidato:

| Código | Cuándo | Diálogo Paso 9 |
|--------|--------|----------------|
| `CURRENT_TARIFF` | Importe **vigente** dentro de 1% | No |
| `HISTORICAL_TARIFF_MATCH` | Vigente no matchea; un importe histórico del mismo padre sí | No (informativo) |
| `NEW_TARIFF` | Status explícito y ningún monto del padre entra en tolerancia | Sí |
| `STATUS_REQUIRED` / `STATUS_AMBIGUOUS` | Falta status o hay más de un status candidato | Sí |
| `CONTEXT_INCOMPLETE` | Sin estación o categoría | Bloquea confirmar; no fabrica tarifa |

5. Sentido: `IDA`/`VUELTA` ganan sobre `AMBAS`; `AMBAS` pedido solo matchea `AMBAS`. Status nunca se infiere de `hora_*`.
6. `peajes_guardar_refresco_tarifas`: transacción validate-then-mutate, `FOR UPDATE`, `fecha_aparicion = now()`. Identidad nueva exige boolean IVA explícito. Importe exactamente igual al current → `SIN_CAMBIO`. Nuevo vacío no llega al RPC.
7. Tras guardar, Paso 9 re-analiza. `peajes_confirmar_carga` no cambia de firma; persiste `pasadas.sentido` (default `AMBAS`) de forma aditiva.

## Relations

| Consumidor | Operación |
|------------|-----------|
| `TarifaRefreshServiceImpl` | extraer → preparar → IVA adapter → detectar → guardar |
| `Paso9RevisionComponent` | Gate de confirmación + diálogo |
| `TarifarioEditorBoardComponent` | Tablero PICO/NO_PICO reutilizado |
| Matcher F14-16 | Mismo helper privado de montos |

## Tables

| Tabla | Rol |
|-------|-----|
| `tarifas` | Identidad + puntero `current_tarifa_id` + flag IVA |
| `tarifa_importe` | Historial append-only |
| `pasadas` | `sentido` en INSERT de confirmar carga |

## Functions

Migración: `supabase/migrations/20260908150000_peajes_refresh_tarifas_paso9.sql`. `SECURITY INVOKER`. `GRANT EXECUTE` a `authenticated, service_role`. `REVOKE ALL FROM PUBLIC`. Helper `_peajes_tarifas_montos_candidatos` no es API de producto.

| RPC | Args | Returns |
|-----|------|---------|
| `peajes_preparar_refresco_tarifas` | `p_contextos jsonb` (arreglo) | identidades + `requiere_normalizacion_iva` por contexto |
| `peajes_detectar_refresco_tarifas` | `p_candidatos jsonb` | arreglo `{ id, codigo, ... }` |
| `peajes_guardar_refresco_tarifas` | `p_cambios jsonb` | arreglo `{ accion, tarifa_id, tarifa_importe_id, anterior, nueva, ... }` |

Candidato detectar: `id`, `estacion_id`, `categoria`, `status_solicitado` opcional, `sentido_solicitado` (default `AMBAS`), `precio_directo`, `precio_normalizado`.

Cambio guardar: `peaje_id`, `estacion_id`, `sentido`, `categoria`, `status`, `importe` (> 0). `requiere_normalizacion_iva` boolean **obligatorio** si la identidad no existe.

## Policies

RLS ALL `authenticated` en `tarifas` / `tarifa_importe` (F14-16). Los RPC heredan el invocador.

## Validations

- Tolerancia: `abs(precio_comparado - importe) / importe <= 0.01`.
- Status solo `PICO` / `NO_PICO`. Sentido solo `IDA` / `VUELTA` / `AMBAS`.
- Celdas duplicadas en `p_cambios` → excepción.
- Estación debe pertenecer al peaje indicado.
- Historial inmutable: INSERT; el trigger promociona el puntero.

## Testing

```powershell
cd ibarra-app
npx supabase test db
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/tarifa-refresh.service.spec.ts" --include="**/paso9-revision.component.spec.ts" --include="**/tarifario-editor-board.component.spec.ts"
```

pgTAP: `supabase/tests/peajes_refresh_tarifas_test.sql`. Tres casos locales (AUSOL CAMPANA / `557074.csv`): ver `feature_list.json` F14-18.

## Notes

- Código Angular: `tarifa-refresh.service.ts`, `tarifa-refresh-dialog.component.*`, `paso9-revision`.
- Tarifario de ruta sigue usando `peajes_guardar_tarifas_actuales`; el diálogo de Paso 9 usa `peajes_guardar_refresco_tarifas`.
- `tarifas_normalizadas` y el hook `peajes_normalizar_tarifas` post-carga no se eliminan.
- Autopistas Urbanas (`VAR`/`KDT`/`PB2` en `autopistas_urbanas.csv`) no está sembrado como códigos de estación en CLI; el proxy AUSA VARELA cat.9 `19985.09` clasifica `NEW_TARIFF`.

---

> Última actualización: 2026-09-08
