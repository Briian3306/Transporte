import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isRetryableStatus, loadStatusCsv, normalizeStatusMessages, STATUS, updateRecordStatus } from './status-csv.mjs';

test('only FAILED and USER_INPUT rows are retryable', () => {
  assert.equal(isRetryableStatus({ uploadFileStatus: STATUS.FAILED }), true);
  assert.equal(
    isRetryableStatus({ uploadFileStatus: STATUS.DUPLICATED, messageStatus: 'Se detectaron 1 pasada(s) duplicada(s).' }),
    false,
  );
  assert.equal(isRetryableStatus({ uploadFileStatus: STATUS.USER_INPUT }), true);
  assert.equal(isRetryableStatus({ uploadFileStatus: STATUS.COMPLETE }), false);
  assert.equal(isRetryableStatus({ uploadFileStatus: 'IN_PROGRESS' }), false);
  assert.equal(isRetryableStatus({ uploadFileStatus: '' }), false);
});

test('writes uploadFileStatus and messageStatus back to the csv', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carga-express-bot-'));
  const filePath = path.join(dir, 'status.csv');
  fs.writeFileSync(
    filePath,
    'numero,Empresa,uploadFileStatus,messageStatus\r\n5009A02010049,AUSA,,\r\n',
    'utf8',
  );

  const store = loadStatusCsv(filePath);
  updateRecordStatus(store, store.records[0], STATUS.FAILED, 'Login: formulario inválido');

  const saved = fs.readFileSync(filePath, 'utf8');
  assert.match(saved, /FAILED/);
  assert.match(saved, /Error/);
  assert.equal(store.records[0].uploadFileStatus, STATUS.FAILED);
});

test('stores a compact one-line duplicate message instead of diagnostic text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carga-express-bot-'));
  const filePath = path.join(dir, 'status.csv');
  fs.writeFileSync(filePath, 'numero,uploadFileStatus,messageStatus\r\n1,FAILED,\r\n', 'utf8');

  const store = loadStatusCsv(filePath);
  updateRecordStatus(
    store,
    store.records[0],
    STATUS.DUPLICATED,
    'Se detectaron 1 pasada(s) duplicada(s). Detalles técnicos: una explicación muy larga\ncon varias líneas.',
  );

  assert.equal(store.records[0].messageStatus, 'Duplicado: 1 pasada(s)');
  assert.doesNotMatch(fs.readFileSync(filePath, 'utf8'), /Detalles técnicos/);
});

test('normalizes existing messages without changing row data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carga-express-bot-'));
  const filePath = path.join(dir, 'status.csv');
  fs.writeFileSync(
    filePath,
    'numero,Empresa,uploadFileStatus,messageStatus\r\n1,AUSA,COMPLETE,full screen text\r\n2,AUSA,USER_INPUT,long manual message\r\n3,AUSA,DUPLICATED,Se detectaron 4 pasada(s) duplicada(s).\r\n',
    'utf8',
  );

  const store = loadStatusCsv(filePath);
  assert.equal(normalizeStatusMessages(store), true);
  assert.deepEqual(
    store.records.map((record) => [record.numero, record.Empresa, record.uploadFileStatus, record.messageStatus]),
    [
      ['1', 'AUSA', 'COMPLETE', ''],
      ['2', 'AUSA', 'USER_INPUT', 'Requiere revisión'],
      ['3', 'AUSA', 'DUPLICATED', 'Duplicado: 4 pasada(s)'],
    ],
  );
});
