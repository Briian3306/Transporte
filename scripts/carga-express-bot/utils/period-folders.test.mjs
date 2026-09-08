import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  parseMasivaFolders,
  requireMasivaFolders,
  resolveListedPeriods,
  resolvePeriodFolder,
} from './period-folders.mjs';

test('parses comma, semicolon, newline and ignores comments', () => {
  assert.deepEqual(parseMasivaFolders('202601-2, 202602-1'), ['202601-2', '202602-1']);
  assert.deepEqual(parseMasivaFolders('202601-2;202602-1\n202603-1'), ['202601-2', '202602-1', '202603-1']);
  assert.deepEqual(parseMasivaFolders('# skip\n202601-2'), ['202601-2']);
  assert.deepEqual(parseMasivaFolders('  '), []);
});

test('requireMasivaFolders throws when empty', () => {
  assert.throws(() => requireMasivaFolders(''), /MASIVA_FOLDERS/);
});

test('resolves only listed folders with MAPPED xlsx and Comprobantes PDFs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'masiva-folders-'));
  const ready = path.join(root, '202601-2');
  fs.mkdirSync(path.join(ready, 'Comprobantes'), { recursive: true });
  fs.writeFileSync(path.join(ready, 'Consumo_202601-2_MAPPED.xlsx'), 'xlsx');
  fs.writeFileSync(path.join(ready, 'Comprobantes', '0104-1.pdf'), 'pdf');

  const noPdf = path.join(root, '202607-2');
  fs.mkdirSync(noPdf, { recursive: true });
  fs.writeFileSync(path.join(noPdf, 'Consumo_202607-2_MAPPED.xlsx'), 'xlsx');

  const missing = resolvePeriodFolder('nope', { root });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /No existe/);

  const listed = resolveListedPeriods(['202601-2', '202607-2', '202601-1'], { root });
  assert.equal(listed[0].ok, true);
  assert.equal(listed[0].pdfs.length, 1);
  assert.equal(listed[1].ok, false);
  assert.match(listed[1].reason, /Sin PDFs/);
  assert.equal(listed[2].ok, false);
});
