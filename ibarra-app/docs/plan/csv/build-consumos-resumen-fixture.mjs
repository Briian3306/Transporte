/**
 * Build fixture: ConsumosResumen without FACTURA 0104-00077675 (NC wrong registers).
 * Source: scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const src = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'scripts',
  'telepeaje plus',
  '202607-2',
  'ConsumosResumen.xlsx'
);
const outDir = path.resolve(__dirname);
const outFile = path.join(outDir, 'ConsumosResumen-202607-2-sin-0104-00077675.xlsx');
const EXCLUDE = '0104-00077675';

const wb = XLSX.readFile(src);
const sheetName = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });

const filtered = rows.filter((r) => String(r.FACTURA || '').trim() !== EXCLUDE);
const excluded = rows.filter((r) => String(r.FACTURA || '').trim() === EXCLUDE);

const counts = {};
for (const r of filtered) {
  const f = String(r.FACTURA || '').trim() || '(vacia)';
  counts[f] = (counts[f] || 0) + 1;
}

function dayKey(f) {
  const s = String(f || '');
  const parts = s.split(' ');
  return parts[0] || s;
}

let dayDups = 0;
const seenDay = new Map();
filtered.forEach((r, i) => {
  const k = [r['Tag Nº'], dayKey(r.Fecha), r['Estación'], r.Dominio].join('|');
  if (seenDay.has(k)) dayDups += 1;
  else seenDay.set(k, i);
});

let fullDups = 0;
const seenFull = new Map();
filtered.forEach((r, i) => {
  const k = [r['Tag Nº'], r.Fecha, r['Estación'], r.Dominio].join('|');
  if (seenFull.has(k)) fullDups += 1;
  else seenFull.set(k, i);
});

const ws = XLSX.utils.json_to_sheet(filtered);
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, ws, sheetName);
XLSX.writeFile(outWb, outFile);

console.log(
  JSON.stringify(
    {
      source: src,
      outFile,
      sourceRows: rows.length,
      excludedFactura: EXCLUDE,
      excludedRows: excluded.length,
      filteredRows: filtered.length,
      fullDateTimeDups: fullDups,
      dayOnlyDups: dayDups,
      facturas: counts,
    },
    null,
    2
  )
);
