import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRUZADO_XLSX = join(__dirname, 'out', 'tarifario-last-cruzado.xlsx');
const AUDIT_XLSX = join(__dirname, 'out', 'auditoria-catalogo-20260904.xlsx');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PARENT_A = '453bcee9-b134-40e8-8db8-fbd07bc17bef';
const PARENT_B = '28437846-7524-4de5-8ff5-ef5383eb0f16';
const PARENT_C = 'f5e8c23e-14be-468d-82da-548bcd932f42';
const LEGACY_A = 'f9597f66-b059-44d5-9bbe-6082cbdd7340';
const LEGACY_B = 'd94f53b4-1b4a-47b2-b7e2-d8f79682efe8';
const PEAJE_ID = 'ab449656-bebf-4cb2-bbb3-6221403e1c7b';
const ESTACION_A = '2ab8b3e2-a9ab-4577-b9c4-81a68c594edc';
const ESTACION_B = 'a12baa34-7a45-4612-aa4d-d3752637e68f';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const LAST_UPDATED = '2026-07-15 06:13:13+00';

async function loadEtl() {
  return import('./migrate-tarifario-v2.mjs');
}

function tarifa(partial = {}) {
  return {
    id: PARENT_A,
    peaje_id: PEAJE_ID,
    estacion_id: ESTACION_A,
    peaje_nombre: 'AUBASA',
    estacion_nombre: 'HUDSON',
    status: 'NO_PICO',
    categoria: 5,
    current_tarifa_id: '',
    sentido: 'AMBAS',
    ...partial,
  };
}

function importe(partial = {}) {
  return {
    id: LEGACY_A,
    tarifa_id: PARENT_A,
    importe: 3550,
    importe_base: 3550,
    fecha_aparicion: '2026-08-01 12:00:00+00',
    tarifas_normalizadas_id: LEGACY_A,
    ...partial,
  };
}

function cruzado(partial = {}) {
  return {
    PEAJE: 'AUBASA',
    ESTACION_QUERY: 'HUDSON',
    ESTACION_MATCH: 'HUDSON',
    CATEGORIA: 5,
    ESTADO_MATCH: 'CON_TARIFA',
    MOTIVO: 'AL_DIA',
    MATCH_LAST: 'TRUE',
    STATUS: 'NO_PICO',
    PRECIO: '$3.550,00',
    PRECIO_LAST: '$3.550,00',
    TARIFA_ID: PARENT_A,
    LAST_UPDATED: '2026-08-01 12:00:00+00',
    ...partial,
  };
}

function sheets(partial = {}) {
  return {
    tarifas: partial.tarifas || [tarifa()],
    tarifas_importe: partial.tarifas_importe || [importe()],
    cruzado: partial.cruzado || [cruzado()],
  };
}

function reportRow(report, parentId) {
  return report.find((r) => r.parent_id === parentId);
}

test('tarifas sheet IDs remain parent tarifas.id with UUID syntax and uniqueness', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets({
    tarifas: [
      tarifa({ id: PARENT_A, categoria: 5 }),
      tarifa({ id: PARENT_B, estacion_id: ESTACION_B, estacion_nombre: 'BERAZATEGUI', categoria: 3 }),
    ],
    tarifas_importe: [
      importe({ id: LEGACY_A, tarifa_id: PARENT_A, tarifas_normalizadas_id: LEGACY_A }),
      importe({ id: LEGACY_B, tarifa_id: PARENT_B, tarifas_normalizadas_id: LEGACY_B, importe: 2035.78 }),
    ],
    cruzado: [
      cruzado({ TARIFA_ID: PARENT_A }),
      cruzado({
        TARIFA_ID: PARENT_B,
        ESTACION_QUERY: 'BERAZATEGUI',
        PRECIO: '$2.035,78',
        PRECIO_LAST: '$2.035,78',
      }),
    ],
  }));
  const ids = result.tarifas.map((row) => row.id).sort();
  assert.deepEqual(ids, [PARENT_B, PARENT_A].sort());
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ids) assert.match(id, UUID_RE);
});

test('invalid parent UUID aborts', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas: [tarifa({ id: 'not-a-uuid' })],
    tarifas_importe: [importe({ tarifa_id: 'not-a-uuid' })],
    cruzado: [cruzado({ TARIFA_ID: 'not-a-uuid' })],
  })));
});

test('duplicate parent IDs abort', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas: [
      tarifa({ id: PARENT_A, categoria: 5 }),
      tarifa({ id: PARENT_A, categoria: 6 }),
    ],
    tarifas_importe: [
      importe({ tarifa_id: PARENT_A }),
    ],
    cruzado: [cruzado({ TARIFA_ID: PARENT_A })],
  })));
});

test('sentido is IDA, VUELTA or AMBAS and AMBAS is a real value', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets({
    tarifas: [
      tarifa({ id: PARENT_A, sentido: 'IDA', categoria: 5 }),
      tarifa({ id: PARENT_B, sentido: 'VUELTA', categoria: 5 }),
      tarifa({ id: PARENT_C, sentido: 'AMBAS', categoria: 6 }),
    ],
    tarifas_importe: [
      importe({ id: LEGACY_A, tarifa_id: PARENT_A, tarifas_normalizadas_id: LEGACY_A }),
      importe({ id: LEGACY_B, tarifa_id: PARENT_B, tarifas_normalizadas_id: LEGACY_B }),
      importe({
        id: '5920654c-67da-4107-9fbd-722c1a13427b',
        tarifa_id: PARENT_C,
        tarifas_normalizadas_id: '5920654c-67da-4107-9fbd-722c1a13427b',
      }),
    ],
    cruzado: [
      cruzado({ TARIFA_ID: PARENT_A }),
      cruzado({ TARIFA_ID: PARENT_B, CATEGORIA: 5 }),
      cruzado({ TARIFA_ID: PARENT_C, CATEGORIA: 6 }),
    ],
  }));
  const byId = new Map(result.tarifas.map((row) => [row.id, row]));
  assert.equal(byId.get(PARENT_A).sentido, 'IDA');
  assert.equal(byId.get(PARENT_B).sentido, 'VUELTA');
  assert.equal(byId.get(PARENT_C).sentido, 'AMBAS');
  assert.notEqual(byId.get(PARENT_C).sentido, '');
  assert.notEqual(byId.get(PARENT_C).sentido, null);
  assert.notEqual(byId.get(PARENT_C).sentido, 'UNKNOWN');
});

test('unknown sentido aborts', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas: [tarifa({ sentido: 'DESCONOCIDO' })],
  })));
});

test('one-to-one lineage keeps tarifa_importe.id equal to tarifas_normalizadas.id', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets());
  const hist = result.tarifa_importe.filter((row) => row.tarifas_normalizadas_id === LEGACY_A);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].id, LEGACY_A);
  assert.equal(hist[0].tarifa_id, PARENT_A);
});

test('one legacy id mapping to two amount rows aborts', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas_importe: [
      importe({ id: LEGACY_A, tarifa_id: PARENT_A, tarifas_normalizadas_id: LEGACY_A, importe: 3550 }),
      importe({
        id: LEGACY_B,
        tarifa_id: PARENT_A,
        tarifas_normalizadas_id: LEGACY_A,
        importe: 3600,
        fecha_aparicion: '2026-08-02 00:00:00+00',
      }),
    ],
  })));
});

test('one history id mapping to two parents aborts', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas: [
      tarifa({ id: PARENT_A, categoria: 5 }),
      tarifa({ id: PARENT_B, categoria: 6 }),
    ],
    tarifas_importe: [
      importe({ id: LEGACY_A, tarifa_id: PARENT_A, tarifas_normalizadas_id: LEGACY_A }),
      importe({ id: LEGACY_A, tarifa_id: PARENT_B, tarifas_normalizadas_id: LEGACY_B }),
    ],
    cruzado: [
      cruzado({ TARIFA_ID: PARENT_A }),
      cruzado({ TARIFA_ID: PARENT_B, CATEGORIA: 6 }),
    ],
  })));
});

test('parent ID colliding with a different configuration key aborts', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas: [
      tarifa({ id: PARENT_A, estacion_id: ESTACION_A, estacion_nombre: 'HUDSON', categoria: 5, sentido: 'AMBAS' }),
      tarifa({ id: PARENT_A, estacion_id: ESTACION_B, estacion_nombre: 'BERAZATEGUI', categoria: 3, sentido: 'IDA' }),
    ],
  })));
});

test('missing Cross TARIFA_ID aborts and does not invent a parent', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  assert.throws(() => parseTarifarioV2(sheets({
    cruzado: [cruzado({ TARIFA_ID: MISSING_ID })],
  })));
});

test('PRECIO_LAST stays the current importe when the compared price differs by 0.23%', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets({
    tarifas_importe: [
      importe({
        id: LEGACY_A,
        tarifa_id: PARENT_A,
        importe: 31427.15,
        importe_base: 31427.15,
        tarifas_normalizadas_id: LEGACY_A,
        fecha_aparicion: '2026-06-01 00:00:00+00',
      }),
    ],
    cruzado: [
      cruzado({
        PRECIO: '$31.427,15',
        PRECIO_LAST: '31500',
        LAST_UPDATED,
      }),
    ],
  }));
  const currentId = result.tarifas[0].current_tarifa_id;
  const current = result.tarifa_importe.find((row) => row.id === currentId);
  assert.equal(Number(current.importe), 31500);
  assert.notEqual(Number(current.importe), 31427.15);
  const legacy = result.tarifa_importe.find((row) => row.id === LEGACY_A);
  assert.equal(Number(legacy.importe), 31427.15);
});

test('Cross-only audited amount gets a fresh UUID, null lineage, LAST_UPDATED as fecha_aparicion, and becomes current', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets({
    tarifas_importe: [
      importe({
        id: LEGACY_A,
        tarifa_id: PARENT_A,
        importe: 31427.15,
        tarifas_normalizadas_id: LEGACY_A,
        fecha_aparicion: '2026-06-01 00:00:00+00',
      }),
    ],
    cruzado: [
      cruzado({
        PRECIO: '$31.427,15',
        PRECIO_LAST: '$31.500,00',
        LAST_UPDATED,
      }),
    ],
  }));
  const currentId = result.tarifas[0].current_tarifa_id;
  assert.match(currentId, UUID_RE);
  assert.notEqual(currentId, PARENT_A);
  assert.notEqual(currentId, LEGACY_A);
  const current = result.tarifa_importe.find((row) => row.id === currentId);
  assert.equal(current.tarifas_normalizadas_id, null);
  assert.equal(current.fecha_aparicion, LAST_UPDATED);
  assert.equal(Number(current.importe), 31500);
  assert.equal(current.tarifa_id, PARENT_A);
});

test('reconciliation report exposes parent, historical, legacy, audited amount, pointer and timestamp', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets());
  assert.ok(Array.isArray(result.report));
  const row = reportRow(result.report, PARENT_A) || result.report[0];
  assert.equal(row.parent_id, PARENT_A);
  assert.equal(row.historical_id, LEGACY_A);
  assert.equal(row.legacy_id, LEGACY_A);
  assert.equal(Number(row.audited_amount), 3550);
  assert.equal(row.chosen_pointer, result.tarifas[0].current_tarifa_id);
  assert.equal(row.source_timestamp, '2026-08-01 12:00:00+00');
});

test('reconciliation report is in-memory and must not land in migrations or overwrite the 20260904 audit workbook', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets());
  assert.ok(Array.isArray(result.report));
  assert.ok(existsSync(CRUZADO_XLSX));
  if (result.reportPath) {
    const path = String(result.reportPath).replace(/\\/g, '/');
    assert.ok(!path.includes('supabase/migrations/'));
    assert.notEqual(path, AUDIT_XLSX.replace(/\\/g, '/'));
    assert.ok(!path.endsWith('auditoria-catalogo-20260904.xlsx'));
  }
});

test('history importe raw ARS string is parsed with parseArs', async () => {
  const { parseTarifarioV2 } = await loadEtl();
  const result = parseTarifarioV2(sheets({
    tarifas_importe: [importe({ importe: '$3.550,00', importe_base: '$3.550,00' })],
  }));
  assert.equal(Number(result.tarifa_importe[0].importe), 3550);
  assert.equal(Number(result.tarifa_importe[0].importe_base), 3550);
});

test('history cases is a non-negative integer snapshot and defaults to zero', async () => {
  const { buildLocalLoadSql, parseTarifarioV2 } = await loadEtl();
  const explicit = parseTarifarioV2(sheets({
    tarifas_importe: [importe({ cases: 17 })],
  }));
  assert.equal(explicit.tarifa_importe[0].cases, 17);

  const defaulted = parseTarifarioV2(sheets({
    tarifas_importe: [importe({ cases: undefined })],
  }));
  assert.equal(defaulted.tarifa_importe[0].cases, 0);

  assert.throws(() => parseTarifarioV2(sheets({
    tarifas_importe: [importe({ cases: -1 })],
  })), /cases/i);
  assert.throws(() => parseTarifarioV2(sheets({
    tarifas_importe: [importe({ cases: 1.5 })],
  })), /cases/i);

  const { sql } = buildLocalLoadSql(explicit);
  assert.match(sql, /hora_media, cases, fecha_aparicion/);
  assert.match(sql, /hora_media, cases, fecha_aparicion,[\s\S]*?\n\s*17,\n\s*'2026-08-01/);
});

test('assertLocalDbUrl accepts loopback and rejects DESARROLLO', async () => {
  const { assertLocalDbUrl } = await loadEtl();
  assert.equal(
    assertLocalDbUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  );
  assert.throws(() => assertLocalDbUrl('postgresql://postgres@kfffigvyvtzyczeiadxh.supabase.co:5432/postgres'));
  assert.throws(() => assertLocalDbUrl('https://kfffigvyvtzyczeiadxh.supabase.co'));
});

test('splitSentidoCollisions keeps directional collisions unresolved without cloning history', async () => {
  const { splitSentidoCollisions } = await loadEtl();
  const split = splitSentidoCollisions(
    [
      tarifa({ id: PARENT_A, sentido: 'IDA', categoria: 5 }),
      tarifa({ id: PARENT_A, sentido: 'VUELTA', categoria: 5 }),
    ],
    [cruzado({ TARIFA_ID: PARENT_A })],
  );
  assert.equal(split.remapped.length, 1);
  assert.equal(split.remapped[0].from, PARENT_A);
  assert.equal(split.remapped[0].sentido, 'VUELTA');
  assert.notEqual(split.remapped[0].to, PARENT_A);
  const ids = split.tarifas.map((row) => row.id);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.equal(split.tarifas.find((row) => row.id === split.remapped[0].to).current_tarifa_id, null);
  assert.equal(split.cruzado.length, 1);
  assert.equal(split.cruzado[0].TARIFA_ID, PARENT_A);
  assert.equal(split.unresolved.length, 1);
  assert.equal(split.unresolved[0].reason, 'DIRECTIONAL_HISTORY_COLLISION');
});
