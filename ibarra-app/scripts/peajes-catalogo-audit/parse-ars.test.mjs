import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArs, formatArs, splitEstaciones, foldName } from './parse-ars.mjs';

test('parseArs reads Argentine $1.192,99 as 1192.99', () => {
  assert.equal(parseArs('$497,08'), 497.08);
  assert.equal(parseArs('$994,15'), 994.15);
  assert.equal(parseArs('$1.192,99'), 1192.99);
  assert.equal(parseArs('$11.975,15'), 11975.15);
  assert.equal(parseArs(''), null);
});

test('formatArs writes Argentine $1.192,99', () => {
  assert.equal(formatArs(497.08), '$497,08');
  assert.equal(formatArs(1192.99), '$1.192,99');
  assert.equal(formatArs(11975.15), '$11.975,15');
  assert.equal(formatArs(null), '');
});

test('splitEstaciones expands groups and ALL', () => {
  assert.deepEqual(
    splitEstaciones('DOCKSUD, GUITIERREZ, HUDSON'),
    ['DOCKSUD', 'GUITIERREZ', 'HUDSON'],
  );
  assert.deepEqual(
    splitEstaciones('RICCHERI , JORGE NEWBERY , EZEIZA-CAÑUELAS'),
    ['RICCHERI', 'JORGE NEWBERY', 'EZEIZA-CAÑUELAS'],
  );
  assert.deepEqual(splitEstaciones('ALL'), ['ALL']);
  assert.deepEqual(splitEstaciones('HUDSON'), ['HUDSON']);
});

test('foldName strips accents and punctuation', () => {
  assert.equal(foldName('GUTIÉRREZ'), 'GUTIERREZ');
  assert.equal(foldName('MAIPÚ'), 'MAIPU');
  assert.equal(foldName('DOCK SUD'), 'DOCK SUD');
});
