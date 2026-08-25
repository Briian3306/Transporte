import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaleError, pickOptionIndex } from './search-select.mjs';

test('picks exact label ignoring case and extra text', () => {
  const labels = ['AUSA-8-2026 · activa', 'AUSA-V2 · activa', 'AUSA-V3 · activa'];
  assert.equal(pickOptionIndex(labels, 'AUSA-V3'), 2);
});

test('picks first option when nothing matches', () => {
  assert.equal(pickOptionIndex(['AUSA'], 'OTRO'), 0);
});

test('detects selenium stale element errors', () => {
  assert.equal(isStaleError(new Error('stale element reference: stale element not found in the current frame')), true);
  assert.equal(isStaleError(new Error('Waiting for element')), false);
});
