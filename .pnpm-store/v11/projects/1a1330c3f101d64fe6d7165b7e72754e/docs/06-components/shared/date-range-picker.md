# Date Range Picker

## Resumen

Selector de fechas reutilizable (UX tipo shadcn): botón trigger + popover. Date-only (sin hora).

Selector: `app-date-range-picker`.  
Fuente: `src/app/components/shared/date-range-picker/`.

## Modos

| `mode` | Comportamiento |
|--------|----------------|
| `range` (default) | Dos meses; primer click → `from`, segundo → `to` |
| `single` | Un mes; un click fija `from` y cierra el popover |

## API

```ts
export interface DateRangeValue {
  from: Date | null;
  to: Date | null;
}
```

| Input | Rol |
|-------|-----|
| `value` | Rango / fecha controlada |
| `label` | Etiqueta visible |
| `placeholder` | Default: `Elegir fechas` (`Elegir fecha` típico en single) |
| `disabled` | Deshabilita el trigger |
| `minDate` / `maxDate` | Límites opcionales |
| `mode` | `'range' \| 'single'` |

| Output | Payload |
|--------|---------|
| `valueChange` | `DateRangeValue` |

Implementa `ControlValueAccessor` para formularios reactivos.

Helpers: `toDateInputValue` / `parseDateInputValue` (`yyyy-MM-dd` local) para forms date-only.

## Comportamiento (range)

1. Primer click → `from`; segundo → `to` (se intercambian si `to < from`).
2. Label del botón: `d MMM y – d MMM y` (`es-AR`) o placeholder.
3. Navegación de meses con chevrons; grilla Su–Sa.
4. Cierre: click fuera, Esc, o al completar el rango.

## Comportamiento (single)

1. Un click selecciona la fecha (`from`; `to` = null).
2. Popover de un mes; cierra al elegir.
3. Uso: wizard Paso 7 · Fecha de factura.

## Integración Pasadas

Mapear a ISO de día:

- `fecha_desde` = inicio del día `from` (local → ISO)
- `fecha_hasta` = fin del día `to` (local → ISO)

## Tokens

Alineados a `--dt-signal` / peajes: `#004ac6`, rail `#f2f4f6`, line `#e2e8f0`.

## Referencias

- [filter-system.md](./filter-system.md)
- Wizard Paso 7: [../peajes/wizard.md](../peajes/wizard.md)

---

> Última actualización: 2026-08-04
