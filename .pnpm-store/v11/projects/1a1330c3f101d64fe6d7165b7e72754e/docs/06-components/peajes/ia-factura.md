# IA de factura (F17 / F18-1)

## Resumen

Asistente de lectura de PDF de factura en el wizard de Peajes (importación **simple** y **masiva**). Propone candidatos (número, fecha, IVA, percepciones, subtotal, total) para que el usuario los aplique de a uno. **No guarda la carga** y **no rellena el formulario solo**.

Código: `src/app/components/peajes/services/ai/invoice/` + `openrouter/`. UI: Paso 1 (PDF) y Paso 7 (sugerencias). Features `F17-1`…`F17-5` y `F18-1` (masiva 1→n).

## Índice

- [Rol](#rol)
- [Objetivo](#objetivo)
- [Fuera de alcance](#fuera-de-alcance)
- [Funcionalidad](#funcionalidad)
- [Contrato de datos](#contrato-de-datos)
- [Dependencias](#dependencias)
- [Referencias](#referencias)

---

## Rol

Capa de **sugerencia operativa** entre el PDF de la factura y el documento del Paso 7.

| Es | No es |
|----|--------|
| Lector de texto de factura vía OpenRouter | Persistencia (Supabase / RPC) |
| Rankeador de candidatos contra el neto post-plantilla | Autocompletado masivo ni “aplicar todo” |
| Feedback de espera en Paso 7 (`loading` / `error` / `ready`) | Reemplazo del operador |

El humano confirma cada valor. Si la IA falla o no hay PDF, el documento se carga a mano.

---

## Objetivo

1. Acortar el Paso 7 cuando hay PDF con texto seleccionable.
2. Ofrecer varias hipótesis por campo (no un único “ganador” forzado).
3. Priorizar importes coherentes con el neto de las pasadas (±1 % en subtotal).
4. No bloquear el wizard: timeout largo (~120 s), formulario siempre editable, reintento o carga manual.

---

## Fuera de alcance

- Escritura a Supabase del PDF, del texto o de las sugerencias.
- Recálculo de IVA/total a partir del subtotal (los cuatro importes son declarados).
- Proxy Netlify `peajes-invoice-ai` (deprecado para este flujo; el browser llama OpenRouter).

---

## Funcionalidad

```text
PDF (Paso 1) → texto in-memory
     → InvoiceAiService.analyze(texto, netoEsperado)
     → OpenRouter (JSON estructurado)
     → rankInvoiceCandidates
     → estado invoiceAi en el wizard
     → chips en Paso 7 (clic = un control)
```

| Pieza | Responsabilidad |
|-------|-----------------|
| `InvoicePdfTextService` | Extrae texto de **todas** las páginas del PDF |
| `InvoiceAiService` | Orquesta analyze + ranking |
| `OpenRouterEngineService` | POST chat completions, schema, timeout 120 s. Fallback: modelo 1 + key 1 → modelo 1 + key 2 → modelo 2 + key 1 |
| `rankInvoiceCandidates` | Ordena y recorta candidatos (máx. 3 por campo) |
| Paso 1 | Dropzone: Excel/CSV + PDF opcional (simple: 1; masiva: N, nombre = `FACTURA`) |
| Paso 7 | Simple: un análisis. Masiva: cola 1→n (`analizarFacturasMasivaPendientes`); badges por documento |
| Paso 7 retry | Re-analiza `idle`/`error`; no toca `ready` |

Estados: `idle` | `loading` | `ready` | `error`. En masiva viven en `invoiceAiPorDocumento`.

En importación simple, Paso 1 muestra `app-ai-cat-loader` con “Soy Olivia!, tu Asistente de IA”. En `loading`, Paso 7 monta el mismo componente (burbuja inferior izquierda). El formulario sigue editable. En `error`, **Reintentar análisis** o carga manual. En masiva el retry solo cubre documentos pendientes.

### Campos sugeridos

| Campo IA | Control Paso 7 |
|----------|----------------|
| `invoiceNumber` | `factura` |
| `invoiceDate` | `fecha_factura` |
| `vat` | `iva` |
| `perceptions` | `percepciones` |
| `subtotal` | `importe_sin_iva` |
| `total` | `importe_total` |

Detalle de click-to-apply y fingerprint: [wizard.md — F17](./wizard.md#sugerencias-ia-de-factura-f17).

---

## Contrato de datos

Entrada al modelo: texto de factura + `expectedNetAmount` (suma de `IMPORTE_NETO` post-plantilla).

Salida OpenRouter (arrays `*_candidates` con `{ value, confidence }`). Tras el ranking: `InvoiceAiResult` con listas tipadas y `expectedNetAmount`.

Errores de usuario (español, sin keys): saturado, proveedor, inválido, red, vacío. Completar a mano o reintentar.

---

## Dependencias

- Env: `NG_APP_OPENROUTER_API_URL`, `NG_APP_OPENROUTER_MODEL`, opcional `NG_APP_OPENROUTER_MODEL_2`, `NG_APP_OPENROUTER_API_KEY`, opcional `NG_APP_OPENROUTER_API_KEY_2`.
- No usa service role. Keys viajan en el bundle Angular.
- No hay RPC de IA. La carga confirmada sigue `peajes_confirmar_carga` con los valores **ingresados** en Paso 7.

---

## Referencias

- Código: `src/app/components/peajes/services/ai/invoice/`, `.../ai/openrouter/`
- UI: `wizard/paso1-carga/`, `wizard/paso7-factura/`
- Loader: `app-ai-cat-loader` (`src/app/components/shared/ai-cat-loader/`)
- Wizard (pasos y mapeo de controles): [wizard.md](./wizard.md)
- Plan de implementación: [../../plan/invoice-ai/PLAN_invoice-ai.md](../../plan/invoice-ai/PLAN_invoice-ai.md)
- Módulo: [../../modulos/peajes.md](../../modulos/peajes.md)

---

> Última actualización: 2026-08-24
