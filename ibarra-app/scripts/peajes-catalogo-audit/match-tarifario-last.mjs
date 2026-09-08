/**
 * Informe tarifario Cruzado: universo = estaciones de tarifas, grilla 1..x
 * (PICO y NO_PICO), PRECIO = último importe por tarifa_id (fecha_aparicion).
 * Tarifario-last se cruza aparte (ALL se copia a cada estación del peaje).
 *
 * Usage (from ibarra-app):
 *   node scripts/peajes-catalogo-audit/match-tarifario-last.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { foldName, formatArs, parseArs, splitEstaciones } from './parse-ars.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');
const DEFAULT_XLSX = join(OUT_DIR, 'tarifas-tarifas-importe.xlsx');
const DEFAULT_OUT = join(OUT_DIR, 'tarifario-last-cruzado.xlsx');

const PEAJE_ALIAS = new Map([
  ['CORREDORES VIALES S A', 'CORREDORES VIALES SA'],
  ['CORREDORES VIALES S.A', 'CORREDORES VIALES SA'],
]);

const ESTACION_ALIAS = new Map([
  ['DOCKSUD', 'DOCK SUD'],
  ['GUITIERREZ', 'GUTIERREZ'],
  ['RICCHERI', 'RICCHIERI'],
  ['YERUA', 'YERAU'],
  ['COLONIA ELIA', 'COLONIA'],
  ['JAMES CRAICK', 'JAMES CRAIK'],
  ['ACCESO', 'ACCESO SAUCE VIEJO'],
  ['TRONCAL', 'TRONCAL SAUCE VIEJO'],
  ['PUENTE GENERAL BELGRANO', 'PUENTE GRAL BELGRANO'],
  ['VENADO TUERTO', 'V TUERTO'],
  ['GENERAL LAGOS', 'LAGOS'],
  ['ITUZAINGO', 'ITUZAINGO'],
]);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function peajeKey(name) {
  const folded = foldName(name);
  return PEAJE_ALIAS.get(folded) || folded;
}

function parseEstacionToken(token) {
  const m = String(token).match(/^(.*)\((.*)\)\s*$/);
  if (!m) return { name: token.trim(), extra: [] };
  return { name: m[1].trim(), extra: foldName(m[2]).split(' ').filter(Boolean) };
}

function canonicalEstacion(token) {
  const { name, extra } = parseEstacionToken(token);
  const folded = foldName(name);
  return { folded: ESTACION_ALIAS.get(folded) || folded, extra };
}

export function scoreEstacion(queryFolded, extra, dbName) {
  const db = foldName(dbName);
  if (!queryFolded) return 0;
  if (extra.length && !extra.every((t) => t.length < 2 || db.includes(t) || (t === 'RN' && (db.includes('RUTA') || db.includes('RN'))))) {
    if (extra.some((t) => /^\d+$/.test(t)) && !extra.filter((t) => /^\d+$/.test(t)).every((t) => db.includes(t))) {
      return 0;
    }
  }
  if (db === queryFolded) return 100;
  if (db.startsWith(queryFolded) || queryFolded.startsWith(db)) return 90;
  if (db.includes(queryFolded) || (queryFolded.length >= 5 && db.length >= 5 && queryFolded.includes(db))) return 80;
  const tokens = queryFolded.split(' ').filter((t) => t.length > 1);
  if (tokens.length && tokens.every((t) => db.includes(t))) return 70;
  return 0;
}

export function matchEstaciones(peajeNombre, estacionCell, estacionesByPeaje) {
  const pKey = peajeKey(peajeNombre);
  const pool = estacionesByPeaje.get(pKey) || [];
  const parts = splitEstaciones(estacionCell);
  const out = [];
  for (const part of parts) {
    if (foldName(part) === 'ALL') {
      out.push({ query: part, match: 'ALL', via: 'ALL' });
      continue;
    }
    if (foldName(part) === 'EZEIZA CANUELAS' || foldName(part) === 'EZEIZA-CANUELAS') {
      const hits = pool.filter((s) => /EZE|CANUELAS|MONTE GRANDE|TRISTAN SUAREZ/.test(foldName(s)));
      if (hits.length) {
        out.push(...hits.map((s) => ({ query: part, match: s, via: 'corredor' })));
        continue;
      }
    }
    const { folded, extra } = canonicalEstacion(part);
    let best = [];
    let bestScore = 0;
    for (const s of pool) {
      const score = scoreEstacion(folded, extra, s);
      if (score > bestScore) {
        bestScore = score;
        best = [s];
      } else if (score && score === bestScore) best.push(s);
    }
    if (bestScore >= 70) {
      for (const s of best) out.push({ query: part, match: s, via: `score:${bestScore}` });
    } else {
      out.push({ query: part, match: '', via: 'SIN_ESTACION' });
    }
  }
  const seen = new Set();
  return out.filter((row) => {
    const k = `${row.match}|${row.query}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function parseCategoria(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return null;
  if (text === '1B') return 1;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function indexTarifas(tarifasRows) {
  const estacionesByPeaje = new Map();
  for (const row of tarifasRows) {
    const pKey = peajeKey(row.peaje_nombre);
    if (!estacionesByPeaje.has(pKey)) estacionesByPeaje.set(pKey, []);
    const list = estacionesByPeaje.get(pKey);
    if (!list.includes(row.estacion_nombre)) list.push(row.estacion_nombre);
  }
  return { estacionesByPeaje };
}

function parseDate(value) {
  if (!value) return 0;
  let text = String(value).trim().replace(' ', 'T');
  text = text.replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function indexImportes(importeRows) {
  const byTarifa = new Map();
  for (const row of importeRows) {
    if (!byTarifa.has(row.tarifa_id)) byTarifa.set(row.tarifa_id, []);
    byTarifa.get(row.tarifa_id).push(row);
  }
  const latest = new Map();
  for (const [id, list] of byTarifa) {
    const top = [...list].sort((a, b) => parseDate(b.fecha_aparicion) - parseDate(a.fecha_aparicion))[0];
    latest.set(id, {
      importe: Number(top.importe),
      fecha_aparicion: top.fecha_aparicion || '',
      historial: list
        .map((r) => Number(r.importe))
        .filter((n) => Number.isFinite(n)),
    });
  }
  return latest;
}

function stationsFromTarifas(tarifasRows) {
  const map = new Map();
  for (const row of tarifasRows) {
    const k = `${peajeKey(row.peaje_nombre)}|${foldName(row.estacion_nombre)}`;
    if (!map.has(k)) {
      map.set(k, {
        peaje: row.peaje_nombre,
        estacion: row.estacion_nombre,
        maxCat: 0,
        tarifas: new Map(),
      });
    }
    const rec = map.get(k);
    rec.maxCat = Math.max(rec.maxCat, Number(row.categoria) || 0);
    rec.tarifas.set(`${row.status}|${Number(row.categoria)}`, row);
  }
  return [...map.values()];
}

function indexLast(lastRows, estacionesByPeaje) {
  const byStation = new Map();
  const byAll = new Map();
  const maxCatByPeaje = new Map();

  for (const src of lastRows) {
    const cat = parseCategoria(src.CATEGORIA);
    if (cat == null) continue;
    const pKey = peajeKey(src.PEAJE);
    maxCatByPeaje.set(pKey, Math.max(maxCatByPeaje.get(pKey) || 0, cat));

    const matches = matchEstaciones(src.PEAJE, src.ESTACION, estacionesByPeaje);
    const isAll = foldName(src.ESTACION) === 'ALL' || matches.some((m) => foldName(m.match) === 'ALL');
    const sides = [
      { status: 'NO_PICO', precio: parseArs(src['HORA NO PICO']) },
      { status: 'PICO', precio: parseArs(src['HORA PICO']) },
    ];
    for (const side of sides) {
      if (side.precio == null) continue;
      if (isAll) {
        byAll.set(`${pKey}|${cat}|${side.status}`, { precio: side.precio, estacionMatch: 'ALL' });
        continue;
      }
      const tokens = splitEstaciones(src.ESTACION);
      for (const st of matches) {
        if (!st.match) continue;
        const estacionMatch = tokens.length === 1 ? String(src.ESTACION).trim() : st.query;
        byStation.set(
          `${pKey}|${foldName(st.match)}|${cat}|${side.status}`,
          { precio: side.precio, estacionMatch },
        );
      }
    }
  }
  return { byStation, byAll, maxCatByPeaje };
}

function lookupLast(lastIndex, peajeNombre, estacionNombre, status, categoria) {
  const pKey = peajeKey(peajeNombre);
  const cat = Number(categoria);
  const stationHit = lastIndex.byStation.get(`${pKey}|${foldName(estacionNombre)}|${cat}|${status}`);
  if (stationHit) return stationHit;
  return lastIndex.byAll.get(`${pKey}|${cat}|${status}`) || null;
}

function sortCruzado(a, b) {
  return String(a.PEAJE).localeCompare(String(b.PEAJE))
    || String(a.ESTACION_QUERY).localeCompare(String(b.ESTACION_QUERY))
    || Number(a.CATEGORIA) - Number(b.CATEGORIA)
    || String(a.STATUS).localeCompare(String(b.STATUS));
}

function withinOnePercent(compared, importe) {
  if (!Number.isFinite(compared) || !Number.isFinite(importe)) return false;
  if (importe === 0) return compared === 0;
  return Math.abs(compared - importe) / importe <= 0.01;
}

export function motivoFila(row) {
  if (row.ESTADO_MATCH === 'SIN_TARIFA') return 'SIN_TARIFA';
  if (row.MATCH_LAST !== 'TRUE') return 'SOLO_DB';
  const compared = parseArs(row.PRECIO);
  const importe = parseArs(row.PRECIO_LAST);
  if (compared != null && importe != null && withinOnePercent(compared, importe)) return 'AL_DIA';
  return 'DESFASADO';
}

export function buildInformeTarifario(lastRows, tarifasRows, importeRows) {
  const tarifaIndex = indexTarifas(tarifasRows);
  const latestByTarifa = indexImportes(importeRows);
  const lastIndex = indexLast(lastRows, tarifaIndex.estacionesByPeaje);
  const stations = stationsFromTarifas(tarifasRows);
  const cruzado = [];
  const statuses = ['NO_PICO', 'PICO'];

  for (const st of stations) {
    const pKey = peajeKey(st.peaje);
    const x = Math.max(5, st.maxCat, lastIndex.maxCatByPeaje.get(pKey) || 0);
    for (let cat = 1; cat <= x; cat++) {
      for (const status of statuses) {
        const tarifa = st.tarifas.get(`${status}|${cat}`) || null;
        const latest = tarifa ? latestByTarifa.get(tarifa.id) : null;
        const conTarifa = Boolean(tarifa && latest && Number.isFinite(latest.importe));
        const lastHit = lookupLast(lastIndex, st.peaje, st.estacion, status, cat);
        const matchLast = Boolean(lastHit);
        const row = {
          PEAJE: st.peaje,
          ESTACION_QUERY: st.estacion,
          ESTACION_MATCH: matchLast ? lastHit.estacionMatch : '',
          CATEGORIA: cat,
          ESTADO_MATCH: conTarifa ? 'CON_TARIFA' : 'SIN_TARIFA',
          MOTIVO: '',
          MATCH_LAST: matchLast ? 'TRUE' : 'FALSE',
          STATUS: status,
          PRECIO: conTarifa ? formatArs(latest.importe) : '',
          PRECIO_LAST: matchLast ? formatArs(lastHit.precio) : '',
          TARIFA_ID: conTarifa ? tarifa.id : '',
          LAST_UPDATED: conTarifa ? (latest.fecha_aparicion || '') : '',
        };
        row.MOTIVO = motivoFila(row);
        cruzado.push(row);
      }
    }
  }

  cruzado.sort(sortCruzado);
  const resumen = [
    { Clave: 'filas_tarifario_last', Valor: lastRows.length },
    { Clave: 'estaciones_db', Valor: stations.length },
    { Clave: 'filas_cruzadas', Valor: cruzado.length },
    { Clave: 'con_tarifa', Valor: cruzado.filter((r) => r.ESTADO_MATCH === 'CON_TARIFA').length },
    { Clave: 'sin_tarifa', Valor: cruzado.filter((r) => r.ESTADO_MATCH === 'SIN_TARIFA').length },
    { Clave: 'match_last', Valor: cruzado.filter((r) => r.MATCH_LAST === 'TRUE').length },
    { Clave: 'desfasados', Valor: cruzado.filter((r) => r.MOTIVO === 'DESFASADO').length },
    { Clave: 'al_dia', Valor: cruzado.filter((r) => r.MOTIVO === 'AL_DIA').length },
    { Clave: 'solo_db', Valor: cruzado.filter((r) => r.MOTIVO === 'SOLO_DB').length },
  ];
  return { cruzado, resumen };
}

export function filasSinPrecio(cruzado) {
  const out = cruzado
    .filter((r) => r.MOTIVO && r.MOTIVO !== 'AL_DIA')
    .map((r) => ({
      PEAJE: r.PEAJE,
      ESTACION: r.ESTACION_QUERY,
      ESTACION_MATCH: r.ESTACION_MATCH,
      CATEGORIA: r.CATEGORIA,
      STATUS: r.STATUS,
      MOTIVO: r.MOTIVO,
      PRECIO: r.PRECIO,
      PRECIO_LAST: r.PRECIO_LAST,
      TARIFA_ID: r.TARIFA_ID,
      LAST_UPDATED: r.LAST_UPDATED,
    }));
  return out.sort((a, b) => String(a.PEAJE).localeCompare(String(b.PEAJE))
    || String(a.ESTACION).localeCompare(String(b.ESTACION))
    || Number(a.CATEGORIA) - Number(b.CATEGORIA)
    || String(a.STATUS).localeCompare(String(b.STATUS)));
}

function sheetRows(wb, name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false });
}

const LAST_SHEET = 'Tarifario-last';

function loadTarifarioLast(wb) {
  if (wb.Sheets[LAST_SHEET]) {
    return { last: sheetRows(wb, LAST_SHEET), lastSheet: wb.Sheets[LAST_SHEET] };
  }
  const fallbacks = [
    join(OUT_DIR, 'tarifario-last-cruzado.xlsx'),
    join(OUT_DIR, 'auditoria-catalogo-20260904.xlsx'),
  ];
  for (const p of fallbacks) {
    if (!existsSync(p)) continue;
    const other = XLSX.readFile(p);
    if (other.Sheets[LAST_SHEET]) {
      return { last: sheetRows(other, LAST_SHEET), lastSheet: other.Sheets[LAST_SHEET] };
    }
  }
  throw new Error('Falta la hoja Tarifario-last en el Excel');
}

function writeXlsx(wb, filePath) {
  try {
    XLSX.writeFile(wb, filePath);
    return true;
  } catch (err) {
    const code = err && err.code;
    const msg = String(err && err.message || err);
    if (code === 'EBUSY' || code === 'EPERM' || /busy|locked|EBUSY|EPERM/i.test(msg)) {
      console.error(`No se pudo escribir ${filePath}: archivo abierto en Excel. Cerrar y reintentar.`);
      return false;
    }
    throw err;
  }
}

export function writeCruzado(options = {}) {
  const srcPath = resolve(options.xlsx || DEFAULT_XLSX);
  const outPath = resolve(options.out || DEFAULT_OUT);
  if (!existsSync(srcPath)) throw new Error(`No se encontro ${srcPath}`);
  const wb = XLSX.readFile(srcPath);
  const { last, lastSheet } = loadTarifarioLast(wb);
  const tarifas = sheetRows(wb, 'tarifas');
  const importes = sheetRows(wb, 'tarifas_importe');
  const { cruzado, resumen } = buildInformeTarifario(last, tarifas, importes);

  const missing = filasSinPrecio(cruzado);
  const pendientes = cruzado.filter((r) => r.MOTIVO !== 'AL_DIA');
  const missingPath = resolve(options.missingOut || join(OUT_DIR, 'tarifario-sin-precio.xlsx'));

  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, wb.Sheets.tarifas, 'tarifas');
  XLSX.utils.book_append_sheet(out, wb.Sheets.tarifas_importe, 'tarifas_importe');
  XLSX.utils.book_append_sheet(out, lastSheet, LAST_SHEET);
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(cruzado), 'Cruzado');
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(pendientes), 'Pendientes');
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(resumen), 'Resumen');
  mkdirSync(dirname(outPath), { recursive: true });
  const wroteCruzado = writeXlsx(out, outPath);

  const missingWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(missingWb, XLSX.utils.json_to_sheet(cruzado), 'Todas');
  XLSX.utils.book_append_sheet(missingWb, XLSX.utils.json_to_sheet(missing), 'Pendientes');
  const wroteMissing = writeXlsx(missingWb, missingPath);
  return { outPath, missingPath, resumen, cruzado, missing, wroteCruzado, wroteMissing };
}

function main() {
  const result = writeCruzado({
    xlsx: argValue('--xlsx') || DEFAULT_XLSX,
    out: argValue('--out') || DEFAULT_OUT,
  });
  if (result.wroteCruzado) console.log(`Excel: ${result.outPath}`);
  if (result.wroteMissing) console.log(`Sin precio: ${result.missingPath} (${result.missing.length} pendientes)`);
  for (const row of result.resumen) console.log(`${row.Clave}: ${row.Valor}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
