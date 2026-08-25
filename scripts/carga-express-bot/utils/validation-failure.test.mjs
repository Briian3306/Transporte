import assert from 'node:assert/strict';
import test from 'node:test';
import { describeValidationFailure } from './validation-failure.mjs';

test('turns a blocked validation with a difference into a terminal failure message', () => {
  const result = describeValidationFailure({ enabled: false, status: 'Requiere revisión' });

  assert.equal(result.failed, true);
  assert.match(result.message, /Paso Validación bloqueado/);
  assert.match(result.message, /Requiere revisión/);
});

test('does not fail when validation can continue', () => {
  assert.deepEqual(describeValidationFailure({ enabled: true, status: 'OK' }), { failed: false, message: '' });
});
