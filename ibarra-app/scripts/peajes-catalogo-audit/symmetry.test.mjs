import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPicoNoPicoSameCategories } from './symmetry.mjs';

test('has_pico fails when NO_PICO has a category that PICO does not', () => {
  const result = assertPicoNoPicoSameCategories({
    cluster: 'has_pico',
    peaje_nombre: 'AUSA',
    estacion_nombre: 'ALBERTI',
    picoCats: [1, 2, 3, 4, 5, 8, 9],
    noPicoCats: [1, 2, 3, 4, 5, 7, 8, 9],
  });
  assert.equal(result.ok, false);
  assert.equal(result.pico, '1,2,3,4,5,8,9');
  assert.equal(result.no_pico, '1,2,3,4,5,7,8,9');
  assert.equal(result.estacion_nombre, 'ALBERTI');
});

test('has_pico fails when PICO has a category that NO_PICO does not', () => {
  const result = assertPicoNoPicoSameCategories({
    cluster: 'has_pico',
    peaje_nombre: 'AUSA',
    estacion_nombre: 'ALBERTI',
    picoCats: [2],
    noPicoCats: [],
  });
  assert.equal(result.ok, false);
});

test('has_pico passes when PICO and NO_PICO categories are the same set', () => {
  const result = assertPicoNoPicoSameCategories({
    cluster: 'has_pico',
    peaje_nombre: 'AUBASA',
    estacion_nombre: 'HUDSON',
    picoCats: [7, 2, 6, 2],
    noPicoCats: [6, 7, 2],
  });
  assert.equal(result.ok, true);
  assert.equal(result.pico, '2,6,7');
  assert.equal(result.no_pico, '2,6,7');
});

test('flat station is not required to have matching PICO categories', () => {
  const result = assertPicoNoPicoSameCategories({
    cluster: 'flat',
    peaje_nombre: 'AUBASA',
    estacion_nombre: 'MAIPU',
    picoCats: [],
    noPicoCats: [2, 3, 5, 6],
  });
  assert.equal(result.ok, true);
});
