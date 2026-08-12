# Auditoría de tarifas (F14-4)

## Resumen

Pantalla `/peajes/auditoria-tarifas` para revisar familias tarifarias inferidas o auditadas a partir de `pasadas` ya importadas. El motor escribe un **diagnóstico** algorítmico; el analista confirma el **status** comercial del peaje (`PICO` / `NO_PICO` u otros del catálogo).

Features: **F14-4** (UI) · **F14-2** (RPCs / servicio) · Owner UI: `02-frontend-wizard-tablas`.

## Ubicación

| Artefacto | Path |
|-----------|------|
| Listado | `src/app/components/peajes/auditoria-tarifas/auditoria-tarifas-list.component.*` |
| Panel familia | `tarifa-familia-panel.component.*` |
| Badges / botones | `tarifa-status-badge`, `tarifa-status-buttons` |
| Comparar | `tarifa-comparar-dialog.component.*` |
| Rutas + provider | `auditoria-tarifas.routes.ts` → `PeajesAuditoriaTarifasSupabaseService` |
| Contratos | `models/auditoria-tarifas.contracts.ts` |
| Tarjeta home | `peajes-home.component.html` — «Auditoría de tarifas» |

Permiso: `{ module: 'peajes', action: 'read' }`. Prefijo CSS: `at__`.

## Flujo UI

1. Filtros (`app-filter-chip-rail`, fechas, peaje, estación, categoría, diagnóstico, status) con debounce 300 ms.
2. Tabla padre nativa (una fila expandida a la vez) + detalle con `app-data-table` anidado.
3. Panel / diálogo de comparación: asignar status por nivel (N niveles), «Es variación por categoría», «Marcar para revisar».
4. Botón **Recalcular** → `peajes_recalcular_tarifas(peaje_id)`.

Badges: universales `PENDIENTE` / `POSIBLE_HORARIO` fijos; resto desde `tarifas_status_catalogo` del peaje; código desconocido → badge neutro con texto crudo.

## Patrón A vs B

- Sin `pasadas.categoria` → Patrón A (familia = estación).
- Con categoría mapeada en el wizard → Patrón B (familia = estación + categoría).

La detección de columna y el destino opcional `CATEGORIA` están en [reconocimiento-columnas.md](./reconocimiento-columnas.md) (F14-3). Backend: [auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md).

## Verificación

```text
ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
npx --yes tsx src/app/components/peajes/auditoria-tarifas/clasificacion.verify.ts
```

---

> Última actualización: 2026-08-12
