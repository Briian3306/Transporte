import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv } from './parse-csv.mjs';

test('parseCsv keeps commas inside quoted station names', () => {
  const text = [
    'Peaje_Nombre,Estacion_Nombre,Importe',
    'AUBASA,HUDSON,1000',
    '"CONEXION ALTO DELTA S.A.","ISLA LA DESEADA - RUTA 174 KM 5,2 (Pte. Rosario-Victoria)",500',
  ].join('\n');
  const rows = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Estacion_Nombre, 'HUDSON');
  assert.equal(rows[1].Estacion_Nombre, 'ISLA LA DESEADA - RUTA 174 KM 5,2 (Pte. Rosario-Victoria)');
  assert.equal(rows[1].Importe, '500');
});
