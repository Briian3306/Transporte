import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';

const TELEPASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TELEPASE_DIR, '..', '..');
const DEFAULT_INPUT = path.resolve(REPO_ROOT, 'scripts/downloads/status.csv');
const DEFAULT_REPORT = path.resolve(REPO_ROOT, 'scripts/downloads/status-template-report.json');

const TEMPLATE_RULES = [
  { template: 'MERCA-SUR-003-YERAU', priority: 2, aliases: ['YERAU', 'YERUA', 'YEAU'] },
  { template: 'MERCA-SUR-004-PIEDRITAS', priority: 2, aliases: ['PIEDRITAS'] },
  { template: 'MERCA-SUR-002-COLONIA', priority: 2, aliases: ['COLONIA'] },
  { template: 'MERCA-SUR-001-ZARATE', priority: 1, aliases: ['ZARATE'] },
];

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, report: DEFAULT_REPORT, dryRun: false, overwrite: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--overwrite') args.overwrite = true;
    else if (arg === '--input') args.input = path.resolve(argv[++i]);
    else if (arg === '--report') args.report = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node enrich-status-templates.mjs [options]

Options:
  --input <csv>   Input status CSV (default: scripts/downloads/status.csv)
  --report <json> Report path (default: scripts/downloads/status-template-report.json)
  --dry-run       Analyze and write the report without changing the CSV
  --overwrite     Recalculate existing templates too (default: preserve them)
  --help          Show this help`);
}

/** RFC 4180-compatible CSV parser for quoted commas, quotes, and newlines. */
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
          .join(',')
      )
      .join('\r\n') + '\r\n'
  );
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function containsAlias(text, alias) {
  const normalized = normalizeText(text);
  const expression = normalizeText(alias).replaceAll(' ', '\\s+');
  return new RegExp(`(?:^|\\s)${expression}(?=\\s|$)`).test(normalized);
}

/** Description aliases have priority over locality aliases. */
export function detectTemplate(text) {
  const matches = TEMPLATE_RULES.map((rule) => ({
    ...rule,
    matchedAliases: rule.aliases.filter((alias) => containsAlias(text, alias)),
  })).filter((rule) => rule.matchedAliases.length);

  if (!matches.length) return { status: 'unknown', template: '', matchedAliases: [] };
  const highestPriority = Math.max(...matches.map((rule) => rule.priority));
  const selected = matches.filter((rule) => rule.priority === highestPriority);
  const matchedAliases = selected.flatMap((rule) => rule.matchedAliases);
  if (selected.length > 1) {
    return {
      status: 'ambiguous',
      template: '',
      matchedAliases,
      candidateTemplates: selected.map((rule) => rule.template),
    };
  }
  return { status: 'matched', template: selected[0].template, matchedAliases };
}

function resolvePdfPath(fileFacturaPath) {
  if (!fileFacturaPath) return null;
  return path.isAbsolute(fileFacturaPath) ? fileFacturaPath : path.resolve(REPO_ROOT, fileFacturaPath);
}

async function extractPdfText(pdfPath) {
  const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
  try {
    return (await parser.getText()).text || '';
  } finally {
    await parser.destroy();
  }
}

function isTargetRow(row) {
  return normalizeText(row.concesionario) === 'AUMESA' || normalizeText(row.Empresa) === 'AUTOVIA DEL MERCOSUR';
}

function writeAtomically(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.copyFileSync(temporaryPath, filePath);
    fs.unlinkSync(temporaryPath);
    if (error.code !== 'EPERM' && error.code !== 'EEXIST') throw error;
  }
}

export async function enrichStatusCsv({ input = DEFAULT_INPUT, report = DEFAULT_REPORT, dryRun = false, overwrite = false } = {}) {
  const parsed = parseCsv(fs.readFileSync(input, 'utf8'));
  if (!parsed.length) throw new Error(`CSV is empty: ${input}`);
  const headers = parsed[0];
  const index = new Map(headers.map((header, position) => [header, position]));
  for (const required of ['Template', 'concesionario', 'Empresa', 'fileFacturaPath']) {
    if (!index.has(required)) throw new Error(`Missing required CSV column: ${required}`);
  }

  const rows = parsed.slice(1).filter((row) => row.length > 1 || row.some(Boolean));
  const reportEntries = [];
  let inspected = 0;
  let changed = 0;

  for (const row of rows) {
    const values = Object.fromEntries(headers.map((header, position) => [header, row[position] ?? '']));
    if (!isTargetRow(values)) continue;
    inspected++;
    const entry = {
      rowId: values.rowId ?? '',
      numero: values.numero ?? '',
      concesionario: values.concesionario ?? '',
      fileFacturaPath: values.fileFacturaPath ?? '',
      previousTemplate: values.Template ?? '',
    };

    if (values.Template && !overwrite) {
      entry.status = 'preserved';
      entry.template = values.Template;
      reportEntries.push(entry);
      continue;
    }

    const pdfPath = resolvePdfPath(values.fileFacturaPath);
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      entry.status = 'missing-pdf';
      reportEntries.push(entry);
      continue;
    }

    try {
      const detection = detectTemplate(await extractPdfText(pdfPath));
      entry.status = detection.status;
      entry.template = detection.template;
      entry.matchedAliases = detection.matchedAliases;
      if (detection.candidateTemplates) entry.candidateTemplates = detection.candidateTemplates;
      if (detection.status === 'matched') {
        row[index.get('Template')] = detection.template;
        changed++;
      }
    } catch (error) {
      entry.status = 'extraction-error';
      entry.error = error instanceof Error ? error.message : String(error);
    }
    reportEntries.push(entry);
  }

  if (!dryRun) writeAtomically(input, stringifyCsv([headers, ...rows]));
  writeAtomically(report, JSON.stringify({ input, dryRun, overwrite, inspected, changed, entries: reportEntries }, null, 2) + '\n');
  return { inspected, changed, reportEntries };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) printHelp();
    else {
      const result = await enrichStatusCsv(args);
      const counts = result.reportEntries.reduce((map, entry) => {
        map[entry.status] = (map[entry.status] || 0) + 1;
        return map;
      }, {});
      console.log(`Rows inspected: ${result.inspected}`);
      console.log(`Templates ${args.dryRun ? 'would be assigned' : 'assigned'}: ${result.changed}`);
      console.log('Results:', counts);
      console.log(`Report: ${args.report}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
