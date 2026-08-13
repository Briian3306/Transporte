# F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)

Plan maestro de la épica **F14**. Traduce el PRD `docs/plan/normalizacion-tarifa/PRD_Feature_Normalizacion_Tarifaria.md` (§20–§27) y el plan técnico v2 `docs/plan/normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md` (§28–§30) al esquema real de DESARROLLO, a la numeración real del wizard y al modelo de agentes de `ibarra-app/AGENTS.md`.

Este documento es la **fuente de coordinación**: define alcance, arquitectura, división por agentes, checklists y criterios de terminado. El detalle de implementación vive en los apéndices (§12 Referencias).

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Alcance](#2-alcance)
3. [Los dos patrones (A/B) y la regla de detección](#3-los-dos-patrones-ab-y-la-regla-de-detección)
4. [Modelo de dos capas: diagnóstico vs status](#4-modelo-de-dos-capas-diagnóstico-vs-status)
5. [Arquitectura y flujo end-to-end](#5-arquitectura-y-flujo-end-to-end)
6. [División por agentes](#6-división-por-agentes)
7. [Checklists de ejecución](#7-checklists-de-ejecución)
8. [Contrato Backend ↔ Frontend](#8-contrato-backend--frontend)
9. [Riesgos y decisiones abiertas](#9-riesgos-y-decisiones-abiertas)
10. [Definición de terminado por feature](#10-definición-de-terminado-por-feature)
11. [Trazabilidad RN/RF](#11-trazabilidad-rnrf)
12. [Referencias](#12-referencias)

---

## 1. Resumen ejecutivo

F14 analiza las `pasadas` ya importadas para reconstruir la **estructura tarifaria real** de cada estación cuando el proveedor no la informa, y para **auditarla** cuando sí la informa. El motor agrupa las pasadas por estación, categoría (si existe) e importe; calcula cuántos casos hay en cada nivel de precio, el multiplicador respecto de la tarifa base de esa estación y el desvío estándar de la hora del día; y con eso emite un **diagnóstico algorítmico**: muestra insuficiente, tarifa única, variación por categoría de vehículo, o candidato a recargo horario.

El resultado no se toma como verdad automática. El diagnóstico alimenta una pantalla de auditoría (`/peajes/auditoria-tarifas`) donde el analista revisa cada familia de tarifas y **asigna manualmente** un status del vocabulario configurado para ese peaje (para el dataset de referencia: `PICO` / `NO_PICO`). Recién esa confirmación humana se propaga a `pasadas.tarifa_status` y queda disponible para Power BI. El MVP responde "acá probablemente hay un recargo horario", nunca "el recargo va de 7 a 10 h".

## 2. Alcance

### Dentro de alcance

- Tablas `tarifas_normalizadas`, `tarifas_parametros_peaje` y `tarifas_status_catalogo`, más las columnas nuevas de `pasadas` (`categoria`, `tarifa_normalizada_id`, `tarifa_status`).
- Motor de agrupación y diagnóstico para Patrón A (inferencia) y Patrón B (auditoría), expuesto como RPCs.
- Enganche post-guardado: `peajes_normalizar_tarifas(p_documento_id)` se dispara sobre el documento recién confirmado por `peajes_confirmar_carga`.
- Recálculo manual por peaje mediante `peajes_recalcular_tarifas(p_peaje_id)` (botón "Recalcular").
- Captura de la categoría del proveedor: detección de la columna `CATEGORIA` en el Paso 2 y destino `CATEGORIA` en el Paso 5 del wizard, persistida como texto crudo en `pasadas.categoria`.
- Pantalla de auditoría con filtros, tabla padre/detalle, panel de comparación de niveles, confirmación individual y en lote, e indicador de progreso por peaje.
- Configuración del vocabulario de status por peaje (`tarifas_status_catalogo`).

### Fuera de alcance (diferido, explícito)

- **Auto-confirmar recargos horarios sin revisión humana.** `auto_confirmar_horario` existe como parámetro pero queda en `false`; el MVP siempre exige confirmación del analista.
- **Detectar la franja horaria exacta** del recargo (inicio/fin). El motor señala *que* probablemente existe, no *cuándo*.
- **Recalcular retroactivamente `importe_neto`** de pasadas ya facturadas. F14 clasifica; no reescribe importes ni documentos.
- **RLS granular por rol/empresa.** Todas las tablas de peajes usan hoy la política plana `{tabla}_authenticated_all` (`FOR ALL TO authenticated USING (true) WITH CHECK (true)`); no existen claims `app_metadata.empresa_id` ni roles `analista`/`admin` en la base. Las tablas nuevas siguen el mismo patrón plano (PRD §5.2). Las políticas por rol del plan v2 §28.9 quedan documentadas como diferimiento, no se implementan.
- **Programación periódica con `pg_cron`.** Las extensiones `pg_cron` y `pg_net` no están instaladas en DESARROLLO. El recálculo es una acción manual; la programación queda diferida.
- Bulk-apply de familias con 3 o más niveles de tarifa (el RPC de grupos similares compara `max/min`, que solo describe familias de 2 niveles).
- Histograma de distribución horaria dentro del panel de comparación.

## 3. Los dos patrones (A/B) y la regla de detección

**Patrón A — sin columna de categoría.** El archivo solo trae importe. La categoría del vehículo y un eventual recargo horario quedan implícitos en ese único número; hay que inferirlos estadísticamente.

**Patrón B — con columna de categoría explícita.** El proveedor informa la categoría (por ejemplo `CATEGORIA` 1–7). No hay que inferirla, pero sí auditar si queda variación residual de importe dentro de una misma categoría y estación.

**Regla de detección (canónica):** el patrón se resuelve en el **Paso 5 — Mapear columnas** del wizard. Si alguna columna del archivo se mapea al destino `CATEGORIA`, las pasadas de ese documento son **Patrón B**; si no se mapea ninguna, son **Patrón A**. La regla es por fila: `pasadas.categoria IS NULL ⇒ 'A'`, en otro caso `'B'`.

> El PRD original (§21) habla de "paso 8" y de un destino `CATEGORIA_ID`. Ambas referencias son obsoletas: el mapeo es el **Paso 5** y el destino se llama **`CATEGORIA`** (texto crudo del proveedor, sin catálogo ni FK).

```text
Archivo cargado (Paso 1)
      │
      ▼
Previsualizar (Paso 2) ── detección de encabezados
      │                    alias CATEGORIA / CATEGORÍA / categoria / CLASE
      ▼
Mapear columnas (Paso 5)
      │
      ▼
¿Alguna columna tiene destino CATEGORIA?
      │
   ┌──┴───┐
  SÍ      NO
   │       │
   ▼       ▼
Patrón B  Patrón A
   │       │
   ▼       ▼
pasadas.categoria = texto      pasadas.categoria = NULL
auditoría de residuo           inferencia estadística
(ratio repetido entre          (multiplicador + desvío
 categorías de la estación)     horario por nivel de importe)
```

Los nueve pasos del wizard, para evitar ambigüedades: 1 Cargar · 2 Previsualizar · 3 Transformar · 4 Aplicar plantilla · **5 Mapear columnas** · 6 Relacionar estaciones · 7 Documento/factura · 8 Validar · **9 Revisar y guardar**.

`CATEGORIA` es un destino **opcional**: se suma a `PasadaColumnKey` / `PASADA_COLUMN_KEYS` pero **no** a `PASADA_COLUMNAS_OBLIGATORIAS`. Un archivo Patrón A debe seguir validando y guardándose sin cambios.

## 4. Modelo de dos capas: diagnóstico vs status

El error a evitar es mezclar "qué tan seguro está el algoritmo" con "cómo se llama comercialmente esa tarifa en este peaje". Son dos campos distintos con dueños distintos.

**Capa 1 — `diagnostico` (algorítmico, fijo, universal).** Lo escribe el motor, es igual para todos los peajes y sirve para ordenar la cola de revisión:

| Valor | Significado |
|---|---|
| `MUESTRA_INSUFICIENTE` | `cases` por debajo de `umbral_muestra_minima`; no se concluye nada |
| `TARIFA_UNICA` | Un solo nivel de importe en la familia; nada que auditar |
| `CATEGORIA` | Desvío horario alto (≈ uniforme): la variación se explica por tipo de vehículo |
| `POSIBLE_HORARIO` | Desvío horario bajo o ratio repetido entre categorías: candidato a recargo por franja |
| `REVISAR` | Variación no explicada (cambio de tarifa en el tiempo, promoción, error de carga) |
| `CONFIRMADO` | El analista ya resolvió esta fila |

**Capa 2 — `status` (entrada del usuario, configurable por peaje).** Es lo que el analista elige y lo único que se propaga a `pasadas.tarifa_status`. Puede valer dos códigos universales, `PENDIENTE` y `POSIBLE_HORARIO`, o cualquier `codigo` cargado en `tarifas_status_catalogo` para ese peaje. Para el dataset de referencia el catálogo tiene exactamente `PICO` y `NO_PICO`.

**Por qué el status es un catálogo y no un `CHECK`.** Cada concesión nombra sus tarifas distinto: una usa `PICO`/`NO_PICO`, otra podría necesitar `LIBRE`/`PICO`/`NOCTURNO`. Un `CHECK` obligaría a una migración por cada vocabulario nuevo y no puede validar contra otra tabla. La validación se hace con un **trigger** `BEFORE INSERT OR UPDATE OF status` que acepta los dos universales o exige que el código exista en `tarifas_status_catalogo` para el `peaje_id` de esa fila — una FK condicional emulada. El campo `tipo_meta` (`PICO`/`NO_PICO`/`NEUTRO`) permite reportes cross-peaje aunque los nombres difieran.

`pasadas.tarifa_status` **no** lleva `CHECK` propio: siempre se copia desde `tarifas_normalizadas.status`, que ya está validado en origen.

## 5. Arquitectura y flujo end-to-end

```text
┌──────────────────────── WIZARD DE CARGA (F14-3) ────────────────────────┐
│                                                                         │
│  Paso 1 Cargar ──► Paso 2 Previsualizar ──► Paso 3/4 Transformar        │
│                     (detecta encabezado CATEGORIA)                      │
│                              │                                          │
│                              ▼                                          │
│                    Paso 5 Mapear columnas                               │
│                    destino CATEGORIA → Patrón B                         │
│                    sin destino        → Patrón A                        │
│                              │                                          │
│  Paso 6 Estaciones ─► Paso 7 Documento ─► Paso 8 Validar ─► Paso 9      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │  peajes_confirmar_carga(...)
                                   │  escribe documentos + pasadas
                                   │  (incluye pasadas.categoria)
                                   ▼
                    ┌──────────────────────────────┐
                    │  HOOK POST-CARGA (F14-2)     │
                    │  peajes_normalizar_tarifas(  │
                    │      p_documento_id)         │
                    │  · match rápido a familias   │
                    │    ya conocidas              │
                    │  · alta de niveles nuevos    │
                    │  · diagnóstico provisorio    │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │  tarifas_normalizadas        │
                    │  (peaje ⟵ estaciones.peaje_id)│
                    │  diagnostico + status        │
                    └──────────────┬───────────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  PANTALLA /peajes/auditoria-tarifas (F14-4)      │
        │  filtros · tabla padre/detalle · panel de niveles │
        │  peajes_listar_tarifas_normalizadas               │
        │  peajes_grupos_similares_tarifa                   │
        │  [ Recalcular ] → peajes_recalcular_tarifas       │
        └──────────────────────┬───────────────────────────┘
                               │  decisión humana
                               ▼
        peajes_confirmar_status_tarifa(p_asignaciones jsonb)
        peajes_marcar_diagnostico_tarifa(id, 'CATEGORIA'|'REVISAR')
                               │
                               ▼
        tarifas_normalizadas.status  ──propaga──►  pasadas.tarifa_status
                               │
                               ▼
        Vistas Power BI (pwbi_pasadas, pasadas_con_peaje, pasadas_gestion, …)
```

Notas de arquitectura que condicionan la implementación:

- **El peaje se deriva, nunca se guarda en `pasadas`.** La cadena es `pasadas.estacion_id → estaciones.peaje_id` (RN-05). Está prohibido agregar `peaje_id` a `pasadas`; `tarifas_normalizadas` sí lleva `peaje_id` propio porque agrega a nivel de peaje/estación.
- **El hook corre dentro del flujo de `peajes_confirmar_carga`**, que es el RPC de guardado final invocado desde `PeajesCargaSupabaseService.confirmarCarga()`. El apéndice A define si se engancha como llamada al final del RPC o como trigger `AFTER INSERT` sobre el lote; la decisión y su justificación quedan documentadas ahí.
- **La unicidad de pasadas no cambia.** `pasadas_duplicado_uk (pase_id, fecha_hora, estacion_id, patente_id)` sigue siendo la clave de deduplicación (RN-16) y F14 no la toca.
- **`documentos` reemplazó a `facturas`** y `pasadas.factura_id` es hoy `pasadas.documento_id`. Toda referencia del PRD v2 a `facturas`/`factura_id` debe leerse contra los nombres actuales.
- **La columna de cantidad es `quantity`**, no `cantidad`.
- **`peajes.empresa_id` es `text`**, referencia lógica a `empresas.id::text` o `'__global__'`; no hay tabla `concesiones`. La "Concesión" del Excel se matchea por nombre contra `empresas`/`peajes`. Por eso los objetos nuevos se nombran `*_peaje*` y no `concesion_*` como en el plan v2.
- **Las vistas existentes deben revisarse** cuando `pasadas` gane columnas: `pasadas_con_peaje`, `pasadas_gestion`, `pwbi_pasadas`, `pwbi_documentos`, `pwbi_estacion`, `pwbi_patentes`.

## 6. División por agentes

| Feature | Título | Owner | Alcance de archivos exclusivo | Depende de |
|---|---|---|---|---|
| **F14-0** | Contrato: `CATEGORIA` en `PasadaColumnKey` / `PASADA_COLUMN_KEYS` | `00-orquestador-setup` | `src/app/components/peajes/models/peajes.types.ts` (y modelos vecinos si hace falta el tipo) | — |
| **F14-1** | Tablas, `ALTER TABLE pasadas`, índices, RLS y trigger de validación de status | `01-backend-supabase` | `supabase/migrations/*peajes*`, `docs/backend/peajes/**` | F14-0 |
| **F14-2** | RPCs de normalización/confirmación + enganche post-carga | `01-backend-supabase` | `supabase/migrations/*peajes*`, `docs/backend/peajes/**`, implementación de servicios Supabase bajo `peajes/**/services/*.service.ts` | F14-1 |
| **F14-3** | Wizard: detección de `CATEGORIA` en Paso 2, destino en Paso 5 y persistencia de `pasadas.categoria` | `02-frontend-wizard-tablas` | `src/app/components/peajes/wizard/**` | F14-0, F14-1 |
| **F14-4** | Pantalla `/peajes/auditoria-tarifas` + tarjeta en `peajes-home` | `02-frontend-wizard-tablas` | `src/app/components/peajes/auditoria-tarifas/**`, `peajes-home.component.*` | F14-2 |
| **F14-5** | Documentación de la feature | `04-documentador` | `docs/06-components/peajes/**`, `docs/06-tablas/peajes/**`, `docs/modulos/peajes.md`, índices | F14-1, F14-2, F14-3, F14-4 |
| **F14-6** | QA/E2E contra el dataset de referencia | `05-integrador-qa` | `peajes.routes.ts`, mapa de permisos, `feature_list.json`, `docs/claude-progress.md`, `docs/session-handoff.md` | F14-3, F14-4 |

**Por qué existe F14-0.** `models/peajes.types.ts` es propiedad exclusiva del agente 00 según la tabla de ownership de `ibarra-app/AGENTS.md`. Si 01 o 02 agregaran `CATEGORIA` por su cuenta, dos agentes editarían el mismo archivo en paralelo. F14-0 aísla ese cambio de contrato, se completa y se comitea antes de que arranquen F14-1 y F14-3, exactamente como la regla 1 del modelo de agentes.

**Paralelismo permitido.** Una vez cerrada F14-0, la rama backend (F14-1 → F14-2) y la rama wizard (F14-3) avanzan en paralelo: tocan `supabase/migrations/**` y `wizard/**` respectivamente. F14-4 espera a F14-2 porque consume RPCs reales, aunque puede maquetarse antes contra un mock tipado que implemente la misma interfaz, dejando el contrato exacto en `docs/session-handoff.md` (regla 3). F14-5 documenta solo lo que ya está `passing` (regla 4). F14-6 corre al final y es el único autorizado a fusionar rutas y permisos (regla 5).

## 7. Checklists de ejecución

Cada ítem es verificable. El detalle de SQL, UI y casos de prueba vive en los apéndices; estos checklists definen **qué** hay que hacer y **cómo se comprueba**, sin duplicar la especificación.

### 7.1 Checklist Backend (F14-1, F14-2 · agente `01-backend-supabase`)

- [ ] Confirmar el esquema real antes de escribir DDL: columnas vigentes de `pasadas`, existencia de `documentos` (no `facturas`), tipo `text` de `peajes.empresa_id` y ausencia de `pg_cron`/`pg_net`. Registrar la verificación en `docs/claude-progress.md`.
- [ ] Migración `YYYYMMDDHHMMSS_peajes_tarifas_normalizadas.sql`: crear `tarifas_parametros_peaje` (PK `peaje_id` → `peajes(id)`, `umbral_muestra_minima` int default 15, `umbral_dispersion` numeric default 4.100, `auto_confirmar_horario` boolean default false).
- [ ] Crear `tarifas_status_catalogo` (`peaje_id`, `codigo`, `etiqueta`, `color`, `tipo_meta` en `PICO|NO_PICO|NEUTRO`, `orden`) con unique `(peaje_id, codigo)`.
- [ ] Crear `tarifas_normalizadas` con `peaje_id`, `estacion_id`, `categoria text null`, `importe`, `importe_base`, `cases`, `multiplicador`, `desvio`, `hora_min/max/media`, `patron` (`A`/`B`), `diagnostico` con `CHECK` sobre los seis valores de la capa 1, `status` sin `CHECK`, `muestra_confiable`, `confirmado_manual/por/at`, y unique `NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)`.
- [ ] Crear el trigger `BEFORE INSERT OR UPDATE OF status` que acepta `PENDIENTE`/`POSIBLE_HORARIO` o valida contra `tarifas_status_catalogo` del mismo `peaje_id`, y probar que un código inexistente levanta excepción.
- [ ] `ALTER TABLE pasadas ADD COLUMN categoria text null, tarifa_normalizada_id uuid null, tarifa_status text not null default 'PENDIENTE'`. Verificar que **no** se agrega `peaje_id` (RN-05) y que `pasadas_duplicado_uk` queda intacta (RN-16).
- [ ] Crear los índices del apéndice A, incluidos el parcial de cola de revisión y el parcial de pasadas sin clasificar.
- [ ] Habilitar RLS en las tres tablas nuevas con la política plana `{tabla}_authenticated_all`, idéntica al resto del módulo. Dejar nota explícita de que la RLS por rol/empresa está diferida.
- [ ] Revisar y, si corresponde, recrear `pasadas_con_peaje`, `pasadas_gestion`, `pwbi_pasadas`, `pwbi_documentos`, `pwbi_estacion` y `pwbi_patentes` para que expongan las columnas nuevas sin romper consumidores.
- [ ] Implementar `peajes_normalizar_tarifas(p_documento_id uuid)`: match rápido contra familias existentes, alta de niveles nuevos acotada al documento, y retorno de `pasadas_matcheadas` / `grupos_nuevos`.
- [ ] Implementar `peajes_recalcular_tarifas(p_peaje_id uuid)`: recálculo completo con la foto de todas las pasadas del peaje, sin pisar filas con `confirmado_manual = true`.
- [ ] Implementar `peajes_confirmar_status_tarifa(p_asignaciones jsonb)` aceptando N niveles por familia y propagando `status` a `pasadas.tarifa_status`.
- [ ] Implementar `peajes_marcar_diagnostico_tarifa(p_tarifa_normalizada_id uuid, p_diagnostico text)` restringido a `CATEGORIA` y `REVISAR`.
- [ ] Implementar `peajes_listar_tarifas_normalizadas(p_filtros jsonb, p_page int, p_page_size int, p_sort text)` con paginado server-side y total de filas.
- [ ] Implementar `peajes_grupos_similares_tarifa(p_tarifa_normalizada_id uuid, p_tolerancia numeric default 0.01)` y documentar el límite de familias de 2 niveles.
- [ ] Enganchar la normalización al guardado final: `peajes_confirmar_carga` dispara `peajes_normalizar_tarifas(documento_id)` por cada documento confirmado, sin cambiar la firma pública del RPC ni romper `PeajesCargaSupabaseService.confirmarCarga()`.
- [ ] Verificar migraciones contra Supabase CLI local (`supabase db reset` + aplicación limpia) antes de cualquier push a DESARROLLO; correr `supabase db advisors` y resolver o justificar cada hallazgo.
- [ ] Resolver el drift `20260811190002_peajes_algoritmo_filtrar_columna.sql` (presente en repo, no aplicado en DESARROLLO) **antes** de aplicar las migraciones de F14, para que el orden remoto quede consistente.
- [ ] Documentar tablas y RPCs en `docs/backend/peajes/` y enlazarlos desde `docs/backend/peajes/index.md`.

### 7.2 Checklist Frontend (F14-0, F14-3, F14-4)

**Contrato (F14-0 · agente 00)**

- [ ] Agregar `'CATEGORIA'` a `PasadaColumnKey` y a `PASADA_COLUMN_KEYS` en `models/peajes.types.ts`.
- [ ] **No** agregarlo a `PASADA_COLUMNAS_OBLIGATORIAS`: el destino es opcional y un archivo Patrón A debe seguir validando.
- [ ] Confirmar con `npx tsc --noEmit -p tsconfig.app.json` que ningún consumidor de `PasadaColumnKey` con `switch` exhaustivo queda roto.
- [ ] Comitear F14-0 antes de que arranquen F14-1 y F14-3.

**Wizard (F14-3 · agente 02)**

- [ ] Sumar los alias de `CATEGORIA` en `COLUMN_ALIASES` de `wizard/services/column-recognition.ts`. `normalizarEncabezadoColumna` ya quita acentos y `º` y pasa a mayúsculas, así que `CATEGORIA`, `CATEGORÍA` y `categoria` colapsan a un único alias; agregar además las variantes reales de proveedor que releve el apéndice B.
- [ ] Verificar que `detectColumnRecommendations` propone el destino `CATEGORIA` en el Paso 2 con el `ColumnRecommendationKind` adecuado y que la recomendación es descartable por el usuario.
- [ ] Resolver el conflicto de `MVP_COLUMNAS_EXCLUIDAS` en `wizard/fixtures/mvp-ejemplo.fixture.ts`, que hoy lista `'CATEGORIA'` como columna a descartar: dejar de excluirla y confirmar que ningún fixture MVP existente cambia de resultado.
- [ ] Ofrecer `CATEGORIA` como destino seleccionable en el Paso 5, marcado como opcional en la UI.
- [ ] Propagar el valor mapeado hasta el payload de `peajes_confirmar_carga` para que `pasadas.categoria` se persista como texto crudo, sin normalizar ni mapear a ningún catálogo interno.
- [ ] Comprobar que un archivo sin columna de categoría recorre los nueve pasos y guarda con `pasadas.categoria = NULL` (Patrón A), sin advertencias nuevas en el Paso 8.

**Pantalla de auditoría (F14-4 · agente 02)**

- [ ] Crear la ruta `/peajes/auditoria-tarifas` con permiso `{ module: 'peajes', action: 'read' }`; si hay conflicto de merge en `peajes.routes.ts` o en el mapa de permisos, lo resuelve el agente 05.
- [ ] Construir la pantalla copiando el patrón de `pasadas-pendientes/pasadas-pendientes-list.component.*`: `<table>` nativa para las filas padre, único `expandedId`, fila de detalle con `colspan` que contiene un `app-data-table` compartido anidado, y paginador manual en el footer. No existe ningún constructo `node-children` en el repo; no inventarlo.
- [ ] Usar el prefijo CSS `at__` en todos los estilos propios de la pantalla y reutilizar los patrones de badge existentes (`--ok` / `--pending`) en lugar de crear una paleta nueva.
- [ ] Filtros con `app-filter-chip-rail`, `app-date-range-picker` y `app-search-multi-select`, con debounce de 300 ms vía `Subject`, siguiendo el mismo cableado que `pasadas-pendientes`.
- [ ] Resolver etiqueta y color de cada status en runtime desde `tarifas_status_catalogo` del peaje seleccionado; los dos universales (`PENDIENTE`, `POSIBLE_HORARIO`) tienen presentación fija y un código desconocido cae a badge neutro con el texto crudo, sin romper la vista.
- [ ] Panel de comparación de niveles con un selector de status por nivel de importe (2, 3 o N niveles), sugerencia inicial por `orden` del catálogo y acciones "Es variación por categoría" y "Marcar para revisar". Implementarlo como drawer lateral al estilo `estacion-ubicacion-drawer.component.*` o con el `app-dialog` compartido, según defina el apéndice C.
- [ ] Inyectar los servicios por token (`@Inject(PEAJES_PASADAS_SERVICE)`, `@Inject(PEAJES_CATALOGO_SERVICE)` y el token nuevo de auditoría) y declarar los `providers` en el fragmento de ruta, como el resto del módulo.
- [ ] Botón "Recalcular" por peaje que invoca `peajes_recalcular_tarifas` con estado de carga y feedback de resultado.
- [ ] Agregar la tarjeta en `peajes-home.component.html` con icono `fas fa-chart-line`, título "Auditoría de tarifas" y link "Auditar tarifas", respetando el estilo de las tarjetas vecinas.
- [ ] Verificar responsive en ancho móvil: la tabla padre no debe desbordar y el panel de comparación debe seguir siendo usable.

### 7.3 Checklist Testing (F14-6 · agente `05-integrador-qa`, con aportes de 01/02)

- [ ] Typecheck limpio: `npx tsc --noEmit -p tsconfig.app.json`.
- [ ] Unit tests del wizard: `ng test --include="**/peajes/wizard/**" --watch=false --browsers=ChromeHeadless`, cubriendo detección de `CATEGORIA` en Paso 2, destino opcional en Paso 5 y payload con `categoria`.
- [ ] Unit tests de la pantalla: `ng test --include="**/peajes/auditoria-tarifas/**" --watch=false --browsers=ChromeHeadless`, cubriendo filtros, expansión de detalle, resolución de badges contra catálogo y armado del payload de confirmación.
- [ ] Regresión del módulo completo: `ng test --include="**/peajes/**" --watch=false --browsers=ChromeHeadless` sin fallos nuevos respecto del baseline.
- [ ] Motor offline sin regresiones: `npx --yes tsx src/app/components/peajes/plantillas/motor.verify.ts`.
- [ ] SQL contra Supabase CLI local: aplicar las migraciones de F14 desde cero, insertar el catálogo `PICO`/`NO_PICO` para el peaje de prueba y verificar que el trigger rechaza un código ajeno al catálogo.
- [ ] Dataset de referencia cargado: confirmar en el entorno de prueba las **1711 pasadas** repartidas entre `file_upload_name = 'ConsumosResumen.xlsx'` (1015 pasadas, 26 estaciones) y `'ConsumosResumen-202607-1.xlsx'` (696 pasadas, 30 estaciones). No existe ningún `file_upload_name` que contenga `202607-2`.
- [ ] Ejecutar `peajes_recalcular_tarifas` sobre cada peaje del dataset y comparar el resultado contra `scripts/telepeaje plus/taifa_normalizacion_test/tarifa_test_resumen_union.csv`: **119 filas**, 34 estaciones, 4 concesiones, 22 niveles de importe. El CSV usa delimitador `;` y coma decimal.
- [ ] Contrastar la clasificación humana esperada del CSV — `PICO` 49, `NO_PICO` 52, `PENDIENTE` 18 — contra lo que el motor propone y lo que la pantalla permite confirmar. El motor no tiene que reproducir el status final por sí solo (es decisión humana); lo que se verifica es que las filas candidatas queden en `POSIBLE_HORARIO` y sean confirmables en la pantalla.
- [ ] Tratar el dataset como **Patrón A** en todas las pruebas: ninguno de los dos libros fuente tiene columna de categoría, aunque el CSV etiquete `PATRON = B` en las 119 filas (ver §9).
- [ ] Reconciliar la diferencia 1040→1015: confirmar localización en ZARATE precio=1500 (CSV 114 vs DB 89) y la hipótesis NC `0104-00077675` de `resumen.txt`; documentar antes de dar F14-6 por cerrada.
- [ ] Verificar que la extracción de hora usa `AT TIME ZONE 'UTC'` y que los desvíos ZARATE coinciden con la tabla empírica (Apéndice D §4.3.1).
- [ ] E2E manual del recorrido completo: cargar un archivo, confirmarlo en Paso 9, verificar que el hook creó filas en `tarifas_normalizadas`, confirmar una familia en la pantalla y comprobar que `pasadas.tarifa_status` quedó actualizado en las pasadas correspondientes.
- [ ] Verificar que las vistas de Power BI siguen respondiendo y ahora exponen `tarifa_status`.
- [ ] Registrar comando + resultado de cada verificación en `feature_list.json` → `evidence` y en `docs/claude-progress.md`.

## 8. Contrato Backend ↔ Frontend

| Operación | Firma | Consumidor | Notas |
|---|---|---|---|
| `peajes_normalizar_tarifas` | `(p_documento_id uuid)` → `pasadas_matcheadas int, grupos_nuevos int` | Hook interno de `peajes_confirmar_carga` (Paso 9) | El frontend no la llama directo; puede mostrar el resumen devuelto |
| `peajes_recalcular_tarifas` | `(p_peaje_id uuid)` → `int` (filas actualizadas) | Botón "Recalcular" de la pantalla | Manual; `pg_cron` diferido |
| `peajes_confirmar_status_tarifa` | `(p_asignaciones jsonb)` → `void` | Panel de comparación, acción "Confirmar asignación" | `[{ "tarifa_normalizada_id": uuid, "status_codigo": text }, …]`; soporta N niveles |
| `peajes_marcar_diagnostico_tarifa` | `(p_tarifa_normalizada_id uuid, p_diagnostico text)` → `void` | Panel de comparación, acciones "Es categoría" / "Marcar para revisar" | Solo `CATEGORIA` y `REVISAR` |
| `peajes_listar_tarifas_normalizadas` | `(p_filtros jsonb, p_page int, p_page_size int, p_sort text)` | Tabla principal + filtros | Paginado server-side; devuelve total para el paginador manual |
| `peajes_grupos_similares_tarifa` | `(p_tarifa_normalizada_id uuid, p_tolerancia numeric default 0.01)` | Bloque "grupos similares" del panel | Solo describe familias de 2 niveles |
| `select * from tarifas_status_catalogo where peaje_id = …` | Query directa | Badges, selectores de asignación, pantalla de configuración | Se puede mockear como `[{codigo, etiqueta, color, tipo_meta, orden}]` |
| `select * from tarifas_parametros_peaje where peaje_id = …` | Query directa | Panel de parámetros (umbrales) | Defaults 15 / 4.100 / false |

Convención de nombres confirmada: los RPC del módulo usan `peajes_<verbo>_<sustantivo>`, **sin** prefijos `fn_` ni `rpc_`. Los nombres `fn_normalizar_tarifas`, `rpc_confirmar_diagnostico`, etc. del plan v2 quedan obsoletos.

## 9. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Impacto | Acción |
|---|---|---|---|
| R1 | **El CSV de referencia marca `PATRON = B` en las 119 filas, pero ninguno de los dos libros fuente tiene columna de categoría.** Por la regla de detección (§3), esos datos son **Patrón A**. La señal de categoría del CSV es el campo derivado `Multiplicador (Categoría estimada)`, que es un cálculo, no un dato del proveedor. | Si se asume B, el motor se prueba contra un camino que el dataset no ejercita y la validación de F14-6 no significa nada. | **Bloqueante de interpretación, no de avance.** Tratar el dataset como Patrón A en todas las pruebas y **confirmar la etiqueta con el product owner** antes de cerrar F14-6. No asumir B en silencio. |
| R2 | **Discrepancia 1040 vs 1015, localizada.** La hoja `RESULTADO_1` de `ConsumosResumen.xlsx` tiene 1040 filas; en DESARROLLO hay 1015 pasadas con ese `file_upload_name`. Las 25 faltantes están **todas** en `ZARATE` precio=1500 (CSV 114 vs DB 89). `resumen.txt` del lote apunta a la NC `0104-00077675` no subida. | Contamina el `cases` del nivel base de ZARATE al contrastar CSV↔DB; el resto de niveles ya calza. | Tratar como evidencia fuerte (no prueba cerrada sin abrir el xlsx). MVP: filtrar `documentos.tipo='FC'` y `precio>0`; **ignorar NCs** (no restar cases). Registrar en F14-6; detalle en Apéndice A §15.3 y Apéndice D §2.4 / §4.3.1. |
| R11 | **Zona horaria del `extract(hour)`.** Sin `AT TIME ZONE 'UTC'` el desvío depende de la sesión; con `America/Argentina/Buenos_Aires` el pico del mediodía se mueve a 7–8 a. m. Prueba empírica ZARATE: 4/5 niveles calzan UTC ±0,01 (Apéndice A §15.2, Apéndice D §4.3.1). | Diagnóstico `POSIBLE_HORARIO` vs `CATEGORIA` incorrecto sin que el código falle. | Pin obligatorio `AT TIME ZONE 'UTC'` en todas las agregaciones. Revisar solo si la ingesta guarda offsets reales. |
| R3 | **`MVP_COLUMNAS_EXCLUIDAS` excluye hoy `'CATEGORIA'`** en `wizard/fixtures/mvp-ejemplo.fixture.ts`. | Contradice directamente F14-3: la columna se descartaría antes de poder mapearse. | Quitar la exclusión en F14-3 y verificar que ningún fixture MVP cambia de resultado. |
| R4 | **Drift de migraciones.** `20260811190002_peajes_algoritmo_filtrar_columna.sql` existe en el repo pero no está aplicada en DESARROLLO (13 códigos de algoritmo activos remotos vs 14 en repo). | Aplicar F14 sobre un remoto desalineado deja el historial inconsistente. | Resolver el drift antes de la primera migración de F14 (checklist backend). |
| R5 | **RN-15 — `pasadas.categoria` ≠ `patentes.categoria`.** `pasadas.categoria` es **texto crudo del proveedor** (por ejemplo `"2"`, `"6"`, `"Cat 7"`). `patentes.categoria` es el enum interno de flota (`TRANSPORTE`, `REMIS`, `OBRA`, `AUTO`). | Confundirlas produce joins inválidos y reportes sin sentido. | Nunca hacer join ni equivalencia automática entre ambas. Si alguna vez hace falta, se resuelve con una tabla de equivalencia explícita, fuera del alcance de F14. Dejarlo escrito en `AGENTS.md` y en la documentación de la tabla. |
| R6 | **Vistas dependientes de `pasadas`.** `pasadas_con_peaje`, `pasadas_gestion`, `pwbi_pasadas`, `pwbi_documentos`, `pwbi_estacion`, `pwbi_patentes`. | Un `ALTER TABLE` puede requerir recrear vistas y romper consumidores de Power BI. | Inventariar y recrear en la misma migración; verificar cada vista después de aplicar. |
| R7 | **Sin `pg_cron`/`pg_net` en DESARROLLO.** | No hay recálculo periódico automático. | El recálculo es manual por botón. La programación queda como diferimiento documentado, no como deuda oculta. |
| R8 | **RLS plana.** Las tablas nuevas quedan `authenticated_all`, igual que el resto del módulo. | Cualquier usuario autenticado ve y edita tarifas de cualquier peaje. | Aceptado por PRD §5.2 (auth/roles fuera del MVP). Registrar como diferimiento explícito; no implementar las políticas por rol del plan v2 §28.9, que dependen de claims inexistentes. |
| R9 | **`peajes.empresa_id` es `text` y no hay tabla `concesiones`.** | El plan v2 modela `concesion_id uuid` con FK; ese modelo no existe acá. | Los objetos nuevos usan `peaje_id uuid → peajes(id)`. La "Concesión" del Excel se sigue resolviendo por nombre en el wizard. |
| R10 | **Grupos similares con 3+ niveles.** El ratio `max/min` no describe familias de más de dos niveles. | Bulk-apply potencialmente incorrecto. | El bulk-apply solo se ofrece cuando la cantidad de niveles coincide; para 3+ niveles el analista confirma familia por familia. |

## 10. Definición de terminado por feature

Aplica la definición general de `ibarra-app/AGENTS.md`: comportamiento implementado, verificaciones corridas y pasadas, evidencia registrada en `feature_list.json` y `docs/claude-progress.md`, y documentación actualizada o diferida con nota. Si falta una condición, la feature queda `in_progress` o `blocked` — nunca `passing`.

| Feature | Terminada cuando |
|---|---|
| **F14-0** | `CATEGORIA` está en `PasadaColumnKey` y `PASADA_COLUMN_KEYS`, no está en `PASADA_COLUMNAS_OBLIGATORIAS`, `npx tsc --noEmit -p tsconfig.app.json` pasa y el cambio está comiteado antes de que arranquen 01 y 02. |
| **F14-1** | Las tres tablas, las tres columnas de `pasadas`, los índices, la RLS plana y el trigger de validación están aplicados y verificados en Supabase CLI local; `supabase db advisors` sin hallazgos nuevos sin justificar; vistas dependientes revisadas; documentación en `docs/backend/peajes/`. |
| **F14-2** | Los seis RPCs existen con la firma del §8, el hook corre al confirmar una carga sin cambiar la firma de `peajes_confirmar_carga`, y una carga de prueba genera filas en `tarifas_normalizadas` con `diagnostico` coherente. |
| **F14-3** | El Paso 2 recomienda `CATEGORIA`, el Paso 5 la ofrece como destino opcional, `pasadas.categoria` se persiste como texto crudo, `MVP_COLUMNAS_EXCLUIDAS` ya no la excluye, y un archivo sin categoría sigue guardando en Patrón A. Tests del wizard en verde. |
| **F14-4** | `/peajes/auditoria-tarifas` está registrada con permiso `peajes:read`, la pantalla lista, filtra, expande detalle, resuelve badges desde el catálogo, permite confirmar N niveles y recalcular, y la tarjeta aparece en `peajes-home`. Tests de la pantalla en verde. |
| **F14-5** | La documentación de componentes, tablas y módulo refleja lo implementado (no lo planeado), los índices están actualizados y los enlaces cruzados resuelven. |
| **F14-6** | Todas las verificaciones del checklist de testing corrieron con evidencia; el hueco 1040/1015 quedó localizado (R2: ZARATE-1500 / hipótesis NC); la prueba UTC quedó registrada (R11); la etiqueta `PATRON` se confirmó o se registró como pendiente del product owner (R1); rutas y permisos fusionados sin conflictos. |

## 11. Trazabilidad RN/RF

Referencias de `docs/plan/peaje-prd-es.md` (§8 RF-01..RF-34, §15 RN-01..RN-26) y del PRD de normalización (§20–§27).

| Ref | Enunciado | Punto de cumplimiento en F14 |
|---|---|---|
| **RN-05** | El peaje se deriva de la estación, no se guarda en la pasada | `tarifas_normalizadas.peaje_id` se resuelve por `estaciones.peaje_id` en los RPCs; prohibido agregar `peaje_id` a `pasadas` (F14-1, F14-2) |
| **RN-15** | La categoría del proveedor no es la categoría interna; requiere equivalencia explícita | `pasadas.categoria` es texto crudo y nunca se joinea con `patentes.categoria` (F14-1, F14-3; riesgo R5) |
| **RN-16** | La clave de duplicado conserva la hora completa | `pasadas_duplicado_uk` intacta; el `ALTER TABLE` no la altera (F14-1); reconciliación 1040/1015 (F14-6) |
| **RN-20** | La base guarda códigos de algoritmo, no código ejecutable | El diagnóstico se persiste como código (`POSIBLE_HORARIO`, `CATEGORIA`, …); la lógica vive en los RPCs (F14-1, F14-2) |
| **RN-24** | Trazabilidad a nivel de paso | `confirmado_manual`, `confirmado_por` y `confirmado_at` registran quién y cuándo resolvió cada familia (F14-1, F14-2) |
| **RF-06** | Detección de tipos y encabezados | Alias de `CATEGORIA` en `column-recognition.ts`, Paso 2 (F14-3) |
| **RF-14** | Mapeo de columnas a la estructura estándar | Destino opcional `CATEGORIA` en el Paso 5 (F14-0, F14-3) |
| **RF-26** | Auditoría de la carga | Pantalla `/peajes/auditoria-tarifas` y cola de revisión (F14-4) |
| **RF-32** | Reportes y salida a Power BI | `tarifa_status` propagado a `pasadas` y expuesto en `pwbi_*` (F14-1, F14-2) |
| **§20–§22** | Motor de normalización y tabla estándar de salida | `tarifas_normalizadas` (F14-1) |
| **§23–§24** | Algoritmos Patrón A y Patrón B | `peajes_normalizar_tarifas` y `peajes_recalcular_tarifas` (F14-2) |
| **§25** | Parámetros configurables por concesión | `tarifas_parametros_peaje` (F14-1) |
| **§26–§27** | Nueva entidad y alcance MVP | §2 de este plan |

## 12. Referencias

### Apéndices de esta carpeta

- [APENDICE-A-modelo-datos-sql.md](./APENDICE-A-modelo-datos-sql.md) — DDL completo, RPCs, índices, RLS y hook post-carga.
- [APENDICE-B-deteccion-categoria-y-mapeo.md](./APENDICE-B-deteccion-categoria-y-mapeo.md) — detección de `CATEGORIA` en el Paso 2 y destino en el Paso 5.
- [APENDICE-C-pantalla-auditoria-frontend.md](./APENDICE-C-pantalla-auditoria-frontend.md) — especificación UI/UX de `/peajes/auditoria-tarifas`.
- [APENDICE-D-testing-y-dataset-referencia.md](./APENDICE-D-testing-y-dataset-referencia.md) — plan de pruebas y dataset de referencia.
- [INDEX.md](./INDEX.md) — índice de la carpeta y orden de lectura por agente.

### Fuentes originales

- [PRD_Feature_Normalizacion_Tarifaria.md](../normalizacion-tarifa/PRD_Feature_Normalizacion_Tarifaria.md) — §20–§27, patrones y algoritmos.
- [PLAN_Backend_Frontend_Tarifas_Normalizadas.md](../normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md) — §28–§30, skeleton SQL v2. **Sus nombres de objetos y de RPC quedaron obsoletos**; prevalecen los de este plan.
- [peaje-prd-es.md](../peaje-prd-es.md) — fuente de verdad de RF-xx y RN-xx.
- `../../../feature_list.json` — estado canónico de F14-0..F14-6.
- `../../../AGENTS.md` — ownership de archivos y definición de terminado.
- Dataset de referencia: `scripts/telepeaje plus/taifa_normalizacion_test/tarifa_test_resumen_union.csv` y los libros `scripts/telepeaje plus/202607-1/ConsumosResumen-202607-1.xlsx` y `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx`.

> Última actualización: 2026-08-12
