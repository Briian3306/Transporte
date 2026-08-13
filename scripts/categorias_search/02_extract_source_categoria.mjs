/**
 * 02 — Extract CATEGORIA from scripts/downloads CSVs (+ Plus XLSX without inventing CATEGORIA)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DOWNLOADS_DIR,
  HERE,
  TELEPEAJE_PLUS_DIR,
  concesionFromDownloadsPath,
  csvToObjects,
  localArToUtcIso,
  moneyKey,
  normalizePatente,
  parseFechaParts,
  parseHoraParts,
  parseMoney,
  readText,
  utcPartsToExportIso,
  walkFiles,
  writeCsv,
} from './lib.mjs';

const DB_KEYS = path.join(HERE, 'db_keys.csv');
const OUT = path.join(HERE, 'source_categoria.csv');

function loadWantedFileNames() {
  if (!fs.existsSync(DB_KEYS)) {
    console.warn('db_keys.csv missing — run 01_extract_db_keys.mjs first; scanning all pasadas_*.csv');
    return null;
  }
  const rows = csvToObjects(readText(DB_KEYS), ',');
  return new Set(rows.map((r) => r.file_name).filter(Boolean));
}

function buildFechaHoraCandidates(fechaRaw, horaRaw, horaTransformada) {
  const fecha = parseFechaParts(fechaRaw);
  if (!fecha) return { fechaStr: '', horaStr: '', candidates: [] };

  const horaPreferred = horaTransformada?.trim()
    ? parseHoraParts(horaTransformada)
    : parseHoraParts(horaRaw);
  const horaFallback = parseHoraParts(horaRaw);
  const horas = [];
  if (horaPreferred) horas.push(horaPreferred);
  if (horaFallback && (!horaPreferred || horaFallback.h !== horaPreferred.h || horaFallback.mi !== horaPreferred.mi || horaFallback.s !== horaPreferred.s)) {
    horas.push(horaFallback);
  }

  const candidates = [];
  const fechaStr = `${fecha.y}-${String(fecha.mo).padStart(2, '0')}-${String(fecha.d).padStart(2, '0')}`;
  let horaStr = '';

  for (const h of horas) {
    horaStr = `${String(h.h).padStart(2, '0')}:${String(h.mi).padStart(2, '0')}:${String(h.s).padStart(2, '0')}`;
    // As UTC wall-clock (if upload stored local as UTC)
    candidates.push(utcPartsToExportIso(fecha.y, fecha.mo, fecha.d, h.h, h.mi, h.s));
    // Argentina local → UTC
    candidates.push(localArToUtcIso(fecha.y, fecha.mo, fecha.d, h.h, h.mi, h.s));
  }

  return { fechaStr, horaStr, candidates: [...new Set(candidates.filter(Boolean))] };
}

function extractFromTelepaseCsv(filePath, wanted) {
  const base = path.basename(filePath);
  if (wanted && !wanted.has(base)) return [];
  if (!/^pasadas_.*\.csv$/i.test(base)) return [];
  // skip testing copies
  if (/_testing\.csv$/i.test(base)) return [];

  const text = readText(filePath);
  const rows = csvToObjects(text, ';');
  const concesion = concesionFromDownloadsPath(filePath);
  const out = [];

  for (const r of rows) {
    const patente = normalizePatente(r.PATENTE || r.DOMINIO || r.Dominio);
    const tarifaNum = parseMoney(r.TARIFA || r.Tarifa);
    const categoria = String(r.CATEGORIA ?? r.Categoria ?? '').trim();
    const { fechaStr, horaStr, candidates } = buildFechaHoraCandidates(
      r.FECHA || r.Fecha,
      r.HORA || r.Hora,
      r.HORA_TRANSFORMADA,
    );

    // One output row per primary fecha_hora candidate (AR→UTC preferred last written;
    // join script indexes all via re-parse from fecha+hora). Store primary = first candidate.
    const fecha_hora = candidates[0] || '';

    out.push({
      file_name: base,
      fecha: fechaStr,
      hora: horaStr,
      fecha_hora,
      fecha_hora_alt: candidates.slice(1).join('|'),
      patente,
      tarifa: tarifaNum === null ? '' : moneyKey(tarifaNum, 2),
      categoria,
      concesion,
    });
  }
  return out;
}

/**
 * Minimal XLSX shared-string + sheet parser for ConsumosResumen (categoria left empty).
 * Avoids extra deps; only used for QA rows when sheet is simple.
 */
function tryExtractConsumosResumen(filePath, wanted) {
  const base = path.basename(filePath);
  if (wanted && !wanted.has(base)) return [];
  if (!/\.xlsx$/i.test(base)) return [];

  // Prefer not inventing CATEGORIA: emit a single marker row noting no category column.
  // Full row parse of xlsx without dependency is fragile; document in console.
  console.log(`ConsumosResumen: ${base} has no CATEGORIA — skipping row extract (Patrón A). Path: ${filePath}`);
  return [];
}

function main() {
  const wanted = loadWantedFileNames();
  const out = [];

  const csvFiles = walkFiles(DOWNLOADS_DIR, (_full, name) => /^pasadas_.*\.csv$/i.test(name));
  console.log(`Scanning ${csvFiles.length} pasadas_*.csv under downloads/`);

  const foundWanted = new Set();
  for (const f of csvFiles) {
    const base = path.basename(f);
    if (wanted && wanted.has(base)) foundWanted.add(base);
    const rows = extractFromTelepaseCsv(f, wanted);
    out.push(...rows);
  }

  if (wanted) {
    for (const name of wanted) {
      if (name.endsWith('.xlsx')) {
        const hits = walkFiles(TELEPEAJE_PLUS_DIR, (_f, n) => n === name);
        if (!hits.length) {
          console.warn(`MISSING Plus file for ${name}`);
          continue;
        }
        for (const h of hits) out.push(...tryExtractConsumosResumen(h, wanted));
      } else if (!foundWanted.has(name) && name.endsWith('.csv')) {
        console.warn(`MISSING downloads CSV for ${name}`);
      }
    }
  }

  writeCsv(
    OUT,
    [
      'file_name',
      'fecha',
      'hora',
      'fecha_hora',
      'fecha_hora_alt',
      'patente',
      'tarifa',
      'categoria',
      'concesion',
    ],
    out,
  );

  const withCat = out.filter((r) => r.categoria).length;
  console.log(`source_categoria.csv: ${out.length} rows, ${withCat} with categoria`);
}

main();
