/**
 * Read-only inventory: Telepase downloads + ConsumosResumen → expected empresa.
 * Compare step reads db_aggregates.json (file-level counts only).
 */
import { readdirSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const downloads = join(repo, 'scripts', 'downloads');
const telepeaje = join(repo, 'scripts', 'telepeaje plus');
const outDir = here;

const EMPRESAS = {
  AUBASA: { id: '75d868b4-aef5-409a-8d12-973506656811', nombre: 'AUBASA' },
  AUSA: { id: '710f497d-7fa6-4259-b8dc-16fb1b3b1468', nombre: 'AUSA' },
  AUSOL: { id: '4951e389-42d4-477b-a442-83196cf67790', nombre: 'AUSOL' },
  AUTOPISTA_DEL_OESTE: {
    id: 'e1f63baf-c084-4d4d-801d-245665ff531b',
    nombre: 'AUTOPISTA DEL OESTE',
  },
  CORREDORES: {
    id: '3744bd1a-a659-41de-8b64-90f9cf74ee1f',
    nombre: 'CORREDORES VIALES SA',
  },
  MERCOSUR: {
    id: '37ab9246-a07a-40b5-b62d-7a8b8e7782db',
    nombre: 'AUTOVIA DEL MERCOSUR',
  },
  SANTAFE: {
    id: 'd897928d-8a0c-42d6-b3e9-fffb66b9006c',
    nombre: 'UNIDAD EJECUTORA (SANTA FE)',
  },
  TELEPEAJE: {
    id: '8b5414f2-3a0a-45ee-abb2-69cac0e2920f',
    nombre: 'TELEPEAJE-PLUS',
  },
};

const FOLDER_ALIAS = {
  AUBASA: EMPRESAS.AUBASA,
  AUMBASA: EMPRESAS.AUBASA,
  AUSA: EMPRESAS.AUSA,
  AUSOL: EMPRESAS.AUSOL,
  'AUTO-ESTE': EMPRESAS.AUTOPISTA_DEL_OESTE,
  'AUTO-OESTE': EMPRESAS.AUTOPISTA_DEL_OESTE,
  'AU-OESTE': EMPRESAS.AUTOPISTA_DEL_OESTE,
  CSVA: EMPRESAS.CORREDORES,
  CVSA: EMPRESAS.CORREDORES,
  MERCOSUR: EMPRESAS.MERCOSUR,
  'SANTA FE': EMPRESAS.SANTAFE,
  SANTAFE: EMPRESAS.SANTAFE,
};

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function walkFiles(root, exts) {
  const out = [];
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (exts.has(ent.name.slice(ent.name.lastIndexOf('.')).toLowerCase())) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function inventoryRow(file_upload_name, relative_folder, source_root, empresa, note) {
  return {
    file_upload_name,
    relative_folder: relative_folder.replaceAll('\\', '/'),
    source_root,
    expected_empresa_id: empresa?.id ?? '',
    expected_empresa_nombre: empresa?.nombre ?? '',
    note: note ?? '',
  };
}

function buildInventory() {
  const rows = [];
  const skipNames = new Set(['errors.csv']);

  for (const full of walkFiles(downloads, new Set(['.csv']))) {
    const rel = relative(downloads, full);
    const name = basename(full);
    if (skipNames.has(name) || name.toLowerCase().includes('_testing')) {
      rows.push(
        inventoryRow(name, rel, 'downloads', null, name === 'errors.csv' ? 'skip_root' : 'skip_testing'),
      );
      continue;
    }
    const folder = rel.split(/[\\/]/)[0].toUpperCase();
    const empresa = FOLDER_ALIAS[folder];
    rows.push(
      inventoryRow(
        name,
        rel,
        'downloads',
        empresa,
        empresa ? '' : `unmapped_folder:${folder}`,
      ),
    );
  }

  for (const full of walkFiles(telepeaje, new Set(['.xlsx']))) {
    const rel = relative(telepeaje, full);
    const name = basename(full);
    rows.push(inventoryRow(name, rel, 'telepeaje plus', EMPRESAS.TELEPEAJE, 'consumos_resumen_mixed'));
  }

  const byName = new Map();
  for (const row of rows) {
    if (!row.expected_empresa_id) continue;
    const list = byName.get(row.file_upload_name) ?? [];
    list.push(row.relative_folder);
    byName.set(row.file_upload_name, list);
  }
  for (const row of rows) {
    const folders = byName.get(row.file_upload_name) ?? [];
    const unique = [...new Set(folders)];
    if (unique.length > 1) row.note = [row.note, 'ambiguous'].filter(Boolean).join('|');
    row.ambiguous = unique.length > 1 ? 'true' : 'false';
  }
  return rows;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

const inventory = buildInventory();
writeCsv(
  join(outDir, 'file_folder_empresa.csv'),
  [
    'file_upload_name',
    'relative_folder',
    'source_root',
    'expected_empresa_id',
    'expected_empresa_nombre',
    'ambiguous',
    'note',
  ],
  inventory,
);

const dbPath = join(outDir, 'db_aggregates.json');
if (!existsSync(dbPath)) {
  console.log(`inventory ${inventory.length} rows. Missing ${dbPath}; skip compare.`);
  process.exit(0);
}

const db = JSON.parse(readFileSync(dbPath, 'utf8'));
const expectedByFile = new Map();
for (const row of inventory) {
  if (!row.expected_empresa_id) continue;
  if (!expectedByFile.has(row.file_upload_name)) expectedByFile.set(row.file_upload_name, row);
}

const telepaseLoaded = new Set();
const mismatches = [];

for (const g of db.estacion) {
  const file = g.file_upload_name;
  const exp = expectedByFile.get(file);
  if (!exp) continue;
  if (exp.source_root === 'telepeaje plus') continue;
  telepaseLoaded.add(file);
  if (g.empresa_id !== exp.expected_empresa_id) {
    const docs = (db.documento ?? []).filter((d) => d.file_upload_name === file);
    const docSummary = docs
      .map((d) => `${d.documento_empresa} (${d.n})`)
      .join('; ');
    mismatches.push({
      file_upload_name: file,
      relative_folder: exp.relative_folder,
      expected_empresa_id: exp.expected_empresa_id,
      expected_empresa_nombre: exp.expected_empresa_nombre,
      db_empresa_id: g.empresa_id,
      db_empresa_nombre: g.empresa_nombre,
      db_peaje_nombre: g.peaje_nombre,
      db_estacion_nombre: g.estacion_nombre,
      n_pasadas: g.n,
      documento_empresa: docSummary,
    });
  }
}

mismatches.sort((a, b) => a.file_upload_name.localeCompare(b.file_upload_name));
writeCsv(
  join(outDir, 'mismatches.csv'),
  [
    'file_upload_name',
    'relative_folder',
    'expected_empresa_id',
    'expected_empresa_nombre',
    'db_empresa_id',
    'db_empresa_nombre',
    'db_peaje_nombre',
    'db_estacion_nombre',
    'n_pasadas',
    'documento_empresa',
  ],
  mismatches,
);

const dbFiles = new Set((db.estacion ?? []).map((g) => g.file_upload_name));
const invMapped = inventory.filter((r) => r.expected_empresa_id);
const onDiskNotDb = invMapped.filter((r) => !dbFiles.has(r.file_upload_name));
const inDbNotDisk = [...dbFiles].filter((f) => !expectedByFile.has(f));
const telepaseOk = [...telepaseLoaded].filter(
  (f) => !mismatches.some((m) => m.file_upload_name === f),
);
const mismatchRows = mismatches.reduce((s, m) => s + Number(m.n_pasadas), 0);

const consumos = invMapped.filter((r) => r.source_root === 'telepeaje plus' && dbFiles.has(r.file_upload_name));

writeFileSync(
  join(outDir, '_compare_stats.json'),
  JSON.stringify(
    {
      inventory_rows: inventory.length,
      inventory_mapped: invMapped.length,
      db_files: dbFiles.size,
      telepase_loaded_ok: telepaseOk.length,
      mismatch_files: new Set(mismatches.map((m) => m.file_upload_name)).size,
      mismatch_pasadas: mismatchRows,
      on_disk_not_db: onDiskNotDb.map((r) => r.file_upload_name),
      in_db_not_disk: inDbNotDisk,
      consumos_loaded: consumos.map((r) => r.file_upload_name),
      telepase_ok: telepaseOk.sort(),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(
  JSON.stringify(
    {
      inventory: inventory.length,
      mismatches: mismatches.length,
      mismatch_pasadas: mismatchRows,
      on_disk_not_db: onDiskNotDb.length,
      in_db_not_disk: inDbNotDisk.length,
    },
    null,
    2,
  ),
);
