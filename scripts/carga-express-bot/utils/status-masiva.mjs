import fs from 'node:fs';
import path from 'node:path';
import {
  compactStatusMessage,
  loadStatusCsv,
  REPO_ROOT,
  saveStatusCsv,
  STATUS,
  stringifyCsv,
  updateRecordStatus,
} from './status-csv.mjs';
import { toRepoRelative } from './period-folders.mjs';

export const MASIVA_HEADERS = ['folder', 'xlsx', 'pdfCount', 'uploadFileStatus', 'messageStatus'];
export const DEFAULT_MASIVA_STATUS_CSV = path.resolve(REPO_ROOT, 'scripts', 'telepeaje plus', 'status-masiva.csv');

export { STATUS, compactStatusMessage, updateRecordStatus };

/** New tabs: blank / FAILED / PENDING / USER_INPUT / stale IN_PROGRESS. */
export function isMasivaRetryableStatus(record) {
  const status = String(record.uploadFileStatus ?? '').trim().toUpperCase();
  return (
    status === '' ||
    status === STATUS.FAILED ||
    status === STATUS.USER_INPUT ||
    status === 'PENDING' ||
    status === 'IN_PROGRESS'
  );
}

export function describeMasivaAllowlistIdle(records = [], allowedFolders = []) {
  const listed = records.filter((record) => allowedFolders.includes(masivaRowKey(record)));
  if (!listed.length) {
    return `Nada que procesar: MASIVA_FOLDERS no coincide con ninguna fila del CSV (${allowedFolders.join(', ') || 'vacío'}).`;
  }
  const parts = listed.map((record) => {
    const status = String(record.uploadFileStatus ?? '').trim() || '(vacío)';
    const pending = isPendingMasivaRecord(record, { allowedFolders });
    return `${masivaRowKey(record)}=${status}${pending ? '' : ' (omitida)'}`;
  });
  return `Nada pendiente en la allowlist: ${parts.join(', ')}.`;
}

/** Only folders in MASIVA_FOLDERS run. Leftover CSV rows (e.g. 202602-1) are ignored. */
export function isPendingMasivaRecord(
  record,
  { allowedFolders = [], parkedKeys = [], skippedKeys = [], folderFilter = null } = {},
) {
  const key = masivaRowKey(record);
  if (!key) return false;
  if (allowedFolders.length && !allowedFolders.includes(key)) return false;
  if (folderFilter && key !== String(folderFilter)) return false;
  if (parkedKeys.includes(key) || skippedKeys.includes(key)) return false;
  return isMasivaRetryableStatus(record);
}

export function masivaRowKey(record) {
  return String(record.folder ?? '').trim();
}

export function loadOrCreateMasivaCsv(filePath = DEFAULT_MASIVA_STATUS_CSV) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, stringifyCsv([MASIVA_HEADERS]), 'utf8');
  }
  const store = loadStatusCsv(filePath);
  for (const header of MASIVA_HEADERS) {
    if (!store.headers.includes(header)) store.headers.push(header);
  }
  return store;
}

export function syncMasivaPeriods(store, periods) {
  for (const period of periods) {
    let record = store.records.find((item) => masivaRowKey(item) === period.folder);
    if (!record) {
      record = { _index: store.records.length };
      for (const header of store.headers) record[header] = '';
      record.folder = period.folder;
      store.records.push(record);
    }
    if (period.ok) {
      record.xlsx = toRepoRelative(period.xlsx);
      record.pdfCount = String(period.pdfs.length);
      record._xlsxAbs = period.xlsx;
      record._pdfs = period.pdfs;
    } else {
      record._skipReason = period.reason;
    }
  }
  saveStatusCsv(store);
  return store;
}

export function markMasivaLoginFailure(store, message) {
  const record = store.records.find((item) => isMasivaRetryableStatus(item)) ?? store.records[0] ?? null;
  if (!record) {
    console.error(`Login falló y no hay carpetas en status-masiva.csv: ${message}`);
    return null;
  }
  return updateRecordStatus(store, record, STATUS.FAILED, `Login: ${message}`);
}
