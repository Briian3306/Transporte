import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceAiCanProceed } from './invoice-ai-wait.mjs';

test('does not proceed while the graph loader is up', () => {
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
