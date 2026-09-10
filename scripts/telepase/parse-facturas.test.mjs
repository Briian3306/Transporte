import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeDownloadedAt } from './parse-facturas.mjs';

test('mergeDownloadedAt keeps previous stamps by numero, periodo and concesionario', () => {
  const nextRows = [
    { numero: '24', periodo: '2026-09-08', concesionario: 'GCO', fileFacturaPath: null },
    { numero: '429984', periodo: '2026-08-16', concesionario: 'GCO', fileFacturaPath: null },
  ];
  const previousRows = [
    { numero: '24', periodo: '2026-09-08', concesionario: 'GCO', downloadedAt: '2026-09-10 10:46:32' },
  ];

  const merged = mergeDownloadedAt(nextRows, previousRows);
  assert.equal(merged[0].downloadedAt, '2026-09-10 10:46:32');
  assert.equal(merged[0].fileFacturaPath, null);
  assert.equal(merged[1].downloadedAt, undefined);
});
