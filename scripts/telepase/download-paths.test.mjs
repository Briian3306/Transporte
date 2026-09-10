import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDownloadPath,
  filterRowsByPeriodMonth,
  formatLocalDateTime,
  matchDownloadedFile,
  persistRowsJson,
  updateRowsWithDownloadPath,
  writeRowsJson,
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

test('writeRowsJson writes atomically and leaves no temp files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rows-json-'));
  const filePath = path.join(dir, 'rows.json');
  writeRowsJson(
    [{ rowId: 'r1', numero: '123', periodo: '2026-06-23' }],
    filePath,
  );

  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(written[0].numero, '123');
  assert.equal(written[0].fileFacturaPath, null);
  assert.equal(written[0].filePasadasPath, null);
  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('writeRowsJson retries UNKNOWN lock errors then succeeds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rows-json-retry-'));
  const filePath = path.join(dir, 'rows.json');
  let attempts = 0;
  const lockError = () => {
    const error = new Error('UNKNOWN: unknown error, open');
    error.code = 'UNKNOWN';
    error.errno = -4094;
    return error;
  };
  const fakeFs = {
    writeFileSync: (target, content, encoding) => fs.writeFileSync(target, content, encoding),
    renameSync: (from, to) => {
      attempts += 1;
      if (attempts < 3) throw lockError();
      fs.renameSync(from, to);
    },
    copyFileSync: () => {
      throw lockError();
    },
    unlinkSync: (target) => {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    },
  };

  writeRowsJson([{ numero: '24', periodo: '2026-09-08' }], filePath, {
    fs: fakeFs,
    sleep: () => {},
  });

  assert.equal(attempts, 3);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8'))[0].numero, '24');
});

test('updateRowsWithDownloadPath stamps downloadedAt only when provided', () => {
  const row = { rowId: 'r1', periodo: '2026-09-08', numero: '24', concesionario: 'GCO' };
  const withoutStamp = updateRowsWithDownloadPath([row], {
    rowId: 'r1',
    kind: 'pasadas',
    path: 'scripts/downloads/GCO/pasadas_2026-09-08_24.csv',
  });
  assert.equal(withoutStamp[0].downloadedAt, undefined);

  const withStamp = updateRowsWithDownloadPath(withoutStamp, {
    rowId: 'r1',
    kind: 'facturas',
    path: 'scripts/downloads/GCO/facturas_2026-09-08_24.pdf',
    downloadedAt: '2026-09-10 10:46:32',
  });
  assert.equal(withStamp[0].downloadedAt, '2026-09-10 10:46:32');
  assert.equal(withStamp[0].fileFacturaPath, 'scripts/downloads/GCO/facturas_2026-09-08_24.pdf');
});

test('persistRowsJson returns false instead of throwing when the lock persists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rows-json-persist-'));
  const filePath = path.join(dir, 'rows.json');
  const lockError = () => {
    const error = new Error('UNKNOWN: unknown error, open');
    error.code = 'UNKNOWN';
    throw error;
  };
  const fakeFs = {
    writeFileSync: () => {
      throw lockError();
    },
    renameSync: () => {
      throw lockError();
    },
    copyFileSync: () => {
      throw lockError();
    },
    unlinkSync: () => {},
  };

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const ok = persistRowsJson([{ numero: '1' }], filePath, {
      fs: fakeFs,
      sleep: () => {},
      retries: 2,
    });
    assert.equal(ok, false);
  } finally {
    console.warn = originalWarn;
  }
});

test('formatLocalDateTime uses YYYY-MM-DD HH:mm:ss', () => {
  assert.equal(formatLocalDateTime(new Date(2026, 8, 10, 10, 46, 32)), '2026-09-10 10:46:32');
});

test('filterRowsByPeriodMonth keeps rows whose periodo month is in range', () => {
  const rows = [
    { numero: '1', periodo: '2026-02-28', concesionario: 'AUMESA' },
    { numero: '2', periodo: '2026-03-31', concesionario: 'AUMESA' },
    { numero: '3', periodo: '2026-04-20', concesionario: 'AUMESA' },
    { numero: '4', periodo: '2026-07-16', concesionario: 'AUMESA' },
  ];
  const filtered = filterRowsByPeriodMonth(rows, { monthInit: 3, monthFinish: 4 });
  assert.deepEqual(
    filtered.map((row) => row.numero),
    ['2', '3'],
  );
});

test('filterRowsByPeriodMonth treats a single bound as that month only', () => {
  const rows = [
    { numero: 'feb', periodo: '2026-02-28' },
    { numero: 'mar', periodo: '2026-03-31' },
  ];
  assert.deepEqual(
    filterRowsByPeriodMonth(rows, { monthInit: 3 }).map((row) => row.numero),
    ['mar'],
  );
  assert.deepEqual(
    filterRowsByPeriodMonth(rows, { monthFinish: 2 }).map((row) => row.numero),
    ['feb'],
  );
});

test('filterRowsByPeriodMonth returns all rows when no month bounds are set', () => {
  const rows = [{ numero: '1', periodo: '2026-02-28' }];
  assert.equal(filterRowsByPeriodMonth(rows, {}).length, 1);
});
