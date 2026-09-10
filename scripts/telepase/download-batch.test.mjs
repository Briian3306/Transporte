import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from './download-batch.mjs';

test('parseArgs reads month-init and month-finish inclusive range', () => {
  const args = parseArgs(['--month-init', '3', '--month-finish', '4']);
  assert.equal(args.monthInit, 3);
  assert.equal(args.monthFinish, 4);
});

test('parseArgs accepts underscored and typo aliases from the CLI', () => {
  const args = parseArgs(['--month_init', '3', '--mont_finish', '4']);
  assert.equal(args.monthInit, 3);
  assert.equal(args.monthFinish, 4);
});

test('parseArgs rejects a month outside 1-12', () => {
  assert.throws(() => parseArgs(['--month-init', '13']), /month-init must be 1-12/);
});
