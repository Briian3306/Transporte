import assert from 'node:assert/strict';
import test from 'node:test';
import { matchEstaciones, buildInformeTarifario, filasSinPrecio } from './match-tarifario-last.mjs';

function keyOf(r) {
  return `${r.PEAJE}|${r.ESTACION_QUERY}|${r.CATEGORIA}|${r.STATUS}`;
}

test('DOCKSUD GUITIERREZ HUDSON expand to AUBASA stations', () => {
  const byPeaje = new Map([
    ['AUBASA', ['DOCK SUD', 'GUTIERREZ', 'HUDSON', 'MAIPU']],
  ]);
  const hits = matchEstaciones('AUBASA', 'DOCKSUD, GUITIERREZ, HUDSON', byPeaje);
  assert.deepEqual(hits.map((h) => h.match).sort(), ['DOCK SUD', 'GUTIERREZ', 'HUDSON']);
});

test('informe keeps one row per key and uses the latest fecha_aparicion', () => {
  const last = [{
    CATEGORIA: '1',
    'HORA NO PICO': '$3.550,00',
    'HORA PICO': '',
    PEAJE: 'AUBASA',
    ESTACION: 'BERNAL',
  }];
  const tarifas = [
    { id: 't-1', peaje_nombre: 'AUBASA', estacion_nombre: 'BERNAL', status: 'NO_PICO', categoria: 1 },
  ];
  const importes = [
    { tarifa_id: 't-1', importe: 2550, fecha_aparicion: '2026-01-01 00:00:00+00' },
    { tarifa_id: 't-1', importe: 3550, fecha_aparicion: '2026-08-01 12:00:00+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const keys = cruzado.map(keyOf);
  assert.equal(keys.length, new Set(keys).size);
  const row = cruzado.find((r) => Number(r.CATEGORIA) === 1 && r.STATUS === 'NO_PICO');
  assert.equal(row.ESTADO_MATCH, 'CON_TARIFA');
  assert.equal(row.TARIFA_ID, 't-1');
  assert.equal(row.PRECIO, '$3.550,00');
  assert.equal(row.LAST_UPDATED, '2026-08-01 12:00:00+00');
  assert.equal(row.MATCH_LAST, 'TRUE');
  assert.equal(row.PRECIO_LAST, '$3.550,00');
  assert.equal(row.MOTIVO, 'AL_DIA');
});

test('YERAU CON_TARIFA MATCH_LAST TRUE can be desfasado vs PRECIO_LAST', () => {
  const last = [
    { CATEGORIA: '2', 'HORA NO PICO': '$5.465,48', 'HORA PICO': '', PEAJE: 'Autovía del Mercosur', ESTACION: 'YERUÁ' },
    { CATEGORIA: '3', 'HORA NO PICO': '$6.465,48', 'HORA PICO': '', PEAJE: 'Autovía del Mercosur', ESTACION: 'YERUÁ' },
  ];
  const tarifas = [
    { id: 'a7609548-00b2-48c0-8c62-543e314beb64', peaje_nombre: 'Autovía del Mercosur', estacion_nombre: 'YERAU', status: 'NO_PICO', categoria: 2 },
    { id: '293e627c-8cc7-476d-8b4e-7af96db60f95', peaje_nombre: 'Autovía del Mercosur', estacion_nombre: 'YERAU', status: 'NO_PICO', categoria: 3 },
  ];
  const importes = [
    { tarifa_id: 'a7609548-00b2-48c0-8c62-543e314beb64', importe: 4465.48, fecha_aparicion: '2026-06-26 13:43:08+00' },
    { tarifa_id: '293e627c-8cc7-476d-8b4e-7af96db60f95', importe: 4465.48, fecha_aparicion: '2026-06-04 02:04:45+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const c2 = cruzado.find((r) => r.ESTACION_QUERY === 'YERAU' && Number(r.CATEGORIA) === 2 && r.STATUS === 'NO_PICO');
  const c3 = cruzado.find((r) => r.ESTACION_QUERY === 'YERAU' && Number(r.CATEGORIA) === 3 && r.STATUS === 'NO_PICO');
  assert.equal(c2.ESTADO_MATCH, 'CON_TARIFA');
  assert.equal(c2.MATCH_LAST, 'TRUE');
  assert.equal(c2.ESTACION_MATCH, 'YERUÁ');
  assert.equal(c2.PRECIO, '$4.465,48');
  assert.equal(c2.PRECIO_LAST, '$5.465,48');
  assert.equal(c2.LAST_UPDATED, '2026-06-26 13:43:08+00');
  assert.equal(c3.PRECIO_LAST, '$6.465,48');
  assert.notEqual(c3.PRECIO, c3.PRECIO_LAST);
  assert.equal(c2.MOTIVO, 'DESFASADO');
  assert.equal(c3.MOTIVO, 'DESFASADO');
});

test('CON_TARIFA with MATCH_LAST FALSE when last has no key', () => {
  const last = [];
  const tarifas = [
    { id: 'only-db', peaje_nombre: 'AUBASA', estacion_nombre: 'HUDSON', status: 'PICO', categoria: 4 },
  ];
  const importes = [
    { tarifa_id: 'only-db', importe: 2385.97, fecha_aparicion: '2026-06-26 13:43:08+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const row = cruzado.find((r) => Number(r.CATEGORIA) === 4 && r.STATUS === 'PICO');
  assert.equal(row.ESTADO_MATCH, 'CON_TARIFA');
  assert.equal(row.MATCH_LAST, 'FALSE');
  assert.equal(row.PRECIO_LAST, '');
  assert.equal(row.ESTACION_MATCH, '');
  assert.equal(row.TARIFA_ID, 'only-db');
  assert.equal(row.PRECIO, '$2.385,97');
  assert.equal(row.MOTIVO, 'SOLO_DB');
});

test('AUSOL ALL copies ESTACION_MATCH=ALL onto every DB station with its own tarifa_id', () => {
  const last = [{
    CATEGORIA: '2',
    'HORA NO PICO': '$994,15',
    'HORA PICO': '',
    PEAJE: 'AUSOL',
    ESTACION: 'ALL',
  }];
  const tarifas = [
    { id: 'a-off', peaje_nombre: 'AUSOL', estacion_nombre: 'BELGRANO', status: 'NO_PICO', categoria: 2 },
    { id: 'b-off', peaje_nombre: 'AUSOL', estacion_nombre: 'PILAR', status: 'NO_PICO', categoria: 2 },
    { id: 'c-off', peaje_nombre: 'AUSOL', estacion_nombre: 'TIGRE', status: 'NO_PICO', categoria: 2 },
  ];
  const importes = [
    { tarifa_id: 'a-off', importe: 994.15, fecha_aparicion: '2026-07-01 00:00:00+00' },
    { tarifa_id: 'b-off', importe: 994.15, fecha_aparicion: '2026-07-01 00:00:00+00' },
    { tarifa_id: 'c-off', importe: 699.09, fecha_aparicion: '2026-07-01 00:00:00+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const cat2 = cruzado.filter((r) => Number(r.CATEGORIA) === 2 && r.STATUS === 'NO_PICO');
  assert.equal(cat2.length, 3);
  assert.ok(cat2.every((r) => r.ESTACION_MATCH === 'ALL'));
  assert.ok(cat2.every((r) => r.MATCH_LAST === 'TRUE'));
  assert.ok(cat2.every((r) => r.PRECIO_LAST === '$994,15'));
  const belgrano = cat2.find((r) => r.ESTACION_QUERY === 'BELGRANO');
  const tigre = cat2.find((r) => r.ESTACION_QUERY === 'TIGRE');
  assert.equal(belgrano.TARIFA_ID, 'a-off');
  assert.equal(belgrano.PRECIO, '$994,15');
  assert.equal(belgrano.MOTIVO, 'AL_DIA');
  assert.equal(tigre.TARIFA_ID, 'c-off');
  assert.equal(tigre.PRECIO, '$699,09');
  assert.equal(tigre.MOTIVO, 'DESFASADO');
});

test('grid emits 1..x PICO and NO_PICO; SIN_TARIFA has no PRECIO or TARIFA_ID', () => {
  const last = [{
    CATEGORIA: '7',
    'HORA NO PICO': '$1.000,00',
    'HORA PICO': '$1.200,00',
    PEAJE: 'AUBASA',
    ESTACION: 'HUDSON',
  }];
  const tarifas = [
    { id: 'h7', peaje_nombre: 'AUBASA', estacion_nombre: 'HUDSON', status: 'NO_PICO', categoria: 7 },
  ];
  const importes = [
    { tarifa_id: 'h7', importe: 1000, fecha_aparicion: '2026-07-01 00:00:00+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const hudson = cruzado.filter((r) => r.ESTACION_QUERY === 'HUDSON');
  const cats = [...new Set(hudson.map((r) => Number(r.CATEGORIA)))].sort((a, b) => a - b);
  assert.deepEqual(cats, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(hudson.filter((r) => r.STATUS === 'PICO').length, 7);
  assert.equal(hudson.filter((r) => r.STATUS === 'NO_PICO').length, 7);
  const hole = hudson.find((r) => Number(r.CATEGORIA) === 1 && r.STATUS === 'NO_PICO');
  assert.equal(hole.ESTADO_MATCH, 'SIN_TARIFA');
  assert.equal(hole.MOTIVO, 'SIN_TARIFA');
  assert.equal(hole.PRECIO, '');
  assert.equal(hole.TARIFA_ID, '');
  assert.equal(hole.LAST_UPDATED, '');
  assert.ok(cruzado.every((r) => r.MOTIVO));
});

test('filasSinPrecio includes desfasados and SIN_TARIFA, not al-dia matches', () => {
  const last = [{
    CATEGORIA: '2',
    'HORA NO PICO': '$994,15',
    'HORA PICO': '',
    PEAJE: 'AUSOL',
    ESTACION: 'ALL',
  }];
  const tarifas = [
    { id: 'a-off', peaje_nombre: 'AUSOL', estacion_nombre: 'BELGRANO', status: 'NO_PICO', categoria: 2 },
    { id: 'c-off', peaje_nombre: 'AUSOL', estacion_nombre: 'TIGRE', status: 'NO_PICO', categoria: 2 },
  ];
  const importes = [
    { tarifa_id: 'a-off', importe: 994.15, fecha_aparicion: '2026-07-01 00:00:00+00' },
    { tarifa_id: 'c-off', importe: 699.09, fecha_aparicion: '2026-07-01 00:00:00+00' },
  ];
  const { cruzado } = buildInformeTarifario(last, tarifas, importes);
  const missing = filasSinPrecio(cruzado);
  assert.ok(missing.some((r) => r.ESTACION === 'TIGRE' && r.PEAJE === 'AUSOL' && String(r.CATEGORIA) === '2'));
  assert.ok(!missing.some((r) => r.ESTACION === 'BELGRANO' && String(r.CATEGORIA) === '2' && r.STATUS === 'NO_PICO'));
});

function oneStationInforme(importe, lastPrice) {
  const last = [{
    CATEGORIA: '5',
    'HORA NO PICO': lastPrice,
    'HORA PICO': '',
    PEAJE: 'AUBASA',
    ESTACION: 'MAIPU',
  }];
  const tarifas = [
    { id: 'maipu-5', peaje_nombre: 'AUBASA', estacion_nombre: 'MAIPU', status: 'NO_PICO', categoria: 5 },
  ];
  const importes = [
    { tarifa_id: 'maipu-5', importe, fecha_aparicion: '2026-07-15 06:13:13+00' },
  ];
  return buildInformeTarifario(last, tarifas, importes);
}

function maipuNoPico5(cruzado) {
  return cruzado.find((r) => r.ESTACION_QUERY === 'MAIPU' && Number(r.CATEGORIA) === 5 && r.STATUS === 'NO_PICO');
}

test('1% tolerance: exact compared price is AL_DIA', () => {
  const { cruzado } = oneStationInforme(10000, '$10.000,00');
  const row = maipuNoPico5(cruzado);
  assert.equal(row.MOTIVO, 'AL_DIA');
  assert.equal(row.MATCH_LAST, 'TRUE');
  assert.equal(row.PRECIO, '$10.000,00');
  assert.equal(row.PRECIO_LAST, '$10.000,00');
});

test('1% tolerance: 31427.15 vs 31500 (0.23%) is AL_DIA and does not rewrite PRECIO_LAST', () => {
  const { cruzado } = oneStationInforme(31427.15, '$31.500,00');
  const row = maipuNoPico5(cruzado);
  assert.equal(row.MOTIVO, 'AL_DIA');
  assert.equal(row.MATCH_LAST, 'TRUE');
  assert.equal(row.PRECIO, '$31.427,15');
  assert.equal(row.PRECIO_LAST, '$31.500,00');
  assert.notEqual(row.PRECIO, row.PRECIO_LAST);
});

test('1% tolerance: exactly 1% relative error is AL_DIA', () => {
  const { cruzado } = oneStationInforme(10100, '$10.000,00');
  const row = maipuNoPico5(cruzado);
  assert.equal(row.MOTIVO, 'AL_DIA');
  assert.equal(row.MATCH_LAST, 'TRUE');
  assert.equal(row.PRECIO, '$10.100,00');
  assert.equal(row.PRECIO_LAST, '$10.000,00');
});

test('1% tolerance: greater than 1% relative error is DESFASADO', () => {
  const { cruzado } = oneStationInforme(10101, '$10.000,00');
  const row = maipuNoPico5(cruzado);
  assert.equal(row.MOTIVO, 'DESFASADO');
  assert.equal(row.MATCH_LAST, 'TRUE');
  assert.equal(row.PRECIO, '$10.101,00');
  assert.equal(row.PRECIO_LAST, '$10.000,00');
});

