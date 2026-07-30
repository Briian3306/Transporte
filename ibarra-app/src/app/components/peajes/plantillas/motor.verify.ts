/**
 * Verificación aislada del motor (§21) sin Karma.
 * Uso: npx --yes tsx src/app/components/peajes/plantillas/motor.verify.ts
 * Motivo: ng test bloqueado por errores TS en catalogos/** (agente 02).
 */
import { crearMotor } from './motor/peajes-motor-transformacion.service';
import {
  FILA_EJEMPLO_PRD_21,
  buildPlantillaDemoProveedor,
} from './mocks/peajes-plantillas.mock';
import { AlgoritmoCombinado } from '../models/peajes.models';
import {
  puedeAplicarRecurso,
  validarPublicacionAlgoritmo,
  validarPublicacionPlantilla,
} from './validacion/plantillas-validacion';
import { GLOBAL_EMPRESA_ID } from './mocks/peajes-plantillas.mock';

const algoritmos: AlgoritmoCombinado[] = [
  {
    id: 'alg-normalizar-patente',
    nombre: 'NORMALIZAR_PATENTE',
    empresa_id: GLOBAL_EMPRESA_ID,
    estado: 'activa',
    pasos: [
      {
        id: '1',
        algoritmo_combinado_id: 'alg-normalizar-patente',
        orden: 1,
        algoritmo_codigo: 'BORRAR_ESPACIOS',
      },
      {
        id: '2',
        algoritmo_combinado_id: 'alg-normalizar-patente',
        orden: 2,
        algoritmo_codigo: 'ELIMINAR_GUIONES',
      },
      {
        id: '3',
        algoritmo_combinado_id: 'alg-normalizar-patente',
        orden: 3,
        algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
      },
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

function main(): void {
  const motor = crearMotor();
  const plantilla = buildPlantillaDemoProveedor(
    'alg-normalizar-patente',
    'alg-combinar-fecha-hora'
  );

  console.log('F03-1 motor §21');
  const [row] = motor.aplicarPipeline(
    [FILA_EJEMPLO_PRD_21],
    plantilla.configuraciones ?? [],
    algoritmos
  );
  assert(row['FECHA_HORA'] === '2026-06-25 20:50:05', 'FECHA_HORA');
  assert(row['PASE_ID'] === '98702170', 'PASE_ID');
  assert(row['PATENTE_ID'] === 'AD625QB', 'PATENTE_ID');
  assert(row['IMPORTE_NETO'] === 12180, 'IMPORTE_NETO');

  console.log('F03-1 patente dirty + hora pad');
  const [row2] = motor.aplicarPipeline(
    [{ ...FILA_EJEMPLO_PRD_21, DOMINIO: ' ad-625-qb ', HORA: '85557' }],
    plantilla.configuraciones ?? [],
    algoritmos
  );
  assert(row2['PATENTE_ID'] === 'AD625QB', 'patente normalizada');
  assert(row2['FECHA_HORA'] === '2026-06-25 08:55:57', 'hora padded');

  console.log('F03-4 compatibilidad');
  const faltan = motor.validarCompatibilidad(plantilla.configuraciones ?? [], [
    'FECHA',
    'DOMINIO',
  ]);
  assert(faltan.length > 0, 'columnas faltantes informadas');

  console.log('F03-5/6 expand NORMALIZAR_PATENTE');
  const exp = motor.expandirAlgoritmo(algoritmos[0]);
  assert(
    exp.map((p) => p.algoritmoCodigo).join(',') ===
      'BORRAR_ESPACIOS,ELIMINAR_GUIONES,CONVERTIR_MAYUSCULAS',
    'expansión NORMALIZAR_PATENTE'
  );

  console.log('F03-5 registry reject');
  const bad = validarPublicacionAlgoritmo(
    { nombre: 'X', empresa_id: 'e' },
    [{ orden: 1, algoritmo_codigo: 'NO_EXISTE' }],
    motor.getRegistry()
  );
  assert(!bad.ok, 'rechaza código no registrado');

  console.log('F03-7 validación publicación');
  const dup = validarPublicacionPlantilla(
    { nombre: 'X', empresa_id: 'e', estado: 'activa' },
    [
      {
        nombre_columna: 'A',
        orden: 1,
        tipo: 'mapeo',
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA' },
      },
      {
        nombre_columna: 'B',
        orden: 1,
        tipo: 'mapeo',
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA' },
      },
    ],
    motor.getRegistry()
  );
  assert(!dup.ok, 'bloquea orden duplicado');

  console.log('F03-8 alcance empresa');
  assert(!puedeAplicarRecurso('empresa-a', 'empresa-b'), 'A no aplica a B');
  assert(puedeAplicarRecurso(GLOBAL_EMPRESA_ID, 'empresa-b'), 'global sí');

  console.log('\nPASS: verificación motor/plantillas F03');
}

main();
