/**
 * 01 — Extract join keys from PWBI / pasadas exports → db_keys.csv
 */
import path from 'node:path';
import {
  HERE,
  csvToObjects,
  moneyKey,
  normalizeDbFechaHora,
  normalizePatente,
  parseMoney,
  readText,
  writeCsv,
} from './lib.mjs';

const PWBI = path.join(HERE, 'pwbi_pasadas_rows.csv');
const PASADAS = path.join(HERE, 'pasadas_rows.csv');
const OUT = path.join(HERE, 'db_keys.csv');

function main() {
  const pwbi = csvToObjects(readText(PWBI), ',');
  const pasadasById = new Map(
    csvToObjects(readText(PASADAS), ',').map((r) => [r.id, r]),
  );

  const rows = [];
  const seen = new Set();

  for (const r of pwbi) {
    const id = r.Pasada_ID || r.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const base = pasadasById.get(id) || {};
    const fecha_hora = normalizeDbFechaHora(r.fecha_hora || base.fecha_hora);
    const tarifaNum = parseMoney(r.precio ?? base.precio);
    const patente = normalizePatente(r.Patente);
    const file_name = (r.file_upload_name || base.file_upload_name || '').trim();
    const concesion = (r.Peaje_Nombre || r.Empresa_Nombre || '').trim();

    rows.push({
      id,
      fecha_hora: fecha_hora || '',
      tarifa: tarifaNum === null ? '' : moneyKey(tarifaNum, 2),
      patente,
      file_name,
      concesion,
    });
  }

  // Include any pasadas rows missing from PWBI
  for (const [id, base] of pasadasById) {
    if (seen.has(id)) continue;
    rows.push({
      id,
      fecha_hora: normalizeDbFechaHora(base.fecha_hora) || '',
      tarifa: (() => {
        const n = parseMoney(base.precio);
        return n === null ? '' : moneyKey(n, 2);
      })(),
      patente: '',
      file_name: (base.file_upload_name || '').trim(),
      concesion: '',
    });
  }

  writeCsv(OUT, ['id', 'fecha_hora', 'tarifa', 'patente', 'file_name', 'concesion'], rows);

  const files = new Set(rows.map((r) => r.file_name).filter(Boolean));
  console.log(`db_keys.csv: ${rows.length} rows, ${files.size} distinct file_name`);
  for (const f of [...files].sort()) console.log(`  - ${f}`);
}

main();
