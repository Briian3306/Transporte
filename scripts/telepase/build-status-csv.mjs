import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyCsv } from './enrich-status-templates.mjs';
import { DOWNLOADS_DIR, ROWS_JSON_PATH } from './paths.mjs';
import { downloadPrefix } from './download-paths.mjs';

const TELEPASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TELEPASE_DIR, '..', '..');
export const DEFAULT_STATUS_CSV = path.resolve(REPO_ROOT, 'scripts/downloads/status.csv');

export const STATUS_CSV_HEADERS = [
  'rowId',
  'periodo',
  'fechaEmision',
  'fechaVencimiento',
  'concesionario',
  'Empresa',
  'Template',
  'concesionarioVisible',
  'numero',
  'monto',
  'facturaUrl',
  'pasadaUrl',
  'estado',
  'hasDownloads',
  'fileFacturaPath',
  'filePasadasPath',
  'uploadFileStatus',
  'messageStatus',
];

export const EMPRESA_TEMPLATE_BY_CONCESIONARIO = {
  AUSA: { Empresa: 'AUSA', Template: 'AUSA-V3' },
  AUSOL: { Empresa: 'AUTOPISTAS DEL SOL', Template: 'AUSOL-7-2026' },
  GCO: { Empresa: 'AUTOPISTA DEL OESTE (ACCESO OESTE)', Template: 'AU-OESTE-V1-08-26' },
  CVSA: { Empresa: 'CORREDORES VIALES SA', Template: 'CORRE-VIALES-V1' },
  AUBASA: { Empresa: 'AUBASA', Template: 'AUBASA-7-2026' },
  SANTAFE: { Empresa: 'AUTOPISTA ROSARIO - SANTAFE', Template: 'SANTAFE-V1' },
  AUMESA: { Empresa: 'AUTOVIA DEL MERCOSUR', Template: '' },
  'CAMINO DE LAS SIERRAS': { Empresa: 'CAMINOS DE LAS SIERRAS', Template: 'SOY-CORDOBES' },
  'CAMINOS DE LAS SIERRAS': { Empresa: 'CAMINOS DE LAS SIERRAS', Template: 'SOY-CORDOBES' },
};

function sanitizeSegment(value) {
  return String(value || 'UNKNOWN').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'UNKNOWN';
}

function rowKey(row) {
  return [row.numero, row.periodo, row.concesionario].filter(Boolean).join('|');
}

function toRepoRelative(filePath, repoRoot) {
  if (!filePath) return '';
  if (!path.isAbsolute(filePath)) return String(filePath).split(path.sep).join('/');
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function fileExists(relativeOrAbsolute, repoRoot) {
  if (!relativeOrAbsolute) return false;
  const absolute = path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(repoRoot, relativeOrAbsolute);
  return fs.existsSync(absolute);
}

function matchLocalFile(downloadsRoot, repoRoot, concesionario, kind, periodo, numero) {
  const folder = path.join(downloadsRoot, sanitizeSegment(concesionario));
  if (!fs.existsSync(folder)) return '';
  const prefix = `${downloadPrefix(kind, periodo, numero)}.`;
  const fileName = fs.readdirSync(folder).find((candidate) => candidate.startsWith(prefix));
  return fileName ? toRepoRelative(path.join(folder, fileName), repoRoot) : '';
}

function resolveFilePath(row, field, kind, { downloadsRoot, repoRoot }) {
  const existing = row[field];
  if (existing && fileExists(existing, repoRoot)) return toRepoRelative(existing, repoRoot);
  return matchLocalFile(downloadsRoot, repoRoot, row.concesionario, kind, row.periodo, row.numero);
}

function mappingFor(concesionario) {
  return (
    EMPRESA_TEMPLATE_BY_CONCESIONARIO[String(concesionario || '').trim()] || {
      Empresa: String(concesionario || ''),
      Template: '',
    }
  );
}

export function buildStatusRecords(rows, options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const downloadsRoot = options.downloadsRoot || DOWNLOADS_DIR;
  const previousByKey = new Map((options.previousRecords || []).map((row) => [rowKey(row), row]));

  return rows.map((row) => {
    const mapping = mappingFor(row.concesionario);
    const previous = previousByKey.get(rowKey(row));
    const fileFacturaPath = resolveFilePath(row, 'fileFacturaPath', 'facturas', { downloadsRoot, repoRoot });
    const filePasadasPath = resolveFilePath(row, 'filePasadasPath', 'pasadas', { downloadsRoot, repoRoot });
    const bothExist = Boolean(fileFacturaPath && filePasadasPath);

    return {
      rowId: row.rowId ?? '',
      periodo: row.periodo ?? '',
      fechaEmision: row.fechaEmision ?? '',
      fechaVencimiento: row.fechaVencimiento ?? '',
      concesionario: row.concesionario ?? '',
      Empresa: mapping.Empresa,
      Template: previous?.Template || mapping.Template,
      concesionarioVisible: row.concesionarioVisible ?? '',
      numero: row.numero ?? '',
      monto: row.monto ?? '',
      facturaUrl: row.facturaUrl ?? '',
      pasadaUrl: row.pasadaUrl ?? '',
      estado: row.estado ?? '',
      hasDownloads: bothExist ? 'VERDADERO' : 'FALSO',
      fileFacturaPath,
      filePasadasPath,
      uploadFileStatus: previous?.uploadFileStatus ?? '',
      messageStatus: previous?.messageStatus ?? '',
    };
  });
}

export function stringifyStatusCsv(records) {
  return stringifyCsv([STATUS_CSV_HEADERS, ...records.map((record) => STATUS_CSV_HEADERS.map((header) => record[header] ?? ''))]);
}

export function writeStatusCsv(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = stringifyStatusCsv(records);
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  try {
    fs.renameSync(temporaryPath, filePath);
    return filePath;
  } catch {
    try {
      fs.copyFileSync(temporaryPath, filePath);
      fs.unlinkSync(temporaryPath);
      return filePath;
    } catch {
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
        try {
          fs.unlinkSync(temporaryPath);
        } catch {
          /* ignore */
        }
        console.warn(
          `No pude escribir ${filePath} (¿está abierto en Excel?): ${directError.message}. Guardé ${fallbackPath}`,
        );
        return fallbackPath;
      }
    }
  }
}

function parseCsv(text) {
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

export function loadPreviousStatusCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (!parsed.length) return [];
  const headers = parsed[0];
  return parsed
    .slice(1)
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function parseArgs(argv) {
  const args = { output: DEFAULT_STATUS_CSV, merge: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--output') args.output = path.resolve(argv[++i]);
    else if (arg === '--no-merge') args.merge = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node build-status-csv.mjs [options]

Build scripts/downloads/status.csv from scripts/telepase/rows.json.

Options:
  --output <csv>  Output path (default: scripts/downloads/status.csv)
  --no-merge      Ignore existing uploadFileStatus / Template values
  --help          Show this help`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) printHelp();
    else {
      const rows = JSON.parse(fs.readFileSync(ROWS_JSON_PATH, 'utf8'));
      const previousRecords = args.merge
        ? loadPreviousStatusCsv(args.output).length
          ? loadPreviousStatusCsv(args.output)
          : loadPreviousStatusCsv(args.output.replace(/\.csv$/i, '.bot.csv'))
        : [];
      const records = buildStatusRecords(rows, { previousRecords });
      const written = writeStatusCsv(args.output, records);
      const withFiles = records.filter((row) => row.hasDownloads === 'VERDADERO').length;
      console.log(`Wrote ${records.length} rows to ${written}`);
      console.log(`Both files present: ${withFiles}`);
      console.log(`Missing files: ${records.length - withFiles}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
