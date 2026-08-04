# Sistema de filtros compartido

## Resumen

Los filtros **no viven dentro** de `data-table`. El host compone widgets shared + (opcional) `FilterChipRail` y entrega `rows` ya filtrados/paginados a la tabla.

## Índice

- [Piezas](#piezas)
- [Patrón Pasadas (server)](#patrón-pasadas-server)
- [Patrón catálogos (client)](#patrón-catálogos-client)
- [Migración desde pasadas-filters legacy](#migración-desde-pasadas-filters-legacy)
- [Próximos consumidores](#próximos-consumidores)

## Piezas

| Componente | Rol |
|------------|-----|
| `app-date-range-picker` | Rango `from`/`to` (date-only) |
| `app-search-multi-select` | Multi-select con typeahead ≤10 + chips |
| `app-filter-chip-rail` | Chips resumen removibles (filtros no ya visibles como badges) |
| `app-data-table` | Listado |

## Patrón Pasadas (server)

```text
pasadas-filters
  ├─ date-range-picker → fecha_desde / fecha_hasta (ISO día)
  ├─ search-multi-select ×3 → estacion_ids / patente_ids / empresa_ids
  └─ Estado (stub)
pasadas-list
  ├─ debounce 300ms → RPC peajes_listar_pasadas
  ├─ filter-chip-rail (solo fechas / futuros stubs)
  └─ data-table
```

Los ids seleccionados ya se muestran como chips **dentro** del search-multi-select; el rail no los duplica.

## Patrón catálogos (client)

```text
app-data-table
  [clientFilter]="true"
  [filterableColumnsInputs]="true"
  [searchableInputMain]="['nombre'|'patente'|…]"
  columns[].filter → text | search-select | multiselect | date-range
```

- Controles generados desde `columns` (labels claros por campo).
- Buscador global con placeholder “Buscar en …”.
- Dataset completo en `rows`; paginación interna.
- Formularios de alta/edición (panel izquierdo) no cambian.

## Migración desde pasadas-filters legacy

| Antes | Después |
|-------|---------|
| `datetime-local` Desde/Hasta | `app-date-range-picker` |
| Inputs “rápido” + checkbox lists | `app-search-multi-select` |
| Chips por cada id en el rail | Badges en el input; rail solo fechas |

Campos `q_*` del contrato RPC se conservan por compatibilidad; la UI nueva no los escribe.

## Próximos consumidores

Historial checklist / incidentes / stock (date range). Documentar al migrar; no bloquean este release.

## Referencias

- [data-table.md](./data-table.md)
- [date-range-picker.md](./date-range-picker.md)
- [search-multi-select.md](./search-multi-select.md)
- UI catálogos: [../peajes/catalogos.md](../peajes/catalogos.md)

---

> Última actualización: 2026-08-04
