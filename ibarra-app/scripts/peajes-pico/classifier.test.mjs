import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clusterImportes,
  familyRatio,
  ratioWithinTolerance,
  monthlyIncreaseOk,
  inheritByRank,
  classifyByHours,
  derivePeakEnvelope,
  classifyFamilyMonth,
  classifyAll,
  validateJulyBlind,
} from './classifier.mjs';

test('clusters importes within 0.5% and keeps 1% apart', () => {
  const clustered = clusterImportes([
    { importe: 100, casos: 10 },
    { importe: 100.4, casos: 2 },
    { importe: 101.2, casos: 3 },
  ]);
  assert.equal(clustered.length, 2);
  assert.equal(clustered[0].miembros.length, 2);
  assert.equal(clustered[1].miembros.length, 1);
});

test('R is tarifa mayor / tarifa menor', () => {
  const r = familyRatio([6044.83, 16982.69]);
  assert.ok(Math.abs(r - 16982.69 / 6044.83) < 1e-9);
  assert.equal(familyRatio([6044.83]), null);
});

test('ratioWithinTolerance is ±2%', () => {
  const julyR = 16982.69 / 6044.83;
  assert.equal(ratioWithinTolerance(julyR, julyR, 0.02), true);
  assert.equal(ratioWithinTolerance(julyR * 1.019, julyR, 0.02), true);
  assert.equal(ratioWithinTolerance(julyR * 1.03, julyR, 0.02), false);
});

test('monthly increase 0% to 15% is ok, drop or 20% is not', () => {
  assert.equal(monthlyIncreaseOk(5920.5, 6044.83), true);
  assert.equal(monthlyIncreaseOk(6044.83, 6044.83), true);
  assert.equal(monthlyIncreaseOk(6044.83, 5920.5), false);
  assert.equal(monthlyIncreaseOk(5000, 6000), false);
});

test('inheritByRank maps cheapest to first july status by importe', () => {
  const july = [
    { importe: 6044.83, status: 'NO_PICO' },
    { importe: 16982.69, status: 'PICO' },
  ];
  const june = inheritByRank(
    [{ importe: 5920.5 }, { importe: 16633.4 }],
    july,
  );
  assert.equal(june[0].statusPropuesto, 'NO_PICO');
  assert.equal(june[1].statusPropuesto, 'PICO');
});

test('derivePeakEnvelope ignores singleton outlier hours', () => {
  const envelope = derivePeakEnvelope({
    7: 11, 8: 2, 9: 8, 10: 21, 16: 13, 17: 12, 20: 5, 23: 1,
  });
  assert.equal(envelope.min, 7);
  assert.equal(envelope.max, 20);
});

test('classifyByHours: all-day span is NO_PICO, tight peak span is PICO', () => {
  const window = { min: 7, max: 20 };
  assert.equal(classifyByHours({ horaMin: 0.1, horaMax: 23.9 }, window).status, 'NO_PICO');
  assert.equal(classifyByHours({ horaMin: 7.0, horaMax: 19.5 }, window).status, 'PICO');
  assert.equal(classifyByHours({ horaMin: 11.0, horaMax: 11.0 }, window).status, 'PICO');
  assert.equal(classifyByHours({ horaMin: 22.0, horaMax: 23.0 }, window).status, 'SIN_PROPUESTA');
});

test('ILLIA II cat 7 June inherits ALTA from July pair + stable R', () => {
  const julyRef = {
    niveles: [
      { importe: 6044.83, status: 'NO_PICO', casos: 53 },
      { importe: 16982.69, status: 'PICO', casos: 19 },
    ],
    r: 16982.69 / 6044.83,
  };
  const rows = classifyFamilyMonth(
    {
      peaje: 'AUSA',
      estacion: 'ILLIA II',
      categoria: '7',
      mes: '2026-06',
      niveles: [
        { importe: 5920.5, casos: 58, horaMin: 1, horaMax: 23, tarifaNormalizadaId: 'a' },
        { importe: 16633.4, casos: 24, horaMin: 7, horaMax: 20, tarifaNormalizadaId: 'b' },
      ],
    },
    julyRef,
    { min: 7, max: 20 },
    { nextByRank: [6044.83, 16982.69] },
  );
  assert.equal(rows[0].statusPropuesto, 'NO_PICO');
  assert.equal(rows[1].statusPropuesto, 'PICO');
  assert.equal(rows[0].confianza, 'ALTA');
  assert.equal(rows[1].confianza, 'ALTA');
  assert.ok(rows[0].r > 2.8 && rows[0].r < 2.82);
  assert.equal(rows[0].rJulio, julyRef.r);
});

test('single all-day level with July NO_PICO-only is ALTA NO_PICO', () => {
  const rows = classifyFamilyMonth(
    {
      peaje: 'AUSA',
      estacion: 'PASEO DEL BAJO',
      categoria: '7',
      mes: '2026-03',
      niveles: [
        { importe: 8744.49, casos: 183, horaMin: 0, horaMax: 23, tarifaNormalizadaId: 'c' },
      ],
    },
    { niveles: [{ importe: 9935.82, status: 'NO_PICO', casos: 78 }], r: null },
    { min: 7, max: 20 },
    { nextByRank: [9935.82] },
  );
  assert.equal(rows[0].statusPropuesto, 'NO_PICO');
  assert.equal(rows[0].confianza, 'ALTA');
  assert.equal(rows[0].r, null);
});

test('single level inside peak window without July pair is MEDIA PICO', () => {
  const rows = classifyFamilyMonth(
    {
      peaje: 'AUSA',
      estacion: 'ILLIA II',
      categoria: '4',
      mes: '2026-06',
      niveles: [
        { importe: 3665, casos: 1, horaMin: 16, horaMax: 16, tarifaNormalizadaId: 'd' },
      ],
    },
    { niveles: [], r: null },
    { min: 7, max: 20 },
    { nextByRank: [] },
  );
  assert.equal(rows[0].statusPropuesto, 'PICO');
  assert.equal(rows[0].confianza, 'MEDIA');
});

test('validateJulyBlind reports coincidence of ranking vs manual labels', () => {
  const families = [
    {
      key: 'AUSA|ILLIA II|7',
      mes: '2026-07',
      niveles: [
        { importe: 6044.83, casos: 53, horaMin: 2, horaMax: 23, statusManual: 'NO_PICO' },
        { importe: 16982.69, casos: 19, horaMin: 7, horaMax: 20, statusManual: 'PICO' },
      ],
    },
  ];
  const report = validateJulyBlind(families, { min: 7, max: 20 });
  assert.equal(report.total, 2);
  assert.equal(report.coincidencias, 2);
  assert.equal(report.pct, 100);
});

test('three importes: cheaper ones NO_PICO, max PICO', () => {
  const rows = classifyFamilyMonth(
    {
      peaje: 'AUBASA',
      estacion: 'GUTIERREZ',
      categoria: '7',
      mes: '2026-06',
      niveles: [
        { importe: 13000, casos: 2, horaMin: 8, horaMax: 12, tarifaNormalizadaId: 'n1' },
        { importe: 14000, casos: 3, horaMin: 9, horaMax: 14, tarifaNormalizadaId: 'n2' },
        { importe: 16833.2, casos: 4, horaMin: 17, horaMax: 19, tarifaNormalizadaId: 'p' },
      ],
    },
    {
      niveles: [
        { importe: 13466.55, status: 'NO_PICO', casos: 1 },
        { importe: 14370.19, status: 'NO_PICO', casos: 3 },
        { importe: 16833.2, status: 'PICO', casos: 4 },
      ],
      r: 16833.2 / 13466.55,
    },
    { min: 7, max: 19 },
    { nextByRank: [13466.55, 14370.19, 16833.2] },
  );
  assert.equal(rows.find((r) => r.importe === 13000).statusPropuesto, 'NO_PICO');
  assert.equal(rows.find((r) => r.importe === 14000).statusPropuesto, 'NO_PICO');
  assert.equal(rows.find((r) => r.importe === 16833.2).statusPropuesto, 'PICO');
});

test('July reference month copies manual status as ALTA', () => {
  const out = classifyAll({
    niveles: [
      {
        peaje: 'AUSA',
        estacion: 'X',
        categoria: '2',
        mes: '2026-07',
        importe: 100,
        casos: 5,
        horaMin: 22,
        horaMax: 23,
        tarifaNormalizadaId: 'j',
        statusManual: 'NO_PICO',
      },
    ],
    histogramasPico: { AUSA: { 7: 5, 18: 5 } },
    mesReferencia: '2026-07',
  });
  assert.equal(out.propuesta[0].statusPropuesto, 'NO_PICO');
  assert.equal(out.propuesta[0].confianza, 'ALTA');
  assert.match(out.propuesta[0].motivo, /Referencia julio/);
});

test('classifyAll attaches CONFIRMAR empty and keeps tarifa id', () => {
  const out = classifyAll({
    niveles: [
      {
        peaje: 'AUSA',
        estacion: 'ILLIA II',
        categoria: '7',
        mes: '2026-07',
        importe: 6044.83,
        casos: 53,
        horaMin: 2,
        horaMax: 23,
        tarifaNormalizadaId: 'jul-np',
        statusManual: 'NO_PICO',
      },
      {
        peaje: 'AUSA',
        estacion: 'ILLIA II',
        categoria: '7',
        mes: '2026-07',
        importe: 16982.69,
        casos: 19,
        horaMin: 7,
        horaMax: 20,
        tarifaNormalizadaId: 'jul-p',
        statusManual: 'PICO',
      },
      {
        peaje: 'AUSA',
        estacion: 'ILLIA II',
        categoria: '7',
        mes: '2026-06',
        importe: 5920.5,
        casos: 58,
        horaMin: 1,
        horaMax: 23,
        tarifaNormalizadaId: 'jun-np',
        statusManual: null,
      },
      {
        peaje: 'AUSA',
        estacion: 'ILLIA II',
        categoria: '7',
        mes: '2026-06',
        importe: 16633.4,
        casos: 24,
        horaMin: 7,
        horaMax: 20,
        tarifaNormalizadaId: 'jun-p',
        statusManual: null,
      },
    ],
    histogramasPico: { AUSA: { 7: 11, 16: 13, 20: 5 } },
    mesReferencia: '2026-07',
  });
  const junio = out.propuesta.filter((r) => r.mes === '2026-06');
  assert.equal(junio.length, 2);
  assert.equal(junio.every((r) => r.confianza === 'ALTA'), true);
  assert.equal(junio.every((r) => r.confirmar === ''), true);
  assert.ok(junio.some((r) => r.tarifaNormalizadaId === 'jun-np'));
  assert.equal(out.control.julio.pct >= 95, true);
});
