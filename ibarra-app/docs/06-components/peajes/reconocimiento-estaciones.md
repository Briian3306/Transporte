# Reconocimiento de estaciones (Paso 6 · F02-13)

## Resumen

En el wizard **simple**, tras elegir **empresa** en Paso 1, el Paso 6 solo ofrece estaciones de los **peajes de esa empresa**. Usa `reconocerEstacion` del catálogo para auto-seleccionar coincidencias exactas y recomendar alta cuando no hay match.

### Código `0001` (Zarate vs DOCK SUD) — F02-17

Telepase MERCOSUR usa `ESTACION=0001`. Ese código está en **Zarate** (`c9ed477b-11e7-4698-a81d-97813a9ae538`, AUTOVIA DEL MERCOSUR) **y** en **DOCK SUD** (AUBASA). Prevención:

1. Paso 1 (simple) exige empresa. El recuadro «La empresa cierra el peaje» explica el alcance.
2. `reconocerEstacion(valor, empresaId)` filtra aliases y `codigos_proveedor` (`1` ≡ `0001`) a esa empresa. Sin empresa, un código compartido queda en **sugerencias** (no se toma el primero).
3. Una plantilla que restaura una estación de otra empresa no salta a Factura: abre Paso 6, descarta el id ajeno y vuelve a reconocer.

DESARROLLO data fix 2026-08-14: `pasadas_2026-07-16_86802.csv` (148), `86803.csv` (47), `pasadas_2026-07-01_79158.csv` (49) movidas a Zarate; `peajes_recalcular_tarifas` en Autovía del Mercosur + AUBASA. Auditoría: `scripts/categorias_search/empresa_folder_audit/REPORT.md`.

Con columna Excel **`Concesion`** (RN-26): ese valor representa el **peaje**. Paso 5 recomienda el peaje; Paso 6 filtra estaciones a ese peaje/empresa. El usuario puede corregir peaje o estación. No se listan estaciones de peajes/empresas ajenos por defecto. Ver [importacion-masiva-consumos-resumen.md](./importacion-masiva-consumos-resumen.md) y [wizard.md](./wizard.md).

## Flujo

### Simple (una empresa, sin Concesion)

1. `listarPeajes(empresaId)` → ids de peaje.
2. `listarEstaciones()` filtradas por `peaje_id` ∈ peajes de la empresa.
3. Por cada código proveedor único del archivo:
   - `reconocerEstacion(valor, empresaId)`
   - `exacta` → auto-selecciona **Estación interna**
   - `sugerencias` → chips; «Ninguna coincide» habilita crear
   - `sin_coincidencia` → banner **Recomendado: crear estación**

### Con Concesion (RN-26 · ConsumosResumen)

```text
COMPANY → Concesion (Excel) → PEAJE recomendado → ESTACIONES de ese peaje
```

1. Paso 5 detecta `Concesion` y recomienda peajes del catálogo.
2. Paso 6: por cada código `Estación`, toma la Concesión dominante de esas filas → `peajeIdAlcance`.
3. Selector y chips: **solo** estaciones con `peaje_id = peajeIdAlcance`.
4. El usuario puede cambiar el peaje de la fila (entonces se refresca el listado de estaciones).

## Alta mínima

El alta se abre en **`app-dialog`** (mismo patrón que crear empresa en Paso 1), no en un bloque al pie del paso. Disparadores: **Ninguna coincide**, **Nueva**, **Crear estación**.

El formulario **no** replica el catálogo completo (`ubicacion`, geo, `camino`, etc.). Solo:

| Campo | Comportamiento |
|-------|----------------|
| Nombre | Prefill = código proveedor; editable |
| Peaje | Oculto si la empresa tiene 1 peaje; `app-search-select` si hay varios |
| Estación interna | `app-search-select` con listado completo al enfocar (`showAllWhenEmpty`) |
| Código proveedor | Implícito (`codigos_proveedor: [valor]`) |

Crear peajes nuevos queda en Catálogos → Peajes.

## Código proveedor ESTACION + VIA (F02-15)

Archivos como AUSOL [`docs/plan/csv/557074.csv`](../../plan/csv/557074.csv) traen columnas `ESTACION` y `VIA`. El combine `ESTACION - VIA` (p. ej. `CAMPANA - 0003`) **solo** se aplica si `VIA` está en `columnasParaMapeo()` (incluida en Paso 2).

| Selección Paso 2 | Código proveedor en Paso 6 |
|------------------|----------------------------|
| `ESTACION` incluida, `VIA` excluida | `CAMPANA` |
| Ambas incluidas | `CAMPANA - 0003` |

Misma regla en `construirPasadasDesdeMapeo` (ya no depende del nombre de archivo `387882.csv`).

Implementación: `viaIncluidaEnSeleccion()` / `valorEstacionProveedor` en `paso6-estaciones.component.ts`; `valorEstacionProveedorDesdeFila` en el state.

## Plantillas recurrentes (F09)

Al finalizar Paso 6, al llegar a **Paso 7** se recomienda crear una plantilla si el usuario todavía no eligió una. La recomendación aparece una sola vez por carga y solo cuando ya existen mapeos y relaciones de estación confirmadas.

Al crearla, la plantilla guarda configuraciones del pipeline, mapeos del Paso 5 y filas en `plantilla_estaciones_reconocidas`. Cada fila vincula el valor original y normalizado del proveedor con `estacion_id`; por ejemplo, `CAMPANA DESCENDENTE` → estación interna `CAMPANA`.

En una carga posterior, la prioridad de resolución es: relación de plantilla → alias confirmado de empresa en `estaciones_alias_proveedor` → coincidencia exacta o sugerencia. El alias por empresa se conserva para importaciones sin plantilla.

Si el archivo es compatible y no hay estaciones ambiguas/nuevas ni patentes fuera del catálogo, el wizard salta desde Paso 4 directamente a Paso 7. Cualquier excepción abre el paso que corresponda (`irAExcepcion`: Paso 5 para mapeos/patentes, Paso 6 para estaciones).

`validarDefinicionPlantilla` acepta el snapshot `mapeos`: un destino obligatorio como `ESTACION_ID` puede cubrirse solo por mapeo (sin paso de pipeline). Si el origen del mapeo (p. ej. `ESTACION`) no está en el archivo ni es salida del pipeline, se informa el error antes de aplicar.

## Categoría y familias tarifarias por estación (F14)

La estación resuelta en el Paso 6 es **una de las dos dimensiones** de una familia tarifaria; la otra es la categoría del proveedor mapeada en el Paso 5 ([reconocimiento-columnas.md](./reconocimiento-columnas.md)).

```text
Patrón A (sin categoría):  familia = estación            → variación intra-estación por explicar
Patrón B (con categoría):  familia = estación + categoría → variación intra-familia ≈ horaria
```

Resolver mal una estación en el Paso 6 parte o mezcla familias aguas abajo: dos códigos de proveedor que son la misma estación producen dos familias con la mitad de las pasadas y pueden quedar en `MUESTRA_INSUFICIENTE`. Por eso la calidad del Paso 6 importa para la auditoría tarifaria.

Modelo completo: [APENDICE-B](../../plan/auditoria-pasadas-patrones/APENDICE-B-deteccion-categoria-y-mapeo.md). Pantalla: [auditoria-tarifas.md](./auditoria-tarifas.md).

## Archivos

- `wizard/paso6-estaciones/*`
- `wizard/services/peajes-wizard-state.service.ts`
- `services/peajes-catalogo.service.ts` (`reconocerEstacion`, `crearEstacion`, `confirmarAliasEstacion`)

## Feature

**F02-13** (passing) · **F02-15** (fix VIA exclusion) · **F02-17** (código `0001` Zarate vs DOCK SUD) · **F13-4** (RN-26 Concesion→Peaje→Estaciones) · ver `feature_list.json` y [wizard.md](./wizard.md).

---

> Última actualización: 2026-08-14
