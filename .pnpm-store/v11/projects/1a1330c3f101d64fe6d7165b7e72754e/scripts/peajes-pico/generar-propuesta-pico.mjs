/**
 * Generates propuesta-pico-YYYYMMDD.xlsx from monthly tariff levels.
 *
 * Usage (from ibarra-app):
 *   node scripts/peajes-pico/generar-propuesta-pico.mjs
 *   node scripts/peajes-pico/generar-propuesta-pico.mjs --from-json scripts/peajes-pico/data/niveles-mensuales.json
 *
 * Default input: scripts/peajes-pico/data/niveles-mensuales.json
 * Histogram:     scripts/peajes-pico/data/histograma-pico-julio.json
 *
 * Refresh dumps with extract-niveles-mensuales.sql and
 * extract-histograma-pico-julio.sql (read-only against DESARROLLO).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { classifyAll } from './classifier.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..', '..');
const OUT_DIR = join(__dirname, 'out');

const PEAJES_PICO = [
  'AUBASA',
  'AUTOPISTA DEL OESTE',
  'AUSA',
  'CORREDORES VIALES SA',
  'RUTAS SUR ATLANTICO S.A.',
  'AUSOL',
];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function statusManual(row) {
  if (Number(row.casos_pico) > 0 && Number(row.casos_pico) >= Number(row.casos_no_pico)) {
    return 'PICO';
  }
  if (Number(row.casos_no_pico) > 0) return 'NO_PICO';
  return null;
}

function normalizeNiveles(rows) {
  return rows.map((row) => ({
    peaje: row.peaje,
    estacion: row.estacion,
    categoria: row.categoria,
    mes: row.mes,
    importe: Number(row.importe),
    casos: Number(row.casos),
    horaMin: row.hora_min != null ? Number(row.hora_min) : null,
    horaMax: row.hora_max != null ? Number(row.hora_max) : null,
    tarifaNormalizadaId: row.tarifa_normalizada_id ?? row.tarifaNormalizadaId ?? null,
    statusManual: row.statusManual ?? statusManual(row),
  }));
}

function histogramasFromRows(rows) {
  const out = {};
  for (const row of rows) {
    if (!out[row.peaje]) out[row.peaje] = {};
    out[row.peaje][row.hora] = Number(row.n);
  }
  return out;
}

function round2(n) {
  if (n == null || Number.isNaN(n)) return '';
  return Math.round(n * 100) / 100;
}

function round4(n) {
  if (n == null || Number.isNaN(n)) return '';
  return Math.round(n * 10000) / 10000;
}

function buildWorkbook(result) {
  const propuestaRows = result.propuesta.map((r) => ({
    Peaje: r.peaje,
    Estacion: r.estacion,
    Categoria: r.categoria ?? '',
    Mes: r.mes,
    Importe: round2(r.importe),
    Casos: r.casos,
    'R (mayor/menor)': round4(r.r),
    'R julio': round4(r.rJulio),
    'Horas (min-max)': r.horas,
    'Status propuesto': r.statusPropuesto,
    Confianza: r.confianza,
    Motivo: r.motivo,
    CONFIRMAR: r.confirmar,
    tarifa_normalizada_id: r.tarifaNormalizadaId ?? '',
  }));

  const counts = { ALTA: 0, MEDIA: 0, '—': 0 };
  const statusCounts = { PICO: 0, NO_PICO: 0, SIN_PROPUESTA: 0 };
  for (const r of result.propuesta) {
    counts[r.confianza] = (counts[r.confianza] || 0) + 1;
    statusCounts[r.statusPropuesto] = (statusCounts[r.statusPropuesto] || 0) + 1;
  }

  const julio = result.control.julio;
  const controlMeta = [
    { Seccion: 'Autovalidacion julio', Clave: 'niveles_con_status_manual', Valor: julio.total },
    { Seccion: 'Autovalidacion julio', Clave: 'coincidencias', Valor: julio.coincidencias },
    { Seccion: 'Autovalidacion julio', Clave: 'pct', Valor: julio.pct },
    { Seccion: 'Autovalidacion julio', Clave: 'target_pct', Valor: 95 },
    { Seccion: 'Autovalidacion julio', Clave: 'pasa_target', Valor: julio.pct >= 95 ? 'SI' : 'NO' },
    { Seccion: 'Propuesta', Clave: 'filas', Valor: result.propuesta.length },
    { Seccion: 'Propuesta', Clave: 'confianza_ALTA', Valor: counts.ALTA || 0 },
    { Seccion: 'Propuesta', Clave: 'confianza_MEDIA', Valor: counts.MEDIA || 0 },
    { Seccion: 'Propuesta', Clave: 'sin_propuesta', Valor: statusCounts.SIN_PROPUESTA || 0 },
    { Seccion: 'Propuesta', Clave: 'propuesto_PICO', Valor: statusCounts.PICO || 0 },
    { Seccion: 'Propuesta', Clave: 'propuesto_NO_PICO', Valor: statusCounts.NO_PICO || 0 },
    { Seccion: 'Peajes', Clave: 'lista', Valor: PEAJES_PICO.join(' | ') },
    { Seccion: 'Uso', Clave: 'CONFIRMAR', Valor: 'Completar SI / NO. Futuro: importar SI via peajes_confirmar_status_tarifa.' },
  ];
  for (const [peaje, stats] of Object.entries(julio.porPeaje || {})) {
    const pct = stats.total === 0 ? 0 : Math.round((stats.coincidencias / stats.total) * 1000) / 10;
    controlMeta.push({
      Seccion: 'Autovalidacion por peaje',
      Clave: peaje,
      Valor: `${stats.coincidencias}/${stats.total} (${pct}%)`,
    });
  }
  for (const [peaje, env] of Object.entries(result.control.envelopes || {})) {
    controlMeta.push({
      Seccion: 'Ventana pico julio (UTC)',
      Clave: peaje,
      Valor: env ? `${env.min}:00 – ${env.max}:00` : '(sin PICO en julio)',
    });
  }

  const ratios = result.control.ratiosRef.map((r) => ({
    Peaje: r.peaje,
    Estacion: r.estacion,
    Categoria: r.categoria ?? '',
    'R julio': round4(r.r),
    Niveles: r.niveles,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(propuestaRows), 'Propuesta');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(controlMeta), 'Control');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ratios), 'Ratios_julio');
  return wb;
}

function loadEnvDevelopment() {
  const files = ['.env', '.env.local', '.env.development', '.env.development.local'];
  const merged = {};
  for (const file of files) {
    const p = join(appRoot, file);
    if (!existsSync(p)) continue;
    for (const rawLine of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      merged[line.slice(0, eq).trim()] = value;
    }
  }
  return merged;
}

function main() {
  const fromJson = argValue('--from-json')
    || join(__dirname, 'data', 'niveles-mensuales.json');
  const histPath = argValue('--histograma')
    || join(__dirname, 'data', 'histograma-pico-julio.json');

  if (!existsSync(fromJson)) {
    const env = loadEnvDevelopment();
    console.error(
      `No se encontro ${fromJson}.\n` +
      'Corre extract-niveles-mensuales.sql contra DESARROLLO y guardalo como JSON,\n' +
      'o pasa --from-json. ' +
      (env.NG_APP_SUPABASE_URL
        ? `(Supabase URL detectada: ${env.NG_APP_SUPABASE_URL} — este script no escribe, solo lee dumps.)`
        : 'No hay NG_APP_SUPABASE_URL en .env.development.'),
    );
    process.exit(1);
  }

  const niveles = normalizeNiveles(JSON.parse(readFileSync(fromJson, 'utf8')));
  const histogramasPico = existsSync(histPath)
    ? histogramasFromRows(JSON.parse(readFileSync(histPath, 'utf8')))
    : {};

  const result = classifyAll({ niveles, histogramasPico, mesReferencia: '2026-07' });
  const wb = buildWorkbook(result);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = argValue('--out') || join(OUT_DIR, `propuesta-pico-${stamp}.xlsx`);
  XLSX.writeFile(wb, outPath);

  const controlJson = join(OUT_DIR, `propuesta-pico-${stamp}-control.json`);
  writeFileSync(controlJson, JSON.stringify(result.control.julio, null, 2));

  console.log(`Excel: ${outPath}`);
  console.log(`Filas propuesta: ${result.propuesta.length}`);
  console.log(
    `Autovalidacion julio: ${result.control.julio.coincidencias}/${result.control.julio.total} = ${result.control.julio.pct}% (target 95%)`,
  );
  if (result.control.julio.pct < 95) {
    console.warn('AVISO: coincidencia julio < 95%. Revisar umbrales antes de confirmar en lote.');
  }
}

main();
