# Patentes sin resolver (Paso 5 · F02-14 / F02-16)

## Resumen

Si el mapeo a `PATENTE_ID` produce dominios que no están en el catálogo, el Paso 5 **no bloquea** solo con un mensaje de error: muestra una tabla resoluble.

## UI

Sección **Patentes sin resolver en el catálogo** con `app-data-table`:

| Columna | Contenido |
|---------|-----------|
| PATENTE | Dominio normalizado |
| Acciones | **Agregar** / **Quitar** |

Filtro rápido (cliente) encima de la tabla.

### Acciones por fila

- **Agregar** → `crearPatente({ patente, categoria: 'TRANSPORTE' })` y saca la fila de pendientes.
- **Quitar** → agrega a `patentesExcluidas` en el estado del wizard; esas filas no entran al import (`construirPasadasDesdeMapeo` las filtra).

### Acciones masivas (F02-16)

Toolbar encima de la DataTable:

| Botón | Comportamiento |
|-------|----------------|
| **Agregar todas** | Crea en el catálogo todas las patentes unresolved **visibles** (respeta el filtro rápido). Secuencial; si alguna falla, conserva las altas OK y muestra conteo de errores parciales. |
| **Quitar todas** | Excluye del import el conjunto visible vía `excluirPatenteDelImport`. |

Durante el bulk, botones de fila y toolbar quedan deshabilitados (`agregandoTodas` / `accionPatente`).

## Continuar

Requiere:

1. Columnas obligatorias mapeadas.
2. Cero patentes unresolved (todas agregadas o quitadas).

## Archivos

- `wizard/paso5-mapeo/*`
- `PeajesWizardStateService.patentesExcluidas` / `excluirPatenteDelImport`

## Feature

**F02-14** (passing) · **F02-16** (Agregar/Quitar todas) · ver `feature_list.json` y [wizard.md](./wizard.md).

---

> Última actualización: 2026-08-04
