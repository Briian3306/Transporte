# Reconocimiento de estaciones (Paso 6 · F02-13)

## Resumen

En el wizard, tras elegir **empresa** en Paso 1, el Paso 6 solo ofrece estaciones de los **peajes de esa empresa**. Usa `reconocerEstacion` del catálogo para auto-seleccionar coincidencias exactas y recomendar alta cuando no hay match.

## Flujo

1. `listarPeajes(empresaId)` → ids de peaje.
2. `listarEstaciones()` filtradas por `peaje_id` ∈ peajes de la empresa.
3. Por cada código proveedor único del archivo:
   - `reconocerEstacion(valor, empresaId)`
   - `exacta` → auto-selecciona **Estación interna**
   - `sugerencias` → chips; «Ninguna coincide» habilita crear
   - `sin_coincidencia` → banner **Recomendado: crear estación**

## Alta mínima

El alta se abre en **`app-dialog`** (mismo patrón que crear empresa en Paso 1), no en un bloque al pie del paso. Disparadores: **Ninguna coincide**, **Nueva**, **Crear estación**.

El formulario **no** replica el catálogo completo (`ubicacion`, geo, `camino`, etc.). Solo:

| Campo | Comportamiento |
|-------|----------------|
| Nombre | Prefill = código proveedor; editable |
| Peaje | Oculto si la empresa tiene 1 peaje; select si hay varios |
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

## Archivos

- `wizard/paso6-estaciones/*`
- `wizard/services/peajes-wizard-state.service.ts`
- `services/peajes-catalogo.service.ts` (`reconocerEstacion`, `crearEstacion`, `confirmarAliasEstacion`)

## Feature

**F02-13** (passing) · **F02-15** (fix VIA exclusion) · ver `feature_list.json` y [wizard.md](./wizard.md).

---

> Última actualización: 2026-08-04
