# Plan de refactor UI/UX — Auditoría de tarifas

## Resumen

Este documento propone el refactor de `/peajes/auditoria-tarifas` para que el analista pueda inspeccionar una familia tarifaria, comprender su evidencia horaria y asignar un status sin controles ocultos ni acciones mezcladas. El plan parte de la captura y de la respuesta real de `peajes_listar_tarifas_normalizadas` compartidas el 13 de agosto de 2026.

El alcance de este documento es **solo planificación**. No implementa cambios ni modifica el contrato de backend.

## Índice

- [Problema observado](#problema-observado)
- [Diagnóstico técnico](#diagnóstico-técnico)
- [Objetivo de experiencia](#objetivo-de-experiencia)
- [Dirección visual](#dirección-visual)
- [Flujo propuesto](#flujo-propuesto)
- [Componentes afectados](#componentes-afectados)
- [Plan por fases](#plan-por-fases)
- [Contrato de datos](#contrato-de-datos)
- [Pruebas automatizadas propuestas](#pruebas-automatizadas-propuestas)
- [Checklist UX manual](#checklist-ux-manual)
- [Criterios de aceptación](#criterios-de-aceptación)
- [Riesgos y decisiones](#riesgos-y-decisiones)
- [Referencias](#referencias)

---

## Problema observado

### Evidencia de la captura

1. La fila expandida mezcla en una misma línea las acciones primarias y secundarias: `Confirmar 0 niveles`, `Es variación por categoría`, `Marcar para revisar` y `Comparar con grupos similares`.
2. La columna **Franja horaria** aparece vacía aunque cada fila recibida incluye `hora_min`, `hora_media` y `hora_max`.
3. La columna **Clasificación** muestra el valor crudo (`PENDIENTE`) en vez de los controles para elegir `HORA_PICO`, `HORA_NO_PICO` u otro código del catálogo.
4. El listado de progreso por concesión ocupa mucho alto visual y compite con los filtros y la tarea principal.
5. El selector de filtro **Status** obliga a escribir para descubrir opciones; el usuario no ve de antemano los estados disponibles.
6. La expansión dentro de la tabla produce una pantalla larga y difícil de auditar, especialmente cuando se combinan tabla principal, tabla anidada y paginadores.

### Impacto operativo

- No se distingue con claridad entre **ver evidencia**, **clasificar** y **corregir diagnóstico**.
- El usuario no puede deducir con seguridad un status horario porque la principal evidencia —la franja horaria— no se representa.
- La acción primaria no guía el siguiente paso y puede mostrar `Confirmar 0 niveles`.
- La densidad de acciones aumenta el riesgo de elegir una operación secundaria por error.

---

## Diagnóstico técnico

### Defecto de renderizado prioritario

`DataTableColumnDirective` recibe la clave mediante el input requerido `appDataTableColumn`. En el panel actual las plantillas se declaran con esta forma:

```html
<ng-template appDataTableColumn key="franja" let-row>
```

La forma que debe verificarse durante la implementación es:

```html
<ng-template appDataTableColumn="franja" let-row>
```

El mismo problema aparece en `importe`, `cases`, `multiplicador`, `diagnostico` y `status`. Al no encontrarse una plantilla por `columnKey`, `app-data-table` cae en la celda plana:

```html
{{ cellValue(row, col.key) }}
```

Esto explica simultáneamente:

- `franja` vacía: no existe una propiedad literal `row.franja`;
- `status` como texto `PENDIENTE`: se imprime el valor crudo;
- ausencia de botones dinámicos: nunca se instancia `app-tarifa-status-buttons`;
- multiplicador sin barra visual y diagnóstico sin badge enriquecido.

Este defecto debe resolverse y cubrirse con una prueba antes del refactor visual. Si no se hace, cualquier rediseño conservará la causa funcional.

### Hallazgos secundarios

- `loadFamilia()` solicita hasta 100 niveles y el detalle fija `page=1` y `pageSize=niveles.length`; por lo tanto, el paginador actual no representa una navegación real.
- El panel inline depende del ancho residual de una tabla de 11 columnas, lo que comprime evidencia y controles.
- `tarifa-status-buttons` ya genera opciones desde `tarifas_status_catalogo`, incluye navegación por teclado y agrega `POSIBLE_HORARIO`; el problema principal no es el catálogo, sino que el template no llega a renderizarse.
- El filtro Status usa un buscador múltiple adecuado para catálogos grandes, pero poco descubrible para los 2–4 estados frecuentes.

---

## Objetivo de experiencia

La pantalla debe permitir completar este ciclo sin ambigüedad:

```text
Encontrar una familia pendiente
        ↓
Ver todos sus niveles y evidencia horaria
        ↓
Asignar un status visible a cada nivel
        ↓
Confirmar la familia
        ↓
Continuar con la siguiente pendiente
```

Principios:

1. **Una acción, una intención:** separar Ver, Clasificar y Más acciones.
2. **Evidencia antes que decisión:** importe, casos y franja horaria deben preceder al selector de status.
3. **Opciones visibles:** los estados frecuentes no deben depender de escribir en un buscador.
4. **Contexto estable:** la tabla principal no debe cambiar de altura al abrir una familia.
5. **Continuidad de auditoría:** después de guardar debe ofrecerse la siguiente familia pendiente.
6. **Sin design system nuevo:** mantener standalone Angular 19, CSS propio, Font Awesome y componentes shared existentes.

---

## Dirección visual

### Concepto

Una **mesa de control tarifaria**: datos compactos, evidencia horaria legible y una sola zona de decisión. La firma visual será una regla de 24 horas con marcas `00`, `06`, `12`, `18` y `24`, rango min–max y marcador de media; no un gráfico decorativo.

### Tokens a reutilizar

| Rol | Valor | Uso |
|---|---:|---|
| Señal | `#004AC6` | navegación, foco, acción principal |
| Precio | `#2563EB` | importes y nivel activo |
| Éxito | `#0F766E` | familia confirmada / NO_PICO si el catálogo lo define así |
| Advertencia | `#B45309` | pendiente o posible horario |
| Riesgo | `#B91C1C` | errores y revisar |
| Tinta | `#0F172A` | texto principal |
| Fondo operativo | `#F7F9FB` | superficie secundaria |

La tipografía seguirá la del host. Los importes, casos y horas deben usar numerales tabulares.

### Estructura general

```text
┌ Auditoría de tarifas                    Volver  Pasadas  Recalcular ┐
│ [Resumen global] [Pendientes] [Concesiones completas]              │
│ Progreso por concesión ▾                                             │
├ Filtros principales                                                  ┤
│ Peaje | Estación | Status visible | Patrón | Más filtros            │
├ Familias tarifarias                                                  ┤
│ Estación | Cat. | Casos | Diagnóstico | Status | [👁] [Clasificar]  │
│ ...                                                                  │
└ Paginación                                                           ┘
```

El progreso detallado queda colapsable; el resumen global permanece visible y ocupa una sola fila.

---

## Flujo propuesto

### 1. Tabla principal

La tabla deja de expandir contenido dentro de sus filas. Cada fila tendrá dos acciones principales:

| Acción | Presentación | Resultado |
|---|---|---|
| Ver detalle | botón de icono `fa-eye`, nombre accesible `Ver niveles de {estación}` | abre diálogo en modo lectura |
| Clasificar | botón compacto con icono `fa-tags` y texto `Clasificar` | abre el mismo diálogo con foco en el primer nivel pendiente |

Las acciones secundarias se agrupan en `Más acciones` dentro del diálogo, nunca en la línea principal.

### 2. Diálogo de familia

El diálogo usa tamaño grande y mantiene contexto en encabezado y pie.

```text
┌ PASEO DEL BAJO · Categoría 9 · Patrón B                    [×] ┐
│ 2 niveles · 130 casos · 2 pendientes                           │
├─────────────────────────────────────────────────────────────────┤
│ IMPORTE  CASOS  MULT.  FRANJA HORARIA       DIAGNÓSTICO STATUS │
│ 9731,46      6  1,00×  18:42 ━━━●━━ 22:12   Muestra... [▼]    │
│ 9935,82    124  1,02×  00:05 ━━━━━●━ 23:57   Revisar    [▼]    │
├ Mostrando 1–2 de 2                           Filas 10  1/1 ─────┤
│ Más acciones ▾                         Cancelar  Confirmar 2    │
└─────────────────────────────────────────────────────────────────┘
```

Requisitos:

- Ver todos los niveles recibidos en `rows`.
- Paginación interna real con tamaños `10`, `25`, `50`; para familias menores no debe aparentar que hay más páginas.
- Encabezado sticky con estación, categoría, patrón, casos y pendientes.
- Footer sticky con el contador y la acción primaria.
- En móvil, cada nivel se transforma en tarjeta; no se fuerza una tabla de 720 px.
- El diálogo debe cerrar con Escape y devolver foco al botón que lo abrió.

### 3. Franja horaria

Cada nivel debe mostrar:

- etiqueta explícita `HH:mm–HH:mm` derivada de `hora_min` y `hora_max`;
- riel 0–24 horas con marcas visuales cada 6 horas;
- marcador de `hora_media`;
- texto auxiliar `Media HH:mm · desvío N,NN h`;
- estado `Sin datos horarios` si alguno de los valores requeridos es `null`.

No usar solo color para distinguir el rango. La etiqueta textual es obligatoria.

### 4. Selección de status

Para cada nivel, el control debe mostrar inmediatamente la selección actual y las opciones disponibles.

Propuesta:

- 2–3 opciones: segmented buttons / radios visibles (`Hora no pico`, `Hora pico`, etc.);
- más de 3 opciones: botón con el status actual que abre un menú/listbox, sin exigir escribir;
- color, etiqueta y orden provienen de `tarifas_status_catalogo`;
- el código crudo queda como texto auxiliar o tooltip, no como etiqueta primaria;
- `PENDIENTE` se presenta como `Sin clasificar`;
- `POSIBLE_HORARIO` se presenta como sugerencia, no como confirmación humana;
- nunca mostrar `Confirmar 0 niveles`: si no hay cambios, el botón dice `Sin cambios` y queda deshabilitado.

### 5. Filtro Status

Agregar un riel de chips visibles para los estados frecuentes:

```text
[Todos] [Sin clasificar 36] [Posible horario 6] [Hora pico] [Hora no pico] [Más…]
```

`Más…` conserva el buscador múltiple para catálogos extensos. Los chips deben poder combinarse como filtro múltiple y reflejarse en `app-filter-chip-rail`.

### 6. Progreso

Reemplazar el bloque vertical siempre abierto por:

- resumen global: `clasificadas / total`, porcentaje y pendientes;
- un botón `Ver progreso por concesión`;
- panel colapsable con barras por concesión;
- orden: concesiones con más pendientes primero; completas al final;
- en móvil: nombre, porcentaje y pendientes en dos líneas.

No se elimina información; se reduce su peso visual durante la auditoría.

### 7. Mejora adicional recomendada: cola guiada

Agregar al diálogo `Guardar y ver siguiente pendiente`. Esta acción:

1. confirma los cambios;
2. actualiza progreso y tabla;
3. abre la siguiente familia según filtros y orden vigentes;
4. muestra `No quedan familias pendientes` al finalizar.

Es una mejora acotada que reduce navegación repetitiva y hace la auditoría más rápida sin cambiar el backend.

---

## Componentes afectados

| Artefacto | Cambio planificado | Owner |
|---|---|---|
| `auditoria-tarifas-list.component.*` | quitar expansión inline; abrir diálogo; status visibles; progreso compacto; navegación siguiente | 02 Frontend Wizard & Tablas |
| `tarifa-familia-panel.component.*` | contenido del diálogo, paginación, riel horario, footer de confirmación | 02 Frontend Wizard & Tablas |
| `tarifa-status-buttons.component.*` | modo visible o menú según cantidad de opciones; etiquetas accesibles | 02 Frontend Wizard & Tablas |
| Nuevo `tarifa-familia-dialog.component.*` | encapsular apertura, foco, encabezado y acciones | 02 Frontend Wizard & Tablas |
| `auditoria-tarifas-list.component.spec.ts` | apertura por Ver/Clasificar, filtros y progreso | 02 Frontend Wizard & Tablas |
| `tarifa-familia-panel.component.spec.ts` | templates, horas, paginación, confirmación y estados | 02 Frontend Wizard & Tablas |
| `auditoria-tarifas.md` | actualizar solo después de que la feature esté verificada | 04 Documentador |

No se planifican cambios en migraciones, RPC, modelos compartidos, rutas ni permisos.

---

## Plan por fases

### Fase UX-0 — Corregir el renderizado funcional

1. Cambiar cada template a `appDataTableColumn="<key>"`.
2. Agregar una prueba que falle si `Franja horaria` cae en celda plana.
3. Verificar que `app-tarifa-status-buttons` se instancia por cada nivel.
4. Verificar que multiplicador y diagnóstico usan sus templates enriquecidos.

**Salida:** el panel actual vuelve a mostrar lo que ya prometía antes de moverlo a diálogo.

### Fase UX-1 — Separar inspección y clasificación

1. Sustituir el chevron/expansión por `Ver detalle` con icono de ojo.
2. Mantener un botón `Clasificar` con texto visible.
3. Crear el diálogo de familia reutilizando `app-dialog`.
4. Mover el panel y las acciones secundarias al diálogo.
5. Restaurar foco al disparador al cerrar.

**Salida:** la tabla mantiene altura estable y cada acción tiene una intención clara.

### Fase UX-2 — Evidencia y status descubribles

1. Formatear horas decimales a `HH:mm` sin alterar la zona UTC usada por el algoritmo.
2. Añadir riel 0–24, min, media y max con fallback nulo.
3. Hacer visibles los estados frecuentes sin búsqueda.
4. Mostrar `Sin cambios` en vez de `Confirmar 0 niveles`.
5. Añadir contador de pendientes y confirmación sticky.

**Salida:** el analista puede justificar visualmente una clasificación horaria.

### Fase UX-3 — Navegación y progreso

1. Compactar progreso global.
2. Hacer colapsable el detalle por concesión.
3. Ordenar por pendientes descendentes.
4. Implementar `Guardar y ver siguiente pendiente`.

**Salida:** menor scroll y menor número de clics por familia auditada.

### Fase UX-4 — Responsive, accesibilidad y QA

1. Tarjetas por nivel en viewport menor a 720 px.
2. Recorrido completo solo con teclado.
3. Validar roles, foco, labels, `aria-live` y contraste.
4. Ejecutar tests Angular, build y checklist visual en escritorio/móvil.
5. Registrar evidencia en `feature_list.json` y `docs/claude-progress.md` únicamente al implementar.

---

## Contrato de datos

La respuesta compartida de `peajes_listar_tarifas_normalizadas` ya contiene lo necesario para este refactor:

| Campo | Uso UI |
|---|---|
| `id` | identidad del nivel y asignación |
| `estacion_id`, `estacion_nombre` | familia y encabezado |
| `peaje_id`, `peaje_nombre` | catálogo y progreso |
| `categoria` | patrón B / contexto |
| `importe`, `importe_base`, `multiplicador` | escalera tarifaria |
| `cases`, `muestra_confiable` | confianza y orden |
| `hora_min`, `hora_media`, `hora_max`, `desvio` | riel y evidencia horaria |
| `diagnostico` | explicación algorítmica de solo lectura |
| `status`, `status_etiqueta`, `status_color`, `status_tipo_meta` | presentación y selección |
| `confirmado_manual`, `confirmado_at`, `confirmado_por` | estado de auditoría |

### Límite explícito

En este plan, “ver todas las filas del `node_list`” significa ver todos los **niveles agregados de `tarifas_normalizadas`** de la familia. Si se requieren las **pasadas crudas** que componen cada nivel, hace falta una consulta/RPC paginado adicional; debe planificarse como feature backend separada para no cargar miles de registros en este diálogo.

---

## Pruebas automatizadas propuestas

### Angular/TestBed

| ID | Archivo | Caso |
|---|---|---|
| UT-01 | `tarifa-familia-panel.component.spec.ts` | renderiza template de franja y no una celda vacía |
| UT-02 | mismo | muestra `hora_min`, `hora_media`, `hora_max` formateadas |
| UT-03 | mismo | muestra fallback cuando no hay horas |
| UT-04 | mismo | renderiza una opción de status por entrada del catálogo |
| UT-05 | mismo | `Confirmar` queda deshabilitado y dice `Sin cambios` sin asignaciones nuevas |
| UT-06 | mismo | emite todas las asignaciones modificadas con `status_codigo` |
| UT-07 | mismo | pagina niveles sin perder selecciones |
| UT-08 | `auditoria-tarifas-list.component.spec.ts` | botón Ver abre diálogo en modo lectura |
| UT-09 | mismo | botón Clasificar abre diálogo y selecciona el primer pendiente |
| UT-10 | mismo | cerrar diálogo restaura estado y no expande tabla |
| UT-11 | mismo | chips de status exponen opciones sin escribir |
| UT-12 | mismo | progreso se ordena por pendientes y puede colapsarse |
| UT-13 | mismo | Guardar y siguiente respeta filtros y orden actuales |
| UT-14 | `tarifa-status-buttons.component.spec.ts` | flechas, Home y End cambian el radio activo |

### Verificación visual/navegador

Usar locators por rol y nombre accesible, sin depender de clases CSS internas:

1. escritorio `1366×768`;
2. tablet `768×1024`;
3. móvil `390×844`;
4. preferencia `reduced-motion: reduce`;
5. navegación completa con Tab, flechas, Enter y Escape;
6. consola sin errores al abrir/cerrar y paginar el diálogo.

Comandos previstos para la futura implementación:

```powershell
ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

---

## Checklist UX manual

### Preparación

- [ ] Dataset con una familia de 1 nivel, otra de 2 y otra de 5 o más.
- [ ] Al menos un nivel con `hora_*` completo y uno con valores nulos.
- [ ] Catálogo con `HORA_PICO`, `HORA_NO_PICO` y un tercer status personalizado.
- [ ] Estado inicial con filas `PENDIENTE`, `POSIBLE_HORARIO` y confirmadas.

### Descubrimiento y navegación

- [ ] En menos de 5 segundos se identifican las acciones Ver y Clasificar.
- [ ] El icono de ojo tiene tooltip y nombre accesible específico de estación.
- [ ] La tabla no cambia de altura al abrir una familia.
- [ ] Escape cierra el diálogo.
- [ ] El foco vuelve al botón que abrió el diálogo.
- [ ] Volver, Pasadas y Recalcular conservan su comportamiento.

### Detalle y paginación

- [ ] El diálogo muestra estación, categoría, patrón, niveles, casos y pendientes.
- [ ] Se ven todos los niveles del `node_list`, no solo la fila seleccionada.
- [ ] La paginación indica rango, total y página actual correctamente.
- [ ] Cambiar de página no pierde selecciones de status.
- [ ] Familias pequeñas no muestran controles de página engañosos.
- [ ] El encabezado y el footer permanecen disponibles al hacer scroll.

### Franja horaria

- [ ] Cada nivel muestra rango textual min–max.
- [ ] La media se distingue del rango sin depender solo del color.
- [ ] El desvío incluye unidad horaria.
- [ ] Valores nulos muestran `Sin datos horarios` y no una celda vacía.
- [ ] Rango cercano a medianoche no desborda el riel.
- [ ] Los valores coinciden con `hora_min`, `hora_media` y `hora_max` del RPC.

### Status y confirmación

- [ ] `HORA_PICO`, `HORA_NO_PICO` y estados personalizados se descubren sin escribir.
- [ ] La opción actual se reconoce por texto, icono/estado y color.
- [ ] `PENDIENTE` se presenta como `Sin clasificar`.
- [ ] La sugerencia automática se diferencia de una confirmación humana.
- [ ] El botón nunca dice `Confirmar 0 niveles`.
- [ ] Confirmar muestra estado de guardado y evita doble clic.
- [ ] Un error conserva selecciones y ofrece reintento.
- [ ] El éxito actualiza tabla, badge y progreso.
- [ ] Guardar y siguiente abre la siguiente familia pendiente correcta.

### Acciones secundarias

- [ ] `Es variación por categoría`, `Marcar para revisar` y `Comparar` están agrupadas bajo Más acciones.
- [ ] Cada acción explica su efecto antes de modificar toda la familia.
- [ ] Una acción secundaria no compite visualmente con Confirmar.
- [ ] Comparar conserva la asignación aún no guardada o advierte antes de descartarla.

### Progreso y filtros

- [ ] El resumen global ocupa una sola fila en escritorio.
- [ ] El detalle por concesión puede expandirse y colapsarse.
- [ ] Las concesiones con pendientes aparecen primero.
- [ ] Los chips de status son visibles y seleccionables.
- [ ] `Más…` permite buscar estados adicionales.
- [ ] Limpiar filtros restablece chips, tabla y progreso.

### Móvil y accesibilidad

- [ ] En `390×844` no hay scroll horizontal para clasificar niveles.
- [ ] Los targets táctiles principales miden al menos 44×44 px.
- [ ] Todo el flujo funciona sin mouse.
- [ ] El radiogroup/listbox anuncia opción y estado seleccionado.
- [ ] Errores usan `role="alert"`; cambios de contador usan `aria-live="polite"`.
- [ ] El diálogo mantiene el foco dentro mientras está abierto.
- [ ] El contraste de texto, badges y foco cumple WCAG AA.
- [ ] Con movimiento reducido no hay transiciones esenciales.

---

## Criterios de aceptación

1. La franja horaria se renderiza con datos reales y fallback explícito.
2. Ver y Clasificar son acciones separadas y accesibles desde la tabla.
3. Todos los niveles agregados de una familia se consultan en un diálogo paginado.
4. Los status disponibles se pueden descubrir y seleccionar sin escribir.
5. No existe el estado visual `Confirmar 0 niveles`.
6. Las acciones secundarias no aparecen en la misma jerarquía que Confirmar.
7. El progreso no desplaza la tarea principal y sigue disponible por concesión.
8. Las selecciones sobreviven a la paginación interna.
9. El flujo funciona en escritorio, tablet, móvil y solo teclado.
10. Tests del módulo, TypeScript y build pasan antes de marcar la feature como `passing`.

---

## Riesgos y decisiones

| Riesgo | Decisión / mitigación |
|---|---|
| Confundir niveles agregados con pasadas crudas | nombrar el diálogo `Niveles de tarifa`; planificar RPC separado si se piden pasadas |
| Catálogo vacío o sin cargar | mostrar estado bloqueado con explicación, no inventar códigos |
| Catálogo con muchos status | radios visibles hasta 3; listbox sin búsqueda obligatoria desde 4 |
| Familias de 100+ niveles | paginación cliente solo si la respuesta ya trae todos; de lo contrario, paginación server-side |
| Perder cambios al cerrar o comparar | confirmación de descarte cuando el formulario está modificado |
| Romper documentación local ya editada | actualizar `auditoria-tarifas.md` únicamente después de implementar y preservar cambios existentes |
| Modificar invariantes F14 | no tocar `diagnostico`, derivación de peaje, `pasadas.categoria` ni hook post-carga |

### Decisión de alcance

El refactor inicial no agrega histograma, edición del catálogo, pasadas crudas ni cambios SQL. La prioridad es corregir el renderizado, hacer visible la evidencia ya disponible y ordenar la tarea de clasificación.

---

## Referencias

- [Auditoría de tarifas — pantalla y servicios](../../06-components/peajes/auditoria-tarifas.md)
- [PRD de Peajes](../peaje-prd-short.md)
- [PRD de normalización tarifaria](./PRD_Feature_Normalizacion_Tarifaria.md)
- [Plan backend/frontend existente](./PLAN_Backend_Frontend_Tarifas_Normalizadas.md)
- [Apéndice frontend F14](../auditoria-pasadas-patrones/APENDICE-C-pantalla-auditoria-frontend.md)
- `src/app/components/peajes/auditoria-tarifas/`
- `src/app/components/shared/data-table/`

---

> Última actualización: agosto de 2026
