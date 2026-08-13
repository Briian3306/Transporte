/**
 * 03 — Join db_keys × source_categoria → update_categoria_pasadas.csv
 */
import path from 'node:path';
import {
  HERE,
  csvToObjects,
  epochSec,
  moneyKey,
  normalizePatente,
  parseMoney,
  readText,
  writeCsv,
} from './lib.mjs';

const DB = path.join(HERE, 'db_keys.csv');
const SRC = path.join(HERE, 'source_categoria.csv');
const OUT = path.join(HERE, 'update_categoria_pasadas.csv');
const UNMATCHED = path.join(HERE, 'join_unmatched_db.csv');
const AMBIGUOUS = path.join(HERE, 'join_ambiguous.csv');

const TOLERANCE_SEC = 2;

function indexSource(srcRows) {
  // keyWithTarifa: file|patente|tarifa → entries
  // keyNoTarifa: file|patente → entries (fallback when DB precio ≠ source TARIFA, e.g. AUSA)
  const withTarifa = new Map();
  const noTarifa = new Map();

  const push = (map, key, entry) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };

  for (const r of srcRows) {
    const file = (r.file_name || '').trim();
    const patente = normalizePatente(r.patente);
    const tarifa = moneyKey(parseMoney(r.tarifa), 2);
    if (!file || !patente) continue;

    const times = [r.fecha_hora, ...(r.fecha_hora_alt ? String(r.fecha_hora_alt).split('|') : [])]
      .map((t) => t.trim())
      .filter(Boolean);

    for (const t of times) {
      const sec = epochSec(t);
      if (sec === null) continue;
      const entry = {
        sec,
        fechaHora: t,
        tarifa,
        categoria: String(r.categoria ?? '').trim(),
        concesion: r.concesion || '',
        row: r,
      };
      if (tarifa) push(withTarifa, `${file}|${patente}|${tarifa}`, entry);
      push(noTarifa, `${file}|${patente}`, entry);
    }
  }
  return { withTarifa, noTarifa };
}

function dedupeHits(hits) {
  const seen = new Set();
  const unique = [];
  for (const h of hits) {
    const k = `${h.sec}|${h.categoria}|${h.tarifa || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(h);
  }
  return unique;
}

function hitsNear(bucket, target) {
  if (!bucket?.length || target === null) return [];
  let hits = bucket.filter((b) => b.sec === target);
  if (!hits.length) {
    hits = bucket.filter((b) => Math.abs(b.sec - target) <= TOLERANCE_SEC);
  }
  return dedupeHits(hits);
}

function findMatches(index, file, patente, tarifa, fechaHora) {
  const target = epochSec(fechaHora);
  if (target === null) return { hits: [], strategy: 'none' };

  const full = hitsNear(index.withTarifa.get(`${file}|${patente}|${tarifa}`), target);
  if (full.length) return { hits: full, strategy: 'file_patente_tarifa_time' };

  // Fallback: file + patente + time (AUSA precio often ≠ TARIFA text)
  const loose = hitsNear(index.noTarifa.get(`${file}|${patente}`), target);
  if (loose.length) return { hits: loose, strategy: 'file_patente_time' };

  return { hits: [], strategy: 'none' };
}

function main() {
  const dbRows = csvToObjects(readText(DB), ',');
  const srcRows = csvToObjects(readText(SRC), ',');
  const index = indexSource(srcRows);

  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  let matchedWithCat = 0;
  let consumosUnmatched = 0;
  const strategyCounts = Object.create(null);

  for (const d of dbRows) {
    const id = d.id;
    const file = (d.file_name || '').trim();
    const patente = normalizePatente(d.patente);
    const tarifa = moneyKey(parseMoney(d.tarifa), 2);
    const fecha_hora = (d.fecha_hora || '').trim();
    const concesionDb = d.concesion || '';

    const { hits, strategy } = findMatches(index, file, patente, tarifa, fecha_hora);
    strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;

    if (!hits.length) {
      unmatched.push({
        id,
        file_name: file,
        patente,
        tarifa,
        fecha_hora,
        concesion: concesionDb,
        reason: file.toLowerCase().includes('consumosresumen')
          ? 'no_categoria_in_source'
          : 'no_match',
      });
      if (file.toLowerCase().includes('consumosresumen')) consumosUnmatched += 1;
      continue;
    }

    const cats = [...new Set(hits.map((h) => h.categoria).filter(Boolean))];
    if (cats.length > 1) {
      ambiguous.push({
        id,
        file_name: file,
        patente,
        tarifa,
        fecha_hora,
        categorias: cats.join('|'),
        hit_count: hits.length,
        strategy,
      });
      continue;
    }

    const best = hits.find((h) => h.categoria) || hits[0];
    const categoria = best.categoria || '';
    if (categoria) matchedWithCat += 1;

    matched.push({
      id,
      file_name: file,
      patente,
      // Prefer DB tarifa (precio) for UPDATE sanity check against pasadas.precio
      tarifa,
      categoria,
      concesion: best.concesion || concesionDb,
    });
  }

  // Only export rows that have a categoria (useful for UPDATE)
  const withCat = matched.filter((r) => r.categoria);
  writeCsv(OUT, ['id', 'file_name', 'patente', 'tarifa', 'categoria', 'concesion'], withCat);
  writeCsv(
    UNMATCHED,
    ['id', 'file_name', 'patente', 'tarifa', 'fecha_hora', 'concesion', 'reason'],
    unmatched,
  );
  writeCsv(
    AMBIGUOUS,
    ['id', 'file_name', 'patente', 'tarifa', 'fecha_hora', 'categorias', 'hit_count', 'strategy'],
    ambiguous,
  );

  console.log('--- join stats ---');
  console.log(`db rows:           ${dbRows.length}`);
  console.log(`matched (any):     ${matched.length}`);
  console.log(`matched with cat:  ${matchedWithCat}`);
  console.log(`written to update: ${withCat.length}`);
  console.log(`unmatched:         ${unmatched.length}`);
  console.log(`  ConsumosResumen: ${consumosUnmatched}`);
  console.log(`ambiguous:         ${ambiguous.length}`);
  console.log('strategies:', strategyCounts);
}

main();
