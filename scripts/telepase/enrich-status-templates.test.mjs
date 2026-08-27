import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTemplate } from './enrich-status-templates.mjs';

test('detects the Caminos de las Sierras template from its invoice text', () => {
  const result = detectTemplate('CAMINOS DE LAS SIERRAS S.A. Fecha: 31/05/2026');

  assert.deepEqual(result, {
    status: 'matched',
    template: 'SOY-CORDOBES',
    matchedAliases: ['CAMINOS DE LAS SIERRAS'],
  });
});
