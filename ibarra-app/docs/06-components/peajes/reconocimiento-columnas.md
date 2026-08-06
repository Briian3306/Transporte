# Reconocimiento automático de columnas (F02-11)

## Resumen

Asistente de importación semántico del wizard: detecta columnas comunes entre concesionarias (AUSOL, Autopistas Urbanas, Demo, etc.) y recomienda transformaciones reutilizables en **Paso 2**. El reconocimiento se basa en el **significado de la columna**, no en el nombre del peaje ni en el formato del archivo.

Feature: **F02-11** · Owner: `02-frontend-wizard-tablas`.

## Ubicación

| Artefacto | Path |
|-----------|------|
| Recetas puras | `src/app/components/peajes/wizard/services/column-recognition.ts` |
| Fachada Angular | `…/peajes-column-recognition.service.ts` |
| Draft types | `…/wizard-draft.types.ts` |
| Estado | `PeajesWizardStateService` (`recomendaciones`, `aceptarRecomendacion`, …) |
| UI | `paso2-preview` — rail «Asistente de importación» |

## Aliases por semántica

| Semántica | Aliases (case-insensitive) |
|-----------|----------------------------|
| Patente | `PATENTE`, `DOMINIO`, `PATENTE_ID` |
| Tarifa | `TARIFA`, `PRECIO` |
| Bonificación | `BONIFICACION`, `BONIFICACION_IMPORTE` |
| Fecha | `FECHA` |
| Hora | `HORA` |
| Estación | `ESTACION` |
| Vía | `VIA` |
| Dispositivo / pase | `DISPOSITIVO`, `DISPOSITIVON` |

## Recetas → algoritmos

| Kind | Condición | Efecto al aplicar |
|------|-----------|-------------------|
| `fecha_hora` | `FECHA` + `HORA` | `FORMATEAR_FECHA_HORA` (si `HORA` es HHMMSS) o `COMBINAR_COLUMNAS` (si tiene `:`) → `FECHA_HORA` |
| `patente` | alias de patente | `BORRAR_ESPACIOS` → `ELIMINAR_GUIONES` → `CONVERTIR_MAYUSCULAS` → `PATENTE_ID` |
| `dispositivo` | alias de dispositivo | `COPIAR_COLUMNA` → `PASE_ID` |
| `tarifa` | alias de tarifa | Si muestra AR (`19.985,09`) → `CONVERTIR_NUMERO_ARS` → `PRECIO`; si decimal con punto → `CONVERTIR_NUMERO` → `PRECIO`. El CSV se carga como texto (no SheetJS numérico) para no perder la coma decimal. |
| `bonificacion` | alias de descuento | Misma regla AR/US que tarifa; si hay tarifa, también `CALCULAR_IMPORTE_NETO` |

Catálogo de códigos atómicos: [plantillas-y-algoritmos.md](./plantillas-y-algoritmos.md).

## IVA opcional

Paso 2 ya no muestra la recomendación de preparar `ESTACION` o `VIA`: esas columnas quedan disponibles para su resolución manual en Paso 6.

Cuando se reconocen tarifa y bonificación, aparece la recomendación opcional **Eliminar IVA de IMPORTE_NETO**. Al aceptarla agrega `ELIMINAR_IVA` después de `CALCULAR_IMPORTE_NETO`; divide cada importe neto por `1,21` y redondea a dos decimales. Al descartarla no se modifica el cálculo actual. La elección forma parte del pipeline y se conserva al guardar una plantilla de empresa.

## UI Paso 2

1. Tras `setPreview`, el estado calcula `recomendaciones` (`pending`).
2. **F02-12 — selección por defecto:** solo las columnas de `incluirColumnas` quedan incluidas; el resto pasa a excluidas (toggle manual). Si no hay reconocimiento, se mantiene include-all. La heurística MVP full-headers puede sobrescribir.
3. El rail muestra badges con **Aplicar** / **Descartar**.
4. Con ≥2 pendientes: **Aplicar todas**.
5. **Aplicar** escribe `configuracionesDraft`, fuerza columnas incluidas y fusiona hints de mapeo; marca `accepted`.
6. Paso 3 reutiliza el draft; `seedDemoPipelineIfEmpty` no pisa un draft ya poblado.

## Relación con seed Demo

`buildDemoPipelineSeeds` / `tieneHeadersParaSeedDemo` usan las **mismas recetas**. Sirven a `seedDemoPipelineIfEmpty` cuando el archivo trae fecha+hora+patente+dispositivo+tarifa+bonificación (aliases Demo **o** AUSOL).

## ESTACION ≠ Strategy

El reconocedor de estaciones permanece en **Paso 6** (catálogo / aliases). La recomendación `estacion` solo prepara la columna (e incluye `VIA` si aplica). No existe `RESOLVER_ESTACION` en `StrategyRegistry`. Ver [reconocimiento-estaciones.md](./reconocimiento-estaciones.md).

## Verificación

```text
ng test --include="**/peajes/wizard/**/*recognition*"
ng test --include="**/peajes/wizard/paso2*"
ng test --include="**/peajes/wizard/services/peajes-wizard-state*"
```

Ver también [wizard.md](./wizard.md) y `feature_list.json` → F02-11 / F02-12.

---

> Última actualización: 2026-08-06
