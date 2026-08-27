import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(BOT_DIR, '..', '..', '..');
export const DEFAULT_STATUS_CSV = path.resolve(REPO_ROOT, 'scripts/downloads/status.csv');

const STATUS = {
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  DUPLICATED: 'DUPLICATED',
  USER_INPUT: 'USER_INPUT',
};

export { STATUS };

/** RFC 4180-compatible CSV parser (same rules as enrich-status-templates.mjs). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
    rows.push(row);
  }
  return rows;
}

export function stringifyCsv(rows) {
  return (
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = value == null ? '' : String(value);
            return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  );
}

function writeAtomically(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  const errors = [];
  try {
    fs.renameSync(temporaryPath, filePath);
    return filePath;
  } catch (error) {
    errors.push(error);
    try {
      fs.copyFileSync(temporaryPath, filePath);
      fs.unlinkSync(temporaryPath);
      return filePath;
    } catch (copyError) {
      errors.push(copyError);
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        try {
          fs.unlinkSync(temporaryPath);
        } catch {
          /* ignore */
        }
        return filePath;
      } catch (directError) {
        const fallbackPath = filePath.replace(/\.csv$/i, '.bot.csv');
        fs.writeFileSync(fallbackPath, content, 'utf8');
        console.warn(
          `No pude escribir ${filePath} (¿está abierto en Excel?): ${directError.message}. Guardé el estado en ${fallbackPath}`,
        );
        try {
          fs.unlinkSync(temporaryPath);
        } catch {
          /* ignore */
        }
        return fallbackPath;
      }
    }
  }
}

export function resolveRepoPath(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return null;
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(REPO_ROOT, relativeOrAbsolute);
}

export function loadStatusCsv(filePath = DEFAULT_STATUS_CSV) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`status.csv not found: ${filePath}`);
  }
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (!parsed.length) throw new Error(`CSV is empty: ${filePath}`);
  const headers = [...parsed[0]];
  for (const required of ['uploadFileStatus', 'messageStatus']) {
    if (!headers.includes(required)) headers.push(required);
  }
  const rows = parsed.slice(1).filter((row) => row.length > 1 || row.some(Boolean));
  return {
    filePath,
    headers,
    records: rows.map((row, index) => {
      const record = { _index: index };
      for (const header of headers) {
        const position = parsed[0].indexOf(header);
        record[header] = position >= 0 ? (row[position] ?? '') : '';
      }
      return record;
    }),
  };
}

export function saveStatusCsv(store) {
  const rows = [store.headers, ...store.records.map((record) => store.headers.map((header) => record[header] ?? ''))];
  const written = writeAtomically(store.filePath, stringifyCsv(rows));
  store.lastWrittenPath = written;
  return written;
}

export function updateRecordStatus(store, record, status, message = '') {
  const compactMessage = compactStatusMessage(message, status);
  record.uploadFileStatus = status;
  record.messageStatus = compactMessage;
  return saveStatusCsv(store);
}

export function compactStatusMessage(message, status = '') {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();
  if (normalizedStatus === STATUS.COMPLETE || normalizedStatus === 'IN_PROGRESS') return '';
  if (normalizedStatus === STATUS.USER_INPUT) return 'Requiere revisión';
  if (normalizedStatus === STATUS.FAILED) return 'Error';
  const text = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const duplicate = text.match(/Se detectaron\s+(\d+)\s+pasada\(s\)\s+duplicada\(s\)/i);
  if (duplicate) return `Duplicado: ${duplicate[1]} pasada(s)`;
  if (/No existe filePasadasPath/i.test(text)) return 'Falta archivo: pasadas';
  if (/No existe fileFacturaPath/i.test(text)) return 'Falta archivo: factura';
  if (/Paso ValidaciÃ³n|Paso Validación/i.test(text)) return 'Validación: requiere revisión';
  if (/Paso Factura/i.test(text)) return 'Factura: formulario inválido';
  if (/Procesando carga-express/i.test(text)) return 'Procesando';
  return text.slice(0, 180);
}

export function normalizeStatusMessages(store) {
  let changed = false;
  for (const record of store.records) {
    const normalized = compactStatusMessage(record.messageStatus, record.uploadFileStatus);
    if (normalized !== String(record.messageStatus ?? '')) {
      record.messageStatus = normalized;
      changed = true;
    }
  }
  return changed;
}

export function firstPendingRecord(store) {
  return store.records.find((record) => !isComplete(record)) ?? store.records[0] ?? null;
}

export function markLoginFailure(store, message) {
  const record = firstPendingRecord(store);
  if (!record) {
    console.error(`Login falló y no hay filas en el CSV: ${message}`);
    return null;
  }
  return updateRecordStatus(store, record, STATUS.FAILED, `Login: ${message}`);
}

export function isComplete(record) {
  return String(record.uploadFileStatus ?? '').trim().toUpperCase() === STATUS.COMPLETE;
}

export function isRetryableStatus(record) {
  const status = String(record.uploadFileStatus ?? '').trim().toUpperCase();
  // A blank status is the normal pending state for rows not processed yet.
  // IN_PROGRESS is also recoverable when a previous run was interrupted.
  return status !== STATUS.COMPLETE && status !== STATUS.DUPLICATED;
}

export function rowKey(record) {
  return [record.numero, record.periodo, record.concesionario].filter(Boolean).join('|');
}
