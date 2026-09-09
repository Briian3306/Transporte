import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseCsv } from './parse-csv.mjs';
import {
  IMPORTE_HEADERS,
  MODEL_SHEETS,
  TARIFAS_HEADERS,
  splitPwbiRows,
} from './from-pwbi.mjs';
import { writeSampleFiles } from './write-sample-files.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const tarifasPath = join(fixturesDir, 'tarifas.csv');
const importePath = join(fixturesDir, 'tarifas_importe.csv');
const xlsxPath = join(__dirname, 'out', 'tarifas-tarifas-importe.xlsx');
const pwbiPath = resolve(__dirname, '..', '..', '..', 'pwbi_tarifas_rows.csv');

function keyOf(row) {
  return `${row.peaje_id}|${row.estacion_id}|${row.status}|${row.categoria}`;
}

function pwbiFixture() {
  return [
    {
      Tarifa_Normalizada_ID: 'imp-1',
      Peaje_ID: 'p1',
      Estacion_ID: 's1',
      Peaje_Nombre: 'AUBASA',
      Estacion_Nombre: 'HUDSON',
      Categoria: '2',
      Categoria_Normalizada: '2',
      fecha_aparicion: '2026-01-01 00:00:00+00',
      Importe: '1000',
      Importe_Base: '1000',
      Cases: '2',
      Multiplicador: '1',
      Desvio: '0',
      Hora_Min: '8',
      Hora_Max: '18',
      Hora_Media: '12',
      Patron: 'B',
      Diagnostico: 'CONFIRMADO',
      Status: 'NO_PICO',
      Muestra_Confiable: 'false',
      Confirmado_Manual: 'true',
    },
    {
      Tarifa_Normalizada_ID: 'imp-2',
      Peaje_ID: 'p1',
      Estacion_ID: 's1',
      Peaje_Nombre: 'AUBASA',
      Estacion_Nombre: 'HUDSON',
      Categoria: '2',
      Categoria_Normalizada: '2',
      fecha_aparicion: '2026-02-01 00:00:00+00',
      Importe: '1100',
      Importe_Base: '1100',
      Cases: '1',
      Multiplicador: '1',
      Desvio: '0',
      Hora_Min: '8',
      Hora_Max: '18',
      Hora_Media: '12',
      Patron: 'B',
      Diagnostico: 'CONFIRMADO',
      Status: 'NO_PICO',
      Muestra_Confiable: 'false',
      Confirmado_Manual: 'true',
    },
    {
      Tarifa_Normalizada_ID: 'imp-3',
      Peaje_ID: 'p1',
      Estacion_ID: 's1',
      Peaje_Nombre: 'AUBASA',
      Estacion_Nombre: 'HUDSON',
      Categoria: '2',
      Categoria_Normalizada: '2',
      fecha_aparicion: '2026-02-01 08:00:00+00',
      Importe: '2000',
      Importe_Base: '2000',
      Cases: '1',
      Multiplicador: '1',
      Desvio: '0',
      Hora_Min: '8',
      Hora_Max: '10',
      Hora_Media: '9',
      Patron: 'B',
      Diagnostico: 'CONFIRMADO',
      Status: 'PICO',
      Muestra_Confiable: 'false',
      Confirmado_Manual: 'true',
    },
    {
      Tarifa_Normalizada_ID: 'pend-1',
      Peaje_ID: 'p1',
      Estacion_ID: 's1',
      Peaje_Nombre: 'AUBASA',
      Estacion_Nombre: 'HUDSON',
      Categoria: '2',
      Categoria_Normalizada: '2',
      fecha_aparicion: '2026-03-01 00:00:00+00',
      Importe: '999',
      Importe_Base: '999',
      Cases: '1',
      Multiplicador: '1',
      Desvio: '0',
      Hora_Min: '0',
      Hora_Max: '0',
      Hora_Media: '0',
      Patron: 'B',
      Diagnostico: 'MUESTRA_INSUFICIENTE',
      Status: 'PENDIENTE',
      Muestra_Confiable: 'false',
      Confirmado_Manual: 'false',
    },
  ];
}

test('splitPwbiRows collapses catalogue keys and keeps every PICO/NO_PICO amount', () => {
  const { tarifas, tarifasImporte } = splitPwbiRows(pwbiFixture());
  assert.equal(tarifas.length, 2);
  assert.equal(tarifasImporte.length, 3);
  assert.equal(new Set(tarifas.map(keyOf)).size, 2);
  const ids = new Set(tarifas.map((r) => r.id));
  for (const row of tarifasImporte) {
    assert.ok(ids.has(row.tarifa_id), `orphan tarifa_id ${row.tarifa_id}`);
  }
  const nopico = tarifasImporte.filter((r) => {
    const t = tarifas.find((x) => x.id === r.tarifa_id);
    return t.status === 'NO_PICO';
  });
  assert.equal(nopico.length, 2);
  assert.ok(!tarifas.some((r) => r.status === 'PENDIENTE'));
});

test('writeSampleFiles writes all dump tarifas and a 2-tab Excel', () => {
  assert.ok(existsSync(pwbiPath), `missing ${pwbiPath}`);
  const source = parseCsv(readFileSync(pwbiPath, 'utf8'));
  const expected = splitPwbiRows(source);
  assert.ok(expected.tarifas.length > 100);
  assert.equal(
    expected.tarifasImporte.length,
    source.filter((r) => r.Status === 'PICO' || r.Status === 'NO_PICO').length,
  );

  const written = writeSampleFiles({ csvPath: pwbiPath });
  assert.equal(written.tarifasCsv, tarifasPath);
  assert.equal(written.importeCsv, importePath);
  assert.equal(written.xlsx, xlsxPath);

  const csvTarifas = parseCsv(readFileSync(tarifasPath, 'utf8'));
  const csvImportes = parseCsv(readFileSync(importePath, 'utf8'));
  assert.deepEqual(Object.keys(csvTarifas[0]), TARIFAS_HEADERS);
  assert.deepEqual(Object.keys(csvImportes[0]), IMPORTE_HEADERS);
  assert.equal(csvTarifas.length, expected.tarifas.length);
  assert.equal(csvImportes.length, expected.tarifasImporte.length);

  const wb = XLSX.readFile(xlsxPath);
  assert.deepEqual(wb.SheetNames, MODEL_SHEETS);
  assert.equal(MODEL_SHEETS.length, 2);
  const sheetTarifas = XLSX.utils.sheet_to_json(wb.Sheets.tarifas, { defval: '' });
  const sheetImportes = XLSX.utils.sheet_to_json(wb.Sheets.tarifas_importe, { defval: '' });
  assert.equal(sheetTarifas.length, expected.tarifas.length);
  assert.equal(sheetImportes.length, expected.tarifasImporte.length);
});
