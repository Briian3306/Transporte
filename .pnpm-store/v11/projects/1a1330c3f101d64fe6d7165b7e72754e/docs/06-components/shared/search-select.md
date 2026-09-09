# Search Select (single)

## Resumen

Input de búsqueda con **una sola selección** (`string | null`). Al tipear (≥1 carácter) muestra hasta **10** coincidencias; al elegir, muestra el valor seleccionado con opción de limpiar. Pensado para Empresa, Plantilla y otros pickers de catálogo donde no hace falta multi.

Selector: `app-search-select`.  
Fuente: `src/app/components/shared/search-select/`.

Complementa `app-search-multi-select`: SMS acumula chips (filtros / multi); este control es scalar para un único id.

## API

```ts
export interface SearchSelectOption {
  id: string;
  label: string;
}
```

| Input | Default | Rol |
|-------|---------|-----|
| `options` | `[]` | Catálogo `{ id, label }` |
| `value` | `null` | Id seleccionado o `null` |
| `label` | `''` | Etiqueta |
| `placeholder` | `Buscar…` | Placeholder del input |
| `maxResults` | `10` | Tope del dropdown |
| `disabled` | `false` | — |
| `emptyMessage` | `Sin resultados` | Dropdown vacío |
| `clearable` | `true` | Si `false`, oculta × |
| `showAllWhenEmpty` | `false` | Con query vacío lista todas las opciones (sin tope `maxResults`) |

| Output | Payload |
|--------|---------|
| `valueChange` | `string \| null` |

`ControlValueAccessor` para `string | null`.

## Comportamiento

- Al enfocar con query vacío abre el dropdown con opciones (hasta `maxResults`, o todas si `showAllWhenEmpty`).
- Filtro: substring case-insensitive sobre `label` (con query aplica `maxResults`).
- Dropdown scrollable; teclado ↑/↓/Enter/Esc; click fuera cierra.
- La opción ya seleccionada no se relista.
- Una nueva elección reemplaza la anterior.
- × (si `clearable`) o Backspace con query vacío limpia la selección.
- Con valor seleccionado, el nombre permanece visible al enfocar con teclado; al tipear se oculta y empieza la búsqueda.

## Uso en wizard Paso 1

Empresa y Plantilla usan `app-search-select`. Cambiar empresa limpia la plantilla y recarga el listado filtrado. Plantilla usa `showAllWhenEmpty` para listar todas al enfocar.

```html
<app-search-select
  label="Plantilla a aplicar"
  [options]="plantillaOptions"
  [value]="plantillaId || null"
  [showAllWhenEmpty]="true"
  (valueChange)="onPlantillaChange($event)"
></app-search-select>
```

## Uso en wizard Paso 6

Estación interna (tabla) y Peaje (alta) usan `app-search-select` con `showAllWhenEmpty`.

## Referencias

- [search-multi-select.md](./search-multi-select.md)
- [wizard.md](../peajes/wizard.md)
- [reconocimiento-estaciones.md](../peajes/reconocimiento-estaciones.md)

---

> Última actualización: 2026-08-05
