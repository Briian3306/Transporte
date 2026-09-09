/**
 * F05-1 — Caso end-to-end PRD §21 + ejemplo 10 filas (total 102060).
 * Uso: npx --yes tsx src/app/components/peajes/e2e-prd21.verify.ts
 *
 * Integra: motor Strategy (03) + sugerencia estación/peaje (lógica catálogo 02)
 * + validación de totales factura. Persistencia RPC cubierta por pgTAP F01-9.
 */
import { crearMotor } from './plantillas/motor/peajes-motor-transformacion.service';
import {
  FILA_EJEMPLO_PRD_21,
  buildPlantillaDemoProveedor,
} from './plantillas/mocks/peajes-plantillas.mock';
import { AlgoritmoCombinado } from './models/peajes.models';
import { GLOBAL_EMPRESA_ID } from './plantillas/mocks/peajes-plantillas.mock';
import { PeajesCatalogoMockService } from './wizard/mocks/peajes-catalogo.mock';
import { firstValueFrom } from 'rxjs';

/** 10 registros del ejemplo MVP (docs/plan/ejemplo-mvp-procesamiento-pasadas.md). */
const FILAS_EJEMPLO_10: Record<string, unknown>[] = [
  { FECHA: '25/06/2026', HORA: '205005', ESTACION: '3', DISPOSITIVON: 98702170, DOMINIO: 'AD625QB', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '25/06/2026', HORA: '085557', ESTACION: '3', DISPOSITIVON: 99837024, DOMINIO: 'AB456CU', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '21/06/2026', HORA: '202641', ESTACION: '3', DISPOSITIVON: 94911721, DOMINIO: 'AE831SI', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '10/07/2026', HORA: '135742', ESTACION: '3', DISPOSITIVON: 97010413, DOMINIO: 'AE469PH', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '01/07/2026', HORA: '131115', ESTACION: '3', DISPOSITIVON: 94931038, DOMINIO: 'AE952TH', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '01/07/2026', HORA: '121934', ESTACION: '3', DISPOSITIVON: 92093802, DOMINIO: 'AD985XP', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '01/07/2026', HORA: '120901', ESTACION: '3', DISPOSITIVON: 97010413, DOMINIO: 'AE469PH', TARIFA: 17400, BONIFICACION: 5220 },
  { FECHA: '22/06/2026', HORA: '120252', ESTACION: '2', DISPOSITIVON: 96073469, DOMINIO: 'AB151SM', TARIFA: 6600, BONIFICACION: 1980 },
  { FECHA: '29/06/2026', HORA: '104329', ESTACION: '1', DISPOSITIVON: 99793212, DOMINIO: 'AG507DK', TARIFA: 6600, BONIFICACION: 1980 },
  { FECHA: '29/06/2026', HORA: '105159', ESTACION: '5', DISPOSITIVON: 94402656, DOMINIO: 'AC295IE', TARIFA: 17400, BONIFICACION: 9840 },
];

const EXPECTED_ESTACION: Record<string, string> = {
  '3': 'EST-096',
  '2': 'EST-092',
  '1': 'EST-091',
  '5': 'EST-095',
};

const algoritmos: AlgoritmoCombinado[] = [
  {
    id: 'alg-normalizar-patente',
    nombre: 'NORMALIZAR_PATENTE',
    empresa_id: GLOBAL_EMPRESA_ID,
    estado: 'activa',
    pasos: [
      { id: '1', algoritmo_combinado_id: 'alg-normalizar-patente', orden: 1, algoritmo_codigo: 'BORRAR_ESPACIOS' },
      { id: '2', algoritmo_combinado_id: 'alg-normalizar-patente', orden: 2, algoritmo_codigo: 'ELIMINAR_GUIONES' },
      { id: '3', algoritmo_combinado_id: 'alg-normalizar-patente', orden: 3, algoritmo_codigo: 'CONVERTIR_MAYUSCULAS' },
    ],
  },
  {
    id: 'alg-combinar-fecha-hora',
    nombre: 'COMBINAR_FECHA_HORA',
    empresa_id: GLOBAL_EMPRESA_ID,
    estado: 'activa',
    pasos: [
      {
        id: '1',
        algoritmo_combinado_id: 'alg-combinar-fecha-hora',
        orden: 1,
        algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
        parametros: { columnas: ['FECHA', 'HORA'], formato_hora: 'HHMMSS' },
      },
    ],
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

async function main(): Promise<void> {
  const motor = crearMotor();
  const plantilla = buildPlantillaDemoProveedor(
    'alg-normalizar-patente',
    'alg-combinar-fecha-hora'
  );
  const catalogo = new PeajesCatalogoMockService();

  console.log('F05-1 §21.3 registro único');
  assert(
    FILAS_EJEMPLO_10[0]['DISPOSITIVON'] === FILA_EJEMPLO_PRD_21['DISPOSITIVON'],
    'primera fila = caso §21 (DISPOSITIVON)'
  );

  const [row] = motor.aplicarPipeline(
    [FILAS_EJEMPLO_10[0]],
    plantilla.configuraciones ?? [],
    algoritmos
  );
  assert(row['FECHA_HORA'] === '2026-06-25 20:50:05', 'FECHA_HORA');
  assert(row['PASE_ID'] === '98702170', 'PASE_ID');
  assert(row['PATENTE_ID'] === 'AD625QB', 'PATENTE_ID');
  assert(Number(row['IMPORTE_NETO']) === 12180, 'IMPORTE_NETO');

  const estList = await firstValueFrom(catalogo.sugerirEstacion('3'));
  const est = estList[0];
  assert(est?.id === 'EST-096', 'código 3 → EST-096');
  assert(est?.peaje_id === 'PEA-001', 'estación → PEA-001');
  assert(est?.nombre === 'Monte Grande', 'estación Monte Grande');

  console.log('F05-1 ejemplo 10 filas + total factura');
  const rows = motor.aplicarPipeline(
    FILAS_EJEMPLO_10,
    plantilla.configuraciones ?? [],
    algoritmos
  );
  assert(rows.length === 10, '10 filas procesadas');

  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const codigoEst = String(FILAS_EJEMPLO_10[i]['ESTACION']);
    const sugeridas = await firstValueFrom(catalogo.sugerirEstacion(codigoEst));
    const sugerida = sugeridas[0];
    const expectedId = EXPECTED_ESTACION[codigoEst];
    assert(sugerida?.id === expectedId, `fila ${i + 1}: estación ${codigoEst} → ${expectedId}`);
    assert(sugerida?.peaje_id === 'PEA-001', `fila ${i + 1}: peaje PEA-001`);
    total += Number(r['IMPORTE_NETO'] ?? 0);
  }

  assert(total === 102060, `suma IMPORTE_NETO = 102060 (got ${total})`);

  const facturaSinIva = 102060;
  assert(total === facturaSinIva, 'total pasadas = Importe_SIN_IVA factura');

  console.log('\nPASS: F05-1 E2E PRD §21 + ejemplo 10 filas (motor + estación/peaje + total)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
