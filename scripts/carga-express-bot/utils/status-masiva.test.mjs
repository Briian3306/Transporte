import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { STATUS } from './status-csv.mjs';
import {
  describeMasivaAllowlistIdle,
  isMasivaRetryableStatus,
  isPendingMasivaRecord,
  loadOrCreateMasivaCsv,
  masivaRowKey,
  syncMasivaPeriods,
} from './status-masiva.mjs';

test('blank FAILED USER_INPUT can start a tab; leftover folders outside allowlist cannot', () => {
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: '' }), true);
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: STATUS.FAILED }), true);
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: STATUS.USER_INPUT }), true);
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: STATUS.COMPLETE }), false);
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: STATUS.DUPLICATED }), false);
  assert.equal(isMasivaRetryableStatus({ uploadFileStatus: 'IN_PROGRESS' }), true);

  const allowed = ['202601-2', '202603-2'];
  assert.equal(
    isPendingMasivaRecord({ folder: '202602-1', uploadFileStatus: '' }, { allowedFolders: allowed }),
    false,
  );
  assert.equal(
    isPendingMasivaRecord({ folder: '202601-2', uploadFileStatus: STATUS.USER_INPUT }, { allowedFolders: allowed }),
    true,
  );
  assert.equal(
    isPendingMasivaRecord(
      { folder: '202601-2', uploadFileStatus: STATUS.USER_INPUT },
      { allowedFolders: allowed, parkedKeys: ['202601-2'] },
    ),
    false,
  );
});

test('stale IN_PROGRESS on the allowlist is pending; COMPLETE is not', () => {
  const allowed = ['202608-1'];
  assert.equal(
    isPendingMasivaRecord({ folder: '202608-1', uploadFileStatus: 'IN_PROGRESS' }, { allowedFolders: allowed }),
    true,
  );
  assert.equal(
    isPendingMasivaRecord({ folder: '202608-1', uploadFileStatus: STATUS.COMPLETE }, { allowedFolders: allowed }),
    false,
  );
  assert.match(
    describeMasivaAllowlistIdle(
      [{ folder: '202608-1', uploadFileStatus: STATUS.COMPLETE }],
      allowed,
    ),
    /202608-1=COMPLETE \(omitida\)/,
  );
});

test('creates status-masiva.csv and syncs listed periods', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-masiva-'));
  const filePath = path.join(dir, 'status-masiva.csv');
  const xlsx = path.join(dir, 'Consumo_202601-2_MAPPED.xlsx');
  fs.writeFileSync(xlsx, 'xlsx');
  const store = loadOrCreateMasivaCsv(filePath);
  syncMasivaPeriods(store, [
    { folder: '202601-2', ok: true, xlsx, pdfs: ['a.pdf', 'b.pdf'] },
  ]);
  assert.equal(store.records.length, 1);
  assert.equal(masivaRowKey(store.records[0]), '202601-2');
  assert.equal(store.records[0].pdfCount, '2');
  assert.match(fs.readFileSync(filePath, 'utf8'), /202601-2/);
});
