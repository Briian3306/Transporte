import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvToObjects, readText } from '../lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const rows = csvToObjects(readText(path.join(ROOT, 'update_categoria_pasadas.csv')), ',');
const filtered = rows.filter(
  (r) => r.categoria && !String(r.file_name).toLowerCase().includes('consumosresumen'),
);

const esc = (s) => String(s ?? '').replace(/'/g, "''");
const BATCH = 250;
const outDir = path.join(HERE, '_batches');
fs.mkdirSync(outDir, { recursive: true });

console.log(`rows=${rows.length} filtered=${filtered.length}`);

let n = 0;
for (let i = 0; i < filtered.length; i += BATCH) {
  const chunk = filtered.slice(i, i + BATCH);
  const values = chunk
    .map(
      (r) =>
        `('${esc(r.id)}','${esc(r.file_name)}','${esc(r.patente)}',${Number(r.tarifa)},'${esc(r.categoria)}','${esc(r.concesion)}')`,
    )
    .join(',\n');
  const sql = `INSERT INTO public._stg_pasadas_categoria (id, file_name, patente, tarifa, categoria, concesion) VALUES
${values}
ON CONFLICT (id) DO UPDATE SET
  file_name = EXCLUDED.file_name,
  patente = EXCLUDED.patente,
  tarifa = EXCLUDED.tarifa,
  categoria = EXCLUDED.categoria,
  concesion = EXCLUDED.concesion;`;
  const name = path.join(outDir, `stg_${String(n).padStart(2, '0')}.sql`);
  fs.writeFileSync(name, sql, 'utf8');
  console.log(`${path.basename(name)} ${chunk.length} ${sql.length}`);
  n += 1;
}
