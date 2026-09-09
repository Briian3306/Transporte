# Apéndice C — Pantalla de auditoría de tarifas (frontend)

Épica **F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)** · Feature **F14-4** (agente 02).

Documentos hermanos (no duplicar su contenido, referenciarlos):

- `PLAN-auditoria-pasadas-patrones.md` — alcance y secuencia de la épica.
- `APENDICE-A-modelo-datos-sql.md` — DDL de `tarifas_normalizadas`, `tarifas_parametros_peaje`, `tarifas_status_catalogo`, columnas nuevas de `pasadas` y firma exacta de las RPC.
- `APENDICE-B-deteccion-categoria-y-mapeo.md` — detección Patrón A/B en Paso 2 y mapeo de `CATEGORIA` en Paso 5.
- `APENDICE-D-testing-y-dataset-referencia.md` — dataset de referencia y plan de pruebas de esta pantalla.

Este apéndice no define SQL ni el contrato de detección: consume ambos.

---

## 1. Objetivo de la pantalla y trabajo que resuelve

**El trabajo único:** convertir cada familia de tarifas detectada por el algoritmo en una decisión humana de clasificación, con un toque por nivel de precio.

El motor de normalización puede decir *qué niveles de precio existen* en una estación y *cómo se distribuyen en el día*, pero no puede decidir si un precio más alto es un **horario pico** o un **vehículo de otra categoría**. Esa decisión la toma un analista que conoce la operación. La pantalla existe para que esa decisión sea rápida, no para que sea completa: no es un ABM de tarifas, no es un tablero de análisis y no reemplaza el wizard de carga.

La consecuencia de diseño más importante es que **hay una sola columna que el usuario escribe: `status`**. Todo lo demás en la pantalla (importe, casos, multiplicador, desvío horario, `diagnostico`, patrón) es evidencia de solo lectura que existe para acortar el tiempo hasta ese toque.

Dos capas conviven y no deben confundirse en la UI:

| Capa | Origen | ¿Editable? | Valores |
|---|---|---|---|
| `diagnostico` | algorítmico, recalculable | no (solo dos acciones lo fuerzan) | `MUESTRA_INSUFICIENTE`, `TARIFA_UNICA`, `CATEGORIA`, `POSIBLE_HORARIO`, `REVISAR`, `CONFIRMADO` |
| `status` | **entrada del usuario** | sí, es el objetivo de la pantalla | universales `PENDIENTE`, `POSIBLE_HORARIO` + códigos por peaje de `tarifas_status_catalogo` (en el dataset de referencia: `PICO`, `NO_PICO`) |

Ruta: `/peajes/auditoria-tarifas`. Permiso: `{ module: 'peajes', action: 'read' }`. Prefijo de bloque CSS: `at__`.

---

## 2. Dirección de diseño

### 2.1 Restricción que manda sobre todo lo demás

`AGENTS.md` es explícito: *"Seguir el look existente (dashboard, formularios, paneles). No introducir un design system nuevo."* La skill `frontend-design` pide una identidad visual distintiva; acá esa exigencia se redirige: **no se gasta en una paleta ni en una tipografía propias, se gasta íntegramente en hacer obvia la decisión tarifaria.** El resto de la pantalla es deliberadamente indistinguible de `pasadas-pendientes`.

### 2.2 Tokens

Se derivan uno a uno de `pasadas-pendientes-list.component.css`, que define su paleta como variables locales del bloque:

```1:16:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.css
.pp {
  --pp-canvas: #f7f9fb;
  --pp-signal: #004ac6;
  --pp-price: #2563eb;
  --pp-ink: #0f172a;
  --pp-muted: #434655;
  --pp-line: #e2e8f0;
  --pp-ok: #10b981;
  --pp-pending: #f59e0b;
```

El bloque `at__` replica esa lista con un solo agregado:

| Token `at__` | Valor | Origen | Uso |
|---|---|---|---|
| `--at-canvas` | `#f7f9fb` | `--pp-canvas` | degradado de fondo del contenedor |
| `--at-signal` | `#004ac6` | `--pp-signal` | enlaces, chevron, botón primario, foco |
| `--at-price` | `#2563eb` | `--pp-price` | columnas de importe y barra de multiplicador |
| `--at-ink` | `#0f172a` | `--pp-ink` | texto principal |
| `--at-muted` | `#434655` | `--pp-muted` | encabezados de tabla, metadatos, eyebrow |
| `--at-line` | `#e2e8f0` | `--pp-line` | bordes, separadores, riel horario |
| `--at-ok` | `#10b981` | `--pp-ok` | badge de `CONFIRMADO` |
| `--at-pending` | `#f59e0b` | `--pp-pending` | badge de `PENDIENTE` / `MUESTRA_INSUFICIENTE` |
| `--at-danger` | `#ef4444` | `.pp__error` y `--eud-danger` del drawer | badge `REVISAR` y mensajes de error |
| **`--at-rail`** | `color-mix(in srgb, var(--at-signal) 10%, #fff)` | **nuevo** | pista del riel horario de 24 h |

Un solo token nuevo. Los colores de los botones de status **no** se declaran acá: vienen de `tarifas_status_catalogo.color` en tiempo de ejecución (§9).

### 2.3 Tipografía y escala

No se agrega ninguna webfont. El "pairing" ya existe en el repositorio y se usa con intención:

- **Texto de interfaz:** la pila del host, sin cambios. Escala heredada de `pp`: `1.75rem` para el `h1`, `0.875rem` para celdas de tabla, `0.75rem` para etiquetas de filtro, `0.6875rem` en mayúsculas con `letter-spacing: 0.08em` para eyebrows y encabezados de columna.
- **Cara de datos:** `font-variant-numeric: tabular-nums` en toda columna numérica (`.at__num`, `.at__price`), igual que `.pp__num` / `.pp__price`. Esto no es cosmético: la escalera tarifaria solo se lee de un vistazo si los dígitos de `1.500,00` y `7.500,00` se alinean verticalmente.
- **Cara utilitaria:** la pila `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` de `.pp__plate` se reutiliza en `.at__code` para mostrar códigos crudos de status desconocidos (§9). Que un código sin traducir aparezca en monoespaciada comunica "esto es un valor del sistema, no una etiqueta".

Espaciado: la misma retícula de `pp` (`0.7rem 0.75rem` en celdas, `0.75rem` de gap entre filtros, `1.25rem 1rem 2.5rem` de padding del contenedor).

### 2.4 Elemento signature: la **escalera tarifaria**

La única pieza que no existe en el repositorio y que justifica su existencia.

Dentro de la fila expandida, los niveles de importe de una estación se apilan **ordenados de menor a mayor precio**, y cada nivel muestra sus dos evidencias en geometría, no en números sueltos:

1. **Barra de multiplicador** — ancho proporcional a `multiplicador` respecto del multiplicador máximo de la familia, en `--at-price`. Responde a *"¿cuánto más caro que la tarifa base?"*. Un salto a `4,00×` grita "otra categoría de vehículo"; un salto a `1,25×` grita "recargo".
2. **Riel horario de 24 h** — una pista `--at-rail` de ancho fijo que representa 0–23 h, con el tramo `hora_min → hora_max` sombreado y una marca en `hora_media`. Responde a *"¿este precio ocurre a toda hora o en una franja?"*. Un tramo que cubre casi todo el riel no puede ser un horario pico; un tramo corto probablemente sí.

**Por qué estas dos y no otras:** la decisión que toma el analista es literalmente elegir entre dos explicaciones para el mismo hecho (un precio distinto). La explicación "categoría" se sostiene en el multiplicador; la explicación "horario" se sostiene en la dispersión. Ponerlas en el mismo renglón, a la misma altura, convierte una comparación mental en una comparación visual. En el dataset de referencia esto se ve de inmediato: en `ZARATE - RUTA 9 KM. 95` los cinco niveles tienen rieles que van de 0 a 23 h (ningún horario explica nada, y sin embargo el multiplicador escala 1×→5×), mientras que en `AGÜERO - AU.RICCHIERI KM 15,80` conviven niveles con rieles de tres horas de ancho y niveles que cubren el día entero.

**Regla de color:** el color queda reservado para decisiones (botones de status y badges). La evidencia se dibuja en geometría y en un único azul. Esto evita que la escalera compita con los botones, que son lo que hay que tocar.

### 2.5 Crítica y qué se quitó

Autocrítica antes de construir, como pide la skill. La respuesta genérica para "pantalla de clasificar filas" es una tabla con un `<select>` por fila y un botón *Guardar* abajo. Se descarta por pedido explícito del usuario ("como con los botones de status") y porque un `<select>` esconde las opciones detrás de un toque extra, que es exactamente el costo que hay que eliminar.

Ideas evaluadas y **descartadas**, para dejar constancia de la restricción:

| Idea | Por qué se quitó |
|---|---|
| Scatter `hora media × importe` por estación | Requiere librería de gráficos; el repo no tiene ninguna y `AGENTS.md` prohíbe sumar stack |
| Histograma horario por nivel | Las RPC devuelven `hora_min / hora_max / hora_media / desvio`, no la distribución; sería un gráfico inventado |
| Borde izquierdo coloreado por `diagnostico` en cada fila | Redundante con el badge de diagnóstico; duplicar la señal desactiva ambas |
| Mini-gráfico de casos por nivel | La columna *Casos* ya lo dice; decoración pura |
| Marcadores numerados `01 / 02 / 03` por nivel | La secuencia relevante es el **precio**, y el precio ya está impreso; numerar sería inventar un orden que no aporta |
| Animación de conteo en el indicador de progreso | Retrasa la lectura del único número que importa |

**La prenda que se saca antes de salir:** el riel horario no lleva escala numérica impresa (ni ticks cada 6 h). Solo la pista, el tramo sombreado y la marca de la media, con `hora_media` y `desvío` en texto debajo. La escala se aprende una vez y después estorba.

---

## 3. Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MÓDULO PEAJES                                                     ← Volver   Pasadas   │
│ Auditoría de tarifas                                                                   │
│ Clasificá cada nivel de precio como pico o no pico. El sistema propone; vos confirmás. │
│                                                                    [ Recalcular ]      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ CORREDORES VIALES SA   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  53 de 64 clasificadas · 11 pendientes      │
│ RUTAS SUR ATLANTICO    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  34 de 38 clasificadas ·  4 pendientes      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Rango de fechas   │ Peaje        │ Estación      │ Categoría   │ Diagnóstico │ Status  │
│ [ 01/07 – 31/07 ] │ [ Todos   ▾] │ [ Todas    ▾] │ [        ▾] │ [ Todos  ▾] │ [   ▾]  │
│ Patrón            │ Muestra confiable            │ Buscar                              │
│ [Todos│A│B]       │ [ ○ Solo ≥ umbral ]          │ [ Buscar por estación…            ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ⓧ Estación: ZARATE   ⓧ Status: PENDIENTE                              Limpiar filtros │
├────────────────────────────────────────────────────────────────────────────────────────┤
│   │ ESTACIÓN            │ CAT │  IMPORTE │ CASOS │  MULT │ DESVÍO │ DIAGNÓSTICO │ STATUS │ PATRÓN │ │
│ ▸ │ ZARATE - RUTA 9…    │  —  │ 1.500,00 │   114 │ 1,00× │   7,49 │ ● CATEGORÍA │ ● NO PICO │  A  │ │
│ ▾ │ ZARATE - RUTA 9…    │  —  │ 3.000,00 │    20 │ 2,00× │   4,73 │ ● CATEGORÍA │ ○ PENDIENTE │ A │ │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│ │  FILA EXPANDIDA at__detail — familia completa de la estación                     │  │
│ │  ① Escalera tarifaria + botones de status por nivel   (§6 y §7)                  │  │
│ │  ② [ Confirmar 5 niveles ]  [ Es variación por categoría ]  [ Marcar para revisar ]│ │
│ │  ③ [ Comparar con grupos similares ]                            (abre diálogo §8) │  │
│ └──────────────────────────────────────────────────────────────────────────────────┘  │
│ ▸ │ LAGOS - RUTA 9…     │  —  │ 1.500,00 │     2 │ 1,00× │   0,71 │ ● MUESTRA…  │ ○ PENDIENTE │ A │ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                        Filas [50 ▾]   1–50 de 119   Anterior  Siguiente │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

El encabezado replica la estructura de `pasadas-pendientes-list.component.html`: eyebrow + `h1` + subtítulo a la izquierda, enlaces a la derecha.

```1:17:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.html
<div class="pp">
  <header class="pp__header">
    <div>
      <p class="pp__eyebrow">Módulo Peajes</p>
      <h1>Ubicaciones pendientes</h1>
      <p class="pp__sub">
        Estaciones sin coordenadas asociadas a pasadas. Completá latitud y longitud para pasar a OK.
      </p>
    </div>
    <div class="pp__header-actions">
      <a routerLink="/peajes" class="pp__link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Volver
      </a>
      <a routerLink="/peajes/pasadas" class="pp__link">Pasadas</a>
    </div>
  </header>
```

Copy real del encabezado de esta pantalla:

- Eyebrow: `Módulo Peajes`
- `h1`: `Auditoría de tarifas`
- Subtítulo: `Clasificá cada nivel de precio como pico o no pico. El sistema propone una clasificación por precio; vos confirmás.`
- Enlaces: `← Volver` (a `/peajes`) y `Pasadas` (a `/peajes/pasadas`).

---

## 4. Filtros

Se reutilizan los controles compartidos de `src/app/components/shared/` (exportados por `src/app/components/shared/index.ts`) con el mismo envoltorio `.at__field` que usa `.pp__field`.

| Filtro | Control | Clave en `p_filtros` | Notas |
|---|---|---|---|
| Rango de fechas | `app-date-range-picker` + `rangeToIsoFilters` | `fecha_desde`, `fecha_hasta` | Filtra las pasadas que alimentan la familia, no la fecha de la familia |
| Peaje / concesión | `app-search-multi-select` | `peaje_ids` | Opciones desde `PeajesCatalogoService.listarPeajes()` |
| Estación | `app-search-multi-select` | `estacion_ids` | Opciones desde `listarEstaciones(peajeId)`; se recorta al peaje elegido |
| Categoría | `app-search-select` con `[showAllWhenEmpty]="true"` | `categorias` | Solo tiene sentido en Patrón B; ver nota abajo |
| Diagnóstico | `app-search-multi-select` | `diagnosticos` | Opciones **fijas**, enumeradas en código: los seis valores de `diagnostico` |
| Status | `app-search-multi-select` | `status` | Opciones **dinámicas**: universales + `tarifas_status_catalogo` de los peajes filtrados |
| Patrón | `app-filter-chip-rail` no; grupo de tres botones `.at__seg` | `patron` | Valores `A`, `B`, `null` (Todos). Es un segmentado de tres, no amerita un multiselect |
| Muestra confiable | `<input type="checkbox" role="switch">` nativo | `solo_muestra_confiable` | `true` ⇒ solo familias con `cases >= umbral_muestra_minima` |
| Búsqueda libre | `<input type="search">` nativo | `q_estacion` | Mismo control y placeholder que `pasadas-pendientes` (`Buscar por nombre…`) |

Los chips activos se renderizan con `app-filter-chip-rail` debajo de la grilla de filtros, exactamente como en `pasadas-pendientes` (`[chips] (remove) (clear)`), y `clearLabel` queda en su valor por defecto `Limpiar filtros`.

**Origen de las opciones de Categoría (importante).** No existe ni debe crearse un catálogo de categorías. Los valores posibles son los que efectivamente aparecen en los datos: `select distinct categoria from tarifas_normalizadas where categoria is not null` acotado por los peajes filtrados. El motivo es que `categoria` es texto libre que llega del archivo del proveedor (Apéndice B), y cada proveedor la escribe distinto. Consecuencias para la UI:

- En **Patrón A** (`categoria IS NULL` en todas las filas) el desplegable queda vacío. En ese caso se deshabilita el control y se muestra la ayuda `Este peaje no informa categoría (Patrón A).` en lugar de un desplegable vacío que parezca roto.
- La lista se recarga cuando cambia el filtro de peaje.
- Como es texto libre, el control es de búsqueda con autocompletado (`app-search-select`), no un `<select>` cerrado.

**Debounce.** Igual que en `pasadas-pendientes`: un `Subject<string>` con `debounceTime(300)`, `distinctUntilChanged()` y `takeUntil(destroy$)`, alimentado por `patchFilters()` con `JSON.stringify(this.filters)`. Cada emisión resetea `page = 1` y recarga.

---

## 5. Tabla principal (familias de tarifa)

**Qué es una fila.** Una fila del padre es **un nivel de tarifa**, es decir una fila de `tarifas_normalizadas` (`estación × categoría × importe`). La *familia* — todos los niveles de esa estación — aparece al expandir (§6). Esto es deliberado: el listado paginado tiene que poder filtrarse por `status` y por `diagnostico`, que son atributos del nivel, y el analista muchas veces llega buscando "todo lo que quedó `PENDIENTE`", no una estación en particular.

Se usa una `<table class="at__table">` nativa, **no** `app-data-table`, por el mismo motivo que en `pasadas-pendientes`: la tabla compartida no soporta filas hijas expandibles. La `app-data-table` se usa anidada dentro del detalle.

| # | Columna | Clave | Alineación | Sortable | Formato |
|---|---|---|---|---|---|
| 0 | (expander) | — | — | no | `.at__expand` con chevron |
| 1 | Estación | `estacion_nombre` | izq. | sí | texto |
| 2 | Categoría | `categoria` | izq. | sí | texto; `—` cuando es `null` |
| 3 | Importe | `importe` | der. | sí | `number: '1.2-2'`, clase `.at__price` |
| 4 | Casos | `cases` | der. | sí | `number` |
| 5 | Multiplicador | `multiplicador` | der. | sí | `number: '1.2-3'` + sufijo `×` |
| 6 | Desvío horario | `desvio` | der. | sí | `number: '1.2-2'`; `—` si es `null` |
| 7 | Diagnóstico | `diagnostico` | izq. | sí | badge fijo (§9) |
| 8 | Status | `status` | izq. | sí | badge dinámico (§9) |
| 9 | Patrón | `patron` | centro | no | badge fijo `A` / `B`, derivado de `categoria == null` |
| 10 | Acciones | — | der. | no | `Clasificar` (expande) · `Comparar` (abre diálogo) |

**Orden por defecto:** `{ key: 'cases', direction: 'desc' }` → `p_sort = 'cases:desc'`. Razón: el analista debería resolver primero lo que más pasadas afecta. En el dataset de referencia esto pone arriba a `ZARATE - RUTA 9 KM. 95` con 355 y 189 casos, que son las dos familias con más peso de todo el conjunto.

**Alternador de orden:** mismo comportamiento que `PasadasPendientesListComponent.onSort(key)` — si se toca la columna activa se invierte la dirección; si se toca otra, arranca en `desc`; en ambos casos `page = 1` y recarga.

**Paginación:** footer manual `.at__pager` idéntico al de `pasadas-pendientes` (selector de filas 25/50/100, rango `x–y de N`, botones `Anterior` / `Siguiente`). `pageSize` inicial **50**.

**Estados y copy real (en español, sin disculpas y sin jerga técnica):**

| Estado | Dónde | Copy |
|---|---|---|
| Cargando | `<td colspan="11" class="at__empty">` | `Cargando familias de tarifa…` |
| Vacío con filtros | ídem | `No hay familias de tarifa con estos filtros.` |
| Vacío sin filtros y sin datos | ídem | `Todavía no se generaron familias de tarifa. Cargá pasadas desde el asistente o usá Recalcular.` |
| Todo clasificado | ídem, cuando el filtro es `status = PENDIENTE` y no hay resultados | `No queda ninguna familia pendiente para estos filtros.` |
| Error de carga | `<p class="at__error" role="alert">` sobre la tabla | `No se pudieron cargar las familias de tarifa. Reintentá o quitá filtros.` |
| Error al confirmar | `<p class="at__error" role="alert">` dentro del detalle | `No se pudo guardar la clasificación. Revisá la conexión y volvé a confirmar.` |
| Detalle vacío | dentro de `at__detail` | `Esta estación tiene un solo nivel de tarifa.` |

El contenedor de la tabla lleva `[attr.aria-busy]="loading"`, igual que `.pp__table-wrap`.

---

## 6. Fila expandida (`at__detail`)

### 6.1 Comportamiento de apertura

Se copia el patrón de `pasadas-pendientes`, que es el **único precedente de expand-in-place del repositorio** (no existe ningún constructo tipo `node-children` en el código):

```124:127:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.html
          <tr class="pp__detail" *ngIf="expandedId === group.estacion_id">
            <td colspan="7">
              <div class="pp__detail-inner">
                <p class="pp__detail-title">Pasadas de {{ group.estacion_nombre }}</p>
```

- Un único campo `expandedId: string | null` guarda el `tarifa_normalizada_id` de la fila abierta ⇒ **solo una fila abierta a la vez**. Abrir otra cierra la anterior sin animación de colapso.
- `toggleExpand(row)` alterna: si `expandedId === row.id` llama a `collapseDetail()`, si no asigna y dispara la carga del detalle.
- Tras cada recarga del listado, si `expandedId` ya no está entre las filas visibles se llama a `collapseDetail()` (misma guarda que `loadRows()` en `pasadas-pendientes`).
- La fila hija es `<tr class="at__detail"><td colspan="11">`. El `colspan` debe seguir a la cantidad de `<th>`: **11** con la columna de expander incluida.
- Toda la `<tr>` padre es clickeable (`(click)="toggleExpand(row)"`) y la celda de acciones frena la propagación con `(click)="$event.stopPropagation()"`, igual que `.pp__actions`.

Chevron:

```90:95:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.html
                <i
                  class="fas"
                  [class.fa-chevron-right]="expandedId !== group.estacion_id"
                  [class.fa-chevron-down]="expandedId === group.estacion_id"
                  aria-hidden="true"
                ></i>
```

El botón que lo contiene lleva `[attr.aria-expanded]` y un `[attr.aria-label]` que cambia entre `Ver niveles de tarifa` y `Ocultar niveles de tarifa`.

### 6.2 Qué muestra

Al expandir un nivel se pide **la familia completa de esa estación**: se vuelve a llamar a `peajes_listar_tarifas_normalizadas` con `p_filtros = { estacion_ids: [row.estacion_id], categorias: row.categoria ? [row.categoria] : null }`, `p_page_size` alto (100 alcanza: la familia más grande del dataset de referencia tiene 17 niveles) y `p_sort = 'importe.asc'`.

El detalle tiene tres bloques verticales:

1. **Encabezado de familia** — `Escalera tarifaria · <estación> · Patrón A · 5 niveles · 713 casos`, en `.at__detail-title` (mismo tratamiento tipográfico que `.pp__detail-title`).
2. **Escalera tarifaria** — el elemento signature (§2.4) con los botones de status por nivel (§7). Es una `app-data-table` anidada con `[exportEnabled]="false"`, columnas propias y plantillas `appDataTableColumn` para cada celda, igual que en `pasadas-pendientes`. Como el detalle nunca supera unas decenas de filas, se usa `[clientFilter]="false"` y se le pasa la familia completa con `[total]` igual a su largo; `(sortChange)` y `(pageChange)` se cablean igual que `onDetailSort` / `onDetailPage`.
3. **Barra de acciones de familia** — `Confirmar N niveles`, `Es variación por categoría`, `Marcar para revisar`, `Comparar con grupos similares`.

Columnas de la tabla anidada:

| Clave | Etiqueta | Ancho | Plantilla |
|---|---|---|---|
| `importe` | `Importe` | `8rem` | `.at__price` + `number: '1.2-2'` |
| `cases` | `Casos` | `5rem` | `number` |
| `multiplicador` | `Mult.` | `10rem` | número + **barra de multiplicador** |
| `franja` | `Franja horaria` | `14rem` | **riel de 24 h** + `media X h · desvío Y` |
| `diagnostico` | `Diagnóstico` | `9rem` | badge fijo |
| `status` | `Clasificación` | `auto` | **grupo de botones de status** (§7) |

---

## 7. Entrada de usuario por botones de status

Este es el corazón de la pantalla y el pedido literal del usuario: *que la carga sea fácil, "como con los botones de status"*. No hay formulario, no hay `<select>`, no hay modal para clasificar.

### 7.1 Construcción del grupo de botones

Para cada nivel se renderiza un grupo con:

- los códigos de `tarifas_status_catalogo` del `peaje_id` de esa estación, **ordenados por `orden` ascendente**;
- más el universal `POSIBLE_HORARIO` si el catálogo del peaje no lo define ya;
- `PENDIENTE` **no** se dibuja como botón: es la ausencia de decisión. Se representa como "ningún botón seleccionado" y se comunica con el texto `Sin clasificar` a la izquierda del grupo.

Cada botón usa `etiqueta` como texto y `color` como color de estado seleccionado. No hay `switch` sobre `'PICO'` / `'NO_PICO'` en ninguna parte del componente: con dos códigos se dibujan dos botones, con cinco se dibujan cinco. **N niveles × M códigos se resuelven con el mismo componente**, sin variantes: el grupo es un `*ngFor` sobre el catálogo, y la escalera es un `*ngFor` sobre los niveles.

Cuando el catálogo del peaje tiene más de cuatro códigos, el grupo pasa a `flex-wrap: wrap` en vez de convertirse en otro control. Ningún caso del dataset de referencia llega ahí (los peajes reales tienen 2), pero la regla evita que un peaje nuevo rompa el layout.

### 7.2 Sugerencia automática por precio ascendente

Al abrir la familia, el componente **preselecciona** una clasificación, sin persistirla:

1. Ordenar los niveles por `importe` ascendente.
2. Ordenar los códigos del catálogo por `orden` ascendente.
3. Asignar al nivel más barato el código de menor `orden`; al segundo nivel, el segundo código; y así hasta agotar los códigos. **Todos los niveles restantes reciben el último código.**
4. Los niveles cuyo `diagnostico` es `MUESTRA_INSUFICIENTE` quedan **sin preselección** (`PENDIENTE`): sugerir sobre una muestra que el propio algoritmo declaró insuficiente sería fabricar confianza.

Con el catálogo del dataset de referencia (`NO_PICO` con `orden` 1, `PICO` con `orden` 2) la regla se lee así: *el nivel más barato es no pico, el resto es pico.*

Honestidad sobre el alcance de la sugerencia, verificada contra el dataset (ver Apéndice D §4): en `ZARATE - RUTA 9 KM. 95` la regla reproduce exactamente la clasificación esperada (1.500 → `NO_PICO`; 3.000 / 4.500 / 6.000 / 7.500 → `PICO`). En `AGÜERO - AU.RICCHIERI KM 15,80`, con 17 niveles y clasificaciones intercaladas, la regla acierta parcialmente. **Por eso la sugerencia es editable y por eso existe la pantalla:** la propuesta ahorra tiempo en el caso frecuente y el humano corrige el caso difícil.

La sugerencia se muestra como preselección normal (botón activo) más una nota discreta arriba de la escalera: `Propuesta automática por precio. Ajustá lo que no corresponda y confirmá.` Al tocar cualquier botón la nota se reemplaza por `Editado.` para que se vea que la propuesta dejó de estar intacta.

### 7.3 Estado local vs. persistencia

Distinción deliberada:

- **La selección es local e instantánea.** Tocar un botón solo cambia un `Map<string, string>` (`tarifa_normalizada_id → codigo`) en el componente. No hay round-trip, no hay spinner, no hay forma de fallar. Esta es la parte "optimista".
- **La persistencia es explícita y con estado pendiente.** `Confirmar N niveles` es lo único que escribe. Mientras corre: el botón se deshabilita y su texto pasa a `Confirmando…`; los botones de status del bloque quedan `disabled` (no se ocultan, para que no salte el layout); al volver, el badge de `status` de las filas padre se actualiza con la respuesta del servidor, no con lo que asumimos.
- Si falla, **no** se revierte la selección local: se muestra el error y se deja el botón `Confirmar` habilitado para reintentar. Revertir borraría el trabajo del usuario por un problema de red.
- Un contador vivo `3 de 5 sin confirmar` acompaña al botón para que se note que hay cambios sin guardar. Al intentar cerrar la fila expandida con cambios sin confirmar se muestra `Tenés 3 niveles sin confirmar.` con las opciones `Confirmar` y `Descartar`.

### 7.4 Ensamblado de `p_asignaciones`

`Confirmar N niveles` arma el arreglo a partir del `Map` local, **excluyendo** los niveles sin selección:

```json
[
  { "tarifa_normalizada_id": "9f1c…", "status_codigo": "NO_PICO" },
  { "tarifa_normalizada_id": "a2d7…", "status_codigo": "PICO" },
  { "tarifa_normalizada_id": "b8e0…", "status_codigo": "PICO" }
]
```

y llama a `peajes_confirmar_status_tarifa(p_asignaciones)` en **una sola invocación** para toda la familia. Una llamada por familia, no una por nivel: el backend puede así marcar `confirmado_manual` y propagar a `pasadas.tarifa_status` de forma atómica (ver Apéndice A). La clave del JSON es `status_codigo` (contrato de Apéndice A §7), no `status`.

### 7.5 Las dos acciones secundarias de un toque

Ambas mapean a `peajes_marcar_diagnostico_tarifa(p_tarifa_normalizada_id, p_diagnostico)`:

| Botón | `p_diagnostico` | Cuándo lo usa el analista | Alcance |
|---|---|---|---|
| `Es variación por categoría` | `CATEGORIA` | El salto de precio es por tipo de vehículo, no por horario | Toda la familia: una llamada por nivel, en secuencia; el botón queda en `Marcando…` hasta que terminan todas |
| `Marcar para revisar` | `REVISAR` | Los datos no alcanzan o hay algo raro que requiere mirar el archivo original | Ídem |

Ninguna de las dos escribe `status`: dejan la familia como estaba y solo cambian el `diagnostico`, que es lo que el analista está corrigiendo. Después de ejecutarse, la familia se recarga y su badge de diagnóstico cambia.

### 7.6 Mock de la superficie

```
┌ ESCALERA TARIFARIA · ZARATE - RUTA 9 KM. 95 · Patrón A · 5 niveles · 713 casos ────────┐
│ Propuesta automática por precio. Ajustá lo que no corresponda y confirmá.              │
│                                                                                        │
│  IMPORTE     CASOS   MULT.   EVIDENCIA                             CLASIFICACIÓN       │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  1.500,00      114   1,00×   ▉                                     ┌──────┬──────────┐ │
│                              0├───────────────────────────┤23      │ Pico │▪ No pico │ │
│                              media 13,5 h · desvío 7,49            └──────┴──────────┘ │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  3.000,00       20   2,00×   ▉▉▉▉                                  ┌──────┬──────────┐ │
│                              3├──────────────────────┤21           │▪Pico │  No pico │ │
│                              media 14,6 h · desvío 4,73            └──────┴──────────┘ │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  4.500,00       35   3,00×   ▉▉▉▉▉▉                                ┌──────┬──────────┐ │
│                              0├───────────────────────────┤23      │▪Pico │  No pico │ │
│                              media 13,7 h · desvío 6,40            └──────┴──────────┘ │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  6.000,00      355   4,00×   ▉▉▉▉▉▉▉▉                              ┌──────┬──────────┐ │
│                              0├───────────────────────────┤23      │▪Pico │  No pico │ │
│                              media 13,1 h · desvío 5,98            └──────┴──────────┘ │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  7.500,00      189   5,00×   ▉▉▉▉▉▉▉▉▉▉                            ┌──────┬──────────┐ │
│                              0├───────────────────────────┤23      │▪Pico │  No pico │ │
│                              media 11,8 h · desvío 7,24            └──────┴──────────┘ │
│ ───────────────────────────────────────────────────────────────────────────────────── │
│  5 de 5 sin confirmar                                                                  │
│  [ Confirmar 5 niveles ]  [ Es variación por categoría ]  [ Marcar para revisar ]      │
│  [ Comparar con grupos similares ]                                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

`▪` marca el botón seleccionado. Los cinco rieles casi completos y el multiplicador que escala 1×→5× es exactamente la lectura que lleva al analista a tocar `Es variación por categoría` en vez de clasificar por horario — y ese es el trabajo que la escalera hace en un segundo.

Copy de botones (verbo activo, y el mismo verbo en el resultado):

| Botón | Estado en curso | Confirmación |
|---|---|---|
| `Confirmar 5 niveles` | `Confirmando…` | `5 niveles confirmados` |
| `Es variación por categoría` | `Marcando…` | `Marcada como variación por categoría` |
| `Marcar para revisar` | `Marcando…` | `Marcada para revisar` |
| `Recalcular` | `Recalculando…` | `Tarifas recalculadas` |

---

## 8. Diálogo de confirmación / comparación

### 8.1 Elección entre los dos precedentes

El repositorio tiene dos superficies flotantes:

| Precedente | Forma | Uso actual |
|---|---|---|
| `EstacionUbicacionDrawerComponent` (`eud__`) | panel lateral `width: min(400px, 100%)` | formulario de 4 campos |
| `DialogComponent` (`app-dialog`) | modal centrado, `size: 'md' \| 'lg'` | altas rápidas de catálogo en Paso 5 |

**Se elige `app-dialog` con `size="lg"`.** Motivo concreto: el contenido es una **comparación numérica de dos tablas lado a lado** (los niveles de esta familia y los de las familias similares). En 400 px de ancho eso obliga a scroll horizontal y anula la comparación, que es la única razón por la que el diálogo existe. El drawer está dimensionado para formularios angostos y no para tablas. Además `app-dialog` ya trae el eyebrow + título que se necesita para contextualizar la estación.

### 8.2 Contrato

Componente propio `TarifaCompararDialogComponent`, que envuelve a `app-dialog`:

| Entrada / Salida | Tipo | Descripción |
|---|---|---|
| `@Input() open` | `boolean` | visibilidad |
| `@Input() familia` | `TarifaFamilia \| null` | familia de origen: estación, categoría, niveles |
| `@Input() similares` | `TarifaGrupoSimilar[]` | resultado de `peajes_grupos_similares_tarifa` |
| `@Input() loading` | `boolean` | mientras se resuelve la RPC de similares |
| `@Input() saving` | `boolean` | mientras corre la aplicación masiva |
| `@Input() error` | `string \| null` | mensaje de error |
| `@Input() tolerancia` | `number` | valor enviado como `p_tolerancia`, editable en el diálogo |
| `@Output() closed` | `void` | cierre |
| `@Output() toleranciaChange` | `number` | re-consulta de similares |
| `@Output() aplicarMasivo` | `TarifaAsignacion[]` | asignaciones a enviar a `peajes_confirmar_status_tarifa` |

`app-dialog` ya cumple el contrato de accesibilidad base:

```6:14:ibarra-app/src/app/components/shared/dialog/dialog.component.html
  <section
    #panel
    class="app-dialog"
    [class.app-dialog--lg]="size === 'lg'"
    role="dialog"
    aria-modal="true"
    [attr.aria-labelledby]="title ? 'app-dialog-title' : null"
    (click)="$event.stopPropagation()"
  >
```

y maneja Escape en el propio componente:

```50:55:ibarra-app/src/app/components/shared/dialog/dialog.component.ts
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) {
      this.close();
    }
  }
```

**Lo que `app-dialog` no hace y este componente debe agregar** (dos huecos reales, no supuestos):

1. **No mueve el foco al abrir ni lo devuelve al cerrar.** `TarifaCompararDialogComponent` debe guardar `document.activeElement` antes de abrir, enfocar el primer control del diálogo al abrir, y restaurar el foco al elemento guardado al cerrar.
2. **No atrapa el foco (`focus trap`).** Se implementa un `keydown.tab` en el panel que cicla entre el primer y el último elemento enfocable.

Además, `id="app-dialog-title"` está fijo en el template compartido: **no puede haber dos `app-dialog` abiertos a la vez** en esta pantalla, o el `aria-labelledby` apunta a un id duplicado. Como el diálogo de comparación y el de confirmación de `Recalcular` son mutuamente excluyentes por diseño, alcanza con no abrirlos simultáneamente; queda anotado como restricción, no como bug a arreglar acá.

### 8.3 Contenido

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AUDITORÍA DE TARIFAS                                                    [×]  │
│ Comparar ZARATE - RUTA 9 KM. 95                                              │
│ Revisá si otras estaciones tienen la misma escalera de precios.              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ESTA FAMILIA                                                                 │
│  1.500,00 · 114 casos · 1,00×  ▸ No pico                                     │
│  3.000,00 ·  20 casos · 2,00×  ▸ Pico                                        │
│  4.500,00 ·  35 casos · 3,00×  ▸ Pico                                        │
│  6.000,00 · 355 casos · 4,00×  ▸ Pico                                        │
│  7.500,00 · 189 casos · 5,00×  ▸ Pico                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ GRUPOS SIMILARES        Tolerancia [ 0,05 ]                                  │
│  ☑ LAGOS - RUTA 9 KM. 272     5 niveles · 178 casos · ratio 5,00 · sin clasif.│
│  ☑ LARENA - RUTA 8 KM 65      4 niveles · 106 casos · ratio 5,00 · sin clasif.│
│  ☐ MONTE GRANDE - AU. EZE-CAÑ 4 niveles ·   9 casos · ratio 5,00 · 2 pendient.│
│                                                                              │
│  ⓘ La búsqueda de grupos similares compara solo los dos niveles extremos      │
│    (más barato y más caro) de cada familia. Dos familias con el mismo ratio   │
│    pero distinta cantidad de niveles intermedios aparecen como similares.     │
│    Revisá cada una antes de aplicar.                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                          [ Cancelar ]  [ Aplicar a 2 estaciones ]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- El bloque de similares se llena con `peajes_grupos_similares_tarifa(p_tarifa_normalizada_id, p_tolerancia)`. `tolerancia` arranca en el valor por defecto que fije Apéndice A y es editable; cambiarla re-consulta.
- **Limitación documentada, visible en la UI, no escondida en un doc:** el bloque `ⓘ` de arriba es copy literal a renderizar. La comparación por extremos es exactamente lo que hace la RPC y el usuario tiene que saberlo antes de aplicar en masa.
- `Aplicar a N estaciones` toma la clasificación de *esta* familia y la proyecta sobre las familias tildadas, emparejando niveles por posición en el orden ascendente de precio. Emite un único arreglo `p_asignaciones` con todos los niveles de todas las familias seleccionadas.
- Si una familia similar tiene distinta cantidad de niveles, se muestra `distinta cantidad de niveles` junto a su nombre y su casilla arranca **desmarcada**; se puede marcar igual, y entonces se emparejan solo los niveles que existen en ambas.
- Botón secundario `Cancelar`, primario `Aplicar a N estaciones` (con `N` vivo). En curso: `Aplicando…`.

---

## 9. Badges dinámicos

Tres badges conviven y solo uno es dinámico. La distinción tiene que ser evidente en el código, no solo en la cabeza del que lo escribe.

| Badge | Origen de color y texto | Cuándo cambia |
|---|---|---|
| `diagnostico` | mapa **constante** en TypeScript, seis entradas | nunca en runtime |
| `patron` | derivado: `categoria == null ? 'A' : 'B'` | nunca en runtime |
| `status` | **`tarifas_status_catalogo` cargado por peaje** | cada vez que cambia el catálogo |

### 9.1 Badges fijos

Se resuelven con un objeto literal y clases CSS, sin lógica:

| `diagnostico` | Etiqueta | Clase | Tono |
|---|---|---|---|
| `MUESTRA_INSUFICIENTE` | `Muestra insuficiente` | `at__badge--pending` | ámbar |
| `TARIFA_UNICA` | `Tarifa única` | `at__badge--neutral` | gris |
| `CATEGORIA` | `Categoría` | `at__badge--info` | azul `--at-signal` |
| `POSIBLE_HORARIO` | `Posible horario` | `at__badge--info` | azul `--at-signal` |
| `REVISAR` | `Revisar` | `at__badge--danger` | rojo `--at-danger` |
| `CONFIRMADO` | `Confirmado` | `at__badge--ok` | verde `--at-ok` |

La forma del badge es la de `pasadas-pendientes`, incluida la bolita de `::before`:

```176:203:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.css
.pp__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
}

.pp__badge::before {
  content: '';
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: currentColor;
}

.pp__badge--ok {
  color: #065f46;
  background: color-mix(in srgb, var(--pp-ok) 18%, #fff);
}

.pp__badge--pending {
  color: #92400e;
  background: color-mix(in srgb, var(--pp-pending) 22%, #fff);
}
```

### 9.2 Badge dinámico de `status`

Componente `TarifaStatusBadgeComponent` (`<app-tarifa-status-badge>`), con entradas `codigo: string | null` y `catalogo: TarifaStatusCatalogo[]`. Resuelve así, en orden:

1. **`codigo` nulo o `'PENDIENTE'`** → etiqueta `Sin clasificar`, tono ámbar `--at-pending`. Es un estado esperado, no un error.
2. **Código presente en `catalogo`** → `etiqueta` del catálogo, y color de fondo `color-mix(in srgb, {color} 18%, #fff)` con el `color` del catálogo aplicado por `[style.--at-badge-tint]`. Las clases CSS no se generan a partir del código: el color entra como custom property, para no depender de que exista una clase `at__badge--PICO`.
3. **Catálogo todavía no cargado** → mismo texto crudo del código pero en tono neutro y con `[attr.aria-busy]="true"`. No se muestra un esqueleto ni se oculta la celda: se muestra el dato que sí tenemos.
4. **Código desconocido para el catálogo cargado** → **pastilla gris con el código crudo en monoespaciada** (`.at__code`) y `title="Código no definido en el catálogo de este peaje"`. Nunca una celda vacía, nunca un color inventado, nunca una excepción.

El punto 4 es el requisito duro: si alguien agrega un código en la base y olvida cargarlo en el catálogo, la pantalla sigue siendo usable y el problema queda visible.

Contraste: el color de `tarifas_status_catalogo.color` se usa solo como **tinte de fondo** (18–22 % sobre blanco, igual que los badges existentes) y el texto va en `--at-ink`. Así un color mal elegido en el catálogo degrada la estética pero nunca el contraste del texto.

---

## 10. Indicador de progreso por concesión

Debajo del encabezado y **sobre** los filtros, un riel de una línea por peaje con familias en el resultado actual:

```
CORREDORES VIALES SA   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  53 de 64 clasificadas · 11 pendientes
RUTAS SUR ATLANTICO    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  34 de 38 clasificadas ·  4 pendientes
CORREDOR VIAL 5        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  13 de 16 clasificadas ·  3 pendientes
CONEXION ALTO DELTA     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   1 de  1 clasificada  ·  0 pendientes  ✓
```

Responde a la única pregunta que la tabla paginada no puede responder: *¿cuánto falta?*

**Cómo se obtiene sin RPC nueva.** Por cada peaje presente en los filtros, dos llamadas a `peajes_listar_tarifas_normalizadas` con `p_page_size: 1`, leyendo solo el `total`:

- total de familias: `p_filtros = { ...filtros, peaje_ids: [id] }`
- pendientes: `p_filtros = { ...filtros, peaje_ids: [id], status: ['PENDIENTE'] }`

Se ejecutan en paralelo con `Promise.all`, se cachean por combinación de filtros y se refrescan después de cada confirmación o recálculo. Si Apéndice A prefiere devolver un bloque `resumen` en la propia RPC de listado, esta pantalla lo consume y descarta las llamadas extra — queda como nota de handoff para el agente 01.

Cuando un peaje llega a cero pendientes, la línea muestra `✓` y el texto `Concesión completa.` en `--at-ok`. Sin animación, sin confeti: es una lista de trabajo.

Al alcanzar cero pendientes en **todos** los peajes visibles, el riel se reemplaza por una sola línea: `No queda ninguna familia pendiente con estos filtros.`

---

## 11. Acción "Recalcular"

`pg_cron` **no está instalado**, así que no hay recálculo programado: el disparo es manual y la pantalla es su único punto de entrada.

- **Ubicación:** en `.at__header-actions`, a la derecha del encabezado, después de los enlaces de navegación, con clase `.at__btn` (secundario, no primario — no es la acción principal de la pantalla). Icono `fas fa-rotate`.
- **Habilitación:** solo cuando hay exactamente **un** peaje en el filtro, porque la RPC recibe `p_peaje_id`. Con "Todos" o con varios seleccionados el botón queda `disabled` y con `title="Elegí un peaje para recalcular"`.
- **Confirmación:** `app-dialog` `size="md"`, eyebrow `Auditoría de tarifas`, título `Recalcular tarifas de CORREDORES VIALES SA`, descripción: `Se vuelven a detectar las familias de tarifa a partir de las pasadas actuales. Las clasificaciones confirmadas a mano se conservan.` Acciones: `Cancelar` y `Recalcular`.

  La frase sobre las clasificaciones manuales solo se muestra si Apéndice A confirma el comportamiento de `confirmado_manual`; si no, se cambia por el texto real. **No prometer en la UI algo que el SQL no garantice.**
- **Feedback de larga duración:** al confirmar, el diálogo se cierra, el botón del encabezado pasa a `Recalculando…` con `[disabled]="true"`, y aparece bajo el encabezado una franja `.at__notice` con el texto `Recalculando tarifas. Puede tardar algunos minutos con muchas pasadas. Podés seguir mirando el listado; los resultados se actualizan al terminar.` La tabla **no** se bloquea.
- **Al terminar:** la franja se reemplaza por `Tarifas recalculadas.` durante unos segundos y se recargan listado y progreso. Si falla: `No se pudo recalcular. Reintentá en unos minutos.` en `.at__error` con `role="alert"`.
- El botón permanece deshabilitado hasta que la promesa se resuelve, para evitar dobles disparos.

---

## 12. Componentes y archivos a crear

Todo bajo `ibarra-app/src/app/components/peajes/auditoria-tarifas/`.

| Archivo | Responsabilidad | Dueño |
|---|---|---|
| `auditoria-tarifas.routes.ts` | fragmento de rutas (`PEAJES_AUDITORIA_TARIFAS_ROUTES`) | 02 (crea) / 05 (integra) |
| `auditoria-tarifas-list.component.ts` | contenedor: filtros, carga, orden, paginación, `expandedId`, progreso, recálculo | 02 |
| `auditoria-tarifas-list.component.html` | tabla padre + fila `at__detail` + montaje de diálogos | 02 |
| `auditoria-tarifas-list.component.css` | bloque `at__` completo | 02 |
| `tarifa-familia-panel.component.ts/.html/.css` | escalera tarifaria de una familia (barra de multiplicador + riel horario) y barra de acciones | 02 |
| `tarifa-status-buttons.component.ts/.html/.css` | grupo de botones de status de un nivel: `radiogroup`, roving tabindex, sugerencia | 02 |
| `tarifa-status-badge.component.ts/.css` | badge dinámico con fallback (§9.2) | 02 |
| `tarifa-comparar-dialog.component.ts/.html/.css` | diálogo de comparación con foco atrapado y grupos similares | 02 |
| `mocks/auditoria-tarifas.mock.ts` | implementación tipada en memoria del contrato, con datos del dataset de referencia | 02 |
| `*.spec.ts` | ver Apéndice D §6 | 02 |

Fuera de esa carpeta:

| Archivo | Cambio | Dueño |
|---|---|---|
| `src/app/components/peajes/models/auditoria-tarifas.contracts.ts` | interfaz de servicio + token + tipos de fila/filtro | 00 / 01 (**no** 02) |
| `src/app/components/peajes/models/index.ts` | re-export del contrato | 00 / 01 |
| `src/app/components/peajes/services/peajes-auditoria-tarifas-supabase.service.ts` | implementación real contra las RPC | 01 (F14-2) |
| `src/app/components/peajes/peajes.providers.ts` | `PEAJES_AUDITORIA_TARIFAS_PROVIDERS` | 05 |
| `src/app/components/peajes/peajes.routes.ts` | spread del fragmento | 05 |
| `src/app/guards/permission.guard.ts` | entrada en `ROUTE_PERMISSIONS` | 05 |
| `src/app/components/peajes/peajes-home.component.html` | tarjeta nueva | 05 |

### 12.1 Fragmento de rutas

Se copia la forma de `pasadas-pendientes.routes.ts`:

```1:11:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes.routes.ts
import { Routes } from '@angular/router';
import { PasadasPendientesListComponent } from './pasadas-pendientes-list.component';
import { PEAJES_PASADAS_PROVIDERS } from '../peajes.providers';

export const PEAJES_PASADAS_PENDIENTES_ROUTES: Routes = [
  {
    path: 'pasadas-pendientes',
    providers: PEAJES_PASADAS_PROVIDERS,
    children: [{ path: '', component: PasadasPendientesListComponent }],
  },
];
```

El equivalente usa `path: 'auditoria-tarifas'` y un `PEAJES_AUDITORIA_TARIFAS_PROVIDERS` que reutiliza los providers existentes y suma el nuevo token:

```ts
export const PEAJES_AUDITORIA_TARIFAS_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useExisting: PeajesAuditoriaTarifasSupabaseService },
];
```

Se necesita `PEAJES_CATALOGO_SERVICE` para poblar los filtros de peaje y estación, igual que hace `PEAJES_PASADAS_PROVIDERS`.

### 12.2 Entrada en `ROUTE_PERMISSIONS`

En `permission.guard.ts`, dentro del bloque de peajes:

```ts
'/peajes/auditoria-tarifas': { module: 'peajes', action: 'read' },
```

El guard igual resolvería por prefijo (`/peajes` está mapeado y el fallback ordena por longitud), pero la entrada explícita mantiene la convención del bloque, donde cada pantalla figura por separado.

### 12.3 Tarjeta en `peajes-home`

La plantilla es literalmente la tarjeta existente de Pasadas:

```34:39:ibarra-app/src/app/components/peajes/peajes-home.component.html
    <a routerLink="/peajes/pasadas" class="peajes-home__card">
      <div class="peajes-home__icon"><i class="fas fa-table" aria-hidden="true"></i></div>
      <h2>Pasadas</h2>
      <p>Consultá, filtrá y gestioná pasadas guardadas con auditoría de carga.</p>
      <span class="peajes-home__link">Abrir gestión</span>
    </a>
```

Tarjeta a agregar, después de *Ubicaciones pendientes* y antes de *Plantillas y algoritmos*:

```html
    <a routerLink="/peajes/auditoria-tarifas" class="peajes-home__card">
      <div class="peajes-home__icon"><i class="fas fa-chart-line" aria-hidden="true"></i></div>
      <h2>Auditoría de tarifas</h2>
      <p>Clasificá los niveles de precio detectados por estación como pico o no pico.</p>
      <span class="peajes-home__link">Auditar tarifas</span>
    </a>
```

La grilla es `repeat(auto-fit, minmax(240px, 1fr))`, así que la sexta tarjeta entra sin tocar el CSS.

> Las tres modificaciones de §12.2, §12.3 y el spread en `peajes.routes.ts` son **alcance del agente 05** según `AGENTS.md`. El agente 02 las deja anotadas en `docs/session-handoff.md` y no edita esos archivos.

---

## 13. Servicios y contratos

### 13.1 Patrón de token del repositorio

El repo no usa `InjectionToken<T>`: usa constantes string y `@Inject(...)` en el constructor.

```261:266:ibarra-app/src/app/components/peajes/models/peajes-services.contracts.ts
/** Token de inyección sugerido para mocks vs real (02/03/01). */
export const PEAJES_CATALOGO_SERVICE = 'PEAJES_CATALOGO_SERVICE';
export const PEAJES_CARGA_SERVICE = 'PEAJES_CARGA_SERVICE';
export const PEAJES_PLANTILLAS_SERVICE = 'PEAJES_PLANTILLAS_SERVICE';
export const PEAJES_MOTOR_TRANSFORMACION = 'PEAJES_MOTOR_TRANSFORMACION';
export const PEAJES_PASADAS_SERVICE = 'PEAJES_PASADAS_SERVICE';
```

y el consumidor inyecta así, **sin `inject()` y sin signals**:

```93:96:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.ts
  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_PASADAS_SERVICE) private readonly pasadas: PeajesPasadasService
  ) {}
```

`AuditoriaTarifasListComponent` sigue exactamente esa forma: campos de clase planos (`rows`, `total`, `loading`, `error`, `page`, `pageSize`, `sort`, `expandedId`, …), `Subject` con `debounceTime(300)` para filtros, `firstValueFrom` sobre los `Observable` del servicio. **No introducir signals en esta pantalla**: sería el único componente de peajes que los usa.

### 13.2 Contrato propuesto

```ts
// src/app/components/peajes/models/auditoria-tarifas.contracts.ts

export type TarifaDiagnostico =
  | 'MUESTRA_INSUFICIENTE'
  | 'TARIFA_UNICA'
  | 'CATEGORIA'
  | 'POSIBLE_HORARIO'
  | 'REVISAR'
  | 'CONFIRMADO';

export type TarifaStatusTipoMeta = 'PICO' | 'NO_PICO' | 'NEUTRO';

export interface TarifaStatusCatalogo {
  peaje_id: string;
  codigo: string;
  etiqueta: string;
  color: string;
  tipo_meta: TarifaStatusTipoMeta;
  orden: number;
}

/** Una fila de tarifas_normalizadas, tal como la devuelve la RPC de listado.
 *  Las claves coinciden con Apéndice A §9.1 (`cases`, `desvio`, …).
 *  Las etiquetas de UI siguen en español (Casos, Desvío horario). */
export interface TarifaNormalizadaRow {
  id: string;
  peaje_id: string;
  peaje_nombre: string | null;
  estacion_id: string;
  estacion_nombre: string;
  /** null ⇒ Patrón A. */
  categoria: string | null;
  importe: number;
  cases: number;
  importe_base: number;
  multiplicador: number;
  hora_min: number | null;
  hora_max: number | null;
  hora_media: number | null;
  desvio: number | null;
  muestra_confiable: boolean;
  diagnostico: TarifaDiagnostico;
  /** Entrada del usuario. 'PENDIENTE' mientras no se clasifica. */
  status: string;
  confirmado_manual: boolean;
}

export interface TarifasNormalizadasFilters {
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  peaje_ids?: string[];
  estacion_ids?: string[];
  categorias?: string[];
  diagnosticos?: TarifaDiagnostico[];
  status?: string[];
  /** 'A' | 'B' | null (todos). */
  patron?: 'A' | 'B' | null;
  solo_muestra_confiable?: boolean;
  q_estacion?: string | null;
}

export interface TarifasNormalizadasListParams {
  filters?: TarifasNormalizadasFilters;
  page?: number;
  pageSize?: number;
  /** Formato 'columna:asc' | 'columna:desc' — debe coincidir con p_sort de Apéndice A (`cases:desc`). */
  sort?: string;
}

export interface TarifasNormalizadasListResult {
  rows: TarifaNormalizadaRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TarifaAsignacion {
  tarifa_normalizada_id: string;
  /** Clave del payload RPC = status_codigo (Apéndice A §7). */
  status_codigo: string;
}

export interface TarifaGrupoSimilar {
  estacion_id: string;
  estacion_nombre: string;
  categoria: string | null;
  niveles: number;
  cases: number;
  importe_min: number;
  importe_max: number;
  ratio: number;
  pendientes: number;
}

export interface PeajesAuditoriaTarifasService {
  listar(params: TarifasNormalizadasListParams): Observable<TarifasNormalizadasListResult>;
  listarStatusCatalogo(peajeId: string): Observable<TarifaStatusCatalogo[]>;
  listarCategorias(peajeIds?: string[]): Observable<string[]>;
  confirmarStatus(asignaciones: TarifaAsignacion[]): Observable<{ actualizadas: number }>;
  marcarDiagnostico(
    tarifaNormalizadaId: string,
    diagnostico: TarifaDiagnostico
  ): Observable<TarifaNormalizadaRow>;
  gruposSimilares(
    tarifaNormalizadaId: string,
    tolerancia: number
  ): Observable<TarifaGrupoSimilar[]>;
  recalcular(peajeId: string): Observable<{ familias: number }>;
}

export const PEAJES_AUDITORIA_TARIFAS_SERVICE = 'PEAJES_AUDITORIA_TARIFAS_SERVICE';
```

Correspondencia uno a uno con las RPC:

| Método | RPC |
|---|---|
| `listar` | `peajes_listar_tarifas_normalizadas(p_filtros, p_page, p_page_size, p_sort)` |
| `confirmarStatus` | `peajes_confirmar_status_tarifa(p_asignaciones)` |
| `marcarDiagnostico` | `peajes_marcar_diagnostico_tarifa(p_tarifa_normalizada_id, p_diagnostico)` |
| `gruposSimilares` | `peajes_grupos_similares_tarifa(p_tarifa_normalizada_id, p_tolerancia)` |
| `recalcular` | `peajes_recalcular_tarifas(p_peaje_id)` |
| `listarStatusCatalogo` | `select` sobre `tarifas_status_catalogo` (no requiere RPC) |
| `listarCategorias` | `select distinct categoria` (no requiere RPC) |

### 13.3 Trabajo en paralelo y handoff obligatorio

`AGENTS.md` habilita el trabajo en paralelo mientras no se solapen los archivos, y establece que si el frontend necesita una capacidad de backend que todavía no existe, **construye contra un mock tipado que implemente la misma interfaz** y deja el contrato exacto anotado en `docs/session-handoff.md`.

Por lo tanto, mientras `F14-1` y `F14-2` no estén `passing`:

- El agente 02 desarrolla contra `mocks/auditoria-tarifas.mock.ts`, una clase en memoria que implementa `PeajesAuditoriaTarifasService` con `of(...)`, sembrada con las familias del dataset de referencia (`ZARATE` de 5 niveles, `AGÜERO` de 17 niveles, y al menos una familia de un solo nivel) para que la escalera y la sugerencia se prueben con datos reales.
- El mock incluye un catálogo de status `[{ codigo: 'NO_PICO', etiqueta: 'No pico', color: '#10b981', tipo_meta: 'NO_PICO', orden: 1 }, { codigo: 'PICO', etiqueta: 'Pico', color: '#f59e0b', tipo_meta: 'PICO', orden: 2 }]` y **un código extra sin entrada en el catálogo** para ejercitar el fallback de §9.2.
- El agente 02 **no** edita `models/peajes-services.contracts.ts` ni `models/index.ts`.

**Nota de handoff a registrar en `docs/session-handoff.md`** (texto a copiar):

> F14-4 (agente 02) requiere de F14-0/F14-2:
> 1. `models/auditoria-tarifas.contracts.ts` con la interfaz `PeajesAuditoriaTarifasService`, el token `PEAJES_AUDITORIA_TARIFAS_SERVICE` y los tipos `TarifaNormalizadaRow`, `TarifasNormalizadasFilters`, `TarifaStatusCatalogo`, `TarifaAsignacion`, `TarifaGrupoSimilar`, re-exportados desde `models/index.ts`.
> 2. Confirmación de las claves aceptadas por `p_filtros` (§4 de este apéndice) y del formato de `p_sort`.
> 3. Confirmación de si `peajes_confirmar_status_tarifa` acepta asignaciones de varias estaciones en una sola llamada (necesario para "Aplicar a N estaciones" del diálogo de comparación).
> 4. Confirmación de si `peajes_recalcular_tarifas` respeta `confirmado_manual` (de eso depende el copy del diálogo de Recalcular).
> 5. Definición de si el listado devuelve un bloque `resumen` con pendientes por peaje; si no, la pantalla lo resuelve con dos llamadas de `p_page_size: 1`.

---

## 14. Accesibilidad y responsive

### 14.1 Teclado

- **Botones de status.** El grupo es `<div role="radiogroup" [attr.aria-label]="'Clasificación de ' + importe">` con hijos `<button type="button" role="radio" [attr.aria-checked]>`. Roving tabindex: solo el botón seleccionado (o el primero si no hay selección) tiene `tabindex="0"`; el resto `tabindex="-1"`. `ArrowRight` / `ArrowLeft` mueven **y seleccionan**; `Home` / `End` van a los extremos. Así el analista recorre toda una familia con Tab una vez y flechas dentro de cada nivel, en vez de tabular por cada botón de cada nivel.
- **Expander.** Es un `<button>` real, no un `<div (click)>`, con `[attr.aria-expanded]` y `[attr.aria-controls]` apuntando al `id` del `at__detail`. La fila entera también responde al click con el mouse, pero el teclado no depende de eso.
- **Orden de tabulación en el detalle.** El detalle se inserta inmediatamente después de la fila padre en el DOM, así que el orden natural ya es el correcto: expandir y seguir tabulando lleva a la escalera.
- **Diálogo.** Foco al primer control al abrir, trampa de foco con `Tab`/`Shift+Tab`, `Escape` cierra (ya lo hace `app-dialog`), foco restaurado al elemento que lo abrió (§8.2).
- **Ningún atajo global de teclado.** Se evaluó "1 / 2 para clasificar" y se descartó: los códigos son por peaje y dependientes de datos, un atajo numérico significaría cosas distintas en cada concesión.

### 14.2 Foco visible

Regla explícita para todo elemento interactivo del bloque, siguiendo la del drawer:

```162:165:ibarra-app/src/app/components/peajes/pasadas-pendientes/estacion-ubicacion-drawer.component.css
.eud__form input:focus {
  outline: 2px solid color-mix(in srgb, var(--eud-signal) 35%, transparent);
  border-color: var(--eud-signal);
}
```

En `at__` se aplica sobre `.at__status-btn:focus-visible`, `.at__expand:focus-visible`, `.at__sort:focus-visible` y `.at__btn:focus-visible` con `outline: 2px solid color-mix(in srgb, var(--at-signal) 45%, transparent); outline-offset: 2px;`. Nunca `outline: none` sin reemplazo.

Además, el botón de status seleccionado **no se distingue solo por color**: lleva un punto `●` antes de la etiqueta y `font-weight: 700`, para daltonismo y para pantallas a pleno sol (es una PWA de campo).

### 14.3 Movimiento reducido

Precedente del drawer:

```221:225:ibarra-app/src/app/components/peajes/pasadas-pendientes/estacion-ubicacion-drawer.component.css
@media (prefers-reduced-motion: reduce) {
  .eud__panel {
    animation: none;
  }
}
```

En `at__`, bajo `@media (prefers-reduced-motion: reduce)`: sin transición de apertura del detalle, sin transición de ancho en la barra de multiplicador ni en el riel horario, y sin `transform` en hover de botones. Los cambios de color de estado se mantienen (no son movimiento).

### 14.4 Tabla numérica ancha en móvil

Es el punto más difícil: diez columnas numéricas en un teléfono. Tres decisiones concretas, escalonadas por ancho:

**≥ 1024 px** — tabla completa, `max-width: 1200px` centrado, como `.pp`.

**720–1023 px** — el contenedor `.at__table-wrap` mantiene `overflow: auto` (igual que `.pp__table-wrap`) y se **fija la primera columna de datos**: `.at__table th:nth-child(2), .at__table td:nth-child(2) { position: sticky; left: 0; background: #fff; }`. Sin la estación fija, el scroll horizontal deja al usuario sin saber qué fila está mirando. Se ocultan `Multiplicador` y `Desvío horario` (`.at__col--secundaria { display: none; }`): son la evidencia detallada y viven en la escalera del detalle, que es donde se decide.

**< 720 px** — la tabla padre se reordena a tarjetas apiladas: cada fila pasa a `display: grid` con dos columnas (etiqueta / valor) y los `<th>` se ocultan visualmente, dejando visibles **estación, importe, casos, diagnóstico y status**. La escalera del detalle **no** se reordena: mantiene su estructura porque es lo único que en móvil justifica el scroll horizontal, y ahí sí el usuario está mirando una sola familia a propósito. Los botones de status pasan a ancho completo apilados, con altura mínima de `2.75rem` (objetivo táctil ≥ 44 px), que es el único lugar donde la pantalla se aparta de las medidas de `pp` — deliberadamente, porque son el control que más se toca.

El encabezado sigue la regla existente:

```327:336:ibarra-app/src/app/components/peajes/pasadas-pendientes/pasadas-pendientes-list.component.css
@media (max-width: 720px) {
  .pp__header h1 {
    font-size: 1.4rem;
  }

  .pp__btn--primary {
    padding: 0.35rem 0.5rem;
    font-size: 0.6875rem;
  }
}
```

El riel de progreso por concesión (§10) apila nombre y barra en dos líneas por debajo de 720 px.

### 14.5 Lectores de pantalla

- Cada `<th>` ordenable lleva `[attr.aria-sort]` con `ascending` / `descending` / `none`.
- El contenedor de la tabla lleva `[attr.aria-busy]="loading"`.
- Los errores van en `<p class="at__error" role="alert">`, igual que `.pp__error`.
- El contador `3 de 5 sin confirmar` va en un `<p aria-live="polite">` para que el cambio se anuncie sin robar el foco.
- El badge dinámico con código desconocido expone el código como texto real, no como `title` solamente.

---

## 15. Checklist Frontend (agente 02 · F14-4)

```text
- [ ] Leer AGENTS.md, PLAN-auditoria-pasadas-patrones.md, APENDICE-A y APENDICE-B antes de escribir código
- [ ] Crear carpeta auditoria-tarifas/ con los archivos de §12 (no tocar src/app/components/peajes/models/)
- [ ] mocks/auditoria-tarifas.mock.ts sembrado con ZARATE (5 niveles / 713 casos) y AGÜERO (17 niveles / 102 casos)
- [ ] El mock incluye un código de status ausente del catálogo, para el fallback gris de §9.2
- [ ] Componente standalone: true, imports explícitos, @Inject en constructor, sin signals
- [ ] Filtros con debounceTime(300) + distinctUntilChanged + takeUntil(destroy$)
- [ ] Filtro de categoría poblado con select distinct; deshabilitado y con ayuda cuando es Patrón A
- [ ] Tabla padre nativa .at__table con las 10 columnas de §5 y orden por defecto cases:desc
- [ ] Copy real de vacío / cargando / error de §5, en español
- [ ] Fila expandida con expandedId único, colspan="11" y app-data-table anidada
- [ ] Escalera tarifaria: barra de multiplicador + riel de 24 h, en un solo azul
- [ ] Botones de status generados desde tarifas_status_catalogo, ordenados por orden, sin switch por código
- [ ] Sugerencia ascendente: nivel más barato → menor orden; resto → último orden; MUESTRA_INSUFICIENTE sin sugerencia
- [ ] Confirmar arma p_asignaciones con status_codigo (no status) en una sola llamada por familia
- [ ] "Es variación por categoría" → CATEGORIA y "Marcar para revisar" → REVISAR
- [ ] Selección local instantánea; persistencia con estado pendiente; sin revertir en caso de error
- [ ] TarifaStatusBadgeComponent con los 4 caminos de resolución (§9.2)
- [ ] Diálogo de comparación con app-dialog size="lg" + foco inicial, trampa de foco y restauración
- [ ] Aviso visible de la limitación de dos niveles de peajes_grupos_similares_tarifa
- [ ] Riel de progreso por concesión con las dos llamadas de p_page_size: 1
- [ ] Recalcular: habilitado con un solo peaje, diálogo de confirmación, franja de larga duración
- [ ] role="radiogroup" + roving tabindex + flechas en los botones de status
- [ ] :focus-visible en todo control; estado seleccionado no depende solo del color
- [ ] @media (prefers-reduced-motion: reduce) sin animación de detalle ni de barras
- [ ] Breakpoints 1024 / 720 de §14.4; estación sticky en scroll horizontal; botones ≥ 44 px en móvil
- [ ] Handoff en docs/session-handoff.md con los 5 puntos de §13.3
- [ ] Anotar para agente 05: ROUTE_PERMISSIONS, spread en peajes.routes.ts, tarjeta en peajes-home
- [ ] npx tsc --noEmit -p tsconfig.app.json
- [ ] ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
- [ ] npm run build
- [ ] Actualizar solo F14-4 en feature_list.json con evidencia (comando + resultado)
```

---

> Última actualización: 2026-08-12
