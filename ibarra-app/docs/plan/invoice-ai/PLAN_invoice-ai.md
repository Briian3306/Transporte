# Reconocedor IA de facturas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Permitir que el wizard simple de Peajes lea un PDF opcional, consulte OpenRouter una vez que una plantilla produjo el importe neto de las pasadas y ofrezca candidatos clickeables para completar la factura sin guardar automáticamente.

**Architecture:** El PDF se selecciona en Paso 1 y su texto queda sólo en memoria durante el wizard. Después de aplicar una plantilla sin excepciones, el estado calcula el neto efectivo en centavos y el servicio de IA consulta una función Netlify que custodia las claves OpenRouter. Un motor determinista reordena los candidatos y Paso 7 los aplica sólo tras un clic explícito.

**Tech Stack:** Angular 19 standalone, Reactive Forms, RxJS, \`pdf-parse\`, Netlify Functions CommonJS, OpenRouter structured output, Jasmine/Karma y Node \`node:test\`.

**Spec:** \`docs/plan/invoice-ai/plan_ai_invoice.md\`; \`docs/06-components/peajes/wizard.md\`; \`docs/plan/invoice-ai/recreate/template/openrouter-engine.service.ts\`; \`docs/plan/invoice-ai/recreate/template/invoice-ai.service.ts\`; \`docs/plan/invoice-ai/recreate/prompt/promp.ts\`.

## Global Constraints

- La IA sugiere únicamente \`factura\`, \`fecha_factura\`, \`iva\`, \`percepciones\` e \`importe_total\`; nunca guarda ni confirma una carga.
- El usuario conserva edición manual y puede continuar si falta PDF, no hay candidatos o OpenRouter falla.
- El PDF es opcional y sólo se admite para importación simple; un PDF único no se asocia a varios documentos de una importación masiva.
- El neto de referencia es la suma en centavos de \`IMPORTE_NETO\` después de aplicar la plantilla; la tolerancia inicial es ±1%.
- Percepciones cercanas al 3–4% e IVA cercano al 21% son señales de confianza, no filtros que descarten candidatos.
- El modelo se intenta primero con \`OPENROUTER_API_KEY\` y, sólo ante timeout, 429, 5xx, fallo de proveedor o endpoint inexistente, con \`OPENROUTER_API_KEY_2\`.
- Ninguna clave OpenRouter puede estar en \`NG_APP_*\`, \`environment.values.ts\`, código Angular, logs ni respuestas HTTP. Los secretos se configuran en \`.env.local\` y Netlify.
- No usar Supabase ni persistir el PDF, texto o sugerencias.
- Los PDFs de regresión son \`docs/plan/invoice-ai/testing/facturas_2026-07-22_1947769.pdf\` y \`docs/plan/invoice-ai/testing/facturas_2026-07-22_1947768.pdf\`; no se reemplazan ni se generan durante las pruebas.
- Las pruebas unitarias y de UI no llaman servicios externos. La regresión con OpenRouter es explícitamente opt-in mediante \`RUN_OPENROUTER_LIVE_TESTS=1\` y nunca corre en CI por defecto.
- Textos UI en español; seguir componentes standalone, CSS actual del wizard y accesibilidad por teclado.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| \`netlify/functions/peajes-invoice-ai.js\` | Valida el body, fija prompt/schema/modelo y aplica fallback entre claves. |
| \`netlify/functions/peajes-invoice-ai.test.js\` | Pruebas Node del handler y política de retry. |
| \`src/app/components/peajes/services/ai/openrouter/openrouter-engine.service.ts\` | Cliente Angular del endpoint Netlify y errores de dominio. |
| \`src/app/components/peajes/services/ai/invoice/invoice-ai.models.ts\` | Tipos compartidos de request, resultado, candidatos y estado. |
| \`src/app/components/peajes/services/ai/invoice/invoice-ai.prompt.ts\` | Prompt basado en \`promp.ts\`, sin secretos. |
| \`src/app/components/peajes/services/ai/invoice/invoice-ai.schema.ts\` | JSON Schema structured output. |
| \`src/app/components/peajes/services/ai/invoice/invoice-confidence.engine.ts\` | Normaliza, puntúa, ordena y limita candidatos. |
| \`src/app/components/peajes/services/ai/invoice/invoice-pdf-text.service.ts\` | Extrae texto de todas las páginas con \`pdf-parse\`. |
| \`src/app/components/peajes/services/ai/invoice/invoice-ai.service.ts\` | Orquesta texto + neto + proxy + confidence engine. |
| \`docs/plan/invoice-ai/testing/invoice-ai-fixtures.json\` | Manifest canónico con los valores confirmados de las dos facturas históricas. |
| \`scripts/verify-invoice-ai-fixtures.mjs\` | Runner opt-in que extrae ambos PDFs con \`pdf-parse\`, invoca el handler real y compara candidatos esperados. |
| \`src/app/components/peajes/wizard/services/peajes-wizard-state.service.ts\` | Mantiene PDF y resultado IA efímeros e invalida resultados viejos. |
| \`src/app/components/peajes/wizard/paso1-carga/*\` | PDF opcional y disparo post-plantilla. |
| \`src/app/components/peajes/wizard/paso7-factura/*\` | Estado, botones de sugerencia y aplicación explícita. |

## Task 1: Definir contratos y motor de confianza

**Files:**
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-ai.models.ts\`
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-ai.schema.ts\`
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-ai.prompt.ts\`
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-confidence.engine.ts\`
- Test: \`src/app/components/peajes/services/ai/invoice/invoice-confidence.engine.spec.ts\`

**Interfaces:**
- Produces \`InvoiceField = 'invoiceNumber' | 'invoiceDate' | 'vat' | 'perceptions' | 'total'\`.
- Produces \`InvoiceCandidate<T> { value: T; modelConfidence: number; confidence: number; level: 'alta' | 'media' | 'baja'; }\`.
- Produces \`InvoiceAiResult { invoiceNumber; invoiceDate; vat; perceptions; total; expectedNetAmount; }\`.
- Produces \`rankInvoiceCandidates(raw: OpenRouterInvoiceResponse, expectedNetAmount: number): InvoiceAiResult\`.

- [ ] **Step 1: Write the failing test**

~~~ts
it('keeps a 9.5% perception but ranks the 3.98% candidate first', () => {
  const result = rankInvoiceCandidates({
    invoice_number_candidates: [], invoice_date_candidates: [], vat_candidates: [],
    perception_candidates: [{ value: 95000, confidence: .9 }, { value: 39800, confidence: .8 }],
    total_candidates: [],
  }, 1_000_000);

  expect(result.perceptions.map(candidate => candidate.value)).toEqual([39800, 95000]);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: \`pnpm exec ng test --include="**/invoice-confidence.engine.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: FAIL because the engine and contracts do not exist.

- [ ] **Step 3: Write minimal implementation**

~~~ts
export const INVOICE_CONFIDENCE_DEFAULTS = {
  netTolerance: .01, ivaRate: .21, perceptionRates: [.03, .04],
  contextWeight: 40, mathWeight: 30, totalWeight: 20,
  formatWeight: 10, maxCandidates: 3,
} as const;
~~~

Normalize model confidence to \`0..1\`; add context, format, net, IVA, perception and total-reconstruction signals without rejecting a finite candidate; deduplicate equal values; set \`alta >= .90\`, \`media >= .70\`; order descending and return no more than three candidates per field. The schema requires the five arrays from the supplied template, ISO dates, monetary numbers and no extra fields.

- [ ] **Step 4: Run test to verify it passes**

Run: \`pnpm exec ng test --include="**/invoice-confidence.engine.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: PASS; the 3–4% signal reranks but does not remove 9.5%, IVA 21% improves confidence and only three candidates remain.


## Task 2: Crear el endpoint seguro OpenRouter con fallback

**Files:**
- Create: \`netlify/functions/peajes-invoice-ai.js\`
- Create: \`netlify/functions/peajes-invoice-ai.test.js\`
- Modify: \`.env.example\`
- Modify: \`netlify.toml\`

**Interfaces:**
- Consumes \`POST /.netlify/functions/peajes-invoice-ai\` body \`{ invoiceText: string; expectedNetAmount: number }\`.
- Produces HTTP \`200\` structured output; \`400\` invalid body; \`429\` if both attempts rate-limit; \`502\` provider failure.
- Uses \`OPENROUTER_API_URL\`, \`OPENROUTER_MODEL\`, \`OPENROUTER_API_KEY\`, \`OPENROUTER_API_KEY_2\` only on the server.

- [ ] **Step 1: Write the failing handler test**

~~~js
test('uses key 2 only after a recoverable key 1 failure', async () => {
  const fetchSpy = mockFetch([response(503), response(200, structuredInvoice)]);
  const result = await createHandler({ fetchImpl: fetchSpy, env: testEnv })(postEvent(validBody));
  assert.equal(result.statusCode, 200);
  assert.equal(fetchSpy.calls[0].headers.Authorization, 'Bearer key-one');
  assert.equal(fetchSpy.calls[1].headers.Authorization, 'Bearer key-two');
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: \`node --test netlify/functions/peajes-invoice-ai.test.js\`

Expected: FAIL because the handler module is absent.

- [ ] **Step 3: Write minimal implementation**

Export \`handler\` and \`createHandler({ fetchImpl, env })\`. Accept only \`OPTIONS\` and \`POST\`; reject empty text, text over 200,000 characters and non-positive/non-finite net amount. Build messages, response format, temperature \`0.2\` and \`provider.require_parameters = true\` server-side. Do not accept prompt, model, schema or key from the client. Retry with key 2 only for \`429\`, \`408\`, \`5xx\`, network errors, \`provider returned error\` and \`no endpoints found\`; redact provider details and return a generic Spanish error.

Add only variable names without values to \`.env.example\` and the Netlify build comment. Never add \`NG_APP_OPENROUTER_*\`.

- [ ] **Step 4: Run test to verify it passes**

Run: \`node --test netlify/functions/peajes-invoice-ai.test.js\`

Expected: PASS for success, fallback, invalid request, absent secrets, rate limit and redacted failures.

- [ ] **Step 5: Commit**

~~~bash
git add netlify/functions/peajes-invoice-ai.js netlify/functions/peajes-invoice-ai.test.js .env.example netlify.toml
git commit -m "feat(peajes): proxy invoice AI requests through Netlify"
~~~

## Task 3: Implementar extracción PDF y cliente Angular

**Files:**
- Create: \`src/app/components/peajes/services/ai/openrouter/openrouter-engine.service.ts\`
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-pdf-text.service.ts\`
- Create: \`src/app/components/peajes/services/ai/invoice/invoice-ai.service.ts\`
- Test: \`src/app/components/peajes/services/ai/invoice/invoice-pdf-text.service.spec.ts\`
- Test: \`src/app/components/peajes/services/ai/invoice/invoice-ai.service.spec.ts\`

**Interfaces:**
- Produces \`extractText(file: File): Promise<string>\`.
- Produces \`analyze(invoiceText: string, expectedNetAmount: number): Observable<InvoiceAiResult>\`.
- Posts only to \`/.netlify/functions/peajes-invoice-ai\`.

- [ ] **Step 1: Write the failing test**

~~~ts
it('joins every PDF page and rejects empty extracted text', async () => {
  await expectAsync(service.extractText(pdfWithTwoTextPages())).toBeResolvedTo('page 1\npage 2');
  await expectAsync(service.extractText(pdfWithoutText())).toBeRejectedWithError(/texto seleccionable/i);
});

it('posts only text and expectedNetAmount', () => {
  service.analyze('Factura A', 100).subscribe();
  const request = http.expectOne('/.netlify/functions/peajes-invoice-ai');
  expect(request.request.body).toEqual({ invoiceText: 'Factura A', expectedNetAmount: 100 });
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: \`pnpm exec ng test --include="**/invoice-pdf-text.service.spec.ts" --include="**/invoice-ai.service.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: FAIL because the services do not exist.

- [ ] **Step 3: Write minimal implementation**

Configure the existing \`pdf-parse\` worker once, extract all pages, join non-empty page text with newlines and always destroy the parser. The Angular engine maps transport errors to a typed, user-safe \`InvoiceAiError\`. \`InvoiceAiService\` ranks the proxy response with Task 1; it never calls OpenRouter directly or reads environment keys.

- [ ] **Step 4: Run test to verify it passes**

Run: \`pnpm exec ng test --include="**/invoice-pdf-text.service.spec.ts" --include="**/invoice-ai.service.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: PASS; extraction is local, payload has no credential and output is ranked.


## Task 4: Preparar análisis después de aplicar plantilla

**Files:**
- Modify: \`src/app/components/peajes/wizard/services/peajes-wizard-state.service.ts\`
- Modify: \`src/app/components/peajes/wizard/paso1-carga/paso1-carga.component.ts\`
- Modify: \`src/app/components/peajes/wizard/paso1-carga/paso1-carga.component.html\`
- Modify: \`src/app/components/peajes/wizard/paso1-carga/paso1-carga.component.css\`
- Test: \`src/app/components/peajes/wizard/services/peajes-wizard-state.service.spec.ts\`
- Test: \`src/app/components/peajes/wizard/paso1-carga/paso1-carga.component.spec.ts\`

**Interfaces:**
- Produces \`setInvoicePdf(file, text)\`, \`setInvoiceAiAnalysis(status, result, error)\` and \`invoiceExpectedNetAmount(): number | null\` in wizard state.
- Consumes an \`aplicarYEvaluar\` result with \`ok === true\` and \`excepcion === null\`.
- Produces automatic analysis only for simple import with PDF text and a positive calculated net.

- [ ] **Step 1: Write the failing orchestration tests**

~~~ts
it('analyzes only after the template applies without exceptions', async () => {
  component.onPlantillaChange('template-1');
  await component.continuar();
  expect(ai.analyze).toHaveBeenCalledWith('invoice text', 560832.27);
});

it('does not call AI for mass import or absent PDF', async () => {
  state.setModoImportacion('masiva');
  await component.continuar();
  expect(ai.analyze).not.toHaveBeenCalled();
});
~~~

- [ ] **Step 2: Run tests to verify they fail**

Run: \`pnpm exec ng test --include="**/paso1-carga.component.spec.ts" --include="**/peajes-wizard-state.service.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: FAIL because PDF/state/orchestration APIs are missing.

- [ ] **Step 3: Write minimal implementation**

Add a separate optional PDF input to Paso 1; keep XLSX/CSV selection unchanged. On PDF replacement extract text, invalidate suggestions and show a non-blocking inline error. After \`aplicarYEvaluar\` succeeds with no exception, calculate net from post-template \`construirPasadasDesdeMapeo()\` using integer cents. Create a fingerprint from PDF name/size/lastModified, plantilla id and net cents. If it changed, set \`loading\`, analyze once, then store \`ready\` or recoverable \`error\` before entering Paso 7. If the wizard goes to steps 5/6, defer analysis until the same success condition is reached; never analyze preview-only rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: \`pnpm exec ng test --include="**/paso1-carga.component.spec.ts" --include="**/peajes-wizard-state.service.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: PASS; only ready simple templates invoke IA and the net uses cent arithmetic.

- [ ] **Step 5: Commit**

~~~bash
git add src/app/components/peajes/wizard/services/peajes-wizard-state.service.ts src/app/components/peajes/wizard/paso1-carga
git commit -m "feat(peajes): prepare invoice suggestions after template application"
~~~

## Task 5: Mostrar y aplicar candidatos en Paso 7

**Files:**
- Modify: \`src/app/components/peajes/wizard/paso7-factura/paso7-factura.component.ts\`
- Modify: \`src/app/components/peajes/wizard/paso7-factura/paso7-factura.component.html\`
- Modify: \`src/app/components/peajes/wizard/paso7-factura/paso7-factura.component.css\`
- Modify: \`src/app/components/peajes/wizard/paso7-factura/paso7-factura.component.spec.ts\`

**Interfaces:**
- Consumes \`state.snapshot().invoiceAi\`.
- Produces \`applyInvoiceSuggestion(field: InvoiceField, candidate: InvoiceCandidate<string | number>): void\`.

- [ ] **Step 1: Write the failing UI tests**

~~~ts
it('applies only the clicked IVA and leaves total unchanged', () => {
  state.setInvoiceAiAnalysis('ready', invoiceResultWithIva(21), null);
  component.applyInvoiceSuggestion('vat', ivaCandidate(21));
  expect(component.form.controls.iva.value).toBe(21);
  expect(component.form.controls.importe_total.value).toBeNull();
});

it('applies an ISO date and synchronizes the date picker', () => {
  component.applyInvoiceSuggestion('invoiceDate', dateCandidate('2026-06-01'));
  expect(component.form.controls.fecha_factura.value).toBe('2026-06-01');
  expect(component.fechaRanges[0].from).toEqual(new Date(2026, 5, 1));
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: \`pnpm exec ng test --include="**/paso7-factura.component.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: FAIL because suggestion state and application methods are absent.

- [ ] **Step 3: Write minimal implementation**

For the simple form only, render an \`aria-live="polite"\` status beneath the heading and button lists under each eligible input. Each button shows localized value, percentage and \`Confianza alta/media/baja\`. A click patches only the mapped control, marks it dirty and updates \`fechaRanges[0]\` for dates. Show retry only on \`error\`, using the stored PDF/net fingerprint. Do not add bulk auto-apply and do not render IA controls in mass import.

- [ ] **Step 4: Run test to verify it passes**

Run: \`pnpm exec ng test --include="**/paso7-factura.component.spec.ts" --watch=false --browsers=ChromeHeadless\`

Expected: PASS; candidates are field-local and manual editing remains available.


## Task 6: Incorporar los PDFs reales como regresión de extracción y OpenRouter

**Files:**
- Create: \`docs/plan/invoice-ai/testing/invoice-ai-fixtures.json\`
- Create: \`scripts/verify-invoice-ai-fixtures.mjs\`
- Modify: \`netlify/functions/peajes-invoice-ai.test.js\`

**Interfaces:**
- Consumes the immutable PDFs \`facturas_2026-07-22_1947769.pdf\` and \`facturas_2026-07-22_1947768.pdf\`.
- Produces \`InvoiceAiFixture { fileName: string; expectedNetAmount: number; expected: { factura: string; fechaFactura: string; iva: number; percepciones: number; importeTotal: number; } }\`.
- Produces a live-only zero-exit result when every expected value is the first candidate returned by the structured OpenRouter response.

- [ ] **Step 1: Write the failing fixture-manifest and regression tests**

~~~json
[
  {
    "fileName": "facturas_2026-07-22_1947769.pdf",
    "expectedNetAmount": 173460,
    "expected": {
      "factura": "0041-01947769",
      "fechaFactura": "2026-07-22",
      "iva": 0,
      "percepciones": 0,
      "importeTotal": 173460
    }
  },
  {
    "fileName": "facturas_2026-07-22_1947768.pdf",
    "expectedNetAmount": 684180,
    "expected": {
      "factura": "0041-01947768",
      "fechaFactura": "2026-07-22",
      "iva": 0,
      "percepciones": 0,
      "importeTotal": 684180
    }
  }
]
~~~

Add a Node test that reads this manifest and asserts that every PDF path exists. Add the runner assertion below before creating the runner implementation:

~~~js
assert.deepEqual(topValues(result), {
  factura: fixture.expected.factura,
  fechaFactura: fixture.expected.fechaFactura,
  iva: fixture.expected.iva,
  percepciones: fixture.expected.percepciones,
  importeTotal: fixture.expected.importeTotal,
});
~~~

- [ ] **Step 2: Run the fixture test to verify it fails**

Run: \`node --test netlify/functions/peajes-invoice-ai.test.js\`

Expected: FAIL because the fixture manifest and the expected historical cases do not exist.

- [ ] **Step 3: Implement the fixture runner with pdf-parse**

Create the JSON manifest exactly as above. In \`scripts/verify-invoice-ai-fixtures.mjs\`, refuse to run unless \`process.env.RUN_OPENROUTER_LIVE_TESTS === '1'\`; print the command required to enable it and exit 0 otherwise. When enabled, use \`readFile\` and \`PDFParse\` directly to extract text from every page of each fixture, fail if extracted text is blank, then call \`createHandler({ fetchImpl: fetch, env: process.env })\` from the Netlify function with that text and the fixture's \`expectedNetAmount\`.

Parse the handler body and assert the first structured candidate of \`invoice_number_candidates\`, \`invoice_date_candidates\`, \`vat_candidates\`, \`perception_candidates\` and \`total_candidates\` is exactly the five values in the manifest. The separate deterministic Angular confidence-engine tests from Task 1 verify local reranking. For amounts, compare integer cents so \`173460.00\` equals \`173460\`; for dates compare ISO calendar strings. Print only file name, calculated input net, selected candidate values and pass/fail status—never PDF text, HTTP authorization headers or secrets.

- [ ] **Step 4: Run deterministic and live fixture checks**

Run:

~~~bash
node --test netlify/functions/peajes-invoice-ai.test.js
node scripts/verify-invoice-ai-fixtures.mjs
$env:RUN_OPENROUTER_LIVE_TESTS='1'
node scripts/verify-invoice-ai-fixtures.mjs
~~~

Expected: the first command passes manifest/handler behavior; the second reports that live tests are skipped; the third performs two real model calls and exits 0 only when both PDFs produce the exact confirmed invoice number, date, IVA, perceptions and total.

- [ ] **Step 5: Commit the regression fixture task**

~~~bash
git add docs/plan/invoice-ai/testing/invoice-ai-fixtures.json scripts/verify-invoice-ai-fixtures.mjs netlify/functions/peajes-invoice-ai.test.js
git commit -m "test(peajes): add real invoice AI regression fixtures"
~~~

## Task 7: Documentar, verificar e integrar

**Files:**
- Modify: \`docs/06-components/peajes/wizard.md\`
- Modify: \`feature_list.json\`
- Modify: \`docs/claude-progress.md\`
- Modify: \`docs/session-handoff.md\`

**Interfaces:**
- Consumes real evidence from Tasks 1–5.
- Produces feature records \`F16-1\` (contracts/proxy), \`F16-2\` (PDF/early analysis), \`F16-3\` (Paso 7), \`F16-4\` (real-PDF regression) and \`F16-5\` (QA/docs), initially \`not_started\`.

- [ ] **Step 1: Add planned feature records**

Add the five F16 records with owners, exact dependencies and the commands below. Assign F16-4 to QA after Tasks 1–3 and record the two fixture PDFs plus their verified Supabase values in its evidence target. Add the cross-owner handoff: server owns credentials; frontend owns UI/state; the feature makes no Supabase write.

- [ ] **Step 2: Run full verification**

Run:

~~~bash
node --test netlify/functions/peajes-invoice-ai.test.js
node scripts/verify-invoice-ai-fixtures.mjs
pnpm exec ng test --include="**/services/ai/**/*.spec.ts" --include="**/paso1-carga.component.spec.ts" --include="**/paso7-factura.component.spec.ts" --watch=false --browsers=ChromeHeadless
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npx ng build --configuration=development
~~~

Expected: every command exits 0. Run the real OpenRouter fixture command only after explicit authorization for two paid/external calls and record its model name, date and result separately. Record any pre-existing failure verbatim and do not mark the corresponding feature passing.

- [ ] **Step 3: Perform manual visual verification**

Open \`/peajes/carga-express\`, load simple CSV/XLSX + optional PDF + compatible template, and verify Paso 7 has candidates and the computed net. Repeat without PDF, with invalid PDF, no candidates and provider failure; manual completion must work. Replace PDF or template and verify stale suggestions disappear before a new result arrives.

- [ ] **Step 4: Record evidence and documentation**

Document optional PDF, post-template trigger, computed net, retry policy, privacy boundary and click-to-apply behavior in \`wizard.md\`. Record actual outputs in feature evidence and add a dated progress entry; no status becomes passing until all required checks and docs pass.



## Completion Checklist

- [ ] All five requested fields are candidate-based and individually selectable.
- [ ] The query runs post-template and uses the transformed \`IMPORTE_NETO\` sum in cents.
- [ ] PDF/text are not persisted and credentials are never browser-visible.
- [ ] No interaction auto-saves or blocks manual invoice entry.
- [ ] Carga Express/simple is covered; mass import remains outside the one-PDF MVP.
- [ ] Tests, build, evidence, progress and handoff reflect actual execution only.
