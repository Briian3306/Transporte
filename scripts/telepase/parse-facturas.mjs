import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { HTML_PATH, ROWS_JSON_PATH } from './paths.mjs';

function cellText($el) {
  const html = $el.html() ?? '';
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const $tmp = cheerio.load(`<div>${withoutComments}</div>`);
  return $tmp('div').text().replace(/\s+/g, ' ').trim();
}

function firstToken(text) {
  if (!text) return '';
  const date = text.match(/\d{4}-\d{2}-\d{2}/);
  if (date) return date[0];
  const parts = text.split(/\s+/).filter(Boolean);
  return parts[0] ?? '';
}

const SLUG_ALIASES = {
  VSFE: 'SANTAFE',
  AUMESA: 'AUMESA',
  AUBASA: 'AUBASA',
  AUSOL: 'AUSOL',
  AUSA: 'AUSA',
  GCO: 'GCO',
  CVSA: 'CVSA',
};

function slugFromUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const marker = parts.find((p) => p.startsWith('descargar-'));
    if (!marker) return '';
    const m = marker.match(/descargar-(?:factura|pasadas)(?:-([a-z0-9]+))?/i);
    if (m?.[1]) {
      const raw = m[1].toUpperCase();
      return SLUG_ALIASES[raw] || raw;
    }
    const slugPart = parts.find((p) => /^[A-Z]{2,}-/.test(p));
    if (slugPart) return slugPart.split('-')[0];
    return '';
  } catch {
    return '';
  }
}

function concesionarioFromTrClass(className) {
  const known = ['AUSA', 'AUSOL', 'GCO', 'CVSA', 'AUBASA', 'SANTAFE', 'AUMESA'];
  const tokens = String(className || '')
    .split(/\s+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  return tokens.find((t) => known.includes(t)) || '';
}

function findDownloadLink($, $td, kind) {
  // Prefer GA-tagged anchors; fall back to any descargar-* href (AUMESA often omits GA classes).
  const preferred =
    kind === 'factura'
      ? $td.find('a.ga-descargar-factura').first()
      : $td.find('a.ga-descargar-pasada').first();
  if (preferred.length) return preferred;

  const needle = kind === 'factura' ? 'descargar-factura' : 'descargar-pasadas';
  return $td.find(`a[href*="${needle}"]`).first();
}

export function parseFacturasHtml(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $('table#example tbody tr.filtro-tr').each((_, tr) => {
    const $tr = $(tr);
    const $tds = $tr.children('td');
    if ($tds.length < 8) return;

    const periodoRaw = cellText($tds.eq(0));
    const periodo = firstToken(periodoRaw) || periodoRaw.trim();
    const concesionarioVisible = cellText($tds.eq(1));
    const numero = cellText($tds.eq(2)).replace(/\s+/g, '');
    const vencRaw = cellText($tds.eq(3));
    const fechaVencimiento = firstToken(vencRaw);
    const montoFull = cellText($tds.eq(4));
    const montoMatch = montoFull.match(/\$[\d.]+,\d{2}/);
    const monto = montoMatch?.[0] || montoFull.split(/\s+/)[0] || montoFull;

    const $facturaA = findDownloadLink($, $tds.eq(5), 'factura');
    const $pasadaA = findDownloadLink($, $tds.eq(6), 'pasada');
    const facturaUrl = $facturaA.attr('href')?.trim() || null;
    const pasadaUrl = $pasadaA.attr('href')?.trim() || null;

    const dataConc =
      $facturaA.attr('data-concesionario')?.trim() ||
      $pasadaA.attr('data-concesionario')?.trim() ||
      $tds.eq(5).find('a[data-concesionario]').first().attr('data-concesionario')?.trim() ||
      $tds.eq(6).find('a[data-concesionario]').first().attr('data-concesionario')?.trim() ||
      '';

    // Prefer machine slug for folder names (AUMESA), not "AU. DEL MERCOSUR"
    const concesionario =
      dataConc ||
      slugFromUrl(facturaUrl) ||
      slugFromUrl(pasadaUrl) ||
      concesionarioFromTrClass($tr.attr('class')) ||
      concesionarioVisible ||
      'UNKNOWN';

    const estadoSpan = $tds.eq(7).find('span').first().text().replace(/\s+/g, ' ').trim();
    const estado = estadoSpan || firstToken(cellText($tds.eq(7))) || cellText($tds.eq(7));
    const rowId = ($tr.attr('id') || '').trim() || `${periodo}_${numero}`;

    rows.push({
      rowId,
      periodo,
      fechaEmision: periodo,
      fechaVencimiento,
      concesionario,
      concesionarioVisible,
      numero,
      monto,
      facturaUrl,
      pasadaUrl,
      estado,
      hasDownloads: Boolean(facturaUrl || pasadaUrl),
    });
  });

  return rows;
}

export function loadRowsFromDisk() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  return parseFacturasHtml(html);
}

function main() {
  const rows = loadRowsFromDisk();
  fs.writeFileSync(ROWS_JSON_PATH, JSON.stringify(rows, null, 2), 'utf8');
  const withUrls = rows.filter((r) => r.facturaUrl && r.pasadaUrl).length;
  console.log(`Parsed ${rows.length} rows → ${ROWS_JSON_PATH}`);
  console.log(`Rows with both factura+pasada URLs: ${withUrls}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
