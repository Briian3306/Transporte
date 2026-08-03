/**
 * Verificación aislada del motor (§21) sin Karma.
 * Uso: npx --yes tsx src/app/components/peajes/plantillas/motor.verify.ts
 * Motivo: ng test bloqueado por errores TS en catalogos/** (agente 02).
 */
import { crearMotor } from './motor/peajes-motor-transformacion.service';
import {
  FILA_EJEMPLO_PRD_21,
  buildPlantillaDemoProveedor,
  GLOBAL_EMPRESA_ID,
} from './mocks/peajes-plantillas.mock';
import { AlgoritmoCombinado, ConfiguracionPlantilla } from '../models/peajes.models';
import {
  puedeAplicarRecurso,
  validarPublicacionAlgoritmo,
  validarPublicacionPlantilla,
} from './validacion/plantillas-validacion';
import { MVP_FILAS_ORIGEN } from '../wizard/fixtures/mvp-ejemplo.fixture';
import {
  AU_IMPORTE_SIN_IVA,
  auFilasParaMotor,
  buildAuPlantillaConfigs,
} from '../wizard/fixtures/autopistas-urbanas.fixture';
import {
  ACCESO_OESTE_FILAS_MUESTRA,
  buildAccesoOestePlantillaConfigs,
} from './mocks/acceso-oeste.fixture';

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

  console.log('F03-9 descriptors (10 códigos)');
  const descs = motor.getAlgorithmDescriptors();
  assert(descs.length === 11, '11 AlgorithmDescriptor');
  assert(
    descs.every((d) => typeof d.validar === 'function' && typeof d.resumen === 'function'),
    'descriptor validar/resumen'
  );

  console.log('F03-9 skip-disabled');
  const configs = [...(plantilla.configuraciones ?? [])];
  const qtyIdx = configs.findIndex((c) => c.columna_destino === 'QUANTITY');
  const withDisabled = configs.map((c, i) =>
    i === qtyIdx
      ? {
          ...c,
          configuracion: { ...(c.configuracion ?? {}), habilitado: false },
        }
      : c
  );
  const [rowSkip] = motor.aplicarPipeline(
    [FILA_EJEMPLO_PRD_21],
    withDisabled,
    algoritmos
  );
  assert(rowSkip['IMPORTE_NETO'] === 12180, '§21 sigue OK con QUANTITY off');
  assert(rowSkip['QUANTITY'] === undefined, 'QUANTITY omitido si deshabilitado');

  console.log('F03-9 deps use-before-create');
  const badOrder = [
    {
      id: 'b1',
      plantilla_id: 't',
      nombre_columna: 'IMPORTE_NETO',
      columna_destino: 'IMPORTE_NETO',
      orden: 10,
      tipo: 'transformacion',
      obligatoria: true,
      configuracion: {
        algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
        columnas_entrada: ['PRECIO', 'BONIFICACION'],
      },
    },
    {
      id: 'b2',
      plantilla_id: 't',
      nombre_columna: 'TARIFA',
      columna_destino: 'PRECIO',
      orden: 20,
      tipo: 'transformacion',
      obligatoria: true,
      configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
    },
    {
      id: 'b3',
      plantilla_id: 't',
      nombre_columna: 'BONIFICACION',
      columna_destino: 'BONIFICACION',
      orden: 30,
      tipo: 'transformacion',
      obligatoria: true,
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_NUMERO',
        columna: 'BONIFICACION',
      },
    },
  ];
  const depErrs = motor.validarDependenciasPipeline(badOrder, [
    'TARIFA',
    'BONIFICACION',
  ]);
  assert(
    depErrs.some((e) => /uso antes de crear/i.test(e.motivo)),
    'use-before-create detectado'
  );

  console.log('F03-9 deps circular');
  const cyclic = [
    {
      id: 'c1',
      plantilla_id: 't',
      nombre_columna: 'A',
      columna_destino: 'COL_A',
      orden: 10,
      tipo: 'transformacion',
      obligatoria: true,
      configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'COL_B' },
    },
    {
      id: 'c2',
      plantilla_id: 't',
      nombre_columna: 'B',
      columna_destino: 'COL_B',
      orden: 20,
      tipo: 'transformacion',
      obligatoria: true,
      configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'COL_A' },
    },
  ];
  const cycErrs = motor.validarDependenciasPipeline(cyclic, []);
  assert(
    cycErrs.some((e) => /circular/i.test(e.motivo)),
    'ciclo detectado'
  );

  console.log('F03-9 previsualizarPaso');
  const [parcial] = motor.previsualizarPaso(
    plantilla.configuraciones ?? [],
    [FILA_EJEMPLO_PRD_21],
    20,
    algoritmos
  );
  assert(parcial['PASE_ID'] === '98702170', 'previsualizar hasta orden 20: PASE_ID');
  assert(parcial['PATENTE_ID'] === undefined, 'previsualizar no aplica orden>20');

  console.log('F03-9 columnas_entrada alias');
  const [rowAlias] = motor.aplicarPipeline(
    [FILA_EJEMPLO_PRD_21],
    [
      {
        id: 'a1',
        plantilla_id: 't',
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        tipo: 'transformacion',
        obligatoria: true,
        configuracion: {
          algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
          columnas_entrada: ['FECHA', 'HORA'],
          formato_hora: 'HHMMSS',
        },
      },
    ]
  );
  assert(rowAlias['FECHA_HORA'] === '2026-06-25 20:50:05', 'columnas_entrada OK');

  // --- Editable pipeline / Wave 2 QA: Demo seed + AU sums ---
  console.log('I-P Demo seed (atomic) 10 filas → suma 102060');
  const seedConfigs = buildSeedDemoConfigsAtomic();
  const demoRows = motor.aplicarPipeline(MVP_FILAS_ORIGEN.slice(0, 10), seedConfigs);
  assert(demoRows.length === 10, 'Demo 10 filas');
  assert(
    String(demoRows[0]['FECHA_HORA']) === '2026-06-25 20:50:05',
    'Demo row1 FECHA_HORA'
  );
  assert(Number(demoRows[0]['IMPORTE_NETO']) === 12180, 'Demo row1 IMPORTE_NETO');
  const demoSum = demoRows.reduce((a, r) => a + Number(r['IMPORTE_NETO'] ?? 0), 0);
  assert(demoSum === 102060, `Demo suma IMPORTE_NETO = 102060 (got ${demoSum})`);

  console.log('I-P AU plantilla 10 filas → suma 132940.19');
  const auRows = motor.aplicarPipeline(
    auFilasParaMotor(),
    buildAuPlantillaConfigs() as ConfiguracionPlantilla[]
  );
  assert(auRows.length === 10, 'AU 10 filas');
  assert(
    String(auRows[0]['FECHA_HORA']) === '2026-07-27 12:14:33',
    'AU row1 FECHA_HORA'
  );
  assert(Number(auRows[0]['IMPORTE_NETO']) === 19985.09, 'AU row1 IMPORTE_NETO');
  assert(String(auRows[0]['CODIGO_ESTACION']) === 'VAR-02C', 'AU row1 CODIGO_ESTACION');
  const auSum = auRows.reduce((a, r) => a + Number(r['IMPORTE_NETO'] ?? 0), 0);
  assert(
    Math.abs(auSum - AU_IMPORTE_SIN_IVA) < 0.01,
    `AU suma IMPORTE_NETO = 132940.19 (got ${auSum})`
  );

  console.log('I-P Acceso Oeste CSV: ISO, estación-vía y valores estándar');
  const accesoRows = motor.aplicarPipeline(
    ACCESO_OESTE_FILAS_MUESTRA,
    buildAccesoOestePlantillaConfigs()
  );
  assert(accesoRows.length === 2, 'Acceso Oeste filas muestra');
  assert(
    accesoRows[0]['FECHA_HORA'] === '2026-07-16 04:36:48',
    'Acceso Oeste FECHA_HORA ISO'
  );
  assert(
    accesoRows[0]['CODIGO_ESTACION'] === 'ITUZAINGO - 05',
    'Acceso Oeste ESTACION + VIA'
  );
  assert(accesoRows[0]['PASE_ID'] === '94337220', 'Acceso Oeste DISPOSITIVO → PASE_ID');
  assert(accesoRows[0]['PATENTE_ID'] === 'OWG130', 'Acceso Oeste PATENTE → PATENTE_ID');
  assert(accesoRows[0]['IMPORTE_NETO'] === 3976.59, 'Acceso Oeste importe neto');

  console.log('\nPASS: verificación motor/plantillas F03 + I-P Demo/AU');
}

/** Configs atómicas equivalentes al seed wizard Paso 3 (F02-10). */
function buildSeedDemoConfigsAtomic(): ConfiguracionPlantilla[] {
  const pid = 'temp-wizard-plantilla';
  return [
    {
      id: 's10',
      plantilla_id: pid,
      nombre_columna: 'FECHA',
      columna_destino: 'FECHA_HORA',
      orden: 10,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
        columnas_entrada: ['FECHA', 'HORA'],
        columnas: ['FECHA', 'HORA'],
        formato_hora: 'HHMMSS',
      },
      obligatoria: true,
    },
    {
      id: 's20',
      plantilla_id: pid,
      nombre_columna: 'DISPOSITIVON',
      columna_destino: 'PASE_ID',
      orden: 20,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'COPIAR_COLUMNA',
        columnas_entrada: ['DISPOSITIVON'],
        columna: 'DISPOSITIVON',
      },
      obligatoria: true,
    },
    {
      id: 's30',
      plantilla_id: pid,
      nombre_columna: 'DOMINIO',
      columna_destino: 'PATENTE_ID',
      orden: 30,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'BORRAR_ESPACIOS',
        columnas_entrada: ['DOMINIO'],
        columna: 'DOMINIO',
      },
      obligatoria: true,
    },
    {
      id: 's40',
      plantilla_id: pid,
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      orden: 40,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'ELIMINAR_GUIONES',
        columnas_entrada: ['PATENTE_ID'],
        columna: 'PATENTE_ID',
      },
      obligatoria: true,
    },
    {
      id: 's50',
      plantilla_id: pid,
      nombre_columna: 'PATENTE_ID',
      columna_destino: 'PATENTE_ID',
      orden: 50,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
        columnas_entrada: ['PATENTE_ID'],
        columna: 'PATENTE_ID',
      },
      obligatoria: true,
    },
    {
      id: 's60',
      plantilla_id: pid,
      nombre_columna: 'QUANTITY',
      columna_destino: 'QUANTITY',
      orden: 60,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
      obligatoria: true,
    },
    {
      id: 's70',
      plantilla_id: pid,
      nombre_columna: 'IMPORTE_NETO',
      columna_destino: 'IMPORTE_NETO',
      orden: 70,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: {
        algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
        columnas_entrada: ['TARIFA', 'BONIFICACION'],
        precio_columna: 'TARIFA',
        bonificacion_columna: 'BONIFICACION',
      },
      obligatoria: true,
    },
  ];
}

main();
