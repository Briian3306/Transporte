# Refresh de tarifas en Paso 9 (F14-18 + F14-19)

## Summary

Tres RPCs INVOKER contrastan precios de pasadas incluidas contra el catálogo v2 (`tarifas.current_tarifa_id` → `tarifa_importe`) con **vigencia calendario**, **corrección de categoría**, **decisiones explícitas CONFIRM_NEW / MARK_REVIEW** y historial append-only. No pisan filas históricas ni aplican `/ 1.21`. Las firmas públicas de F14-16 se conservan.

UI: diálogo xl/top en Paso 9 con **editores dinámicos por agrupación de estaciones**, tablero Actual/Detectado/Nuevo del Tarifario (sin rail de candidatos) y campo **Vigente desde** (solo inicio; el fin lo cierra el backend). Tablas: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md).

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

Impedir que una carga confirme un precio nuevo, una corrección de categoría o un status ambiguo sin decisión explícita; reconocer matches vigentes o históricos dentro de la vigencia de la pasada; y registrar filas `REVISAR` sin mover el puntero cuando el operador continúa sin resolver.

## Business Logic

### Flujo Paso 9 (F14-19)

1. El frontend extrae candidatos **distintos** de las pasadas incluidas. Precio final visible/directo: `TARIFA_PESOS` si existe, si no `PRECIO`, y `IMPORTE_NETO` solo si no hay ninguno. No se parsea `TARIFA` crudo ni se redondea el candidato. Conserva `rowIndexes`, `fecha_pasada`, `categoria_proveedor` y sentido resuelto. El flag IVA no cambia el monto mostrado: solo manda `precio_normalizado` cuando el tarifario lo pide.
2. `peajes_preparar_refresco_tarifas` resuelve identidades PICO/NO_PICO del contexto. **No** hace aritmética monetaria.
3. El adapter Angular produce `precio_normalizado` **solo** si alguna identidad preparada tiene `requiere_normalizacion_iva = true`. SQL elige según el flag. Nunca divide por 1,21.
4. `peajes_detectar_refresco_tarifas` clasifica cada candidato con helper privado `_peajes_tarifas_matching_candidatos` (todas las categorías, status y sentidos de la estación, rangos de vigencia `[inicio, fin)`). La tarifa existente es la fuente de verdad: un match único reutiliza también su status y sentido aunque difieran los valores del proveedor.

| Código | Cuándo | Diálogo / Paso 9 |
|--------|--------|------------------|
| `CURRENT_TARIFF` | Importe vigente dentro de 1% y vigencia compatible | No (informativo) |
| `HISTORICAL_TARIFF_MATCH` | Vigente no matchea; un histórico del mismo padre sí | No (informativo) |
| `CURRENT_CATEGORY_CORRECTION` | Match único en otra categoría, vigente | Sí (corrección explícita) |
| `HISTORICAL_CATEGORY_CORRECTION` | Match único en otra categoría, histórico | Sí |
| `NEW_TARIFF` | Status explícito y ningún monto entra en tolerancia | Sí |
| `STATUS_REQUIRED` / `STATUS_AMBIGUOUS` | Falta status o hay más de un status candidato | Sí |
| `AMBIGUOUS_TARIFF_MATCH` | Más de un match seguro | Sí |
| `DIRECTION_REQUIRED` / `DIRECTION_CONFLICT` | Sentido ausente o conflictivo | Bloquea hasta resolver sentido |
| `CONTEXT_INCOMPLETE` | Sin estación o categoría | Bloquea confirmar |

5. **Corrección de categoría:** `pasadas.categoria` (proveedor) **no cambia**. Para todos los matches de estación + precio dentro de la tolerancia, se elige la categoría numéricamente mayor; si la identidad de esa categoría es única, se expone como `categoria_calculada`. Si quedan varias identidades en la categoría mayor, el caso permanece ambiguo.
6. **Agrupación de estaciones (UI):** checkbox multi-select agrupa estaciones que comparten el mismo borrador. Desmarcar una estación la deja **exactamente una vez** como editor independiente. Un guardado agrupado fan-out a identidades `tarifas`/`tarifa_importe` **independientes** con el mismo importe/fecha. Detectado muestra `$20.792,47 (3)`. Candidatos sin status/sentido van al **bloque final** del mismo tablero con selectores. Checkbox **Normalizar IVA** solo en identidades nuevas (hereda del tarifario, plantilla como fallback, override manual).
7. **Guardado:** `peajes_guardar_refresco_tarifas` acepta `action`:

| Acción | Efecto |
|--------|--------|
| `CONFIRM_NEW` | Solo si hay importe en **Nuevo** (tipeo o clic en Detectado) y **Vigente desde**. Cierra `fecha_vigencia_fin` del vigente en el nuevo inicio; inserta `CONFIRMADO`; promueve puntero si corresponde |
| `MARK_REVIEW` | Para un importe pendiente, el operador elige **No pico** o **Pico** en su fila de revisión. Esa elección no completa **Nuevo** ni mueve el importe a **Detectado**. La identidad se resuelve contra el tarifario activo: misma estación + status + sentido efectivo; se reutiliza la categoría mayor. Si no existe ese status, se usa la categoría mayor existente de la estación. Inserta `diagnostico = REVISAR` sin vigencia; **no** cierra ni promueve. |

8. **Revalidar precios** no guarda ni cierra el diálogo. Reanaliza las tarifas actuales y los borradores `Nuevo` de la sesión; conserva los valores ingresados. Cada candidato resuelto con una identidad única sale de revisión y permanece visible, de solo lectura, en la celda **Detectado** de su categoría efectiva, status y sentido. El catálogo existente siempre precede a un borrador de sesión; en hits con el mismo precio elige la categoría mayor y conserva la revisión si esa categoría es ambigua. Paso 9 muestra resumen en seis bloques (coincidencias, nuevas confirmadas, correcciones, vigencia, revisar, pendientes) y **no continúa** mientras quede un candidato sin `CONFIRM_NEW`, asignación a Nuevo o `MARK_REVIEW` (este último puede emitirse al guardar si la identidad ya está completa).
9. `peajes_confirmar_carga` no cambia de firma; persiste `pasadas.sentido` (default `AMBAS`).

### Revisión por status

Las filas de revisión no exponen selector de sentido ni normalización IVA. El sentido se determina internamente: familia `AMBAS` → `AMBAS`; familia direccional → `IDA`. Esto evita crear grupos `VUELTA` o `NULL` durante la revisión.

Al elegir un status, el proveedor no decide la categoría. Por ejemplo, si el proveedor informa categoría 9 pero existe categoría 7 + `PICO` para esa estación, se reutiliza categoría 7 + `PICO`; no se crea categoría 9 + `PICO`. Si existen categorías 7 y 9 para `PICO`, se reutiliza 9. Si `PICO` no existe, se crea la identidad de revisión con la categoría activa mayor de la estación, manteniendo `current_tarifa_id = NULL`.

`20260910195747_peajes_tarifario_ocultar_revision.sql` filtra `peajes_listar_tarifas_actuales` a identidades con `current_tarifa_id IS NOT NULL`, por lo que una identidad creada solamente para `REVISAR` no aparece en el Tarifario activo.

### Orden de matching (SQL)

Por candidato, tras hits de monto ≤1% y vigencia compatible, excluyendo filas `REVISAR`:

1. Elegir la categoría numéricamente mayor entre todos los hits de la estación.
2. Si esa categoría tiene una única identidad, reutilizar su status, sentido, tarifa e importe; vigente precede a histórico.
3. Si persisten varias identidades en la categoría mayor, devolver `AMBIGUOUS_TARIFF_MATCH` y no completar datos automáticamente.

`possible_matches` lista alternativas compatibles con vigencia (F14-19); no incluye filas fuera del periodo de la pasada.

### Vigencia e historial

- Intervalos confirmados: `[fecha_vigencia_inicio, fecha_vigencia_fin)` con fin exclusivo; `NULL` fin = abierto.
- Constraint `tarifa_importe_vigencia_confirmada_excl` (GiST): no solapamiento de periodos `CONFIRMADO` con inicio conocido.
- **Único UPDATE permitido** en historial: cerrar `fecha_vigencia_fin` una vez (`NULL` → fecha del nuevo inicio). Resto append-only.
- Legado sin fechas: `fecha_vigencia_inicio/fin` permanecen `NULL`; UI muestra vigencia desconocida. **No** se inventa backfill desde `fecha_aparicion`.

### Dominio `diagnostico`

Valores en `tarifa_importe.diagnostico`: `MUESTRA_INSUFICIENTE`, `TARIFA_UNICA`, `CATEGORIA`, `POSIBLE_HORARIO`, `REVISAR`, `CONFIRMADO`. Snapshot al insert; filas `REVISAR` no promueven puntero.

## Relations

| Consumidor | Operación |
|------------|-----------|
| `TarifaRefreshServiceImpl` | extraer → preparar → IVA adapter → detectar → guardar |
| `Paso9RevisionComponent` | Gate de confirmación + resumen + diálogo |
| `TarifaRefreshDialogComponent` | Agrupación, editores AMBAS/IDA+VUELTA, fan-out |
| `tarifa-refresh-dialog.helpers.ts` | Reductor puro de agrupación |
| `TarifarioEditorBoardComponent` | Tablero Actual/Detectado/Nuevo |
| Matcher F14-16 Paso 8 | Helpers distintos; refresh usa `_peajes_tarifas_matching_candidatos` |

## Tables

| Tabla | Rol |
|-------|-----|
| `tarifas` | Identidad + puntero + flag IVA |
| `tarifa_importe` | Historial append-only + vigencia + diagnostico |
| `pasadas` | `sentido`; categoría proveedor intacta; auditoría vía `tarifa_importe_id` |

## Functions

Migraciones:

- F14-18: `20260908150000_peajes_refresh_tarifas_paso9.sql` (preparar/detectar/guardar base)
- F14-19: `20260909181737_peajes_tarifa_vigencia_diagnostico.sql`, `20260909192938_peajes_tarifa_matching_correcciones.sql`
- Follow-up Paso 9: `20260910195747_peajes_tarifario_ocultar_revision.sql` (production MCP version `20260911111515`)

`SECURITY INVOKER`. `GRANT EXECUTE` a `authenticated, service_role`. Helpers `_peajes_tarifas_matching_candidatos`, `_peajes_aplicar_importe_guardado` no son API de producto.

| RPC | Args | Returns |
|-----|------|---------|
| `peajes_preparar_refresco_tarifas` | `p_contextos jsonb` | identidades + IVA |
| `peajes_detectar_refresco_tarifas` | `p_candidatos jsonb` | arreglo `{ id, codigo, categoria_calculada?, fecha_vigencia_*, possible_matches, ... }` |
| `peajes_guardar_refresco_tarifas` | `p_cambios jsonb` | arreglo `{ accion, tarifa_importe_id, fecha_vigencia_inicio, diagnostico, candidate_id, ... }` |

**Candidato detectar:** `id`, `estacion_id`, `categoria` / `categoria_proveedor`, `status_solicitado`, `sentido_solicitado`, `fecha_pasada`, `precio_directo`, `precio_normalizado`, `unresolvedReason` opcional.

**Cambio guardar:** `action` (`CONFIRM_NEW` \| `MARK_REVIEW`), `peaje_id`, `estacion_id`, `sentido`, `categoria`, `status`, `importe`, `cases`, `fecha_vigencia_inicio` (obligatorio en CONFIRM_NEW), `categoria_calculada` opcional, `candidate_id` opcional, `requiere_normalizacion_iva` si identidad nueva.

**Transacción / locking:** validación completa del payload → `FOR UPDATE` sobre identidades `tarifas` afectadas (orden peaje/estación/sentido/categoría/status) → overlap check por vigencia → mutación vía `_peajes_aplicar_importe_guardado`.

## Policies

RLS ALL `authenticated` en `tarifas` / `tarifa_importe` (F14-16). Los RPC heredan el invocador.

## Validations

- Tolerancia: `abs(precio_comparado - importe) / importe <= 0.01`.
- Status solo `PICO` / `NO_PICO`. Sentido solo `IDA` / `VUELTA` / `AMBAS`; fail-closed sin inferir sentido desde monto.
- Celdas/candidatos duplicados en `p_cambios` → excepción.
- Estación debe pertenecer al peaje indicado.
- Superposición de vigencia confirmada → excepción (sin filas parciales).
- `MARK_REVIEW` rechaza `fecha_vigencia_inicio`.
- Historial inmutable salvo cierre único de `fecha_vigencia_fin`.

## Testing

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
pnpm seed:local
pnpm exec ng test --watch=false --browsers=ChromeHeadless `
  --include="**/tarifa-refresh.service.spec.ts" `
  --include="**/tarifa-comparison-adapter.service.spec.ts" `
  --include="**/paso9-revision/**/*.spec.ts" `
  --include="**/tarifa-refresh-dialog.helpers.spec.ts" `
  --include="**/tarifa-refresh-dialog.component.spec.ts" `
  --include="**/peajes/tarifario/**/*.spec.ts"
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npx ng build --configuration=development
```

| Suite | Archivo / ámbito |
|-------|------------------|
| pgTAP vigencia | `supabase/tests/peajes_tarifa_vigencia_test.sql` |
| pgTAP refresh | `supabase/tests/peajes_refresh_tarifas_test.sql` |
| pgTAP cases | `supabase/tests/peajes_tarifa_importe_cases_test.sql` |
| Angular | helpers, dialog, Paso 9, refresh service, tarifario |

**Estado (2026-09-11):** pgTAP **Files=18 Tests=590 PASS**; TypeScript app/spec checks pass. Focused Karma compiles but ChromeHeadless cannot launch in this Windows environment (OS encryption/GPU cache failure), before executing tests. AUSA-V3: `TARIFA_PESOS=20792.47` is the visible/direct candidate (not `PRECIO` /1.31). Review status buttons remain separate from `Nuevo` and `Detectado`. Migration `20260910195747_peajes_tarifario_ocultar_revision.sql` was applied to production through Supabase MCP as `20260911111515`; the live function was verified to filter review-only identities.

## Notes

- Código: `tarifa-refresh.service.ts`, `tarifa-refresh-dialog.*`, `tarifa-refresh-dialog.helpers.ts`, `paso9-revision.*`, `checkbox-multi-select`.
- Tarifario de ruta: `peajes_guardar_tarifas_actuales` exige `fecha_vigencia_inicio` (F14-19); ver [tarifario.md](../../06-components/peajes/tarifario.md).
- `tarifas_normalizadas` y `peajes_normalizar_tarifas` post-carga se retienen.
- Plan: `docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md`.

---

> Última actualización: 2026-09-11 (revisión solo por status desplegada)
