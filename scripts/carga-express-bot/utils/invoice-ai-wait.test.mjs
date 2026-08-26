import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVOICE_AI_LOADER_SELECTOR,
  invoiceAiCanProceed,
  invoiceAiHasRecognitions,
} from './invoice-ai-wait.mjs';

test('does not proceed while the cat loader is up', () => {
  assert.equal(
    invoiceAiCanProceed({ loading: true, state: 'idle', sawLoader: true, elapsedMs: 5000 }),
    false,
  );
});

test('proceeds when status is ready even if loader was never seen', () => {
  assert.equal(
    invoiceAiCanProceed({ loading: false, state: 'ready', sawLoader: false, elapsedMs: 100 }),
    true,
  );
});

test('waits a grace period when AI has not started', () => {
  assert.equal(
    invoiceAiCanProceed({ loading: false, state: 'idle', sawLoader: false, elapsedMs: 0 }),
    false,
  );
  assert.equal(
    invoiceAiCanProceed({ loading: false, state: 'idle', sawLoader: false, elapsedMs: 15000 }),
    true,
  );
});

test('proceeds after the loader was seen and then removed', () => {
  assert.equal(
    invoiceAiCanProceed({ loading: false, state: 'idle', sawLoader: true, elapsedMs: 200 }),
    true,
  );
});

test('Paso 7 loader CSS targets the cat overlay, not graph-loader', () => {
  assert.match(INVOICE_AI_LOADER_SELECTOR, /data-testid="invoice-ai-loader"/);
  assert.match(INVOICE_AI_LOADER_SELECTOR, /paso7__ai-loader/);
  assert.match(INVOICE_AI_LOADER_SELECTOR, /app-paso7-factura app-ai-cat-loader/);
  assert.doesNotMatch(INVOICE_AI_LOADER_SELECTOR, /app-graph-loader/);
});

test('recognitions are ready only when status is ready and chips exist', () => {
  assert.equal(invoiceAiHasRecognitions({ state: 'ready', chipCount: 0 }), false);
  assert.equal(invoiceAiHasRecognitions({ state: 'loading', chipCount: 3 }), false);
  assert.equal(invoiceAiHasRecognitions({ state: 'ready', chipCount: 3 }), true);
});
