import assert from 'node:assert/strict';
import test from 'node:test';
import { describeValidationFailure, masivaValidationUserInputMessage } from './validation-failure.mjs';

test('turns a blocked validation with a difference into a terminal failure message', () => {
  const result = describeValidationFailure({ enabled: false, status: 'Requiere revisión' });

  assert.equal(result.failed, true);
  assert.match(result.message, /Paso Validación bloqueado/);
  assert.match(result.message, /Requiere revisión/);
});

test('classifies duplicate detection as non-retryable', () => {
  const result = describeValidationFailure({
    enabled: false,
    status: 'Requiere revisión',
    details: 'Se detectaron 1 pasada(s) duplicada(s).',
  });

  assert.equal(result.failed, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.retryable, false);
  assert.equal(result.status, 'DUPLICATED');
  assert.match(result.message, /duplicada/);
});

test('does not fail when validation can continue', () => {
  assert.deepEqual(describeValidationFailure({ enabled: true, status: 'OK' }), { failed: false, message: '' });
});

test('masiva duplicates park as USER_INPUT instead of closing the tab', () => {
  const message = masivaValidationUserInputMessage({
    enabled: false,
    status: 'Requiere revisión',
    details: 'Se detectaron 699 pasada(s) duplicada(s).',
  });
  assert.match(message, /duplicada/);
  assert.match(message, /Subir igualmente/);
  assert.match(message, /Continuar/);
});
