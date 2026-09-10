import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOADS_DIR, ROWS_JSON_PATH, TELEPASE_DIR } from './paths.mjs';

function sanitizeSegment(value) {
  return String(value || 'UNKNOWN').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'UNKNOWN';
}

export function downloadPrefix(kind, periodo, numero) {
  return `${kind}_${periodo}_${numero}`;
}

export function buildDownloadPath(concesionario, kind, periodo, numero, extension = '') {
  const fileName = `${downloadPrefix(kind, periodo, numero)}${extension}`;
  return ['scripts', 'downloads', sanitizeSegment(concesionario), fileName].join('/');
}

export function matchDownloadedFile(concesionario, kind, periodo, numero, files) {
  const folder = path.join(DOWNLOADS_DIR, sanitizeSegment(concesionario));
  const candidates = files || (fs.existsSync(folder) ? fs.readdirSync(folder) : []);
  const prefix = `${downloadPrefix(kind, periodo, numero)}.`;
  const fileName = candidates.find((candidate) => candidate.startsWith(prefix));
  return fileName ? buildDownloadPath(concesionario, kind, periodo, numero, path.extname(fileName)) : null;
}

export function formatLocalDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function updateRowsWithDownloadPath(rows, { rowId, kind, path: filePath, periodo, numero, downloadedAt }) {
  return rows.map((row) => {
    const sameRow =
      (rowId && (row.rowId === rowId || `${row.rowId}|${row.numero}` === rowId)) ||
      (periodo && numero && row.periodo === periodo && row.numero === numero);
    if (!sameRow) return row;

    return {
      ...row,
      fileFacturaPath: row.fileFacturaPath ?? null,
      filePasadasPath: row.filePasadasPath ?? null,
      ...(kind === 'facturas' ? { fileFacturaPath: filePath } : {}),
      ...(kind === 'pasadas' ? { filePasadasPath: filePath } : {}),
      ...(downloadedAt ? { downloadedAt } : {}),
    };
  });
}

export function ensureDownloadPathFields(rows) {
  return rows.map((row) => ({
    ...row,
    fileFacturaPath: row.fileFacturaPath ?? null,
    filePasadasPath: row.filePasadasPath ?? null,
  }));
}

function isRetryableWriteError(error) {
  const code = String(error?.code || '');
  return code === 'UNKNOWN' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

function sleepSync(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* busy wait for short lock retries */
  }
}

function replaceFileAtomically(filePath, content, options = {}) {
  const fsImpl = options.fs || fs;
  const retries = options.retries ?? 5;
  const sleep = options.sleep || sleepSync;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${attempt}`;
    try {
      fsImpl.writeFileSync(temporaryPath, content, 'utf8');
      try {
        fsImpl.renameSync(temporaryPath, filePath);
      } catch (renameError) {
        fsImpl.copyFileSync(temporaryPath, filePath);
        try {
          fsImpl.unlinkSync(temporaryPath);
        } catch {
          /* ignore leftover temp */
        }
      }
      return;
    } catch (error) {
      lastError = error;
      try {
        fsImpl.unlinkSync(temporaryPath);
      } catch {
        /* ignore leftover temp */
      }
      if (!isRetryableWriteError(error) || attempt === retries) throw error;
      sleep(50 * attempt);
    }
  }

  throw lastError;
}

export function writeRowsJson(rows, filePath = ROWS_JSON_PATH, options = {}) {
  const content = JSON.stringify(ensureDownloadPathFields(rows), null, 2);
  replaceFileAtomically(filePath, content, options);
}

export function persistRowsJson(rows, filePath = ROWS_JSON_PATH, options = {}) {
  try {
    writeRowsJson(rows, filePath, options);
    return true;
  } catch (error) {
    console.warn(`Could not write ${filePath}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

export function loadRowsJson() {
  if (!fs.existsSync(ROWS_JSON_PATH)) return [];
  return ensureDownloadPathFields(JSON.parse(fs.readFileSync(ROWS_JSON_PATH, 'utf8')));
}

export function relativeDownloadPath(absolutePath) {
  const repoRoot = path.resolve(TELEPASE_DIR, '..', '..');
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

export function periodoMonth(periodo) {
  const match = String(periodo || '').match(/^\d{4}-(\d{2})/);
  return match ? Number(match[1]) : null;
}

export function filterRowsByPeriodMonth(rows, { monthInit, monthFinish } = {}) {
  if (monthInit == null && monthFinish == null) return rows;
  const start = monthInit ?? monthFinish;
  const end = monthFinish ?? monthInit;
  return rows.filter((row) => {
    const month = periodoMonth(row.periodo);
    return month != null && month >= start && month <= end;
  });
}
