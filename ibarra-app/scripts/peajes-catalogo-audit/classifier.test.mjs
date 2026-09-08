import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCategoryList,
  categoriesMissing,
  classifyCatalogue,
} from './classifier.mjs';

function row(partial) {
  return {
    Tarifa_Normalizada_ID: partial.id ?? 'id-' + Math.random().toString(16).slice(2),
    Peaje_ID: partial.peajeId,
    Estacion_ID: partial.stationId,
    Peaje_Nombre: partial.peaje,
    Estacion_Nombre: partial.station,
    Categoria: String(partial.category ?? ''),
    Categoria_Calculated: '',
    Categoria_Normalizada: String(partial.category),
    fecha_aparicion: partial.fecha ?? '2026-01-01 00:00:00+00',
    Importe: String(partial.importe ?? 1000),
    Importe_Base: String(partial.importe ?? 1000),
    Cases: String(partial.cases ?? 10),
    Status: partial.status,
    Patron: partial.patron ?? 'B',
    Confirmado_Manual: partial.confirmado == null ? 'true' : String(partial.confirmado),
    Diagnostico: partial.diagnostico ?? 'CONFIRMADO',
    Hora_Min: partial.horaMin ?? '8',
    Hora_Max: partial.horaMax ?? '18',
    Hora_Media: '12',
    Multiplicador: '1',
    Desvio: '1',
    Muestra_Confiable: 'true',
    created_at: '2026-08-01 00:00:00+00',
  };
}

function bothStatuses(base, categories) {
  const out = [];
  for (const category of categories) {
    out.push(row({ ...base, category, status: 'PICO', importe: 2000 + category }));
    out.push(row({ ...base, category, status: 'NO_PICO', importe: 1000 + category }));
  }
  return out;
}

function findRow(catalogue, station, status, category) {
  return catalogue.find(
    (r) => r.STATION_NOMBRE === station
      && r.STATUS === status
      && Number(r.CATEGORY) === Number(category),
  );
}

function aubasaFixture() {
  return [
    ...bothStatuses({ peajeId: 'aubasa', stationId: 'hudson', peaje: 'AUBASA', station: 'HUDSON' }, [2, 3, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'aubasa', stationId: 'dock', peaje: 'AUBASA', station: 'DOCK SUD' }, [2, 3, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'aubasa', stationId: 'gutierrez', peaje: 'AUBASA', station: 'GUTIERREZ' }, [2, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'aubasa', stationId: 'bera', peaje: 'AUBASA', station: 'BERAZATEGUI' }, [3, 6, 7]),
    row({ peajeId: 'aubasa', stationId: 'maipu', peaje: 'AUBASA', station: 'MAIPU', category: 5, status: 'NO_PICO', importe: 31000 }),
    row({ peajeId: 'aubasa', stationId: 'maipu', peaje: 'AUBASA', station: 'MAIPU', category: 6, status: 'NO_PICO', importe: 36000 }),
  ];
}

test('formatCategoryList uses 1-N when consecutive from 1, otherwise an explicit list', () => {
  assert.equal(formatCategoryList([1, 2, 3, 4, 5]), '1-5');
  assert.equal(formatCategoryList([1, 2, 3, 4, 5, 6, 7]), '1-7');
  assert.equal(formatCategoryList([2, 3, 5, 6, 7]), '2,3,5,6,7');
  assert.equal(formatCategoryList([2, 4, 7, 8, 9]), '2,4,7,8,9');
});

test('categoriesMissing is expected minus detected', () => {
  assert.equal(categoriesMissing([2, 3, 5, 6, 7], [3, 6, 7]), '2,5');
  assert.equal(categoriesMissing([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), '');
  assert.equal(categoriesMissing([2, 4, 7, 8, 9], [2]), '4,7,8,9');
});

test('clean dual-status rows have blank DIAGNOSTIC and no missing flags', () => {
  const { catalogue } = classifyCatalogue(aubasaFixture());
  const hudsonPico2 = findRow(catalogue, 'HUDSON', 'PICO', 2);
  const hudsonOff2 = findRow(catalogue, 'HUDSON', 'NO_PICO', 2);
  assert.ok(hudsonPico2);
  assert.ok(hudsonOff2);
  assert.equal(hudsonPico2.DIAGNOSTIC, '');
  assert.equal(hudsonOff2.DIAGNOSTIC, '');
  assert.equal(hudsonPico2.MISSING_CATEGORY, '');
  assert.equal(hudsonPico2.MISSING_STATUS, '');
  assert.equal(hudsonPico2.REVIEW_REQUIRED, '');
  assert.equal(hudsonPico2.REFERENCE_PATTERN, '');
  assert.equal(hudsonPico2.IMPORTE, 2002);
  assert.equal(hudsonPico2.ROW_TYPE, 'EXISTING');
});

test('Catalogue Summary emits blank modificated for a generated audit', () => {
  const { summary } = classifyCatalogue(aubasaFixture());
  assert.ok(summary.length);
  assert.equal(summary[0].modificated, '');
  assert.ok(Object.prototype.hasOwnProperty.call(summary[0], 'modificated'));
});

test('BERAZATEGUI missing cat 2 emits PICO and NO_PICO gap rows with expected delta', () => {
  const { catalogue } = classifyCatalogue(aubasaFixture());
  const pico = findRow(catalogue, 'BERAZATEGUI', 'PICO', 2);
  const off = findRow(catalogue, 'BERAZATEGUI', 'NO_PICO', 2);
  assert.ok(pico);
  assert.ok(off);
  assert.equal(pico.ROW_TYPE, 'SUSPECTED_GAP');
  assert.equal(off.ROW_TYPE, 'SUSPECTED_GAP');
  assert.equal(pico.IMPORTE, '');
  assert.equal(off.IMPORTE, '');
  assert.equal(pico.MISSING_CATEGORY, 'TRUE');
  assert.equal(off.MISSING_CATEGORY, 'TRUE');
  assert.equal(pico.DIAGNOSTIC, 'Missing category 2');
  assert.equal(off.DIAGNOSTIC, "Missing category 2, because have PICO and doesn't have NO_PICO");
  assert.equal(pico.CATEGORIES_DETECTED, '3,6,7');
  assert.equal(pico.EXPECTED_CATEGORIES, '2,3,5,6,7');
  assert.equal(pico.CATEGORIES_MISSING, '2,5');
  assert.equal(pico.EXPECTED_STATUSES, 'PICO+NO_PICO');
  assert.match(pico.REFERENCE_PATTERN, /HUDSON/);
});

test('existing BERAZATEGUI cat 6 stays silent even when the station has other holes', () => {
  const { catalogue } = classifyCatalogue(aubasaFixture());
  const existing = findRow(catalogue, 'BERAZATEGUI', 'NO_PICO', 6);
  assert.ok(existing);
  assert.equal(existing.ROW_TYPE, 'EXISTING');
  assert.equal(existing.DIAGNOSTIC, '');
  assert.equal(existing.MISSING_CATEGORY, '');
  assert.equal(existing.CATEGORIES_MISSING, '2,5');
});

test('CAMINO REAL missing NO_PICO counterpart keeps existing PICO silent', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'ausol', stationId: 'campana', peaje: 'AUSOL', station: 'CAMPANA' }, [2, 3, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'ausol', stationId: 'ruta197', peaje: 'AUSOL', station: 'RUTA 197' }, [2, 3, 6, 7]),
    row({ peajeId: 'ausol', stationId: 'camino', peaje: 'AUSOL', station: 'CAMINO REAL', category: 6, status: 'PICO', importe: 3976.59 }),
  ];
  const { catalogue } = classifyCatalogue(rows);
  const existing = findRow(catalogue, 'CAMINO REAL', 'PICO', 6);
  const gap = findRow(catalogue, 'CAMINO REAL', 'NO_PICO', 6);
  assert.ok(existing);
  assert.ok(gap);
  assert.equal(existing.DIAGNOSTIC, '');
  assert.equal(existing.MISSING_STATUS, '');
  assert.equal(gap.MISSING_STATUS, 'TRUE');
  assert.equal(gap.MISSING_CATEGORY, '');
  assert.equal(gap.ROW_TYPE, 'SUSPECTED_GAP');
  assert.equal(gap.DIAGNOSTIC, "Missing category 6, because have PICO and doesn't have NO_PICO");
});

test('Corredores flat cluster expects 1-5 and a single NO_PICO gap row', () => {
  const rows = [
    ...[1, 3, 4, 5].map((category) => row({
      peajeId: 'cvsa',
      stationId: 'zarate',
      peaje: 'CORREDORES VIALES SA',
      station: 'ZARATE - RUTA 9 KM. 95',
      category,
      status: 'NO_PICO',
    })),
    ...[1, 2, 3, 4, 5].map((category) => row({
      peajeId: 'cvsa',
      stationId: 'olivera',
      peaje: 'CORREDORES VIALES SA',
      station: 'OLIVERA - RUTA 5 KM. 86',
      category,
      status: 'NO_PICO',
    })),
    ...[1, 2, 3, 4, 5].map((category) => row({
      peajeId: 'cvsa',
      stationId: 'lagos',
      peaje: 'CORREDORES VIALES SA',
      station: 'LAGOS - RUTA 9 KM. 272',
      category,
      status: 'NO_PICO',
    })),
  ];
  const { catalogue } = classifyCatalogue(rows);
  const existing = findRow(catalogue, 'ZARATE - RUTA 9 KM. 95', 'NO_PICO', 3);
  const gap = findRow(catalogue, 'ZARATE - RUTA 9 KM. 95', 'NO_PICO', 2);
  const picoGap = findRow(catalogue, 'ZARATE - RUTA 9 KM. 95', 'PICO', 2);
  assert.equal(existing.DIAGNOSTIC, '');
  assert.equal(existing.EXPECTED_CATEGORIES, '1-5');
  assert.equal(existing.CATEGORIES_MISSING, '2');
  assert.equal(existing.EXPECTED_STATUSES, 'NO_PICO');
  assert.ok(gap);
  assert.equal(gap.MISSING_CATEGORY, 'TRUE');
  assert.equal(gap.DIAGNOSTIC, 'Missing category 2');
  assert.equal(picoGap, undefined);
});

test('Corredores urban dual-status cluster expects 1-7 not rural 1-5', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'cvsa', stationId: 'ricchieri', peaje: 'CORREDORES VIALES SA', station: 'RICCHIERI' }, [1, 2, 3, 4, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'cvsa', stationId: 'tristan', peaje: 'CORREDORES VIALES SA', station: 'TRISTAN SUAREZ' }, [2, 3, 4, 5, 6, 7]),
    ...bothStatuses({ peajeId: 'cvsa', stationId: 'monte', peaje: 'CORREDORES VIALES SA', station: 'MONTE GRANDE' }, [2, 4, 6, 7]),
    ...[1, 2, 3, 4, 5].map((category) => row({
      peajeId: 'cvsa',
      stationId: 'zarate',
      peaje: 'CORREDORES VIALES SA',
      station: 'ZARATE - RUTA 9 KM. 95',
      category,
      status: 'NO_PICO',
    })),
  ];
  const { catalogue, summary } = classifyCatalogue(rows);
  const ricchieri = findRow(catalogue, 'RICCHIERI', 'PICO', 7);
  const zarate = findRow(catalogue, 'ZARATE - RUTA 9 KM. 95', 'NO_PICO', 1);
  assert.equal(ricchieri.EXPECTED_CATEGORIES, '1-7');
  assert.equal(ricchieri.EXPECTED_STATUSES, 'PICO+NO_PICO');
  assert.equal(zarate.EXPECTED_CATEGORIES, '1-5');
  assert.equal(zarate.EXPECTED_STATUSES, 'NO_PICO');
  const tristanSummary = summary.find((s) => s.STATION_NOMBRE === 'TRISTAN SUAREZ');
  assert.equal(tristanSummary.categories_missing, '1');
  const zarateExisting = findRow(catalogue, 'ZARATE - RUTA 9 KM. 95', 'NO_PICO', 3);
  assert.equal(zarateExisting.REVIEW_REQUIRED, '');
  assert.equal(zarateExisting.DIAGNOSTIC, '');
});

test('AUSA expected set is peer-majority 2,4,7,8,9 not 1-7', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'ausa', stationId: 'illia', peaje: 'AUSA', station: 'ILLIA II' }, [2, 4, 7, 8, 9]),
    ...bothStatuses({ peajeId: 'ausa', stationId: 'varela', peaje: 'AUSA', station: 'VARELA' }, [2, 4, 7, 8, 9]),
    ...bothStatuses({ peajeId: 'ausa', stationId: 'delle', peaje: 'AUSA', station: 'DELLEPIANE I' }, [2, 4, 6, 7, 8, 9]),
    row({ peajeId: 'ausa', stationId: 'alberti', peaje: 'AUSA', station: 'ALBERTI', category: 2, status: 'NO_PICO', importe: 1044.26 }),
  ];
  const { catalogue } = classifyCatalogue(rows);
  const illia = findRow(catalogue, 'ILLIA II', 'NO_PICO', 7);
  assert.equal(illia.EXPECTED_CATEGORIES, '2,4,7,8,9');
  assert.equal(illia.CATEGORIES_MISSING, '');
  assert.equal(findRow(catalogue, 'ILLIA II', 'NO_PICO', 1), undefined);
  assert.equal(findRow(catalogue, 'ILLIA II', 'NO_PICO', 3), undefined);

  const alberti = findRow(catalogue, 'ALBERTI', 'NO_PICO', 2);
  assert.equal(alberti.CATEGORIES_MISSING, '4,7,8,9');
  assert.equal(alberti.REVIEW_REQUIRED, 'TRUE');
  assert.match(alberti.DIAGNOSTIC, /Sparse station/);
  assert.equal(findRow(catalogue, 'ALBERTI', 'NO_PICO', 4), undefined);
  assert.equal(findRow(catalogue, 'ALBERTI', 'PICO', 2), undefined);
});

test('MAIPU known-flat station does not invent PICO rows', () => {
  const { catalogue } = classifyCatalogue(aubasaFixture());
  const maipu = findRow(catalogue, 'MAIPU', 'NO_PICO', 5);
  assert.ok(maipu);
  assert.equal(maipu.REVIEW_REQUIRED, 'TRUE');
  assert.equal(findRow(catalogue, 'MAIPU', 'PICO', 5), undefined);
});

test('latest IMPORTE wins by fecha_aparicion and HISTORIAL keeps both amounts', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'ausol', stationId: 'campana', peaje: 'AUSOL', station: 'CAMPANA' }, [2, 3, 5, 6, 7]),
    row({
      peajeId: 'ausol',
      stationId: 'campana',
      peaje: 'AUSOL',
      station: 'CAMPANA',
      category: 2,
      status: 'NO_PICO',
      importe: 4000,
      fecha: '2026-03-01 00:00:00+00',
      id: 'old',
    }),
    row({
      peajeId: 'ausol',
      stationId: 'campana',
      peaje: 'AUSOL',
      station: 'CAMPANA',
      category: 2,
      status: 'NO_PICO',
      importe: 4970.74,
      fecha: '2026-04-24 11:40:13+00',
      id: 'new',
    }),
  ];
  const { catalogue } = classifyCatalogue(rows);
  const campana = findRow(catalogue, 'CAMPANA', 'NO_PICO', 2);
  assert.equal(campana.IMPORTE, 4970.74);
  assert.equal(campana.TARIFA_NORMALIZADA_ID, 'new');
  assert.ok(campana.N_IMPORTES >= 2);
  assert.match(String(campana.HISTORIAL), /4970\.74@2026-04-24/);
});

test('PENDIENTE-only category is REVIEW_REQUIRED and not treated as a third catalogue status when PICO/NO_PICO exist', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'ausa', stationId: 'illia', peaje: 'AUSA', station: 'ILLIA II' }, [2, 4, 7, 8, 9]),
    row({
      peajeId: 'ausa',
      stationId: 'illia',
      peaje: 'AUSA',
      station: 'ILLIA II',
      category: 2,
      status: 'PENDIENTE',
      importe: 2073.77,
      fecha: '2026-08-04 08:38:29+00',
    }),
  ];
  const { catalogue } = classifyCatalogue(rows);
  assert.equal(findRow(catalogue, 'ILLIA II', 'PENDIENTE', 2), undefined);
  const existing = findRow(catalogue, 'ILLIA II', 'NO_PICO', 2);
  assert.ok(existing);
  assert.equal(existing.STATUS, 'NO_PICO');
});

test('category that exists only as PENDIENTE stays REVIEW_REQUIRED', () => {
  const rows = [
    ...bothStatuses({ peajeId: 'ausa', stationId: 'illia', peaje: 'AUSA', station: 'ILLIA II' }, [2, 4, 7, 8, 9]),
    row({
      peajeId: 'ausa',
      stationId: 'illia',
      peaje: 'AUSA',
      station: 'ILLIA II',
      category: 5,
      status: 'PENDIENTE',
      importe: 8000,
    }),
  ];
  const { catalogue } = classifyCatalogue(rows);
  const pending = findRow(catalogue, 'ILLIA II', 'PENDIENTE', 5);
  assert.ok(pending);
  assert.equal(pending.REVIEW_REQUIRED, 'TRUE');
  assert.ok(pending.DIAGNOSTIC);
});
