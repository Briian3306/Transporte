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

export function updateRowsWithDownloadPath(rows, { rowId, kind, path: filePath, periodo, numero }) {
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

export function writeRowsJson(rows) {
  fs.writeFileSync(ROWS_JSON_PATH, JSON.stringify(ensureDownloadPathFields(rows), null, 2), 'utf8');
}

export function loadRowsJson() {
  if (!fs.existsSync(ROWS_JSON_PATH)) return [];
  return ensureDownloadPathFields(JSON.parse(fs.readFileSync(ROWS_JSON_PATH, 'utf8')));
}

export function relativeDownloadPath(absolutePath) {
  const repoRoot = path.resolve(TELEPASE_DIR, '..', '..');
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}
