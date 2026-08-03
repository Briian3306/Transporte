import { crearMotor } from './motor/peajes-motor-transformacion.service';
import {
  FILA_EJEMPLO_PRD_21,
  COLUMNAS_ARCHIVO_DEMO,
  buildPlantillaDemoProveedor,
} from './mocks/peajes-plantillas.mock';
import { createDefaultRegistry } from './motor/pipeline-builder';
import {
  assertDescriptorsCompletos,
  getAlgorithmDescriptor,
} from './motor/algorithm-descriptor';
import { ALGORITMO_CODIGOS } from './motor/strategy.types';
import { AlgoritmoCombinado, ConfiguracionPlantilla } from '../models/peajes.models';
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
import { AUSOL_FILAS_MUESTRA, buildAusolPlantillaConfigs } from './mocks/ausol.fixture';

function cfg(
  partial: Partial<ConfiguracionPlantilla> & {
    nombre_columna: string;
    orden: number;
  }
): ConfiguracionPlantilla {
  return {
    id: partial.id ?? `cfg-${partial.orden}`,
    plantilla_id: partial.plantilla_id ?? 'plt-test',
    nombre_columna: partial.nombre_columna,
    columna_destino: partial.columna_destino ?? partial.nombre_columna,
    orden: partial.orden,
    tipo: partial.tipo ?? 'transformacion',
    algoritmo_combinado_id: partial.algoritmo_combinado_id ?? null,
    configuracion: partial.configuracion ?? null,
    obligatoria: partial.obligatoria ?? true,
  };
}

const ALG_NORMALIZAR_PATENTE: AlgoritmoCombinado = {
  id: 'alg-normalizar-patente',
  nombre: 'NORMALIZAR_PATENTE',
  empresa_id: '__global__',
  estado: 'activa',
  pasos: [
    {
      id: 'paso-np-1',
      algoritmo_combinado_id: 'alg-normalizar-patente',
      orden: 1,
      algoritmo_codigo: 'BORRAR_ESPACIOS',
    },
    {
      id: 'paso-np-2',
      algoritmo_combinado_id: 'alg-normalizar-patente',
      orden: 2,
      algoritmo_codigo: 'ELIMINAR_GUIONES',
    },
    {
      id: 'paso-np-3',
      algoritmo_combinado_id: 'alg-normalizar-patente',
      orden: 3,
      algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
    },
  ],
};

const ALG_FECHA_HORA: AlgoritmoCombinado = {
  id: 'alg-combinar-fecha-hora',
  nombre: 'COMBINAR_FECHA_HORA',
  empresa_id: '__global__',
  estado: 'activa',
  pasos: [
    {
      id: 'paso-cfh-1',
      algoritmo_combinado_id: 'alg-combinar-fecha-hora',
      orden: 1,
      algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
      parametros: { columnas: ['FECHA', 'HORA'], formato_hora: 'HHMMSS' },
    },
  ],
};

describe('peajes/plantillas/motor', () => {
  const algoritmos = [ALG_NORMALIZAR_PATENTE, ALG_FECHA_HORA];
  const plantilla = buildPlantillaDemoProveedor(
    ALG_NORMALIZAR_PATENTE.id,
    ALG_FECHA_HORA.id
  );

  it('StrategyRegistry rechaza códigos no registrados', () => {
    const registry = createDefaultRegistry();
    expect(registry.tiene('BORRAR_ESPACIOS')).toBeTrue();
    expect(registry.tiene('REEMPLAZAR_TEXTO')).toBeTrue();
    expect(() => registry.obtener('CODIGO_INEXISTENTE')).toThrowError(
      /no registrado/i
    );
  });

  it('REEMPLAZAR_TEXTO aplica aliases en orden', () => {
    const motor = crearMotor();
    const [row] = motor.aplicarPipeline([{ ESTACION: 'BD' }], [cfg({
      nombre_columna: 'ESTACION', columna_destino: 'ESTACION_ID', orden: 10,
      configuracion: { algoritmo_codigo: 'REEMPLAZAR_TEXTO', columna: 'ESTACION', reglas: [
        { buscar: 'BD', reemplazar: 'BLACK DECK' },
        { buscar: 'BLACK DECK', reemplazar: 'BLACK DECK NORTE' },
      ] },
    })]);
    expect(row['ESTACION_ID']).toBe('BLACK DECK NORTE');
  });

  it('I-P12: AUSOL produce estructura estándar antes del reconocedor', () => {
    const motor = crearMotor();
    const [row] = motor.aplicarPipeline(AUSOL_FILAS_MUESTRA, buildAusolPlantillaConfigs());
    expect(row['FECHA_HORA']).toBe('2026-07-16 01:34:14');
    expect(row['ESTACION_ID']).toBe('CAMPANA');
    expect(row['PASE_ID']).toBe('94891934');
    expect(row['PATENTE_ID']).toBe('AE751PA');
    expect(row['IMPORTE_NETO']).toBe(3976.59);
    expect(row['QUANTITY']).toBe(1);
  });

  it('reproduce FECHA_HORA, PATENTE_ID, PASE_ID, IMPORTE_NETO del caso §21', () => {
    const motor = crearMotor();
    const filas = motor.aplicarPipeline(
      [FILA_EJEMPLO_PRD_21],
      plantilla.configuraciones ?? [],
      algoritmos
    );
    const row = filas[0];

    expect(row['FECHA_HORA']).toBe('2026-06-25 20:50:05');
    expect(row['PASE_ID']).toBe('98702170');
    expect(row['PATENTE_ID']).toBe('AD625QB');
    expect(row['IMPORTE_NETO']).toBe(12180);
    expect(row['PRECIO']).toBe(17400);
    expect(row['BONIFICACION']).toBe(5220);
    expect(row['QUANTITY']).toBe(1);
  });

  it('normaliza patente con espacios y guiones', () => {
    const motor = crearMotor();
    const fila = { ...FILA_EJEMPLO_PRD_21, DOMINIO: ' ad-625-qb ' };
    const [row] = motor.aplicarPipeline(
      [fila],
      plantilla.configuraciones ?? [],
      algoritmos
    );
    expect(row['PATENTE_ID']).toBe('AD625QB');
  });

  it('completa HORA con ceros a la izquierda (RN-06)', () => {
    const motor = crearMotor();
    const fila = { ...FILA_EJEMPLO_PRD_21, HORA: '85557' };
    const [row] = motor.aplicarPipeline(
      [fila],
      plantilla.configuraciones ?? [],
      algoritmos
    );
    expect(row['FECHA_HORA']).toBe('2026-06-25 08:55:57');
  });

  it('interpreta MM/DD/YY + HHMMSS del archivo Demo XLSX', () => {
    const motor = crearMotor();
    const [row] = motor.aplicarPipeline(
      [{ FECHA: '6/25/26', HORA: '205005' }],
      [
        cfg({
          nombre_columna: 'FECHA',
          columna_destino: 'FECHA_HORA',
          orden: 10,
          configuracion: {
            algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
            columnas_entrada: ['FECHA', 'HORA'],
            formato_hora: 'MM/DD/YY HHMMSS',
          },
        }),
      ]
    );
    expect(row['FECHA_HORA']).toBe('2026-06-25 20:50:05');
  });

  // --- F03-9 / U-P01…U-P08 ---

  it('U-P01: omite configs con habilitado === false', () => {
    const motor = crearMotor();
    const configs = [
      cfg({
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 10,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
      }),
      cfg({
        nombre_columna: 'QUANTITY',
        columna_destino: 'QUANTITY',
        orden: 20,
        configuracion: {
          algoritmo_codigo: 'ASIGNAR_VALOR',
          valor: 1,
          habilitado: false,
        },
      }),
    ];
    const pasos = motor.construirPipeline(configs);
    expect(pasos.some((p) => p.columnaDestino === 'QUANTITY')).toBeFalse();
    const [row] = motor.aplicarPipeline([FILA_EJEMPLO_PRD_21], configs);
    expect(row['PRECIO']).toBe(17400);
    expect(row['QUANTITY']).toBeUndefined();
  });

  it('U-P02: deps OK cuando productores van antes (reorder)', () => {
    const motor = crearMotor();
    const configs = [
      cfg({
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 10,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
      }),
      cfg({
        nombre_columna: 'BONIFICACION',
        columna_destino: 'BONIFICACION',
        orden: 20,
        configuracion: {
          algoritmo_codigo: 'CONVERTIR_NUMERO',
          columna: 'BONIFICACION',
        },
      }),
      cfg({
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 30,
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          columnas_entrada: ['PRECIO', 'BONIFICACION'],
        },
      }),
    ];
    const errs = motor.validarDependenciasPipeline(configs, COLUMNAS_ARCHIVO_DEMO);
    expect(errs.filter((e) => /uso antes|circular|ausente/i.test(e.motivo)).length).toBe(
      0
    );
    const [row] = motor.aplicarPipeline([FILA_EJEMPLO_PRD_21], configs);
    expect(row['IMPORTE_NETO']).toBe(12180);
  });

  it('U-P03: detecta use-before-create', () => {
    const motor = crearMotor();
    const configs = [
      cfg({
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 10,
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          columnas_entrada: ['PRECIO', 'BONIFICACION'],
        },
      }),
      cfg({
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 20,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
      }),
      cfg({
        nombre_columna: 'BONIFICACION',
        columna_destino: 'BONIFICACION',
        orden: 30,
        configuracion: {
          algoritmo_codigo: 'CONVERTIR_NUMERO',
          columna: 'BONIFICACION',
        },
      }),
    ];
    const errs = motor.validarDependenciasPipeline(configs, COLUMNAS_ARCHIVO_DEMO);
    expect(errs.some((e) => /uso antes de crear/i.test(e.motivo))).toBeTrue();
  });

  it('U-P04: detecta dependencia circular', () => {
    const motor = crearMotor();
    const configs = [
      cfg({
        nombre_columna: 'A',
        columna_destino: 'COL_A',
        orden: 10,
        configuracion: {
          algoritmo_codigo: 'COPIAR_COLUMNA',
          columna: 'COL_B',
        },
      }),
      cfg({
        nombre_columna: 'B',
        columna_destino: 'COL_B',
        orden: 20,
        configuracion: {
          algoritmo_codigo: 'COPIAR_COLUMNA',
          columna: 'COL_A',
        },
      }),
    ];
    const errs = motor.validarDependenciasPipeline(configs, []);
    expect(errs.some((e) => /circular/i.test(e.motivo))).toBeTrue();
  });

  it('U-P05: previsualizarPaso aplica solo hasta orden N', () => {
    const motor = crearMotor();
    const configs = plantilla.configuraciones ?? [];
    const [parcial] = motor.previsualizarPaso(
      configs,
      [FILA_EJEMPLO_PRD_21],
      20,
      algoritmos
    );
    expect(parcial['FECHA_HORA']).toBe('2026-06-25 20:50:05');
    expect(parcial['PASE_ID']).toBe('98702170');
    expect(parcial['PATENTE_ID']).toBeUndefined();
    expect(parcial['IMPORTE_NETO']).toBeUndefined();
  });

  it('U-P06: descriptor.validar rechaza ASIGNAR_VALOR sin valor', () => {
    assertDescriptorsCompletos();
    const motor = crearMotor();
    const descs = motor.getAlgorithmDescriptors();
    expect(descs.length).toBe(ALGORITMO_CODIGOS.length);
    const asig = getAlgorithmDescriptor('ASIGNAR_VALOR');
    expect(asig).toBeTruthy();
    const errs = asig!.validar({});
    expect(errs.some((e) => /falta parametro valor/i.test(e.motivo))).toBeTrue();
    expect(asig!.resumen({ valor: 1 })).toContain('1');
  });

  it('U-P07: código desconocido se rechaza', () => {
    const motor = crearMotor();
    expect(getAlgorithmDescriptor('CODIGO_FANTASMA')).toBeUndefined();
    expect(() =>
      motor.construirPipeline([
        cfg({
          nombre_columna: 'X',
          orden: 1,
          configuracion: { algoritmo_codigo: 'CODIGO_FANTASMA' },
        }),
      ])
    ).toThrowError(/no registrado/i);
    const errs = motor.validarDefinicionPlantilla(
      [
        cfg({
          nombre_columna: 'X',
          orden: 1,
          configuracion: { algoritmo_codigo: 'CODIGO_FANTASMA' },
        }),
      ],
      ['X']
    );
    expect(errs.some((e) => /no registrado/i.test(e.motivo))).toBeTrue();
  });

  it('U-P08: deshabilitar y rehabilitar restaura el paso', () => {
    const motor = crearMotor();
    const base = cfg({
      nombre_columna: 'QUANTITY',
      columna_destino: 'QUANTITY',
      orden: 10,
      configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
    });
    const disabled = {
      ...base,
      configuracion: { ...base.configuracion!, habilitado: false },
    };
    const [off] = motor.aplicarPipeline([FILA_EJEMPLO_PRD_21], [disabled]);
    expect(off['QUANTITY']).toBeUndefined();
    const enabled = {
      ...base,
      configuracion: { ...base.configuracion!, habilitado: true },
    };
    const [on] = motor.aplicarPipeline([FILA_EJEMPLO_PRD_21], [enabled]);
    expect(on['QUANTITY']).toBe(1);
  });

  it('acepta columnas_entrada (alias de columnas) en multi-input', () => {
    const motor = crearMotor();
    const configs = [
      cfg({
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        configuracion: {
          algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
          columnas_entrada: ['FECHA', 'HORA'],
          formato_hora: 'HHMMSS',
        },
      }),
    ];
    const [row] = motor.aplicarPipeline([FILA_EJEMPLO_PRD_21], configs);
    expect(row['FECHA_HORA']).toBe('2026-06-25 20:50:05');
  });

  // --- I-P pipeline sums (editable / Wave 2) ---

  it('I-P09: Demo seed atomic 10 filas → suma IMPORTE_NETO = 102060', () => {
    const motor = crearMotor();
    const configs: ConfiguracionPlantilla[] = [
      cfg({
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        configuracion: {
          algoritmo_codigo: 'FORMATEAR_FECHA_HORA',
          columnas_entrada: ['FECHA', 'HORA'],
          formato_hora: 'HHMMSS',
        },
      }),
      cfg({
        nombre_columna: 'DISPOSITIVON',
        columna_destino: 'PASE_ID',
        orden: 20,
        configuracion: {
          algoritmo_codigo: 'COPIAR_COLUMNA',
          columna: 'DISPOSITIVON',
        },
      }),
      cfg({
        nombre_columna: 'DOMINIO',
        columna_destino: 'PATENTE_ID',
        orden: 30,
        configuracion: {
          algoritmo_codigo: 'BORRAR_ESPACIOS',
          columna: 'DOMINIO',
        },
      }),
      cfg({
        nombre_columna: 'PATENTE_ID',
        columna_destino: 'PATENTE_ID',
        orden: 40,
        configuracion: {
          algoritmo_codigo: 'ELIMINAR_GUIONES',
          columna: 'PATENTE_ID',
        },
      }),
      cfg({
        nombre_columna: 'PATENTE_ID',
        columna_destino: 'PATENTE_ID',
        orden: 50,
        configuracion: {
          algoritmo_codigo: 'CONVERTIR_MAYUSCULAS',
          columna: 'PATENTE_ID',
        },
      }),
      cfg({
        nombre_columna: 'QUANTITY',
        columna_destino: 'QUANTITY',
        orden: 60,
        configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
      }),
      cfg({
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 70,
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          columnas_entrada: ['TARIFA', 'BONIFICACION'],
          precio_columna: 'TARIFA',
          bonificacion_columna: 'BONIFICACION',
        },
      }),
    ];
    const rows = motor.aplicarPipeline(MVP_FILAS_ORIGEN.slice(0, 10), configs);
    expect(rows.length).toBe(10);
    expect(rows[0]['FECHA_HORA']).toBe('2026-06-25 20:50:05');
    expect(Number(rows[0]['IMPORTE_NETO'])).toBe(12180);
    const sum = rows.reduce((a, r) => a + Number(r['IMPORTE_NETO'] ?? 0), 0);
    expect(sum).toBe(102060);
  });

  it('I-P10: AU plantilla 10 filas → suma IMPORTE_NETO = 132940.19', () => {
    const motor = crearMotor();
    const rows = motor.aplicarPipeline(
      auFilasParaMotor(),
      buildAuPlantillaConfigs() as ConfiguracionPlantilla[]
    );
    expect(rows.length).toBe(10);
    expect(rows[0]['FECHA_HORA']).toBe('2026-07-27 12:14:33');
    expect(Number(rows[0]['IMPORTE_NETO'])).toBe(19985.09);
    expect((rows[0] as Record<string, unknown>)['CODIGO_ESTACION']).toBe('VAR-02C');
    const sum = rows.reduce((a, r) => a + Number(r['IMPORTE_NETO'] ?? 0), 0);
    expect(sum).toBeCloseTo(AU_IMPORTE_SIN_IVA, 2);
  });

  it('I-P11: Acceso Oeste transforma fecha ISO, estación-vía y pasadas', () => {
    const motor = crearMotor();
    const rows = motor.aplicarPipeline(
      ACCESO_OESTE_FILAS_MUESTRA,
      buildAccesoOestePlantillaConfigs()
    );
    expect(rows.length).toBe(2);
    const row0 = rows[0] as Record<string, unknown>;
    expect(row0['FECHA_HORA']).toBe('2026-07-16 04:36:48');
    expect(row0['CODIGO_ESTACION']).toBe('ITUZAINGO - 05');
    expect(row0['PASE_ID']).toBe('94337220');
    expect(row0['PATENTE_ID']).toBe('OWG130');
    expect(row0['PRECIO']).toBe(3976.59);
    expect(row0['BONIFICACION']).toBe(0);
    expect(row0['QUANTITY']).toBe(1);
    expect(row0['IMPORTE_NETO']).toBe(3976.59);
  });
});
