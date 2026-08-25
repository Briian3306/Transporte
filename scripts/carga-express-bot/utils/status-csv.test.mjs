import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadStatusCsv, STATUS, updateRecordStatus } from './status-csv.mjs';

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
  assert.match(saved, /Login: formulario inválido/);
  assert.equal(store.records[0].uploadFileStatus, STATUS.FAILED);
});
