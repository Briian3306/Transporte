# Apéndice B — Detección de `CATEGORIA` y mapeo hasta la base

> **Este documento es una especificación de implementación, no código aplicado.**
> Ninguno de los cambios descritos existe todavía en `ibarra-app/src/`. Cada
> bloque de código marcado como *Propuesta* es lo que hay que escribir; los
> bloques marcados como *Código actual* son citas literales del repositorio con
> su ruta y sus líneas.

Épica **F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)**.
Este apéndice cubre el camino completo de la dimensión "categoría del
proveedor": desde que el wizard reconoce la columna en el archivo hasta que el
valor queda guardado en `pasadas.categoria`.

Features involucradas y sus dueños:

| Feature | Alcance en este apéndice | Agente |
|---|---|---|
| **F14-0** | `'CATEGORIA'` en `PasadaColumnKey` y `PASADA_COLUMN_KEYS` (§4) | 00 — Orquestador |
| **F14-3** | Detección en Paso 2 y mapeo en Paso 5 (§2, §3, §5) | 02 — Frontend Wizard |
| **F14-2** | Persistencia de `categoria` en `peajes_confirmar_carga` (§5.4) | 01 — Backend |
| **F14-5** | Documentación (§8) | 04 — Documentador |

Documentos hermanos:

| Documento | Contenido |
|---|---|
| `PLAN-auditoria-pasadas-patrones.md` | Plan principal de la épica |
| [`APENDICE-A-modelo-datos-sql.md`](./APENDICE-A-modelo-datos-sql.md) | Modelo de datos, DDL y RPCs |
| **`APENDICE-B-deteccion-categoria-y-mapeo.md`** | **Este archivo** |
| `APENDICE-C-pantalla-auditoria-frontend.md` | Pantalla de auditoría (UI) |
| `APENDICE-D-testing-y-dataset-referencia.md` | Casos de prueba y dataset |

---

## Índice

- [1. Regla de detección de patrón](#1-regla-de-detección-de-patrón)
- [2. Detección en Paso 2](#2-detección-en-paso-2)
- [3. Conflicto a resolver: MVP_COLUMNAS_EXCLUIDAS](#3-conflicto-a-resolver-mvp_columnas_excluidas)
- [4. Destino de mapeo en Paso 5](#4-destino-de-mapeo-en-paso-5)
- [5. Propagación hasta la base](#5-propagación-hasta-la-base)
- [6. Relación con el motor de transformaciones](#6-relación-con-el-motor-de-transformaciones)
- [7. Impacto en plantillas recurrentes](#7-impacto-en-plantillas-recurrentes)
- [8. Documentación a actualizar](#8-documentación-a-actualizar)
- [9. Checklist por dueño](#9-checklist-por-dueño)

---

## 1. Regla de detección de patrón

La épica distingue dos patrones de familia tarifaria. La regla que los separa es
**una sola** y es puramente estructural:

> Si en el **Paso 5 (Mapeo de columnas)** hay una columna del archivo mapeada al
> destino `CATEGORIA`, la carga es **Patrón B**. Si no la hay, es **Patrón A**.

No interviene ninguna heurística sobre los datos, ni el nombre del proveedor, ni
la cantidad de valores distintos. El patrón es una consecuencia mecánica del
mapeo, y por eso se puede calcular igual en el frontend (para el resumen
post-carga) que en la base (`CASE WHEN p.categoria IS NULL THEN 'A' ELSE 'B' END`,
Apéndice A §5 y §6).

```text
                       ┌──────────────────────────────┐
                       │ Paso 1-2 · Carga y preview   │
                       │ detectColumnRecommendations  │
                       └──────────────┬───────────────┘
                                      │
                     ¿alias de categoría en los headers?
                          ┌───────────┴───────────┐
                         sí                       no
                          │                        │
                          ▼                        │
         recomendación 'categoria' en el rail      │
         del asistente (mapeoHints → CATEGORIA)    │
                          │                        │
              ┌───────────┴──────────┐             │
           Aplicar               Descartar         │
              │                       │            │
              ▼                       ▼            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Paso 5 · wizard/paso5-mapeo                              │
   │ El usuario ve la grilla origen → destino y puede         │
   │ mapear/desmapear CATEGORIA a mano (es OPCIONAL)          │
   └──────────────────────────┬───────────────────────────────┘
                              │
             ¿algún MapeoColumna activo con
             columnaDestino === 'CATEGORIA'?
                  ┌───────────┴───────────┐
                 sí                       no
                  │                        │
                  ▼                        ▼
            ┌───────────┐           ┌───────────┐
            │ PATRÓN B  │           │ PATRÓN A  │
            └─────┬─────┘           └─────┬─────┘
                  │                       │
   pasadas.categoria = texto crudo   pasadas.categoria = NULL
                  │                       │
                  ▼                       ▼
   familia = (estación, categoría)   familia = (estación)
   la variación intra-familia        la variación intra-familia
   se explica por HORARIO            puede ser HORARIO o CATEGORÍA
   (el proveedor ya separó           no declarada → el analista
    por tipo de vehículo)             decide (Apéndice A §6.1)
```

**Corrección respecto del borrador v2.** El documento
[`PLAN_Backend_Frontend_Tarifas_Normalizadas.md`](../normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md)
§28.4 dice *«se completa en el wizard, paso 8 (Mapeo de columnas)»*. Es
incorrecto: el mapeo de columnas es el **Paso 5**
(`src/app/components/peajes/wizard/paso5-mapeo/`). La numeración real del wizard
en este repo es Paso 1 carga · Paso 2 preview · Paso 3 transformaciones · Paso 4
plantilla · **Paso 5 mapeo** · Paso 6 estaciones · Paso 7 factura · Paso 8
validación · Paso 9 confirmación. Toda referencia a "paso 8" en el contexto de
mapeo debe leerse como **Paso 5**.

### 1.1 Por qué el Patrón A es el caso interesante

En Patrón B el proveedor ya hizo el trabajo: si `CAMPANA / categoría 2` tiene
dos importes distintos, la categoría no puede explicarlos, así que la variación
es horaria casi por descarte.

En Patrón A la misma estación puede mostrar `$994.15` y `$1192.99` sin ninguna
columna que explique la diferencia, y hay dos hipótesis igual de plausibles:
recargo de hora pico, o dos tipos de vehículo que el archivo no distingue. Esa
ambigüedad es exactamente lo que el motor de dispersión horaria del Apéndice A
§6.1 intenta resolver, y lo que la pantalla de auditoría le pide confirmar al
analista.

Hoy en DESARROLLO **todas** las pasadas cargadas son Patrón A: ni los archivos
`ConsumosResumen` ni los CSV de Telepase traen columna de categoría mapeada.

---

## 2. Detección en Paso 2

Archivo a modificar:
`src/app/components/peajes/wizard/services/column-recognition.ts`.
Dueño: **agente 02 (F14-3)**.

El archivo es lógica pura (sin dependencias de Angular) y ya implementa el
patrón que hay que copiar. Son cuatro cambios puntuales.

### 2.1 Cambio 1 — sumar `'categoria'` a `ColumnRecommendationKind`

*Código actual* — `column-recognition.ts` líneas 15–22:

```typescript
export type ColumnRecommendationKind =
  | 'fecha_hora'
  | 'patente'
  | 'tarifa'
  | 'bonificacion'
  | 'eliminar_iva'
  | 'dispositivo'
  | 'estacion';
```

*Propuesta*:

```typescript
export type ColumnRecommendationKind =
  | 'fecha_hora'
  | 'patente'
  | 'tarifa'
  | 'bonificacion'
  | 'eliminar_iva'
  | 'dispositivo'
  | 'estacion'
  | 'categoria';
```

### 2.2 Cambio 2 — sumar el bucket `category` a `COLUMN_ALIASES`

*Código actual* — `column-recognition.ts` líneas 40–48:

```typescript
export const COLUMN_ALIASES = {
  plate: [...CONSUMOS_RESUMEN_ALIASES.patente],
  fare: [...CONSUMOS_RESUMEN_ALIASES.precio],
  discount: [...CONSUMOS_RESUMEN_ALIASES.bonificacion],
  date: [...CONSUMOS_RESUMEN_ALIASES.fecha],
  time: ['HORA'],
  device: [...CONSUMOS_RESUMEN_ALIASES.pase],
  station: [...CONSUMOS_RESUMEN_ALIASES.estacion],
} as const;
```

*Propuesta*:

```typescript
export const COLUMN_ALIASES = {
  plate: [...CONSUMOS_RESUMEN_ALIASES.patente],
  fare: [...CONSUMOS_RESUMEN_ALIASES.precio],
  discount: [...CONSUMOS_RESUMEN_ALIASES.bonificacion],
  date: [...CONSUMOS_RESUMEN_ALIASES.fecha],
  time: ['HORA'],
  device: [...CONSUMOS_RESUMEN_ALIASES.pase],
  station: [...CONSUMOS_RESUMEN_ALIASES.estacion],
  category: ['CATEGORIA', 'CATEG', 'CLASE', 'TIPO VEHICULO', 'CATEGORIA VEHICULO'],
} as const;
```

Los otros buckets delegan en `CONSUMOS_RESUMEN_ALIASES`
(`src/app/components/peajes/models/consumos-resumen.helpers.ts`, líneas 10–20),
que hoy **no** tiene una entrada de categoría. Hay dos caminos:

| Camino | Implicancia |
|---|---|
| **(a)** Definir los aliases inline en `COLUMN_ALIASES.category`, como arriba | `consumos-resumen.helpers.ts` está bajo `models/`, alcance exclusivo del **agente 00**. Con este camino, F14-3 no lo toca |
| (b) Agregar `categoria: [...]` a `CONSUMOS_RESUMEN_ALIASES` y delegar | Más consistente con el resto del archivo, pero requiere un cambio de agente 00 y lo convierte en parte de F14-0 |

**Recomendación: camino (a).** `CONSUMOS_RESUMEN_ALIASES` describe el formato
`ConsumosResumen` de un proveedor concreto, y ese formato **no tiene** columna de
categoría; agregarle una entrada sería documentar algo falso. El bucket
`time: ['HORA']` (línea 45) ya sienta el precedente de un alias definido inline
cuando no corresponde al formato ConsumosResumen.

#### Cómo se comparan los aliases (y por qué la lista es más corta de lo que parece)

`resolveAlias` (líneas 82–96) normaliza con `normalizarEncabezadoColumna`, que
está en `consumos-resumen.helpers.ts` líneas 23–31:

```typescript
export function normalizarEncabezadoColumna(valor: string): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[º°]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
```

Es decir: descompone los acentos y borra las marcas diacríticas, elimina `º`/`°`,
colapsa espacios y pasa a mayúsculas. Consecuencia práctica: **`CATEGORIA`,
`Categoría`, `categoria` y ` CATEGORÍA ` normalizan todas a `CATEGORIA`**, así
que alcanza con un único alias para cubrir las cuatro. No hay que enumerar
variantes de acentuación ni de capitalización.

Lo que la normalización **no** cubre son los sinónimos reales del negocio, y ahí
sí hace falta enumerar. Criterio propuesto para decidir qué entra en la lista:

| Alias | ¿Se incluye? | Razón |
|---|---|---|
| `CATEGORIA` | Sí | Encabezado canónico; ya aparece en el fixture MVP (§3) |
| `CATEG` | Sí | Abreviatura frecuente en exportaciones con ancho de columna limitado |
| `CLASE` | Sí | Sinónimo directo; sin otro significado plausible en un archivo de pasadas |
| `TIPO VEHICULO` | Sí | Descripción larga; la normalización ya cubre `Tipo Vehículo` y `TIPO VEHÍCULO` |
| `CATEGORIA VEHICULO` | Sí | Variante larga del canónico |
| `TIPO` | **No** | Demasiado genérico: colisiona con tipo de documento, tipo de dispositivo, tipo de vía |
| `CAT` | **No** | Tres letras, alto riesgo de falso positivo |
| `EJES` | **No** | Es un dato físico, no la categoría comercial del proveedor. Podría derivarse, pero eso es una transformación, no un alias |

**Regla general para agregar aliases más adelante:** un alias entra si (1) fue
observado en un archivo real de un proveedor —adjuntar el archivo o la fila del
CSV en el PR—, y (2) no tiene otro significado plausible dentro de un archivo de
pasadas. Un falso positivo acá es caro: mapearía silenciosamente una columna
equivocada a `CATEGORIA` y contaminaría las familias tarifarias de esa concesión
con una dimensión inventada. Ante la duda, dejarlo afuera: el usuario siempre
puede mapear la columna a mano en el Paso 5.

### 2.3 Cambio 3 — bloque de detección en `detectColumnRecommendations`

El bloque a imitar es el de `estacion`. *Código actual* — líneas 413–426:

```typescript
  if (stationCol) {
    recs.push({
      id: 'rec-estacion',
      kind: 'estacion',
      title: `Recomendado: ${stationCol} → ESTACION_ID`,
      detail:
        'Mapear Estación del Excel al catálogo interno. Concesión puede ser empresa o peaje; la estación puede cruzar empresas.',
      status: 'pending',
      columnasEntrada: [stationCol],
      draftSteps: [],
      incluirColumnas: [stationCol],
      mapeoHints: [hint(stationCol, 'ESTACION_ID')],
    });
  }
```

Es el molde exacto: una recomendación **sin pasos de pipeline**
(`draftSteps: []`) que solo fuerza la inclusión de la columna y sugiere el
destino de mapeo. `hint()` está definido en las líneas 359–361:

```typescript
function hint(origen: string, destino: PasadaColumnKey | null): MapeoColumna {
  return { columnaOrigen: origen, columnaDestino: destino, excluida: false };
}
```

*Propuesta* — resolver el alias junto a los demás (después de la línea 381, donde
se resuelve `stationCol`):

```typescript
  const categoryCol = resolveAlias(lookup, COLUMN_ALIASES.category);
```

y agregar el bloque inmediatamente **después** del bloque de `estacion`
(línea 426), para que en el rail del asistente la recomendación de categoría
aparezca al lado de la de estación, que es su vecina conceptual:

```typescript
  if (categoryCol) {
    recs.push({
      id: 'rec-categoria',
      kind: 'categoria',
      title: `Recomendado: ${categoryCol} → CATEGORIA`,
      detail:
        'Conservar la categoría del proveedor tal cual viene en el archivo. Habilita el análisis tarifario por categoría (Patrón B); sin esta columna las tarifas se agrupan solo por estación.',
      status: 'pending',
      columnasEntrada: [categoryCol],
      draftSteps: [],
      incluirColumnas: [categoryCol],
      mapeoHints: [hint(categoryCol, 'CATEGORIA')],
    });
  }
```

Cuatro decisiones que conviene dejar explícitas:

1. **`draftSteps: []`.** No se agrega ningún paso de pipeline. Ver §6: `CATEGORIA`
   no necesita una estrategia nueva y en el caso normal ni siquiera necesita una
   transformación.
2. **`incluirColumnas: [categoryCol]`.** Esto es funcionalmente necesario, no
   cosmético. Por F02-12, al detectarse recomendaciones el wizard **excluye todo
   lo que no esté en `incluirColumnas`** (ver
   `docs/06-components/peajes/reconocimiento-columnas.md` §UI Paso 2, punto 2).
   Sin esta línea, la columna de categoría quedaría excluida en el Paso 2 y no
   llegaría al Paso 5.
3. **`mapeoHints`** apunta al destino `'CATEGORIA'`, que **todavía no existe** en
   `PasadaColumnKey`. Este cambio **no compila** hasta que F14-0 esté cerrada
   (§4). Es la dependencia dura de F14-3 sobre F14-0.
4. **`id: 'rec-categoria'`** sigue la convención `rec-<kind>` del resto del
   archivo, que el estado usa como clave de aceptar/descartar.

### 2.4 Cambio 4 — qué NO tocar

- **`buildDemoPipelineSeeds`** (líneas 521–544) y **`tieneHeadersParaSeedDemo`**
  (líneas 556–566) exigen fecha + hora + patente + dispositivo + tarifa +
  bonificación para sembrar el pipeline Demo. **No sumar categoría a esa lista**:
  la haría obligatoria para el seed y rompería el seed en todo archivo que no la
  traiga, que hoy son todos.
- **`MVP_SEED_ALIASES`** (líneas 547–554): tampoco. Es el subconjunto de aliases
  del seed Demo.

### 2.5 Comportamiento esperado en la UI

La recomendación aparece en el rail «Asistente de importación» del Paso 2, con
los botones **Aplicar** / **Descartar** que ya existen para las demás. Al
aplicarla: se fuerza la inclusión de la columna y se fusiona el hint de mapeo.
Al descartarla: la columna queda excluida y la carga sigue siendo Patrón A. No
hace falta ningún componente nuevo. El detalle visual, si lo hubiera, es del
**Apéndice C**.

---

## 3. Conflicto a resolver: `MVP_COLUMNAS_EXCLUIDAS`

Hay una colisión directa con el fixture del ejemplo MVP.

*Código actual* —
`src/app/components/peajes/wizard/fixtures/mvp-ejemplo.fixture.ts`, líneas 10–21
y 34:

```typescript
export const MVP_COLUMNAS = [
  'FECHA',
  'HORA',
  'ESTACION',
  'VIA',
  'DISPOSITIVOT',
  'DISPOSITIVON',
  'DOMINIO',
  'CATEGORIA',
  'TARIFA',
  'BONIFICACION',
] as const;
```

```typescript
export const MVP_COLUMNAS_EXCLUIDAS = ['VIA', 'DISPOSITIVOT', 'CATEGORIA'] as const;
```

El archivo de ejemplo **sí trae** `CATEGORIA` (con el valor `'5'` en las diez
filas, líneas 37–158), pero el fixture la declara excluida porque hasta hoy no
tenía destino posible. `buildMvpMapeos()` (líneas 286–296) usa esa constante para
forzar `columnaDestino: null` y `excluida: true`:

```typescript
export function buildMvpMapeos(): MapeoColumna[] {
  return MVP_COLUMNAS.map((columnaOrigen) => {
    const excluida = (MVP_COLUMNAS_EXCLUIDAS as readonly string[]).includes(columnaOrigen);
    const destino = MVP_MAPEO_SUGERIDO[columnaOrigen] ?? null;
    return {
      columnaOrigen,
      columnaDestino: excluida ? null : destino,
      excluida,
    };
  });
}
```

Y `MVP_MAPEO_SUGERIDO` (líneas 174–182) tampoco la lista.

### Resolución propuesta

Sacar `'CATEGORIA'` de `MVP_COLUMNAS_EXCLUIDAS` y agregarla a
`MVP_MAPEO_SUGERIDO`:

```typescript
export const MVP_COLUMNAS_EXCLUIDAS = ['VIA', 'DISPOSITIVOT'] as const;

export const MVP_MAPEO_SUGERIDO: Record<string, PasadaColumnKey | null> = {
  FECHA: 'FECHA_HORA',
  HORA: null,
  ESTACION: 'ESTACION_ID',
  DISPOSITIVON: 'PASE_ID',
  DOMINIO: 'PATENTE_ID',
  CATEGORIA: 'CATEGORIA',
  TARIFA: 'PRECIO',
  BONIFICACION: 'BONIFICACION',
};
```

Conviene además sumar `'CATEGORIA'` a `MVP_COLUMNAS_INCLUIDAS` (líneas 24–32)
para que las dos constantes sigan siendo coherentes entre sí.

**Efecto colateral esperado y deseado:** el recorrido del ejemplo MVP pasa de
Patrón A a **Patrón B**, con `categoria = '5'` en las diez filas. Eso convierte
al fixture en la prueba de humo natural del camino Patrón B de punta a punta.
Como el valor es constante, produce una única familia
`(estación, '5', importe)` por estación, lo cual es un caso degenerado pero
válido: el diagnóstico va a dar `MUESTRA_INSUFICIENTE` (10 filas < umbral 15) o
`TARIFA_UNICA`, ambos correctos.

### Riesgo y dueño

`mvp-ejemplo.fixture.ts` vive bajo `wizard/fixtures/`, alcance exclusivo del
**agente 02**, así que el cambio es suyo (F14-3). Pero el archivo también lo
consume el **agente 03** a través de `MVP_TRANSFORM_SPECS` (líneas 184–258, que
**no** cambian) y del helper `aplicarTransformPreview` (líneas 337–361, que
tampoco cambia porque no tiene rama `CATEGORIA` y devuelve `'—'` por default).

Tests que hay que revisar antes de tocar la constante: cualquier spec que
importe `MVP_COLUMNAS_EXCLUIDAS`, `buildMvpMapeos` o que afirme sobre la cantidad
de mapeos activos del ejemplo. Buscar con:

```powershell
rg "MVP_COLUMNAS_EXCLUIDAS|buildMvpMapeos" ibarra-app/src --glob "*.spec.ts"
```

Si el cambio rompiera un test de otro agente, **no arreglarlo por afuera del
alcance**: anotarlo en `docs/session-handoff.md` y coordinarlo. Los casos de
prueba concretos van en el **Apéndice D**.

---

## 4. Destino de mapeo en Paso 5

Archivo a modificar:
`src/app/components/peajes/models/peajes.types.ts`.
Dueño: **agente 00 — esta es exactamente la razón de existir de F14-0.**

*Código actual* — líneas 19–52, el archivo completo salvo los primeros tipos:

```typescript
export type PasadaColumnKey =
  | 'PASADA_ID'
  | 'FECHA_HORA'
  | 'PASE_ID'
  | 'PATENTE_ID'
  | 'ESTACION_ID'
  | 'PRECIO'
  | 'BONIFICACION'
  | 'QUANTITY'
  | 'IMPORTE_NETO';

export const PASADA_COLUMN_KEYS: readonly PasadaColumnKey[] = [
  'PASADA_ID',
  'FECHA_HORA',
  'PASE_ID',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
] as const;

/** Columnas obligatorias para avanzar el mapeo (MVP). */
export const PASADA_COLUMNAS_OBLIGATORIAS: readonly PasadaColumnKey[] = [
  'FECHA_HORA',
  'PASE_ID',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
] as const;
```

*Propuesta*:

```typescript
export type PasadaColumnKey =
  | 'PASADA_ID'
  | 'FECHA_HORA'
  | 'PASE_ID'
  | 'PATENTE_ID'
  | 'ESTACION_ID'
  | 'PRECIO'
  | 'BONIFICACION'
  | 'QUANTITY'
  | 'IMPORTE_NETO'
  | 'CATEGORIA';

export const PASADA_COLUMN_KEYS: readonly PasadaColumnKey[] = [
  'PASADA_ID',
  'FECHA_HORA',
  'PASE_ID',
  'PATENTE_ID',
  'ESTACION_ID',
  'PRECIO',
  'BONIFICACION',
  'QUANTITY',
  'IMPORTE_NETO',
  'CATEGORIA',
] as const;

// PASADA_COLUMNAS_OBLIGATORIAS NO cambia: CATEGORIA es opcional (RN-15 / F14).
```

### 4.1 `CATEGORIA` es opcional — no tocar `PASADA_COLUMNAS_OBLIGATORIAS`

Es la restricción más importante de esta sección. Si `'CATEGORIA'` entrara a
`PASADA_COLUMNAS_OBLIGATORIAS`, **todo archivo Patrón A dejaría de poder
avanzar** en el Paso 5, incluidos los dos formatos que hoy se cargan en
producción (`ConsumosResumen` y los CSV de Telepase). La constante la consumen al
menos dos lugares que bloquearían el flujo:

- `paso5-mapeo.component.ts` línea 50 (`readonly obligatorias = PASADA_COLUMNAS_OBLIGATORIAS;`),
  que la usa para marcar los destinos requeridos en la grilla.
- `plantillas/motor/peajes-motor-transformacion.service.ts` línea 229
  (`for (const obl of PASADA_COLUMNAS_OBLIGATORIAS)`), dentro de
  `validarDefinicionPlantilla`, que rechazaría toda plantilla que no cubra el
  destino.

### 4.2 Efecto automático en la UI

No hay que tocar el componente del Paso 5. `paso5-mapeo.component.ts` línea 49
expone `readonly destinos = PASADA_COLUMN_KEYS;` y el template arma el selector
de destinos a partir de ese arreglo, así que `CATEGORIA` aparece sola en el
desplegable en cuanto la constante la incluya. Lo mismo pasa con
`plantilla-builder.component.ts` línea 67 (`columnasDestino = PASADA_COLUMN_KEYS;`)
y con `paso3-transformaciones.component.ts` línea 84
(`readonly destinosEstandar = PASADA_COLUMN_KEYS;`), que empezarán a ofrecer
`CATEGORIA` como salida válida de un paso de pipeline. Eso es deseable: permite
que un proveedor exótico derive la categoría con una transformación en vez de
mapearla directo.

Efecto secundario a verificar: `sincronizarMapeosDesdePipeline()`
(`peajes-wizard-state.service.ts` líneas 801–859) auto-mapea cualquier salida de
pipeline cuyo nombre esté en `PASADA_COLUMN_KEYS` (líneas 819 y 827). Con el
cambio, un paso que escriba en `CATEGORIA` se auto-mapea a `CATEGORIA`, que es
justamente lo que se quiere.

### 4.3 Handoff obligatorio

`models/peajes.types.ts` es **alcance exclusivo del agente 00** según la tabla de
`ibarra-app/AGENTS.md`. Los agentes 01 y 02 **no pueden editarlo**, ni siquiera
para desbloquearse: la regla 2 del modelo de agentes en paralelo dice que la
única superficie compartida son los modelos de 00 y que nadie los toca sin pasar
por `docs/session-handoff.md`.

Por eso F14-0 existe como feature separada y es **prerrequisito duro** de F14-2
y F14-3. Procedimiento:

1. El agente 00 aplica el cambio de esta sección, corre
   `npx tsc --noEmit -p tsconfig.app.json`, marca F14-0 `passing` y **comitea**.
2. Registra en `docs/session-handoff.md` una entrada con: el contrato nuevo
   (`'CATEGORIA'` en `PasadaColumnKey` y `PASADA_COLUMN_KEYS`, ausente de
   `PASADA_COLUMNAS_OBLIGATORIAS`), la razón (F14 · RN-15) y qué agentes quedan
   desbloqueados (01 para §5.4, 02 para §2 y §3).
3. Recién entonces arrancan 01 y 02.

Si un agente 02 arranca antes, `mapeoHints: [hint(categoryCol, 'CATEGORIA')]`
falla la compilación con `Type '"CATEGORIA"' is not assignable to type
'PasadaColumnKey'`. Es un error temprano y ruidoso, que es lo mejor que puede
pasar: el diseño falla en compilación, no en runtime.

---

## 5. Propagación hasta la base

El valor recorre cinco saltos. Cada uno necesita un cambio salvo el primero.

```text
[1] Columna del Excel                    'CATEGORIA' → '5'
        │  (Paso 2 · detectColumnRecommendations · §2)
        ▼
[2] MapeoColumna                         { columnaOrigen: 'CATEGORIA',
        │                                   columnaDestino: 'CATEGORIA',
        │                                   excluida: false }
        │  (Paso 5 · el usuario confirma o corrige)
        ▼
[3] construirPasadasDesdeMapeo()         out['CATEGORIA'] = '5'
        │  peajes-wizard-state.service.ts:1104
        ▼
[4] PasadaEstandarizada                  Record<PasadaColumnKey, string|number|null>
        │  peajes.models.ts:188
        ▼
[5] payload p_pasadas de                 { …, categoria: '5' }
    peajes_confirmar_carga
        │  peajes-carga.service.ts:127-143
        ▼
[6] pasadas.categoria                    '5'  (text, sin FK, sin catálogo)
```

### 5.1 Salto 3 — `construirPasadasDesdeMapeo()`

`src/app/components/peajes/wizard/services/peajes-wizard-state.service.ts`,
línea 1104. La función tiene **dos ramas** y hay que atender las dos.

**Rama A — `preferMotor` (líneas 1122–1188).** Se usa cuando hay draft del Paso 3
o plantilla aplicada. Arranca de la salida del motor y completa los destinos
faltantes recorriendo `mapeoActivo` (línea 1129). Es **genérica sobre el destino**:

```typescript
        for (const m of mapeoActivo) {
          const dest = m.columnaDestino!;
          …
          if (!yaTiene || dest === 'ESTACION_ID') {
            out[dest] = valor;
          }
        }
```

Como `dest` sale de `MapeoColumna.columnaDestino`, apenas `CATEGORIA` sea un
`PasadaColumnKey` válido esta rama lo copia **sin ningún cambio de código**. Solo
hay que verificarlo con un test.

**Rama B — fallback sin motor (líneas 1189–1254).** Acá sí hay trabajo, porque
inicializa un objeto con las claves enumeradas a mano (líneas 1195–1205):

```typescript
        const out: Partial<Record<PasadaColumnKey, string | number | null>> = {
          PASADA_ID: null,
          FECHA_HORA: null,
          PASE_ID: null,
          PATENTE_ID: null,
          ESTACION_ID: null,
          PRECIO: null,
          BONIFICACION: null,
          QUANTITY: 1,
          IMPORTE_NETO: null,
        };
```

*Propuesta*: agregar `CATEGORIA: null,` al inicializador. Sin eso, una carga sin
pipeline y sin plantilla devolvería objetos sin la clave, y aunque el bucle de
las líneas 1207–1234 igual escribiría `out[dest]`, el contrato
`PasadaEstandarizada` quedaría incompleto para las filas que no tienen mapeo de
categoría.

El bucle de asignación de esa rama (líneas 1207–1234) tiene un `if/else if` por
destino con tratamiento especial para `FECHA_HORA`, `PATENTE_ID`, `PASE_ID`,
`ESTACION_ID`, `PRECIO` y `BONIFICACION`, y termina con `out[dest] = valor;`.
`CATEGORIA` cae en el camino genérico, que es lo correcto — salvo por el trim,
que se discute en §5.3.

### 5.2 Salto 5 — payload de `peajes_confirmar_carga`

`src/app/components/peajes/services/peajes-carga.service.ts`, líneas 127–143.
*Código actual*:

```typescript
        const pasadasPayload = input.pasadas.map((p) => {
          const norm = normalizarImportesPasada(tipo, {
            precio: Number(p.PRECIO),
            bonificacion: Number(p.BONIFICACION ?? 0),
            importe_neto: p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : undefined,
          });
          return {
            fecha_hora: toPostgresFechaHora(p.FECHA_HORA) ?? p.FECHA_HORA,
            pase_id: p.PASE_ID,
            patente_id: p.PATENTE_ID,
            estacion_id: p.ESTACION_ID,
            precio: norm.precio,
            bonificacion: norm.bonificacion,
            quantity: Number(p.QUANTITY ?? 1),
            importe_neto: norm.importe_neto,
          };
        });
```

*Propuesta*: sumar una clave al objeto devuelto:

```typescript
            importe_neto: norm.importe_neto,
            categoria: normalizarCategoriaProveedor(p.CATEGORIA),
```

con el helper de §5.3. El resto del método no cambia. `validarCarga()`
(líneas 25–101) y `detectarDuplicados()` (líneas 103–120) **no** necesitan la
categoría: no participa de ninguna validación de importes ni de la clave de
duplicado (`pase_id + fecha_hora + estacion_id + patente_id`, RN-16).

El objeto `Pasada` que se reconstruye para el retorno (líneas 185–197) puede
sumar `categoria` si el modelo `Pasada` la incluye; eso es una decisión del
agente 00 sobre `peajes.models.ts` y no bloquea nada.

### 5.3 Normalización del valor: trim sí, mayúsculas no

RN-15 dice que se guarda **el texto crudo del proveedor**, sin catálogo y sin FK.
"Crudo" no puede leerse de forma tan literal como para incluir la basura de
formato del Excel, porque el valor es **clave de agrupación** en
`GROUP BY … p.categoria` (Apéndice A §5 y §6) y en la restricción
`UNIQUE NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)`.

Recomendación:

```typescript
/** RN-15 · Categoría del proveedor: se conserva el texto tal cual, solo sin espacios de borde. */
function normalizarCategoriaProveedor(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === '' ? null : s;
}
```

| Operación | ¿Se aplica? | Justificación |
|---|---|---|
| `trim()` (semántica de `CONVERTIR_TEXTO` / `BORRAR_ESPACIOS`) | **Sí** | `'5'` y `'5 '` son el mismo tipo de vehículo pero producirían **dos familias tarifarias distintas** en `tarifas_normalizadas`, cada una con la mitad de las pasadas. El resultado sería que las dos caen en `MUESTRA_INSUFICIENTE` y ninguna se clasifica. El espacio sobrante es ruido de formato de la exportación, no información del proveedor |
| Vacío → `null` | **Sí** | `''` y "sin categoría" son lo mismo. Dejar `''` crearía un tercer estado indistinguible en la UI pero distinto para el `UNIQUE`, y rompería la equivalencia `categoria IS NULL ⇔ Patrón A` de la que depende el `CHECK` de patrón del Apéndice A §3.3 |
| `toUpperCase()` | **No** | Es una transformación con pérdida sobre un valor que el usuario ve tal cual en el Paso 5 y en la pantalla de auditoría. Si un proveedor manda `Liviano` y otro `LIVIANO`, son concesiones distintas y sus familias tarifarias no se comparan nunca entre sí, así que unificarlos no aporta nada. Y si dentro de **una misma** concesión aparecieran las dos grafías, eso es un dato sobre el archivo que el analista debe ver, no algo que la ingesta deba tapar. Quien quiera normalizarlas puede agregar un paso `CONVERTIR_MAYUSCULAS` en el Paso 3, que es explícito y queda guardado en la plantilla |
| Quitar acentos | **No** | Mismo razonamiento, y además `normalizarEncabezadoColumna` se aplica a **encabezados**, no a valores |

En resumen: `CONVERTIR_TEXTO` con trim, sin mayúsculas. La normalización
agresiva, si hiciera falta para un proveedor puntual, se resuelve con un paso de
pipeline explícito y versionado en la plantilla, no escondida en el servicio de
carga.

### 5.4 Salto 6 — `peajes_confirmar_carga` debe persistirla

Del lado SQL, el `INSERT INTO public.pasadas` dentro del bucle de
`peajes_confirmar_carga` tiene que incluir la columna. La versión canónica vigente
está en `20260807140000_peajes_documentos_tipo_nc.sql` y
`20260810191639_peajes_documentos_bonificacion.sql` (la de
`20260730125534_peajes_rpc_y_auditoria.sql` líneas 560–573 ya está superada);
el agente 01 debe partir de la definición más reciente y sumar:

```sql
-- en la lista de columnas del INSERT
      …, importe_neto, user_id, file_upload_name, categoria
-- en la lista de valores
      …, v_neto, auth.uid(), p_nombre_archivo,
      nullif(btrim(v_pasada->>'categoria'), '')
```

`nullif(btrim(...), '')` replica del lado servidor exactamente la misma
normalización de §5.3. Es redundante a propósito: el RPC también se puede llamar
desde fuera del wizard (tests SQL, scripts), y la invariante
`categoria IS NULL ⇔ Patrón A` tiene que sostenerse siempre.

Este cambio es **F14-2, agente 01**, y está listado en el checklist del
Apéndice A §14 paso 10.

### 5.5 Lo que NO hay que hacer

| Tentación | Por qué no |
|---|---|
| Crear una tabla `categorias` con FK desde `pasadas` | RN-15 explícita: el valor es texto libre del proveedor. Un catálogo obligaría a administrarlo antes de poder importar y rompería la carga de cualquier proveedor nuevo |
| Reusar `patentes.categoria` | Es un enum **interno** (`TRANSPORTE \| REMIS \| OBRA \| AUTO`), del vehículo propio, no del proveedor. Se expone como `patente_categoria` en `pasadas_gestion` y `pwbi_pasadas`. Son dos dimensiones sin relación: una patente `TRANSPORTE` puede aparecer con categoría de proveedor `'5'`. Ver Apéndice A §13 |
| Validar el valor contra una lista | No hay lista. Cualquier texto no vacío es válido |
| Usar la categoría en la clave de duplicado RN-16 | La clave es `(pase_id, fecha_hora, estacion_id, patente_id)` y no cambia. Sumar categoría permitiría importar dos veces la misma pasada si el proveedor cambia el texto entre exportaciones |

---

## 6. Relación con el motor de transformaciones

Según `.agents/skills/peajes-transformaciones-motor/SKILL.md`, el principio es
que *«la columna es la unidad de adaptación y el patrón se elige por el tipo
semántico de la columna, no por su nombre crudo»*. Aplicado a `CATEGORIA`:

**No hace falta ninguna estrategia atómica nueva.** El tipo semántico de la
categoría es "texto que se conserva", y para eso el registro ya tiene lo
necesario:

| Situación | Algoritmo existente | Nota |
|---|---|---|
| La columna ya viene limpia (caso normal) | Ninguno — mapeo directo en Paso 5 | Es lo que hace la recomendación de §2.3, con `draftSteps: []` |
| Hay que castear o limpiar espacios | `CONVERTIR_TEXTO` | Equivalente al trim de §5.3 |
| El proveedor manda la categoría en dos columnas | `COMBINAR_COLUMNAS` | Ya existe |
| Se quiere unificar grafías dentro de una concesión | `CONVERTIR_MAYUSCULAS` | Decisión explícita del usuario, guardada en la plantilla |
| Copiar una columna a `CATEGORIA` sin transformar | `COPIAR_COLUMNA` | Ya existe |

### 6.1 RN-20 no se ve afectada

RN-20 exige que todo `algoritmo_codigo` usado exista y esté activo en
`peajes_algoritmos_catalogo`, y se hace cumplir en dos lugares:
`StrategyRegistry.resolve`/`tiene` del lado TypeScript y
`peajes_validar_algoritmo_combinado`
(`20260730125534_peajes_rpc_y_auditoria.sql`, líneas 376–381) del lado SQL.

Como F14 **no agrega ningún código de algoritmo**, no hay fila nueva en
`peajes_algoritmos_catalogo`, no hay entrada nueva en `ALGORITMO_CODIGOS`, no hay
estrategia nueva en `strategies/estrategias-atomicas.ts` y **no hay riesgo de
desalineación entre el registro TypeScript y el catálogo SQL**. Esa es la razón
concreta por la que conviene resolver `CATEGORIA` como mapeo y no como
transformación: es la opción que no toca el contrato más frágil del módulo.

### 6.2 Contexto sobre la deriva de `FILTRAR_COLUMNA`

Sin relación con F14, pero el agente que trabaje acá se lo va a cruzar: la
migración `20260811190002_peajes_algoritmo_filtrar_columna.sql` está en el
repositorio y **no** aplicada a DESARROLLO, mientras que `FILTRAR_COLUMNA` ya
figura como código atómico en el skill del motor. Es decir, el catálogo SQL
remoto está un paso atrás del registro TypeScript. **F14 no arregla ni empeora
esa deriva**; se menciona solo para que no se confunda con un problema
introducido por esta épica. Se resolverá en el primer `db push --linked` que
haga el agente 01 (Apéndice A §14 paso 15).

---

## 7. Impacto en plantillas recurrentes

**Sí, el mapeo de `CATEGORIA` se persiste en la plantilla y se restaura solo.**
No hay que hacer nada especial. Verificado leyendo la cadena completa:

1. **La columna existe.**
   `20260804145440_peajes_plantillas_reconocimiento_estaciones.sql`, líneas 2–3:

```sql
ALTER TABLE public.plantillas_configuracion
  ADD COLUMN IF NOT EXISTS mapeos jsonb NOT NULL DEFAULT '[]'::jsonb;
```

2. **El RPC la escribe.** Misma migración, `peajes_guardar_plantilla_importacion`
   recibe `p_mapeos jsonb DEFAULT NULL` (línea 30) y lo guarda tal cual, tanto en
   el alta (línea 47, `coalesce(p_mapeos, '[]'::jsonb)`) como en la edición
   (línea 57, `mapeos = coalesce(p_mapeos, mapeos)`).

3. **El servicio Angular lo manda.**
   `src/app/components/peajes/services/peajes-plantillas.service.ts`,
   líneas 58–78:

```typescript
  guardarPlantilla(
    plantilla: …,
    configuraciones: Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[],
    mapeos?: PlantillaMapeoColumna[],
    estacionesReconocidas?: …
  ): Observable<PlantillaConfiguracion> {
    …
        const { data: plantillaId, error: saveError } = await client.rpc(
          'peajes_guardar_plantilla_importacion',
          {
            p_plantilla: { ...plantilla, empresa_id: empresaId },
            p_configuraciones: configuraciones,
            p_mapeos: mapeos ?? null,
            p_estaciones_reconocidas: estacionesReconocidas ?? null,
          }
        );
```

4. **El tipo es genérico sobre el destino.**
   `src/app/components/peajes/models/peajes.models.ts`, líneas 208–212:

```typescript
export interface PlantillaMapeoColumna {
  columnaOrigen: string;
  columnaDestino: PasadaColumnKey | null;
  excluida: boolean;
}
```

`columnaDestino` es `PasadaColumnKey | null`, así que en cuanto F14-0 sume
`'CATEGORIA'` al tipo, el snapshot lo acepta sin ningún cambio de esquema ni de
código. La columna `mapeos` es `jsonb`: no hay migración que hacer.

### 7.1 Consecuencia operativa

Una concesión que carga todos los meses el mismo formato con columna de
categoría solo confirma el mapeo **una vez**. A partir de la segunda carga la
plantilla lo restaura, la carga sigue siendo Patrón B automáticamente y las
familias tarifarias se acumulan mes a mes hasta superar
`umbral_muestra_minima` y poder clasificarse. Ese es justamente el mecanismo por
el cual el sistema mejora su diagnóstico con el uso.

### 7.2 A verificar (no asumir)

`validarDefinicionPlantilla` acepta el snapshot `mapeos` y da por cubierto un
destino obligatorio si está mapeado, aunque no haya paso de pipeline (ver
`docs/06-components/peajes/reconocimiento-estaciones.md`, sección *Plantillas
recurrentes (F09)*, último párrafo). Como `CATEGORIA` **no** es obligatoria
(§4.1), no debería intervenir en esa validación. Confirmar con un test que una
plantilla con mapeo de `CATEGORIA` valida igual que una sin él, y que una
plantilla **sin** `CATEGORIA` sigue validando (no regresión de Patrón A).

---

## 8. Documentación a actualizar

Asignado a **F14-5, agente 04**, y solo después de que F14-0 y F14-3 estén
`passing`. La regla 4 del modelo de agentes es explícita: el documentador
documenta lo que existe, no lo que se planea.

### 8.1 El problema de ubicación

El pedido original fue aplicar el concepto en
`docs/06-components/peajes/reconocimiento-estaciones.md`. Al revisar los dos
archivos aparece un desajuste que conviene resolver con criterio en vez de
obedecer al pie de la letra:

| Documento | De qué trata realmente |
|---|---|
| `reconocimiento-columnas.md` | Reconocimiento **de columnas** en el **Paso 2** (F02-11/F02-12). Tiene la tabla «Aliases por semántica» (líneas 19–30), la tabla «Recetas → algoritmos» (32–41) y la sección «UI Paso 2» (50–57). Es el documento de `column-recognition.ts` |
| `reconocimiento-estaciones.md` | Reconocimiento **de estaciones y peajes** en el **Paso 6** (F02-13/F02-15/F13-4): catálogo, alias de proveedor, alta mínima, código compuesto `ESTACION - VIA` |

El detector de la **columna** `CATEGORIA` es, literalmente, un alias nuevo en
`COLUMN_ALIASES` y un bloque nuevo en `detectColumnRecommendations`: pertenece a
`reconocimiento-columnas.md`. Ponerlo en `reconocimiento-estaciones.md` dejaría
el contenido canónico en el documento equivocado y rompería la separación que
ese mismo par de archivos ya defiende: `reconocimiento-columnas.md` línea 65 dice
*«El reconocedor de estaciones permanece en Paso 6 … Ver
[reconocimiento-estaciones.md]»*.

### 8.2 Resolución: contenido sustantivo en uno, referencia cruzada en el otro

Se honra el pedido sin romper la organización: el detalle técnico va donde
corresponde y el documento de estaciones recibe una sección breve que explica la
interacción real entre las dos dimensiones, que sí es información nueva y sí
pertenece ahí.

#### A. `docs/06-components/peajes/reconocimiento-columnas.md` — contenido canónico

| Cambio | Ubicación exacta |
|---|---|
| Fila nueva en la tabla «Aliases por semántica» | Después de la fila `Dispositivo / pase` (línea 30): `\| Categoría \| `CATEGORIA`, `CATEG`, `CLASE`, `TIPO VEHICULO`, `CATEGORIA VEHICULO` \|` |
| Fila nueva en la tabla «Recetas → algoritmos» | Después de la fila `bonificacion` (línea 40): `\| `categoria` \| alias de categoría \| Sin pasos de pipeline: solo fuerza la inclusión de la columna y sugiere el mapeo a `CATEGORIA` \|` |
| **Sección nueva `## Categoría del proveedor (F14-3)`** | Insertar entre `## IVA opcional` (línea 44) y `## UI Paso 2` (línea 50) |

Contenido de la sección nueva (el agente 04 lo redacta, esto es el guion):

- Qué detecta y con qué aliases, y que `normalizarEncabezadoColumna` ya cubre
  acentos y capitalización.
- Que la recomendación **no** agrega pasos de pipeline y por qué (§6).
- Que `CATEGORIA` es un destino de mapeo **opcional**: los archivos sin esa
  columna siguen funcionando igual.
- Que el mapeo es la señal de Patrón B y que el valor va crudo a
  `pasadas.categoria` (RN-15), con enlace a este apéndice y al Apéndice A.
- Advertencia de que **no** es `patentes.categoria`.
- Actualizar el bloque de verificación (líneas 69–73) con el comando de spec de
  `column-recognition`.
- Actualizar el footer a `> Última actualización: 2026-08-12`.

#### B. `docs/06-components/peajes/reconocimiento-estaciones.md` — referencia cruzada

| Cambio | Ubicación exacta |
|---|---|
| **Sección nueva `## Categoría y familias tarifarias por estación (F14)`** | Insertar entre `## Plantillas recurrentes (F09)` (termina en línea 70) y `## Archivos` (línea 72) |

Contenido (breve, 6–10 líneas, con enlaces en vez de duplicar):

- Que la estación resuelta en el Paso 6 es **una de las dos dimensiones** de una
  familia tarifaria; la otra es la categoría del proveedor, mapeada en el Paso 5.
- Que la combinación define el agrupamiento del análisis:

```text
Patrón A (sin categoría):  familia = estación            → variación intra-estación por explicar
Patrón B (con categoría):  familia = estación + categoría → variación intra-familia = horaria
```

- Que resolver mal una estación en el Paso 6 **parte o mezcla familias
  tarifarias** aguas abajo: dos códigos de proveedor que en realidad son la
  misma estación producen dos familias con la mitad de las pasadas cada una, y
  las dos pueden quedar en `MUESTRA_INSUFICIENTE`. Es la razón práctica por la
  que la calidad del Paso 6 importa para F14, y es el aporte real de esta
  sección.
- Enlaces a `reconocimiento-columnas.md` (para el detector de la columna) y a
  este apéndice (para el modelo completo).
- **No** duplicar la tabla de aliases ni el bloque de código.
- Actualizar el footer a `> Última actualización: 2026-08-12`.

### 8.3 Otros documentos a revisar

| Documento | Cambio |
|---|---|
| `docs/06-components/peajes/wizard.md` | Mencionar `CATEGORIA` como destino opcional del Paso 5 |
| `docs/06-tablas/peajes/documentos-pasadas.md` | Sumar las tres columnas nuevas de `pasadas` con la advertencia de `patente_categoria` |
| `docs/06-components/peajes/plantillas-y-algoritmos.md` | Aclarar que F14 **no** agrega códigos al catálogo (§6.1) |
| `docs/INDEX.md` y `docs/modulos/peajes.md` | Entradas de la épica F14 |
| `docs/backend/peajes/index.md` | RPCs nuevas — es parte de la doc de backend del Apéndice A §1.5 |

---

## 9. Checklist por dueño

Estado canónico en `feature_list.json`; esta lista es operativa.

### F14-0 · agente 00 — Contrato `CATEGORIA` (bloquea a 01 y 02)

- [ ] Agregar `'CATEGORIA'` a `PasadaColumnKey` y a `PASADA_COLUMN_KEYS` en
      `src/app/components/peajes/models/peajes.types.ts` (§4).
- [ ] **Verificar que `PASADA_COLUMNAS_OBLIGATORIAS` NO cambió** (§4.1).
- [ ] Compilación limpia.
      → `npx tsc --noEmit -p tsconfig.app.json`
- [ ] Suite de wizard sin regresiones (el destino nuevo aparece en tres
      componentes por transitividad, §4.2).
      → `ng test --include="**/peajes/wizard/paso5*" --watch=false --browsers=ChromeHeadless`
- [ ] Registrar el contrato y los agentes desbloqueados en
      `docs/session-handoff.md` (§4.3), marcar F14-0 `passing` y **comitear
      antes** de que arranquen 01 y 02.

### F14-3 · agente 02 — Detección en Paso 2 y mapeo en Paso 5

- [ ] Confirmar que F14-0 está comiteada (`git log --oneline -5`).
- [ ] `column-recognition.ts`: `'categoria'` en `ColumnRecommendationKind` (§2.1).
- [ ] `column-recognition.ts`: bucket `category` en `COLUMN_ALIASES` (§2.2,
      camino (a) — sin tocar `consumos-resumen.helpers.ts`).
- [ ] `column-recognition.ts`: `categoryCol` + bloque `rec-categoria` en
      `detectColumnRecommendations`, después del bloque de `estacion` (§2.3).
- [ ] Verificar que **no** se tocaron `buildDemoPipelineSeeds`,
      `tieneHeadersParaSeedDemo` ni `MVP_SEED_ALIASES` (§2.4).
- [ ] `mvp-ejemplo.fixture.ts`: sacar `'CATEGORIA'` de `MVP_COLUMNAS_EXCLUIDAS`,
      agregarla a `MVP_COLUMNAS_INCLUIDAS` y a `MVP_MAPEO_SUGERIDO` (§3).
- [ ] `peajes-wizard-state.service.ts`: `CATEGORIA: null` en el inicializador de
      la rama fallback de `construirPasadasDesdeMapeo` (§5.1).
- [ ] Buscar specs afectados por el cambio de fixture antes de correr la suite.
      → `rg "MVP_COLUMNAS_EXCLUIDAS|buildMvpMapeos" ibarra-app/src --glob "*.spec.ts"`
- [ ] Specs del reconocedor.
      → `ng test --include="**/peajes/wizard/services/column-recognition.spec.ts" --watch=false --browsers=ChromeHeadless`
- [ ] Paso 2.
      → `ng test --include="**/peajes/wizard/paso2*" --watch=false --browsers=ChromeHeadless`
- [ ] Paso 5.
      → `ng test --include="**/peajes/wizard/paso5*" --watch=false --browsers=ChromeHeadless`
- [ ] Compilación.
      → `npx tsc --noEmit -p tsconfig.app.json`
- [ ] Si algún test fuera de alcance quedó rojo: anotarlo en
      `docs/session-handoff.md`, no arreglarlo por afuera del alcance (§3).

### F14-2 · agente 01 — Persistencia (detalle completo en Apéndice A §14)

- [ ] `peajes-carga.service.ts`: `categoria` en `pasadasPayload` con
      `normalizarCategoriaProveedor` (§5.2, §5.3).
- [ ] `peajes_confirmar_carga`: columna `categoria` en el `INSERT INTO pasadas`
      con `nullif(btrim(...), '')` (§5.4).

### F14-5 · agente 04 — Documentación (solo cuando F14-0/F14-3 estén `passing`)

- [ ] `reconocimiento-columnas.md`: filas nuevas en las dos tablas + sección
      `## Categoría del proveedor (F14-3)` entre `## IVA opcional` y
      `## UI Paso 2` (§8.2.A).
- [ ] `reconocimiento-estaciones.md`: sección
      `## Categoría y familias tarifarias por estación (F14)` entre
      `## Plantillas recurrentes (F09)` y `## Archivos`, con referencias
      cruzadas y **sin** duplicar la tabla de aliases (§8.2.B).
- [ ] Documentos secundarios de §8.3.
- [ ] Footer `> Última actualización: 2026-08-12` en cada archivo tocado.

---

> Última actualización: 2026-08-12
