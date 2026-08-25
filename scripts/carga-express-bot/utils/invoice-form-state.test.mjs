import assert from 'node:assert/strict';
import test from 'node:test';
import { describeInvoiceFormFailure } from './invoice-form-state.mjs';

test('describes an invalid subtotal field as a retryable Paso 7 failure', () => {
  const result = describeInvoiceFormFailure({
    missing: [],
    errors: ['Subtotal debe ser un importe válido'],
    invalidControls: ['importe_sin_iva'],
  });

  assert.equal(result.invalid, true);
  assert.match(result.message, /Subtotal/);
});

test('describes missing required fields', () => {
  const result = describeInvoiceFormFailure({
    missing: ['Número de factura', 'Total'],
    errors: [],
    invalidControls: [],
  });

  assert.equal(result.invalid, true);
  assert.match(result.message, /Número de factura/);
  assert.match(result.message, /Total/);
});

test('returns a valid state when the form has no errors', () => {
  assert.deepEqual(
    describeInvoiceFormFailure({ missing: [], errors: [], invalidControls: [] }),
    { invalid: false, message: '' },
  );
});
