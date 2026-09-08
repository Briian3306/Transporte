import assert from 'node:assert/strict';
import { csvEscape, rowToCsv } from './json-pages-to-csv.mjs';

assert.equal(csvEscape(null), '');
assert.equal(csvEscape(true), 'true');
assert.equal(csvEscape('a,b'), '"a,b"');
assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
assert.equal(rowToCsv({ id: '1', categoria: null }, ['id', 'categoria']), '1,');

console.log('json-pages-to-csv.test.mjs ok');
