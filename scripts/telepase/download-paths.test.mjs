import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloadPath,
  matchDownloadedFile,
  updateRowsWithDownloadPath,
} from './download-paths.mjs';

test('builds repository-relative paths for factura and pasada files', () => {
  assert.equal(
    buildDownloadPath('AUSA', 'facturas', '2026-06-23', '5009A02010049', '.pdf'),
    'scripts/downloads/AUSA/facturas_2026-06-23_5009A02010049.pdf'
  );
  assert.equal(
    buildDownloadPath('SANTAFE', 'pasadas', '2025-08-22', '915663', '.csv'),
    'scripts/downloads/SANTAFE/pasadas_2025-08-22_915663.csv'
  );
});

test('matches an existing download by prefix regardless of extension', () => {
  const files = ['facturas_2026-06-23_5009A02010049.pdf', 'pasadas_2026-06-23_5009A02010049.csv'];
  assert.equal(
    matchDownloadedFile('AUSA', 'facturas', '2026-06-23', '5009A02010049', files),
    'scripts/downloads/AUSA/facturas_2026-06-23_5009A02010049.pdf'
  );
});

test('adds fileFacturaPath and filePasadasPath without removing row metadata', () => {
  const row = { rowId: 'r1', periodo: '2026-06-23', numero: '123', concesionario: 'AUSA' };
  const result = updateRowsWithDownloadPath([row], {
    rowId: 'r1',
    kind: 'facturas',
    path: 'scripts/downloads/AUSA/facturas_2026-06-23_123.pdf',
  });

  assert.equal(result[0].rowId, 'r1');
  assert.equal(result[0].fileFacturaPath, 'scripts/downloads/AUSA/facturas_2026-06-23_123.pdf');
  assert.equal(result[0].filePasadasPath, null);
});
