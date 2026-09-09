# Checkbox Multi-Select

## Resumen

Selector múltiple con **checkboxes**, **badges/tickets** y popover con búsqueda. El disparador muestra las selecciones como stubs (rail izquierdo + icono + ×); el listado permite marcar, buscar, agrupar y **Seleccionar todo**.

Selector: `app-checkbox-multi-select`.  
Fuente: `src/app/components/shared/checkbox-multi-select/`.

No reemplaza a `app-search-multi-select`. Usar este control cuando el catálogo debe verse **completo con checkboxes** (filtros, formularios, dashboards). Usar `search-multi-select` cuando el operador **tipea para buscar** y el dropdown solo aparece tras el primer carácter.

Diseño portado de [sersavan/shadcn-multi-select-component](https://github.com/sersavan/shadcn-multi-select-component) a Angular 19 (standalone, sin React/shadcn/Tailwind). Iconos: **Font Awesome**. Formularios: **ControlValueAccessor** (`string[]`), no React Hook Form.

## API

```ts
export interface CheckboxMultiSelectOption {
  label: string;
  value: string;
  icon?: string;          // clase FA, p. ej. 'fas fa-truck'
  disabled?: boolean;
  style?: {
    badgeColor?: string;
    iconColor?: string;
    gradient?: string;    // CSS, p. ej. 'linear-gradient(135deg, #004ac6, #1d4ed8)'
  };
}

export interface CheckboxMultiSelectGroup {
  heading: string;
  options: readonly CheckboxMultiSelectOption[];
}

export type CheckboxMultiSelectSource =
  | readonly CheckboxMultiSelectOption[]
  | readonly CheckboxMultiSelectGroup[];
```

| Input | Default | Rol |
|-------|---------|-----|
| `options` | `[]` | Planas o agrupadas (`heading` + `options`) |
| `value` | `[]` | Values seleccionados |
| `defaultValue` | `[]` | Valor de `reset()` |
| `label` | `''` | Etiqueta |
| `labelIcon` | `''` | Icono FA junto a la etiqueta |
| `hint` | `''` | Texto de ayuda bajo el campo |
| `required` | `false` | Asterisco + `aria-required` |
| `placeholder` | `Seleccionar opciones` | Vacío |
| `searchPlaceholder` | `Buscar opciones…` | Input del popover |
| `emptyMessage` | `Sin coincidencias` | Búsqueda sin resultados |
| `selectAllLabel` | `Seleccionar todo` | — |
| `variant` | `'default'` | `'default' \| 'secondary' \| 'destructive' \| 'inverted'` |
| `animationConfig` | fade / slide / highlight | Ver tipos de animación |
| `maxCount` | `3` | Badges visibles; el resto es `+N` |
| `modalPopover` | `false` | Popover con z-index más alto |
| `hideSelectAll` | `false` | — |
| `searchable` | `true` | — |
| `autoSize` | `false` | Ancho al contenido |
| `singleLine` | `false` | Badges en una sola fila con scroll |
| `disabled` | `false` | — |
| `responsive` | `false` | `true` o `{ mobile, tablet, desktop }` |
| `minWidth` / `maxWidth` | `''` | CSS width |
| `deduplicateOptions` | `false` | Conserva la primera `value` repetida |
| `resetOnDefaultValueChange` | `true` | `reset()` si cambia `defaultValue` |
| `closeOnSelect` | `false` | Cierra el popover al marcar |
| `clearable` | `true` | × de badge y limpiar todo |
| `popoverClass` | `''` | Clase extra del popover |

| Output | Payload |
|--------|---------|
| `valueChange` | `string[]` |

`ControlValueAccessor` para `string[]` (`[(ngModel)]` o `formControlName`).

### Métodos (ViewChild)

| Método | Efecto |
|--------|--------|
| `reset()` | Vuelve a `defaultValue` |
| `clear()` | Vacía la selección |
| `focus()` | Foco en el disparador |
| `getSelectedValues()` | Copia de `value` |
| `setSelectedValues(values)` | Selección programática |
| `openPopover()` / `closePopover()` | Popover |

### Animaciones

```ts
animationConfig = {
  badgeAnimation: 'none' | 'bounce' | 'pulse' | 'wiggle' | 'fade' | 'slide',
  popoverAnimation: 'none' | 'scale' | 'slide' | 'fade' | 'flip',
  optionHoverAnimation: 'none' | 'highlight' | 'scale' | 'glow',
  duration: 0.2, // segundos
}
```

`prefers-reduced-motion: reduce` desactiva las animaciones.

### Responsive

Con `responsive={true}`:

| Viewport | maxCount | compactMode |
|----------|----------|-------------|
| &lt; 640px (móvil) | 2 | sí (targets táctiles más altos) |
| 640–1023px (tablet) | 4 | no |
| ≥ 1024px (desktop) | 6 | no |

Se puede pasar un objeto para override por breakpoint.

## Comportamiento

- Click / Enter / Space / ↓ abre el popover; Esc cierra; click fuera cierra.
- Filtro substring case-insensitive sobre `label` y `value`.
- Opciones `disabled` no se marcan; **Seleccionar todo** solo toma las habilitadas visibles.
- Si todas las visibles habilitadas ya están marcadas, **Seleccionar todo** las quita (conserva values deshabilitados).
- Ctrl/Cmd+A en el popover = seleccionar todo (si no está oculto).
- Backspace con búsqueda vacía quita el último seleccionado.
- Región `aria-live` anuncia altas y bajas.
- Filtrado de gráficos / dashboards: el host filtra sus datos con `value`; el control no habla con charts.

## Uso

```html
<app-checkbox-multi-select
  label="Estaciones"
  labelIcon="fas fa-road"
  hint="Filtra el listado de pasadas."
  [required]="true"
  [options]="estaciones"
  [value]="estacionIds"
  (valueChange)="estacionIds = $event"
  placeholder="Elegir estaciones"
/>
```

```html
<app-checkbox-multi-select
  [options]="frameworksAgrupados"
  [formControl]="frameworksCtrl"
  variant="secondary"
  [maxCount]="4"
  [responsive]="true"
  [animationConfig]="{ badgeAnimation: 'pulse', popoverAnimation: 'slide' }"
/>
```

```ts
@ViewChild(CheckboxMultiSelectComponent)
select?: CheckboxMultiSelectComponent;

clearFilters(): void {
  this.select?.clear();
}
```

### Grupos y deshabilitadas

```ts
const options = [
  {
    heading: 'Frontend',
    options: [
      { value: 'angular', label: 'Angular', icon: 'fab fa-angular' },
      { value: 'react', label: 'React', icon: 'fab fa-react', style: { iconColor: '#61dafb' } },
    ],
  },
  {
    heading: 'Legacy',
    options: [
      { value: 'jquery', label: 'jQuery', disabled: true },
    ],
  },
];
```

## Look

Paleta Ibarra (`#004ac6` signal, papel claro). Las badges no son pills genéricos: cada selección es un **stub de waybill** con rail izquierdo `#c45c26`. `inverted` sirve para paneles oscuros; no es el default.

## Referencias

- [search-multi-select.md](./search-multi-select.md) — typeahead con chips
- [search-select.md](./search-select.md) — single scalar
- [filter-system.md](./filter-system.md)
- [INDEX.md](./INDEX.md)

---

> Última actualización: 2026-09-09
