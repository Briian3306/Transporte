# DataTable compartido

## Resumen

`app-data-table` es una tabla **presentacional y controlada**: el host posee filas, orden, página y selección. No filtra ni edita filas inline. Selector: `app-data-table`.

Fuente: `src/app/components/shared/data-table/`.

## Índice

- [Arquitectura](#arquitectura)
- [API](#api)
- [Plantillas de columna](#plantillas-de-columna)
- [Tokens CSS](#tokens-css)
- [Consumidores](#consumidores)
- [Qué no posee](#qué-no-posee)
- [Roadmap: edición inline de filas](#roadmap-edición-inline-de-filas)
- [Referencias](#referencias)

## Arquitectura

```text
Host (filtros / RPC / formularios)
  ↓ rows, sort, page, selectedIds
app-data-table (render + emite intenciones)
  ↓ ng-template appDataTableColumn
celdas custom
```

- **Sort:** click en header → `sortChange`; el host reordena o pide al servidor.
- **Paginación:** footer emite `pageChange`; el host entrega la página ya cortada.
- **Selección:** controlada con `selectedIds` / `selectionChange` (ids de la página actual se agregan/quitan sin borrar otras páginas).

## API

### Tipos (`data-table.types.ts`)

| Tipo | Campos |
|------|--------|
| `DataTableAlign` | `'left' \| 'center' \| 'right'` |
| `DataTableFilterType` | `'text' \| 'search-select' \| 'multiselect' \| 'date-range'` |
| `DataTableColumnFilter` | `type`, `placeholder?`, `options?` |
| `DataTableColumn` | `key`, `label`, `sortable?`, `width?`, `align?`, `templateOnly?`, `editable?`, `filter?`, `searchable?` |
| `DataTableSort` | `key`, `direction: 'asc' \| 'desc'` |
| `DataTablePageChange` | `page`, `pageSize` |
| `DataTableFilterState` | `global: string`, `columns: Record<key, value>` |

### Inputs (filtros)

| Input | Rol |
|-------|-----|
| `filterableColumnsInputs` | Si `true`, renderiza controles por cada columna con `filter` |
| `searchableInputMain` | Keys del buscador global (placeholder: “Buscar en Patente, …”) |
| `clientFilter` | `rows` = dataset completo; la tabla filtra y pagina |
| `filterOptions` | Opciones extra por key (select/multiselect) |
| `filters` | Estado controlado opcional |

### Outputs

`sortChange`, `pageChange`, `selectionChange`, `rowClick`, `exportClick`, `filtersChange`.

### Ejemplo (catálogo)

```html
<app-data-table
  [columns]="columns"
  [rows]="tableRows"
  [clientFilter]="true"
  [filterableColumnsInputs]="true"
  [searchableInputMain]="['patente']"
  (pageChange)="onPageChange($event)"
/>
```

```ts
columns = [
  { key: 'patente', label: 'Patente', filter: { type: 'text' }, searchable: true },
  { key: 'categoria', label: 'Categoría', filter: { type: 'multiselect' } },
];
```

Modo servidor (Pasadas): no uses `clientFilter`; escucha `filtersChange` y aplica en el RPC.

### Directiva de contenido

```html
<ng-template appDataTableColumn="acciones" let-row>
  <button type="button" (click)="editar(row); $event.stopPropagation()">Editar</button>
</ng-template>
```

Contexto: `{ $implicit: row, column: col }`.

## Plantillas de columna

Si existe plantilla para `col.key`, se usa `ngTemplateOutlet`; si no, `{{ row[key] }}` (solo claves de primer nivel).

## Tokens CSS

Variables en `.dt`: `--dt-signal` (`#004ac6`), `--dt-rail`, `--dt-ink`, `--dt-line`, `--dt-surface`, `--dt-ok` / `--dt-pending` / `--dt-danger`.

## Consumidores

| Host | Uso |
|------|-----|
| `pasadas-list` | Server-driven: sort/page/selection + plantillas |
| `paso5-mapeo` | Cliente: patentes sin resolver |
| Catálogos Peajes | Listados CRUD: filas filtradas en host + acciones |

## Qué no posee

Edición inline, virtual scroll, resize/reorder de columnas, paths anidados (`a.b`).

Los **filtros de columna + búsqueda global** sí viven en la tabla cuando `filterableColumnsInputs` está activo; ver sección API arriba y [filter-system.md](./filter-system.md).

Filtros de dominio complejos (Pasadas RPC) pueden seguir en el host escuchando `filtersChange`.

## Roadmap: edición inline de filas

Diseño para no forzar un refactor mayor:

1. `DataTableColumn.editable?: boolean` (ya tipado).
2. Directiva futura: `ng-template appDataTableEditColumn="key"`.
3. Draft de fila **en el host**; la tabla emite: `rowEditStart`, `rowEditChange`, `rowEditSave`, `rowEditCancel`.
4. Teclado: Enter = guardar, Esc = cancelar.
5. Hasta implementarlo: Pasadas usa drawer; catálogos usan formulario lateral.

Las plantillas actuales de acciones ya cubren “abrir edición” sin cambios de API.

## Referencias

- [filter-system.md](./filter-system.md)
- [search-multi-select.md](./search-multi-select.md)
- [date-range-picker.md](./date-range-picker.md)
- Barrel: `src/app/components/shared/index.ts`

---

> Última actualización: 2026-08-04
