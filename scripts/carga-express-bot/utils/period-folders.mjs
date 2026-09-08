import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './status-csv.mjs';

export const TELEPEAJE_PLUS_DIR = path.resolve(REPO_ROOT, 'scripts', 'telepeaje plus');

export const DEFAULT_MASIVA_FOLDERS = [
  '202601-2',
  '202602-1',
  '202603-1',
  '202603-2',
  '202604-1',
  '202604-02',
  '202605-01',
  '202605-02',
  '202606-01',
  '202606-2',
];

/** Parse MASIVA_FOLDERS from .env: comma, semicolon, or newline. Lines starting with # are ignored. */
export function parseMasivaFolders(raw) {
  return String(raw ?? '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('#'));
}

export function requireMasivaFolders(raw) {
  const folders = parseMasivaFolders(raw);
  if (!folders.length) {
    throw new Error(
      'Falta MASIVA_FOLDERS en scripts/carga-express-bot/.env. Listá las carpetas de scripts/telepeaje plus (ej. 202601-2,202602-1).',
    );
  }
  return folders;
}

export function toRepoRelative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

export function findMappedXlsx(folderDir) {
  if (!fs.existsSync(folderDir)) return null;
  const names = fs.readdirSync(folderDir).filter((name) => {
    const lower = name.toLowerCase();
    return lower.includes('_mapped') && (lower.endsWith('.xlsx') || lower.endsWith('.csv'));
  });
  names.sort();
  return names.length ? path.join(folderDir, names[0]) : null;
}

export function findComprobantesPdfs(folderDir) {
  const comprobantes = path.join(folderDir, 'Comprobantes');
  if (!fs.existsSync(comprobantes) || !fs.statSync(comprobantes).isDirectory()) return [];
  return fs
    .readdirSync(comprobantes)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort()
    .map((name) => path.join(comprobantes, name));
}

export function resolvePeriodFolder(folderName, { root = TELEPEAJE_PLUS_DIR } = {}) {
  const name = String(folderName ?? '').trim();
  const dir = path.join(root, name);
  const xlsx = findMappedXlsx(dir);
  const pdfs = findComprobantesPdfs(dir);
  if (!fs.existsSync(dir)) {
    return { folder: name, ok: false, reason: `No existe la carpeta ${toRepoRelative(dir)}`, dir, xlsx: null, pdfs: [] };
  }
  if (!xlsx) {
    return {
      folder: name,
      ok: false,
      reason: `Sin Consumo_*_MAPPED.xlsx en ${toRepoRelative(dir)}`,
      dir,
      xlsx: null,
      pdfs,
    };
  }
  if (!pdfs.length) {
    return {
      folder: name,
      ok: false,
      reason: `Sin PDFs en ${toRepoRelative(path.join(dir, 'Comprobantes'))}`,
      dir,
      xlsx,
      pdfs: [],
    };
  }
  return { folder: name, ok: true, reason: '', dir, xlsx, pdfs };
}

export function resolveListedPeriods(folderNames, { root = TELEPEAJE_PLUS_DIR } = {}) {
  return folderNames.map((name) => resolvePeriodFolder(name, { root }));
}
