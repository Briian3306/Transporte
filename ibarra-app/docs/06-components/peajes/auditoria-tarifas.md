# Auditoría de tarifas — pantalla y servicios (F14-4)

## Resumen

Pantalla `/peajes/auditoria-tarifas` donde el analista **clasifica niveles de precio** ya detectados a partir de `pasadas` importadas. El sistema propone un **diagnóstico** (solo lectura); la única entrada humana es el **status** del peaje (`PICO`, `NO_PICO`, u otros del catálogo).

Features: **F14-4** (UI) · **F14-2** (RPCs / servicio) · **F14-8** (select + franja + Ver casos) · Owner UI: `02-frontend-wizard-tablas`.

## Índice

- [Resumen](#resumen)
- [Cómo llegar](#cómo-llegar)
- [Qué resuelve (tres capas)](#qué-resuelve-tres-capas)
- [Flujo de uso](#flujo-de-uso)
- [Filtros](#filtros)
- [Tabla principal](#tabla-principal)
- [Fila expandida (familia)](#fila-expandida-familia)
- [Botones y acciones](#botones-y-acciones)
- [Diálogo Comparar](#diálogo-comparar)
- [Diálogo Recalcular](#diálogo-recalcular)
- [Diálogo Ver casos](#diálogo-ver-casos)
- [Componentes y archivos](#componentes-y-archivos)
- [Servicios y contratos](#servicios-y-contratos)
- [Tablas de datos](#tablas-de-datos)
- [Estados vacíos y errores](#estados-vacíos-y-errores)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Cómo llegar

| Paso | Dónde |
|------|--------|
| 1 | Dashboard → módulo **Peajes** (`/peajes`) |
| 2 | Tarjeta **Auditoría de tarifas** (icono `fa-chart-line`, enlace «Auditar tarifas») |
| 3 | O ruta directa `/peajes/auditoria-tarifas` |

Permiso: `{ module: 'peajes', action: 'read' }` (`peajes:read`).

Encabezado de la pantalla: eyebrow «Módulo Peajes», título «Auditoría de tarifas», subtítulo que indica que el sistema propone y el usuario confirma. Enlaces: **Volver** (`/peajes`), **Pasadas** (`/peajes/pasadas`).

---

## Qué resuelve (tres capas)

| Capa | Campo | ¿Editable? | Significado |
|------|--------|------------|-------------|
| Diagnóstico | `diagnostico` | No (salvo acciones secundarias) | Qué sospecha el algoritmo: muestra insuficiente, tarifa única, variación por categoría, posible horario, revisar, confirmado |
| Status | `status` | **Sí — objetivo de la pantalla** | Cómo se llama esa tarifa en la concesión: `PENDIENTE`, `POSIBLE_HORARIO`, o códigos de `tarifas_status_catalogo` (p. ej. `PICO` / `NO_PICO`) |
| Categoría calculada | `categoria_calculated` | **Sí, opcional, solo Patrón A** | Clase vehicular 0–10 que el analista infiere de la escalera. Vacío = sin asignar. No es `pasadas.categoria` (RN-15) |

**Patrón A** — el archivo no trae categoría (`categoria` null): la familia es por estación. El sello **CAT** en la familia permite anotar la clase.  
**Patrón B** — hay categoría del proveedor mapeada en el wizard: la familia es estación + categoría; el sello no aparece (em dash).

La detección de columna `CATEGORIA` y el mapeo opcional están en [reconocimiento-columnas.md](./reconocimiento-columnas.md).

---

## Flujo de uso

```text
1. Abrir /peajes/auditoria-tarifas
2. (Opcional) Filtrar peaje / status PENDIENTE / muestra confiable
3. Mirar la barra de progreso por concesión
4. Clic en una fila → expandir «escalera tarifaria»
5. Revisar multiplicador + franja `03:00 – 05:00` (primer–último caso UTC)
6. En cada nivel, abrir el select de status, escribir para filtrar (PICO / NO_PICO…) y elegir
7. (Opcional, Patrón A) anotar la clase 0–10 en el sello **Categoría**
8. Asignar status → se guarda status y, si hay número, `categoria_calculated`; se propaga `pasadas.tarifa_status`
9. (Opcional) Comparar con grupos similares y aplicar en lote
10. Cuando no queden pendientes, la concesión queda «completa»
```

Orden sugerido: filtrar **Status = Sin clasificar (PENDIENTE)** y un peaje; ir fila por fila con **Clasificar**.

El sistema **preselecciona** un status por precio (más barato → primer código del catálogo). Podés cambiarlo en el select antes de confirmar. Limpiar el select vuelve a «Sin clasificar» (`PENDIENTE`). Los códigos nuevos no se inventan a mano: deben existir en `tarifas_status_catalogo` del peaje.
---

## Filtros

Debounce 300 ms. Chips activos con `app-filter-chip-rail` («Limpiar filtros»).

| Filtro | Control | Efecto |
|--------|---------|--------|
| Rango de fechas | `app-date-range-picker` | UI disponible; hoy **no filtra** el listado RPC (familias agregadas sin snapshot temporal) |
| Peaje | `app-search-multi-select` | Acota familias y el catálogo de status |
| Estación | `app-search-multi-select` | Depende del peaje elegido |
| Categoría | `app-search-select` | Valores distintos de `tarifas_normalizadas`; deshabilitado si el peaje es Patrón A («Este peaje no informa categoría») |
| Diagnóstico | `app-search-multi-select` | Valores fijos del algoritmo |
| Status | `app-search-multi-select` | Universales + códigos del catálogo del peaje |
| Patrón | Segmento Todos / A / B | A = sin categoría; B = con categoría |
| Muestra confiable | Switch | Solo familias con casos ≥ umbral |
| Buscar | Input search | Texto sobre nombre de estación |

---

## Tabla principal

Tabla nativa (`.at__table`), una fila expandida a la vez (`expandedId`). Orden por defecto: `cases` descendente. Paginación: 25 / 50 / 100.

| Columna | Contenido |
|---------|-----------|
| ▸ | Expandir / contraer |
| Estación | Nombre |
| Peaje | Nombre de la concesión. Si la empresa tiene `tarifa_url`, el nombre es un link (nueva pestaña). El lápiz a la derecha edita esa URL |
| Categoría | Texto del proveedor o `—` |
| Importe | Nivel de precio (secundaria en móvil) |
| Casos | Cantidad de pasadas del nivel |
| Multiplicador | Respecto de la base de la familia |
| Desvío horario | Dispersión de la hora (UTC) |
| Diagnóstico | Badge fijo (etiqueta en español) |
| Status | Badge dinámico desde catálogo |
| Patrón | `A` o `B` |
| Acciones | **Clasificar** · **Comparar** |

Clic en la fila o en **Clasificar** abre el detalle. **Comparar** abre el diálogo sin perder el contexto.

---

## Fila expandida (familia)

Componente `app-tarifa-familia-panel` dentro de `.at__detail`.

1. Nota de sugerencia: el sistema preasigna status por **precio ascendente** según el `orden` del catálogo (editable en el select).
2. Si hay **exactamente dos importes distintos** y el catálogo del peaje tiene `NO_PICO` y `PICO`, aparece el recuadro **Reconocimiento detectado**: el más bajo → No Pico, el más alto → Pico. Confirmar deja el diagnóstico en `CONFIRMADO`.
3. `app-data-table` con plantillas `appDataTableColumn="clave"` (no `key="clave"`):
   - Importe
   - Casos
   - Multiplicador + barra visual
   - **Franja horaria** — texto principal `HH:mm – HH:mm` (primer caso – último caso, UTC) desde `hora_min` / `hora_max`, riel secundario, media/desvío debajo. Si `hora_min`/`hora_max` son null → «Sin datos horarios — usá Recalcular en el peaje»
   - Diagnóstico
   - **Categoría** — sello CAT + dígito 0–10 (opcional, solo Patrón A). Vacío = Sin clase. Patrón B muestra `—`
   - **Select de status** (`app-tarifa-status-buttons` → `app-search-select`). Clasificación PICO / NO_PICO
   - **Acciones** — botón **Ver casos** (`fa-search`) abre el diálogo de pasadas del nivel
4. Contador de pendientes y barra de acciones.

En Supabase, las horas viven en `tarifas_normalizadas` como números decimales (`hora_min` `3.00` = 03:00). La UI las formatea a reloj; no hay columna texto `03:00` en la tabla.

---

## Botones y acciones

### Encabezado

| Botón | Cuándo | Qué hace |
|-------|--------|----------|
| **Volver** | Siempre | Navega a `/peajes` |
| **Pasadas** | Siempre | Navega a `/peajes/pasadas` |
| **Recalcular** | Solo si hay **exactamente un** peaje filtrado | Abre diálogo → `peajes_recalcular_tarifas` (rellena/actualiza `hora_min`/`hora_max`/`hora_media`). Deshabilitado con tooltip «Elegí un peaje para recalcular» |

### Por fila (tabla)

| Botón | Qué hace |
|-------|----------|
| **Clasificar** / chevron | Expande u oculta la familia |
| **Comparar** | Abre diálogo de grupos similares |

### Dentro de la familia (entrada principal)

| Control | Qué hace el usuario | Servicio / RPC |
|---------|---------------------|----------------|
| **Select de status** (buscar y elegir) | Abrí el desplegable, escribí para filtrar (`PICO`, `NO_PICO`, …), elegí uno. Clear → Sin clasificar | Solo estado local hasta asignar |
| **Sello Categoría** (Patrón A) | Número opcional 0–10. Vacío = Sin clase. No bloquea Asignar status | Viaja en el mismo payload de `confirmarStatus` |
| **Ver casos** | Abre el diálogo de pasadas de ese nivel (`tarifa_normalizada_id`) | `peajes_listar_pasadas` |
| **Asignar status** | Guarda la asignación de la familia | `confirmarStatus` → `peajes_confirmar_status_tarifa` |
| **Reconocimiento detectado** | Solo con 2 precios distintos. Asigna el más bajo a No Pico, el más alto a Pico, y confirma (`diagnostico = CONFIRMADO`) | `confirmarStatus` → `peajes_confirmar_status_tarifa` |
| **Es variación por categoría** | Marca niveles como `CATEGORIA` | `marcarDiagnostico(..., 'CATEGORIA')` |
| **Marcar para revisar** | Marca como `REVISAR` | `marcarDiagnostico(..., 'REVISAR')` |
| **Comparar** | Abre diálogo de similitud | `gruposSimilares` |

El select usa `app-search-select` (`showAllWhenEmpty`, filtrado por texto). Opciones = catálogo del peaje + `POSIBLE_HORARIO` si no está en el catálogo. No se crean códigos libres desde la fila (el trigger de DB rechazaría un status fuera del catálogo).

En un par de dos precios, si el usuario elige **No Pico** en el más bajo y **Pico** en el más alto (hay que tocar ambos selects), se confirma solo: `confirmarStatus` deja `diagnostico = CONFIRMADO`. No se dispara con la propuesta automática ni si los códigos están invertidos.

### Diálogo Ver casos

`app-tarifa-casos-dialog` sobre `app-dialog` (tamaño `lg`). Misma tabla que `/peajes/pasadas` (Fecha, Estación, Patente, Empresa, Precio, Neto, Archivo, Creado) **sin** filtros, selección ni acciones de edición. Pagina y ordena con `peajes_listar_pasadas` filtrado por `tarifa_normalizada_id`.

### Diálogo Recalcular

| Botón | Qué hace |
|-------|----------|
| **Cancelar** | Cierra sin cambios |
| **Recalcular** | Ejecuta el recálculo; conserva clasificaciones `confirmado_manual` en niveles que **siguen** teniendo pasadas. Quita niveles sin pasadas FC (p. ej. DOCK SUD / cat 7 / 23.536,62 quedó `MUESTRA_INSUFICIENTE` fantasma tras mover MERCOSUR a Zarate) |

### Diálogo Comparar

| Control | Qué hace |
|---------|----------|
| Tolerancia | Ajusta el umbral de ratio (default 0.05) y vuelve a buscar |
| Checkbox por grupo similar | Selecciona estaciones para aplicar el mismo patrón |
| **Cancelar** | Cierra |
| **Aplicar a N grupos** | Bulk `confirmarStatus` emparejando niveles por importe |

Límite documentado en UI: la similitud compara solo extremos (más barato / más caro). Familias con distinta cantidad de niveles muestran advertencia.
---

## Diálogo Comparar

`app-tarifa-comparar-dialog` sobre `app-dialog` (tamaño `lg`).

- Bloque «Esta familia»: lista de importes + badges de status.
- Bloque «Grupos similares»: estaciones con ratio parecido, casos y pendientes.
- Aplica la misma escalera de status a los grupos tildados.

---

## Diálogo Recalcular

`app-dialog` con eyebrow «Auditoría de tarifas». Descripción: vuelve a detectar familias desde las pasadas actuales; **no pisa** confirmaciones manuales de niveles que siguen existiendo. Si un nivel ya no tiene pasadas FC (estación reasignada), **desaparece** aunque estuviera en `MUESTRA_INSUFICIENTE`. Feedback en barra de aviso mientras corre (puede tardar).

---

## Diálogo Ver casos

`app-tarifa-casos-dialog` sobre `app-dialog` (tamaño `lg`). Se abre desde **Ver casos** en la columna Acciones de cada nivel.

- Misma tabla que `/peajes/pasadas`: Fecha, Estación (+ badge OK/PENDING), Patente, Empresa, Precio, Neto, Archivo, Creado.
- Sin filtros, chip rail, selección, alta ni edición.
- Lista paginada vía `peajes_listar_pasadas` con `tarifa_normalizada_id` del nivel.

---

## Diálogo URL de tarifas

`app-dialog` (tamaño `md`) desde el lápiz junto a **Peaje**. Persiste `empresas.tarifa_url` vía `actualizarEmpresa`. Vacío = sin link. Debe ser `http://` o `https://`.

---

## Componentes y archivos

| Pieza | Path | Rol |
|-------|------|-----|
| Listado | `auditoria-tarifas/auditoria-tarifas-list.component.*` | Filtros, tabla, progreso, diálogos |
| Panel familia | `tarifa-familia-panel.component.*` | Escalera + acciones de confirmación |
| Casos | `tarifa-casos-dialog.component.*` | Pasadas del nivel (sin filtros/acciones) |
| Botones status | `tarifa-status-buttons.component.*` | Select buscable (`app-search-select`) sobre el catálogo del peaje |
| Badge status | `tarifa-status-badge.component.*` | Color/etiqueta dinámicos; fallback código crudo |
| Comparar | `tarifa-comparar-dialog.component.*` | Grupos similares + apply masivo |
| Helpers | `auditoria-tarifas.helpers.ts` | Labels, sugerencia por precio, sort |
| Mock tests | `mocks/auditoria-tarifas.mock.ts` | Servicio en memoria para specs |
| Rutas | `auditoria-tarifas.routes.ts` | Provider Supabase + path `auditoria-tarifas` |
| Contratos | `models/auditoria-tarifas.contracts.ts` | Interfaces + token |
| Servicio | `services/peajes-auditoria-tarifas.service.ts` | Implementación Supabase |
| Home | `peajes-home.component.html` | Tarjeta de entrada |

Prefijo CSS: `at__` (misma familia visual que `pp__` de ubicaciones pendientes).

---

## Servicios y contratos

Token: `PEAJES_AUDITORIA_TARIFAS_SERVICE`.  
Interfaz: `PeajesAuditoriaTarifasService`.  
Implementación de ruta: `PeajesAuditoriaTarifasSupabaseService`.  
Catálogo de peajes/estaciones: `PEAJES_CATALOGO_SERVICE` (mismo patrón que otras pantallas).

| Método | Backend | Uso en UI |
|--------|---------|-----------|
| `listar(params)` | RPC `peajes_listar_tarifas_normalizadas` | Tabla, progreso, carga de familia |
| `listarStatusCatalogo(peajeId)` | `SELECT` `tarifas_status_catalogo` | Options del select + badges |
| `listarCategorias(peajeIds?)` | `SELECT distinct` `tarifas_normalizadas.categoria` | Filtro categoría |
| `confirmarStatus(asignaciones)` | RPC `peajes_confirmar_status_tarifa` | Confirmar familia / apply masivo |
| `marcarDiagnostico(id, diag)` | RPC `peajes_marcar_diagnostico_tarifa` | «Categoría» / «Revisar» |
| `gruposSimilares(id, tolerancia)` | RPC `peajes_grupos_similares_tarifa` | Diálogo comparar |
| `recalcular(peajeId)` | RPC `peajes_recalcular_tarifas` | Botón Recalcular |

`TarifaAsignacion`: `{ tarifa_normalizada_id, status_codigo, categoria_calculated? }`. La clase es opcional: confirmar PICO/NO_PICO no la exige.

Tras confirmar, el status se propaga a `pasadas.tarifa_status` (ver backend). La normalización post-carga (`peajes_normalizar_tarifas`) la dispara el wizard al guardar, no esta pantalla.

Detalle SQL/RPC: [docs/backend/peajes/auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md).

---

## Tablas de datos

| Tabla | Rol en la pantalla |
|-------|--------------------|
| `tarifas_status_catalogo` | Etiquetas, colores y opciones del select por peaje |
| `tarifas_normalizadas` | Filas (importe, casos, `hora_min`/`hora_max`/`hora_media` numéricos UTC, diagnóstico, status) |
| `tarifas_parametros_peaje` | Umbrales de muestra/dispersión (recálculo) |
| `pasadas` | Fuente del motor; columnas `categoria`, `tarifa_normalizada_id`, `tarifa_status` |
| `estaciones` / `peajes` | Nombres y filtro; peaje **derivado** vía `estacion_id` (RN-05) |
| `empresas` | `tarifa_url` del link en la columna Peaje (`peajes.empresa_id`) |

Modelo: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md).

---

## Estados vacíos y errores

| Situación | Mensaje / comportamiento |
|-----------|--------------------------|
| Cargando | «Cargando familias de tarifa…» |
| Sin datos y sin filtros | «Todavía no se generaron familias… Cargá pasadas desde el asistente o usá Recalcular.» |
| Filtro PENDIENTE vacío | «No queda ninguna familia pendiente para estos filtros.» |
| Error de listado | Alerta + «No se pudieron cargar las familias…» |
| Fallo al confirmar | «No se pudo guardar la clasificación…» en el panel |
| Progreso en 0 pendientes | «Concesión completa. ✓» / «No queda ninguna familia pendiente…» |

---

## Verificación

```powershell
cd ibarra-app
ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
npx --yes tsx src/app/components/peajes/auditoria-tarifas/clasificacion.verify.ts
```

---

## Referencias

- Backend / RPC: [auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md)
- Reconocimiento CATEGORIA: [reconocimiento-columnas.md](./reconocimiento-columnas.md)
- Servicios Peajes: [servicios-y-providers.md](./servicios-y-providers.md)
- Módulo: [docs/modulos/peajes.md](../../modulos/peajes.md)
- Plan F14: [docs/plan/auditoria-pasadas-patrones/INDEX.md](../../plan/auditoria-pasadas-patrones/INDEX.md)
- Apéndice UI (diseño): [APENDICE-C](../../plan/auditoria-pasadas-patrones/APENDICE-C-pantalla-auditoria-frontend.md)

---

> Última actualización: 2026-08-14 (Recalcular borra niveles sin pasadas FC / MUESTRA_INSUFICIENTE fantasma)
