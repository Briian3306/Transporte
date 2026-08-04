# Dialog (modal compartido)

## Resumen

Modal reutilizable para altas de catálogo y confirmaciones cortas en Peajes / operación.

Selector: `app-dialog`.  
Fuente: `src/app/components/shared/dialog/`.

## API

| Input | Default | Rol |
|-------|---------|-----|
| `open` | `false` | Visible |
| `eyebrow` | `''` | Etiqueta superior (p. ej. «Catálogo de estaciones») |
| `title` | `''` | Título |
| `description` | `''` | Texto de apoyo |
| `closeLabel` | `Cerrar` | aria-label del botón × |
| `closeOnBackdrop` | `true` | Click fuera cierra |
| `size` | `'md'` | `'md' \| 'lg'` |

| Output | Cuándo |
|--------|--------|
| `openChange` | Al cerrar (`false`) |
| `closed` | Tras cerrar (Esc, ×, backdrop) |

### Proyección

- Contenido default → cuerpo del diálogo
- `[appDialogActions]` → footer de acciones (Cancelar / Confirmar)

## Uso

```html
<app-dialog
  [open]="crearAbierto"
  eyebrow="Catálogo"
  title="Crear estación"
  description="Se asociará el código proveedor."
  (closed)="crearAbierto = false"
>
  <!-- form fields -->
  <div appDialogActions class="pw__footer-actions">
    <button type="button" class="pw__btn" (click)="crearAbierto = false">Cancelar</button>
    <button type="button" class="pw__btn pw__btn--primary" (click)="guardar()">Crear</button>
  </div>
</app-dialog>
```

## Consumidores

- Wizard Paso 1 — crear empresa
- Wizard Paso 6 — crear estación («Ninguna coincide» / Nueva / Crear estación)

## Referencias

- [INDEX.md](./INDEX.md)
- [../peajes/wizard.md](../peajes/wizard.md)

---

> Última actualización: 2026-08-04
