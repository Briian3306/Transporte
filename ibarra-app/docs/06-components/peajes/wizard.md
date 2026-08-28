# Guía — Wizard de carga de peajes

## Resumen

`PeajesWizardComponent` (`app-peajes-wizard`) orquesta el asistente guiado de carga Excel → transformaciones → mapeo → factura → validación → confirmación (PRD §4). Implementado por Agente 02 (F02-1…F02-9 `passing`). Pasos 3–4 consumen el motor de Agente 03 sin duplicar Strategy.

## Índice

- [Resumen](#resumen)
- [Ubicación y rutas](#ubicación-y-rutas)
- [Pasos](#pasos)
- [Estado (RF-25)](#estado-rf-25)
- [Sugerencias IA de factura (F17)](#sugerencias-ia-de-factura-f17) — guía canónica: [ia-factura.md](./ia-factura.md)
- [Excel](#excel)
- [Providers actuales](#providers-actuales)
- [Dependencias](#dependencias)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Ubicación y rutas

| Artefacto | Path |
|-----------|------|
| Shell | `src/app/components/peajes/wizard/peajes-wizard.component.*` |
| Fragmento rutas | `wizard/wizard.routes.ts` → `PEAJES_WIZARD_ROUTES` |
| Path esperado | `/peajes/wizard` |

### Vista Express para usuarios

La ruta `/peajes/carga-express` ofrece una variante reducida del wizard para usuarios que
trabajan con plantillas ya configuradas. Solo muestra Carga, Estaciones, Factura y Revisión;
el Paso 8 de Validación aparece como pantalla intermedia cuando la validación encuentra errores
o una diferencia de factura fuera de tolerancia.

El Paso 1 exige archivo, empresa y plantilla. La plantilla se aplica automáticamente y el usuario
no modifica transformaciones, mapeos ni configuraciones. Si todas las estaciones quedan reconocidas,
el flujo salta directamente a Factura. Las recomendaciones o estaciones sin resolver mantienen
visible el Paso 6 para que el usuario las confirme.

La tarjeta de inicio está en `peajes-home.component.html` como **Carga rápida** y utiliza el mismo
permiso `peajes:read` que el módulo. El wizard administrativo `/peajes/wizard` conserva sus nueve
pasos y el acceso al ejemplo MVP.

**Estado de integración:** el fragmento **no** está mergeado en `peajes.routes.ts` (solo home). Merge = Agente 05.

---

## Pasos

| # | Label | Componente | Notas |
|---|-------|------------|-------|
| 1 | Carga | `paso1-carga` | Upload `.xlsx`/`.csv` + empresa + plantilla. PDF de factura opcional: uno en simple, N en masiva (nombre = columna `FACTURA`). Con plantilla compatible → `facturaDirecta` Paso 7; excepciones → Paso 5/6; sin plantilla → Paso 2 |
| 2 | Preview | `paso2-preview` | Máx. 10 filas (RNF-03). Rail de recomendaciones semánticas (F02-11). Por defecto solo columnas reconocidas quedan incluidas (F02-12): ver [reconocimiento-columnas.md](./reconocimiento-columnas.md) |
| 3 | Transformaciones | `paso3-transformaciones` | Motor 03 |
| 4 | Plantilla | `paso4-plantilla` | Aplica pipeline + `mapeos` + estaciones (F09). Sin excepciones → `facturaDirecta` Paso 7; si no, `irAExcepcion` 5 o 6 |
| 5 | Mapeo | `paso5-mapeo` | Columnas → Structure Goal. Destinos opcionales: **`CATEGORIA`** (F14-3 / RN-15) y **`PASE_ID`** (F02-18: último `pases.created_at` de la patente). Sin `PRECIO` y con `IMPORTE_NETO`, se toma el neto. Tira «Para avanzar» nombra destinos cubiertos / de catálogo / faltantes; Continuar no se deshabilita en silencio. Detecta `Concesion`→Peaje (RN-26). Patentes: [patentes-sin-resolver.md](./patentes-sin-resolver.md) (F02-14) |
| 6 | Estaciones | `paso6-estaciones` | Relación proveedor ↔ estación filtrada por peaje de `Concesion`/empresa (RN-26); alta en `app-dialog` ([reconocimiento-estaciones.md](./reconocimiento-estaciones.md), F02-13). Código `0001` Zarate vs DOCK SUD: la empresa del Paso 1 acota `reconocerEstacion` (F02-17) |
| 7 | Factura | `paso7-factura` | Cuenta opcional; subtotal, percepciones, IVA y total declarados; empresa SMS single (Paso 1); fecha DRP single. En simple, candidatos IA clickeables (F17). Recomienda crear plantilla completa (pipeline+mapeos+estaciones) |
| 8 | Validación | `paso8-validacion` | Errores fila/columna/valor/motivo y diferencia neto de factura vs. pasadas |
| 9 | Revisión | `paso9-revision` | Confirmación de carga |

### Paso 5 — cobertura y destinos opcionales (F02-18)

Continuar permanece clicable. Si falta un destino, el badge dice `Falta ESTACION_ID` (claves reales) y la tira **Para avanzar** explica cada chip: cubierto, cubierto por catálogo, o falta + cómo resolverlo. No se usa un botón primario deshabilitado sin mensaje.

| Destino | Si el archivo no lo trae |
|---------|--------------------------|
| `PASE_ID` | Opcional. Paso 8 toma el último pase de `pases` (`created_at` desc) para esa `patente_id`. Si la patente no tiene pase, el error nombra la placa. Un TAG/dispositivo mapeado sigue resolviéndose (o creándose) por código. |
| `PRECIO` | Si hay `IMPORTE_NETO`, se completa PRECIO = neto + bonificación (mismo patrón que QUANTITY/BONIFICACION sintéticos). |
| `CATEGORIA` | Sigue opcional (Patrón A / F14-3). |

Helper: `ultimo-pase-patente.helper.ts`. Catálogo vía `PeajesCatalogoService.listarPases()`.

---

## Estado (RF-25)

### Flujo Express de patentes y pasos dinámicos

En `/peajes/carga-express`, el Paso 5 administrativo se reemplaza por `patentes-express`
cuando la plantilla deja dominios sin catálogo. El usuario puede agregar patentes de forma
individual, agregarlas masivamente o excluirlas del import. Antes de validar, cada patente
del proveedor se convierte a su UUID interno.

El stepper Express asigna números visuales consecutivos y ordena Patentes antes de Estaciones.
Estaciones solo se muestra cuando el reconocimiento deja recomendaciones o pendientes; si todas
las estaciones están reconocidas, el flujo avanza directamente a Factura. La aplicación de
plantilla distingue excepciones de `mapeo`, `patentes` y `estaciones`.

> Para controles, errores técnicos y el criterio de avance del Paso 8, consultar [validacion-carga.md](./validacion-carga.md).

`PeajesWizardStateService` mantiene el paso actual y datos intermedios del flujo (archivo, preview, mapeos, relaciones, factura, resultado de validación).

### Plantillas recurrentes (F09)

En **Paso 1**, Empresa y Plantilla usan `app-search-select` (búsqueda single). Si hay archivo + empresa + plantilla, `PeajesPlantillaApplyService` aplica pipeline/mapeos/estaciones al Continuar: sin excepciones → Paso 7; con excepciones → Paso 5 o 6; sin plantilla → Paso 2.

En Paso 4 (flujo sin plantilla temprana) se reutiliza el mismo servicio. `validarDefinicionPlantilla` considera destinos del pipeline **o** `mapeos` activos. Detalle: [reconocimiento-estaciones.md](./reconocimiento-estaciones.md) y PRD §4 / §7.4.

### Factura, percepciones, IVA y tolerancia

El Paso 7 persiste cuatro valores declarados por el usuario: `importe_sin_iva` como **subtotal**, `percepciones`, `iva` e `importe_total`. El total no se recalcula ni bloquea la carga: el único contraste contra las pasadas es subtotal versus suma de importes netos, con una diferencia absoluta admisible de hasta el **1% del subtotal**. La suma de pasadas se hace en centavos para no introducir desvíos por precisión decimal de JavaScript. RAE no integra el desglose actual.

Caso real documentado: para `557074.csv`, la factura `0840-0557074` del `2026-08-01` usa subtotal `560832.27`, percepciones `24676.62`, IVA `117774.78` y total `703283.67`.

### Recomendaciones de columnas (F02-11)

Tras `setPreview`, el estado calcula `recomendaciones` a partir de aliases semánticos (`column-recognition.ts`).

| API | Efecto |
|-----|--------|
| `recomendacionesPendientes()` | Badges aún no aplicadas/descartadas |
| `aceptarRecomendacion(id)` | Merge de `draftSteps` → `configuracionesDraft` + includes/mapeo hints |
| `descartarRecomendacion(id)` | Oculta la badge (`dismissed`) |
| `aceptarTodasRecomendaciones()` | Aplica todas las pendientes |

Detalle canónico: [reconocimiento-columnas.md](./reconocimiento-columnas.md).

**F02-12:** tras detectar recomendaciones, `setPreview` deja **incluidas** solo las columnas de `incluirColumnas` y el resto en **excluidas** (el usuario puede volver a marcarlas). Si no hay reconocimiento, se mantiene include-all. La heurística MVP full-headers puede sobrescribir la selección.

---

## Sugerencias IA de factura (F17)

Rol, objetivo y límites: **[ia-factura.md](./ia-factura.md)**. Abajo, el encaje en los pasos del wizard.

En importación **simple** y **masiva** (wizard y `/peajes/carga-express`) el usuario puede adjuntar PDF de factura opcionales. La IA **no guarda** la carga: solo propone candidatos. Sin PDF, con PDF inválido, sin candidatos o si OpenRouter falla, el usuario completa el documento a mano.

En **masiva** el nombre del PDF (sin extensión) debe coincidir con el valor de la columna `FACTURA` (`123` → `123.pdf`). Los PDF sin match se listan como aviso y no bloquean.

### PDF opcional (Paso 1)

El dropzone y el file picker aceptan **el Excel/CSV y PDF juntos** (`multiple`). En simple: un PDF. En masiva: N PDF. Extrae texto de **todas** las páginas (`InvoicePdfTextService` + `pdf-parse`) y lo deja en memoria. Quitar el PDF invalida sugerencias. Un error de lectura es inline y no bloquea Continuar.

### Disparo post-plantilla

Tras `aplicarYEvaluar` con `ok === true` y `excepcion === null`, Paso 1 llama `maybeAnalyzeInvoice` **antes** de emitir `facturaDirecta`. Requisitos: modo simple, texto PDF y neto de referencia positivo. Si el flujo pasa por Pasos 5/6, Paso 7 relanza el análisis cuando el estado IA sigue en `idle`.

No analiza filas de preview solas. Si el fingerprint no cambió y el estado ya es `ready` o `loading`, no vuelve a consultar.

### Neto de referencia (centavos)

`invoiceExpectedNetAmount()` suma `IMPORTE_NETO` de las pasadas post-plantilla en **centavos enteros** (`Math.round(valor * 100)`) y devuelve pesos (`cents / 100`) para el POST. Solo en modo simple, con plantilla/pipeline aplicado y suma > 0. El fingerprint es `fileName|size|lastModified|plantillaId|netCents`.

### OpenRouter desde el browser

`OpenRouterEngineService` hace POST a `environment.openRouterApiUrl` (OpenRouter chat completions) con prompt, schema y modelo. Ante 429, 408, 404, 5xx, timeout, error de red, `provider returned error` o `no endpoints found` reintenta en este orden: `NG_APP_OPENROUTER_MODEL` + `NG_APP_OPENROUTER_API_KEY` → mismo modelo + `NG_APP_OPENROUTER_API_KEY_2` → `NG_APP_OPENROUTER_MODEL_2` + key 1. Timeout HTTP 120s. Las keys viajan en el bundle; no se loguean. El PDF, el texto y las sugerencias no se persisten ni se escriben en Supabase. No se usa `/.netlify/functions/peajes-invoice-ai` para este flujo.

Estados: `idle` | `loading` | `ready` | `error`. En Paso 1 (importación simple) se muestra `app-ai-cat-loader` con “Soy tu Asistente de IA”. En Paso 7, `loading` muestra el mismo componente (burbuja inferior izquierda, frases rotativas; hover la sube un poco) y el formulario permanece editable. **Reintentar análisis** aparece solo si `status === 'error'`. Contrato de la IA: [ia-factura.md](./ia-factura.md).

### Click para aplicar (Paso 7)

Bajo cada campo elegible hay botones (valor localizado, porcentaje y `Confianza alta/media/baja`). Un clic parchea **solo** ese control y lo marca dirty. Mapeo:

| Campo IA | Control |
|----------|---------|
| `invoiceNumber` | `factura` |
| `invoiceDate` | `fecha_factura` (+ `fechaRanges[0]`) |
| `vat` | `iva` |
| `perceptions` | `percepciones` |
| `subtotal` | `importe_sin_iva` |
| `total` | `importe_total` |

No hay auto-apply masivo. El ranking de `subtotal_candidates` prioriza el valor más cercano al neto esperado post-plantilla (±1%).

Plan: `docs/plan/invoice-ai/PLAN_invoice-ai.md`. Features `F17-1`…`F17-5`.

---

## Excel

`PeajesExcelService` usa dependencia `xlsx` para parsear el archivo y producir preview tipado (`ExcelCargaPreview`).

---

## Providers actuales

El wizard y `wizard.routes.ts` aún proveen **mocks**:

```ts
{ provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService }
{ provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService }
```

Servicios reales listos (F01): `PeajesCatalogoSupabaseService`, `PeajesCargaSupabaseService`. Swap documentado en [servicios-y-providers.md](./servicios-y-providers.md).

---

## Dependencias

- Contratos: `peajes-services.contracts.ts`
- Motor: `PeajesMotorTransformacionService` (pasos 3–4)
- Catálogos UI hermanados: [catalogos.md](./catalogos.md)
- Persistencia: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md)

---

## Verificación

```text
ng build --configuration=development → OK
ng test --watch=false --browsers=ChromeHeadless
  --include="**/peajes/wizard/**/*.spec.ts"
  --include="**/peajes/catalogos/**/*.spec.ts" → 12 SUCCESS
```

---

## Referencias

### Reconocedor de estaciones

El Paso 6 normaliza el valor del proveedor y prioriza alias confirmado, nombre exacto y sugerencias parciales dentro de la empresa. Las sugerencias requieren confirmación; solo después de declarar que ninguna coincide se habilita crear una estación. Caso reproducible: [AUSOL 557074](../../plan/prueba-workflow-557074-ausol.md).

### Company → Concesion → Peaje → Estaciones (RN-26 / RF-17)

Para formatos con columna Excel `Concesion` (ConsumosResumen / Telepase Plus):

```text
COMPANY (Paso 1 / documento)
   ↓
Concesion (Excel)  →  PEAJE del catálogo
   ↓
ESTACIONES solo de ese Peaje
```

| Paso | Comportamiento |
|------|----------------|
| **5** | Detecta `Concesion` (metadata). Reconoce peajes con el mismo algoritmo que estaciones (exacta / sugerencias / sin_coincidencia). Panel estilo «patentes sin resolver»: chips de sugerencia + **Agregar peaje** (dialog con empresa). |
| **6** | Filtra estaciones por peaje de Concesión. En **masiva** no muestra la tarjeta «Peaje relacionado» (muchas filas); en simple (≤12) la muestra **arriba** de la tabla. |

No se muestran estaciones de peajes/empresas ajenos en el alcance por defecto. Relaciones: tablas `empresas` → `peajes` → `estaciones` (sin listas hardcodeadas).

Guía operativa: [importacion-masiva-consumos-resumen.md](./importacion-masiva-consumos-resumen.md) · [reconocimiento-estaciones.md](./reconocimiento-estaciones.md).

- PRD §4 (pasos), RN-26, RF-16/RF-17, §21 (caso E2E — pendiente Agente 05)
- Código: `src/app/components/peajes/wizard/**`

---

> Última actualización: 2026-08-24
