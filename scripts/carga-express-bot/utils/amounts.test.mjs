import assert from 'node:assert/strict';
import test from 'node:test';
import { amountsClose, formatDateInput, parseAmount } from './amounts.mjs';

test('parses AR currency with thousands and cents', () => {
  assert.equal(parseAmount('$4.386.978,42'), 4386978.42);
  assert.equal(parseAmount('560832.27'), 560832.27);
  assert.equal(parseAmount('1.234'), 1234);
});

test('compares amounts with cents tolerance', () => {
  assert.equal(amountsClose(4386978.42, 4386978.42), true);
  assert.equal(amountsClose(10, 10.01), true);
  assert.equal(amountsClose(10, 11), false);
});

test('normalizes dates to dd/mm/aaaa', () => {
  assert.equal(formatDateInput('23/06/2026'), '23/06/2026');
  assert.equal(formatDateInput('2026-06-23'), '23/06/2026');
  assert.equal(formatDateInput('1/6/2026'), '01/06/2026');
});
