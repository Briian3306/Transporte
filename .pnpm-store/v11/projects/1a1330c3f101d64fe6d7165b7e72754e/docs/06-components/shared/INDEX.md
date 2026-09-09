# Índice — Componentes compartidos

## Resumen

Primitivas UI reutilizables bajo `src/app/components/shared/`. El `data-table` es presentacional; filtros y búsqueda viven como siblings y los hosts los componen.

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [data-table.md](./data-table.md) | Tabla controlada: API, plantillas, consumidores, roadmap de edición inline |
| [filter-system.md](./filter-system.md) | Composición filtros + chip rail + data-table (Pasadas y catálogos) |
| [date-range-picker.md](./date-range-picker.md) | Fecha: modo `range` (2 meses) o `single` (1 mes) |
| [checkbox-multi-select.md](./checkbox-multi-select.md) | Multi-select con checkboxes, badges, grupos y búsqueda en popover |
| [search-multi-select.md](./search-multi-select.md) | Búsqueda multi/single con chips (≤10 resultados) |
| [search-select.md](./search-select.md) | Búsqueda single scalar (`string \| null`, ≤10 resultados) |
| [dialog.md](./dialog.md) | Modal compartido (altas de catálogo / wizard) |
| [graph-loader.md](./graph-loader.md) | Espera activa (canvas + frases rotativas); no bloquea el formulario |

## Código fuente

```text
src/app/components/shared/
  data-table/
  date-range-picker/
  checkbox-multi-select/
  search-multi-select/
  search-select/
  dialog/
  graph-loader/
  loading-spinner/
  filter-bar/          # FilterChipRail
  index.ts             # barrel
```

## Referencias

- Catálogos UI: [../peajes/catalogos.md](../peajes/catalogos.md)
- Tablas catálogo: [../../06-tablas/peajes/catalogos.md](../../06-tablas/peajes/catalogos.md)
- [IA de factura (consumo)](../peajes/ia-factura.md)

---

> Última actualización: 2026-09-09
