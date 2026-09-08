/** Split pwbi_tarifas rows into future tablas tarifas + tarifas_importe. No Supabase. */

import { createHash } from 'node:crypto';

export const TARIFAS_HEADERS = [
  'id',
  'peaje_id',
  'estacion_id',
  'peaje_nombre',
  'estacion_nombre',
  'status',
  'categoria',
  'patron',
];

export const IMPORTE_HEADERS = [
  'id',
  'tarifa_id',
  'importe',
  'importe_base',
  'cases',
  'multiplicador',
  'desvio',
  'hora_min',
  'hora_max',
  'hora_media',
  'diagnostico',
  'muestra_confiable',
  'confirmado_manual',
  'fecha_aparicion',
  'tarifas_normalizadas_id',
];

export const MODEL_SHEETS = ['tarifas', 'tarifas_importe'];

function parseNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function comboKey(peajeId, estacionId, status, categoria) {
  return `${peajeId}|${estacionId}|${status}|${categoria}`;
}

export function tarifaIdFor(peajeId, estacionId, status, categoria) {
  const hex = createHash('sha1')
    .update(comboKey(peajeId, estacionId, status, categoria))
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function statusOrder(status) {
  if (status === 'PICO') return 0;
  if (status === 'NO_PICO') return 1;
  return 2;
}

export function splitPwbiRows(rows) {
  const tarifasByKey = new Map();
  const tarifasImporte = [];

  for (const r of rows) {
    if (r.Status !== 'PICO' && r.Status !== 'NO_PICO') continue;
    const categoria = parseNum(r.Categoria_Normalizada);
    if (categoria == null) continue;
    const key = comboKey(r.Peaje_ID, r.Estacion_ID, r.Status, categoria);
    if (!tarifasByKey.has(key)) {
      tarifasByKey.set(key, {
        id: tarifaIdFor(r.Peaje_ID, r.Estacion_ID, r.Status, categoria),
        peaje_id: r.Peaje_ID,
        estacion_id: r.Estacion_ID,
        peaje_nombre: r.Peaje_Nombre,
        estacion_nombre: r.Estacion_Nombre,
        status: r.Status,
        categoria,
        patron: r.Patron || '',
      });
    }
    const tarifa = tarifasByKey.get(key);
    tarifasImporte.push({
      id: r.Tarifa_Normalizada_ID,
      tarifa_id: tarifa.id,
      importe: r.Importe,
      importe_base: r.Importe_Base,
      cases: r.Cases,
      multiplicador: r.Multiplicador,
      desvio: r.Desvio,
      hora_min: r.Hora_Min,
      hora_max: r.Hora_Max,
      hora_media: r.Hora_Media,
      diagnostico: r.Diagnostico,
      muestra_confiable: r.Muestra_Confiable,
      confirmado_manual: r.Confirmado_Manual,
      fecha_aparicion: r.fecha_aparicion,
      tarifas_normalizadas_id: r.Tarifa_Normalizada_ID,
    });
  }

  const tarifas = [...tarifasByKey.values()].sort((a, b) => (
    String(a.peaje_nombre).localeCompare(String(b.peaje_nombre))
    || String(a.estacion_nombre).localeCompare(String(b.estacion_nombre))
    || Number(a.categoria) - Number(b.categoria)
    || statusOrder(a.status) - statusOrder(b.status)
  ));

  tarifasImporte.sort((a, b) => String(a.fecha_aparicion).localeCompare(String(b.fecha_aparicion))
    || String(a.id).localeCompare(String(b.id)));

  return { tarifas, tarifasImporte };
}
