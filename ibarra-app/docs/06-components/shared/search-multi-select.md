# Search Multi-Select (chips)

## Resumen

Input genérico de búsqueda con chips: al tipear (≥1 carácter) muestra hasta **10** coincidencias; al elegir, renderiza **badges/chips**. Sirve para patentes, estaciones, empresas, peajes, pases y cualquier catálogo futuro.

Selector: `app-search-multi-select`.  
Fuente: `src/app/components/shared/search-multi-select/`.

Complementa `AutocompleteGenericComponent`: este control soporta **multi** y **single** con la misma UI de chips.

## API

```ts
export interface SearchMultiSelectOption {
  id: string;
  label: string;
}

export type SearchMultiSelectMode = 'multi' | 'single';
```

| Input | Default | Rol |
|-------|---------|-----|
| `options` | `[]` | Catálogo `{ id, label }` |
| `value` | `[]` | Ids seleccionados |
| `label` | `''` | Etiqueta |
| `placeholder` | `Buscar…` | Placeholder del input |
| `maxResults` | `10` | Tope del dropdown |
| `disabled` | `false` | — |
| `emptyMessage` | `Sin resultados` | Dropdown vacío |
| `badgeTone` | `'signal'` | `'default' \| 'signal' \| 'muted'` |
| `mode` | `'multi'` | `'multi'` acumula; `'single'` reemplaza |
| `clearable` | `true` | Si `false`, oculta × del chip |

| Output | Payload |
|--------|---------|
| `valueChange` | `string[]` |

`ControlValueAccessor` para `string[]`.

## Comportamiento

- Filtro: substring case-insensitive sobre `label`.
- Dropdown scrollable; teclado ↑/↓/Enter/Esc; click fuera cierra.
- Opciones ya seleccionadas no se relistan (modo multi).
- Chip × quita el id de `value` (si `clearable` y no `disabled`).
- **Single:** una selección; chip sin × cuando `disabled` + `clearable=false` (p. ej. empresa fijada en Paso 7).

## Uso en catálogos / Pasadas

- `value` vacío → el host muestra **todas** las filas.
- `value` con ids → el host filtra el listado a esos ids.
- Pasadas: `estacion_ids` / `patente_ids` / `empresa_ids` del RPC (modo multi).

## Uso en wizard Paso 7

Empresa en modo `single`, `disabled` y `clearable=false`: muestra la empresa elegida en Paso 1 sin permitir cambio.

## Referencias

- [filter-system.md](./filter-system.md)
- [data-table.md](./data-table.md)

---

> Última actualización: 2026-08-04
