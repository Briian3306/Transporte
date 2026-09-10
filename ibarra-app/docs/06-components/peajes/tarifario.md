# Tarifario — precios actuales (F14-17 + F14-19 vigencia)

## Resumen

Pantalla `/peajes/tarifario` para **consultar el precio vigente** de cada identidad `tarifas` y **editar en lote** NO_PICO + PICO de un contexto exacto `peaje + estación + sentido`. El guardado **no pisa** filas históricas: append `CONFIRMADO` con **Vigente desde** obligatorio; el backend cierra el periodo anterior en esa fecha de inicio.

Features: **F14-17** (RPCs + UI), **F14-19** (campo Vigente desde, historial con vigencia/diagnóstico). Schema F14-16+. Owner UI: `02-frontend-wizard-tablas`. Provider: `PeajesTarifarioSupabaseService`. Mock solo en specs.

## Índice

- [Cómo llegar](#cómo-llegar)
- [Qué resuelve](#qué-resuelve)
- [Flujo de uso](#flujo-de-uso)
- [Listado](#listado)
- [Editor](#editor)
- [Historial](#historial)
- [Sentido](#sentido)
- [Componentes y archivos](#componentes-y-archivos)
- [Servicio](#servicio)
- [Estados vacíos y errores](#estados-vacíos-y-errores)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Cómo llegar

| Paso | Dónde |
|------|--------|
| 1 | Dashboard → módulo **Peajes** (`/peajes`) |
| 2 | Tarjeta **Tarifario** (icono `fa-tags`, junto a Auditoría de tarifas) |
| 3 | O ruta directa `/peajes/tarifario` |

Permiso: `{ module: 'peajes', action: 'manage' }` (`peajes:manage` o `*:*`). El operador `peajes:read` + `peajes:create` **no** ve la tarjeta ni entra a la ruta.

Editor: `/peajes/tarifario/:peajeId/:estacionId/:sentido`. Un `sentido` inválido redirige al listado.

---

## Qué resuelve

| Superficie | Dato | Editable |
|------------|------|----------|
| Listado | Precio **actual** (`current_tarifa_id` → `tarifa_importe.importe`) | No; acción **Editar** |
| Editor | Escalera 0–10, columnas NO_PICO y PICO (Actual + Nuevo) | Solo **Nuevo** |
| Historial | Importes previos de una identidad | Solo lectura; vigente marcado |

No es Auditoría de tarifas: no hay familia expandida, diagnóstico, patrón A/B, Recalcular, Comparar ni Ver casos.

Categorías en el editor: **1–N** según la estación, hasta la última categoría que ya tiene dato. Un botón **Agregar categoría** (Tab / Enter / `+`) suma la siguiente hasta **10**. No se rellenan filas vacías. `TARIFA_CATEGORIAS` 0–10 sigue siendo el catálogo del listado.

Faltante: UI muestra `—`, nunca `0`. `0` es un importe real si está guardado.

---

## Flujo de uso

```text
1. Abrir /peajes/tarifario
2. Filtrar peaje / estación / categoría / sentido / status / buscar
3. Editar en una fila → editor de ese peaje+estación+sentido
4. Completar NUEVO solo donde hay cambio (vacío = no tocar)
5. Guardar cambios (un payload bulk)
6. (Opcional) Historial en una celda con tarifa_id
```

---

## Listado

Chrome compartido con auditoría (`at__`, `peajes-list-shell.css`).

Columnas: Estación, Peaje, Categoría, Importe, Fecha actualización, Status (`PICO` / `NO_PICO`), Sentido, Acciones.

**Editar** abre el editor con el `sentido` de esa fila.

Filtro Sentido: Todos / IDA / VUELTA / AMBAS (match exacto). Debounce 300 ms. Paginador 25 / 50 / 100.

---

## Editor

Tablero dual (no pestañas), breadcrumb `PEAJE > ESTACION > SENTIDO`. Encabezado con **Última actualización** (la fecha más reciente del contexto). Cada celda Actual muestra importe + fecha.

- **Vigente desde** (F14-19): date picker compartido del contexto; obligatorio para guardar cambios con importe Nuevo. El operador **no** ingresa fecha fin; el RPC cierra el vigente abierto en el nuevo inicio.
- Tab: NUEVO NO_PICO → NUEVO PICO; el último NUEVO va a **Agregar categoría**. **Historial** queda fuera del Tab (`tabindex="-1"`). Tab / Shift+Tab / Enter mueven y seleccionan el campo NUEVO.
- NUEVO vacío se omite del payload (no-op).
- NUEVO inválido: error inline y no se guarda.
- Contexto sin identidades: éxito; tablero vacío y **Agregar categoría**. Agregar suma hasta 10.
- IDA no carga VUELTA ni AMBAS. AMBAS es un sentido real.

El mismo tablero (`TarifarioEditorBoardComponent`) se reutiliza en el diálogo de refresh Paso 9 con columnas Actual / Detectado / Nuevo. En Detectado el monto sale `$20.792,47 (3)` (clic copia a Nuevo). Candidatos sin PICO/NO_PICO o sentido van a filas finales del tablero con selectores y checkbox IVA solo para identidades nuevas. El tarifario standalone no usa Detectado ni esas filas. Ver [refresh-tarifas-paso9.md](../../backend/peajes/refresh-tarifas-paso9.md).

---

## Historial

`app-dialog` `lg` por celda (categoría + status). Columnas: Fecha aparición, Importe, **Desde**, **Hasta**, **Diagnóstico**, **Categoría calculada**, sello **Vigente**. Filas legadas sin vigencia en SQL muestran **Sin fecha conocida** en Desde/Hasta hasta que el RPC de historial exponga `fecha_vigencia_*` (shape F14-17 aún vigente en remoto). Deshabilitado si `tarifa_id` es null.

---

## Sentido

Valores: `IDA` | `VUELTA` | `AMBAS`. Nunca null. No se fusionan contextos.

---

## Componentes y archivos

| Path | Rol |
|------|-----|
| `tarifario/tarifario-list.component.*` | Listado de precios actuales |
| `tarifario/tarifario-editor-board.component.*` | Tablero presentacional PICO/NO_PICO (también en diálogo Paso 9) |
| `tarifario/tarifario-editor.component.*` | Ruta editor: carga/guarda/historial/agregar categoría |
| `tarifario/tarifario-historial-dialog.component.*` | Historial |
| `tarifario/tarifario.helpers.ts` | parse/format es-AR, `buildEditorRows`, `collectCambios` |
| `tarifario/mocks/tarifario.mock.ts` | Backend in-memory para specs |
| `tarifario/tarifario.routes.ts` | `useClass: PeajesTarifarioSupabaseService` |
| `services/peajes-tarifario.service.ts` | RPC list/editor/guardar/historial |
| `shared/peajes-list-shell.css` | Chrome `at__` compartido con auditoría |
| `models/tarifario.contracts.ts` | Tipos, `TARIFA_CATEGORIAS`, token |

RPCs de la ruta: `peajes_listar_tarifas_actuales`, `peajes_obtener_tarifario_editor`, `peajes_guardar_tarifas_actuales`, `peajes_listar_tarifa_historial`. El refresco de Paso 9 usa [refresh-tarifas-paso9.md](../../backend/peajes/refresh-tarifas-paso9.md) y `TARIFA_REFRESH_SERVICE`, no este guardar. `DialogComponent` admite `size="xl"` y `placement="top"` para ese diálogo. Backend tarifario: [tarifario.md](../../backend/peajes/tarifario.md).

---

## Servicio

```ts
listar(params) → TarifarioListResult
obtenerEditor(peajeId, estacionId, sentido) → TarifarioEditorPayload
guardar(peajeId, estacionId, sentido, cambios) → { actualizadas }
listarHistorial(tarifaId) → TarifarioHistorialItem[]
```

`cambios`: `{ categoria, status: 'PICO' | 'NO_PICO', importe, fecha_vigencia_inicio }[]` (F14-19).

Guardar: append `CONFIRMADO` con vigencia; cierra el periodo abierto anterior; el trigger promociona `current_tarifa_id` si el inicio es posterior; identidad ausente se crea. Historia previa intacta. `importe > 0`. Superposición de vigencia → error de negocio sin filas parciales.

---

## Estados vacíos y errores

| Caso | UI |
|------|----|
| Catálogo v2 vacío | Listado: mensaje de vacío |
| Contexto sin filas `tarifas` | Editor vacío; **Agregar categoría** hasta 10 |
| Filtros sin matches | «No hay tarifas actuales para estos filtros.» |
| Fallo de carga | Alerta; reintentar o quitar filtros |
| Importe Nuevo inválido | Inline + bloqueo de Guardar |

---

## Verificación

```powershell
cd ibarra-app
npx supabase test db
pnpm exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless
pnpm exec ng test --include="**/peajes/tarifario/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
pnpm seed:local
```

**2026-09-10 (precio final Paso 9):** Detectado `$importe (casos)`; filas de revisión con selectores status/sentido y checkbox IVA. Specs tablero + diálogo de refresh. pgTAP global **589 PASS**. Tarifario de ruta sin cambios de schema.

---

## Referencias

- Contratos: `src/app/components/peajes/models/tarifario.contracts.ts`
- Feature: `F14-17` en `feature_list.json`
- Schema: [tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md)
- RPCs: [tarifario.md](../../backend/peajes/tarifario.md)
- Auditoría (clasificar niveles de pasadas, no el catálogo): [auditoria-tarifas.md](./auditoria-tarifas.md)
