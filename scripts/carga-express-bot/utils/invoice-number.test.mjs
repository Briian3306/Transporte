import assert from 'node:assert/strict';
import test from 'node:test';
import { pickInvoiceNumber, stripInvoiceTypeLetters } from './invoice-number.mjs';

test('strips invoice type letters A/B/C', () => {
  assert.equal(stripInvoiceTypeLetters('A 00050-04923389'), '00050-04923389');
  assert.equal(stripInvoiceTypeLetters('B-0840-0557074'), '0840-0557074');
  assert.equal(stripInvoiceTypeLetters('00050-04923389'), '00050-04923389');
});

test('prefers hyphenated match over incomplete CSV numero', () => {
  const picked = pickInvoiceNumber(
    [
      { value: 'A 00050-04923389', confidence: 0.7 },
      { value: '4923389', confidence: 0.9 },
    ],
    '04923389',
  );
  assert.equal(picked, '00050-04923389');
});

test('falls back to highest-confidence hyphenated suggestion', () => {
  const picked = pickInvoiceNumber(
    [
      { value: 'C 00011-00000001', confidence: 0.4 },
      { value: '00022-00000002', confidence: 0.8 },
    ],
    '5009A02010049',
  );
  assert.equal(picked, '00022-00000002');
});
