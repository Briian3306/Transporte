import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildStatusRecords, STATUS_CSV_HEADERS, stringifyStatusCsv, writeStatusCsv } from './build-status-csv.mjs';

const TELEPASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TELEPASE_DIR, '..', '..');

test('maps Telepase rows to carga-express status columns and discovers local files', () => {
  const downloadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'status-csv-dl-'));
  const ausaDir = path.join(downloadsRoot, 'AUSA');
  fs.mkdirSync(ausaDir);
  fs.writeFileSync(path.join(ausaDir, 'facturas_2026-08-31_5009A02090191.pdf'), 'pdf');
  fs.writeFileSync(path.join(ausaDir, 'pasadas_2026-08-31_5009A02090191.csv'), 'csv');

  const records = buildStatusRecords(
    [
      {
        rowId: '2026-08-31',
        periodo: '2026-08-31',
        fechaEmision: '2026-08-31',
        fechaVencimiento: '2026-09-14',
        concesionario: 'AUSA',
        concesionarioVisible: 'AUTOPISTAS URBANAS',
        numero: '5009A02090191',
        monto: '$1.915.017,09',
        facturaUrl: 'https://telepase.com.ar/admin/descargar-factura/5009A02090191/DR/AUSA-20260831-5009A02090191',
        pasadaUrl: 'https://telepase.com.ar/admin/descargar-pasadas/0000438233/5009A02090191',
        fileFacturaPath: null,
        filePasadasPath: null,
        estado: 'PAGADO',
        hasDownloads: true,
      },
      {
        rowId: '2026-08-16',
        periodo: '2026-08-16',
        concesionario: 'AUMESA',
        concesionarioVisible: 'AU. DEL MERCOSUR',
        numero: '111312',
        monto: '$1.722.448,62',
        estado: 'PAGAR',
      },
    ],
    { downloadsRoot, repoRoot: REPO_ROOT },
  );

  assert.equal(records[0].Empresa, 'AUSA');
  assert.equal(records[0].Template, 'AUSA-V3');
  assert.equal(records[0].fileFacturaPath, path.relative(REPO_ROOT, path.join(ausaDir, 'facturas_2026-08-31_5009A02090191.pdf')).split(path.sep).join('/'));
  assert.equal(records[0].filePasadasPath, path.relative(REPO_ROOT, path.join(ausaDir, 'pasadas_2026-08-31_5009A02090191.csv')).split(path.sep).join('/'));
  assert.equal(records[0].hasDownloads, 'VERDADERO');
  assert.equal(records[0].uploadFileStatus, '');

  assert.equal(records[1].Empresa, 'AUTOVIA DEL MERCOSUR');
  assert.equal(records[1].Template, '');
  assert.equal(records[1].hasDownloads, 'FALSO');
});

test('keeps previous Template and upload status when regenerating', () => {
  const records = buildStatusRecords(
    [
      {
        periodo: '2026-08-16',
        concesionario: 'AUMESA',
        numero: '111312',
        monto: '$1',
      },
    ],
    {
      previousRecords: [
        {
          periodo: '2026-08-16',
          concesionario: 'AUMESA',
          numero: '111312',
          Template: 'MERCA-SUR-001-ZARATE',
          uploadFileStatus: 'COMPLETE',
          messageStatus: '',
        },
      ],
    },
  );

  assert.equal(records[0].Template, 'MERCA-SUR-001-ZARATE');
  assert.equal(records[0].uploadFileStatus, 'COMPLETE');
});

test('writes RFC 4180 CSV with the bot header', () => {
  const csv = stringifyStatusCsv([
    {
      numero: '429984',
      Empresa: 'AUTOPISTA DEL OESTE (ACCESO OESTE)',
      Template: 'AU-OESTE-V1-08-26',
      monto: '$2.134.197,85',
      concesionario: 'GCO',
    },
  ]);

  assert.equal(csv.split('\r\n')[0], STATUS_CSV_HEADERS.join(','));
  assert.match(csv, /"\$2\.134\.197,85"/);
});

test('creates the output file even when the downloads folder is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-csv-out-'));
  const filePath = path.join(dir, 'nested', 'status.csv');
  writeStatusCsv(filePath, [{ numero: '1', concesionario: 'AUSA', Empresa: 'AUSA' }]);
  assert.equal(fs.existsSync(filePath), true);
});
