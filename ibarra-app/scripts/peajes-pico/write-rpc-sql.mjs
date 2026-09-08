import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'out', 'rpc-batches');
for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const json = readFileSync(join(dir, name), 'utf8');
  const sql = `SELECT public.peajes_confirmar_status_tarifa($payload$${json}$payload$::jsonb) AS resultado;`;
  writeFileSync(join(dir, name.replace('.json', '.sql')), sql);
}
const sample = readFileSync(join(dir, '01.sql'), 'utf8');
console.log(sample.slice(0, 80));
console.log('...');
console.log(sample.slice(-40));
