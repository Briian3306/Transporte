# Índice — Componentes compartidos

## Resumen

Primitivas UI reutilizables bajo `src/app/components/shared/`. El `data-table` es presentacional; filtros y búsqueda viven como siblings y los hosts los componen.

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [data-table.md](./data-table.md) | Tabla controlada: API, plantillas, consumidores, roadmap de edición inline |
| [filter-system.md](./filter-system.md) | Composición filtros + chip rail + data-table (Pasadas y catálogos) |
| [date-range-picker.md](./date-range-picker.md) | Fecha: modo `range` (2 meses) o `single` (1 mes) |
| [search-multi-select.md](./search-multi-select.md) | Búsqueda multi/single con chips (≤10 resultados) |
| [search-select.md](./search-select.md) | Búsqueda single scalar (`string \| null`, ≤10 resultados) |
| [dialog.md](./dialog.md) | Modal compartido (altas de catálogo / wizard) |

## Código fuente

```text
src/app/components/shared/
  data-table/
  date-range-picker/
  search-multi-select/
  search-select/
  dialog/
  filter-bar/          # FilterChipRail
  index.ts             # barrel
```

## Referencias

- Catálogos UI: [../peajes/catalogos.md](../peajes/catalogos.md)
- Tablas catálogo: [../../06-tablas/peajes/catalogos.md](../../06-tablas/peajes/catalogos.md)

---

> Última actualización: 2026-08-05
