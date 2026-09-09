# Graph loader (`app-graph-loader`)

## Resumen

Componente shared de **espera activa**: muestra un grafo animado (nodos + aristas en canvas) y frases que rotan mientras un proceso asíncrono corre en segundo plano.

No bloquea la UI. El host decide cuándo mostrarlo; el usuario puede seguir editando el formulario.

Selector: `app-graph-loader`.  
Fuente: `src/app/components/shared/graph-loader/`.

## Índice

- [Rol](#rol)
- [Objetivo](#objetivo)
- [Funcionalidad](#funcionalidad)
- [API](#api)
- [Ejemplos](#ejemplos)
- [Consumidores](#consumidores)
- [Referencias](#referencias)

---

## Rol

Pieza de **feedback de espera** reutilizable. Ocupa el hueco entre un spinner genérico (`app-loading-spinner`, Paso 6) y un overlay modal.

En Peajes comunica “la IA está leyendo la factura” sin impedir cargar el documento a mano.

| Es | No es |
|----|--------|
| Indicador visual + copy de progreso | Motor de IA / llamada HTTP |
| Canvas compacto (~240×220) sobre la superficie del wizard | Página de loading a pantalla completa |
| Presentacional (inputs de mensajes y detalle) | Dueño del estado `idle \| loading \| ready \| error` |

El estado de negocio vive en el wizard (`invoiceAi.status`). Este componente solo se **monta** mientras ese estado es `loading`.

---

## Objetivo

1. Hacer visible que el análisis sigue en curso (hasta ~120 s).
2. Variar el mensaje (`Analizando texto....`, `Analizando Factura ....`, …) para que la espera no parezca colgada.
3. Dejar el formulario usable: sin overlay, sin `pointer-events: none`, sin deshabilitar inputs.
4. Respetar `prefers-reduced-motion: reduce` (nodos estáticos, primer mensaje fijo).

---

## Funcionalidad

Al entrar en vista:

1. Dibuja seis nodos unidos por aristas en un `<canvas>` transparente.
2. Anima el grafo con `requestAnimationFrame` (salvo reduced motion).
3. Rota `messages` cada `messageIntervalMs` (default 2200 ms).
4. Expone `role="status"` y `aria-live="polite"` con la frase actual.
5. En destroy cancela RAF y el intervalo.

No persiste nada. No llama OpenRouter.

### Relación con el wizard

| `invoiceAi.status` | Graph loader | Formulario factura |
|--------------------|--------------|--------------------|
| `loading` | Visible | Editable |
| `error` | Oculto | Editable + Reintentar análisis |
| `ready` | Oculto | Editable + chips de sugerencia |
| Importación masiva | No se renderiza | Sin chrome de IA |

---

## API

| Input | Default | Rol |
|-------|---------|-----|
| `messages` | ver frases por defecto | Líneas que rotan bajo el canvas |
| `messageIntervalMs` | `2200` | Intervalo de rotación (ms) |
| `detail` | `Podés completar el documento a mano.` | Texto de apoyo (no rota) |

Frases por defecto:

- `Analizando texto....`
- `Analizando Factura ....`
- `Leyendo importes....`
- `Buscando número y fecha....`

No emite outputs. El host lo muestra u oculta con `*ngIf`.

---

## Ejemplos

```html
<div *ngIf="invoiceAi.status === 'loading'" data-testid="invoice-ai-loader">
  <app-graph-loader></app-graph-loader>
</div>
```

Mensajes custom:

```html
<app-graph-loader
  [messages]="['Indexando archivo....', 'Cruzando importes....']"
  [messageIntervalMs]="2500"
  detail="Podés seguir cargando datos."
></app-graph-loader>
```

---

## Consumidores

| Host | Cuándo |
|------|--------|
| Paso 7 factura (`paso7-factura`) | Importación **simple**, `invoiceAi.status === 'loading'` |

No reemplaza `app-loading-spinner` (reconocimiento de estaciones en Paso 6).

Tests: `graph-loader.component.spec.ts`, casos de loader en `paso7-factura.component.spec.ts`.

---

## Referencias

- Código: `src/app/components/shared/graph-loader/`
- Barrel: `src/app/components/shared/index.ts`
- Uso en wizard (F17): [../peajes/ia-factura.md](../peajes/ia-factura.md) · [../peajes/wizard.md](../peajes/wizard.md)
- Índice shared: [INDEX.md](./INDEX.md)

---

> Última actualización: 2026-08-24
