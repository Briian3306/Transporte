import { crearMotor } from './motor/peajes-motor-transformacion.service';
import {
  FILA_EJEMPLO_PRD_21,
  buildPlantillaDemoProveedor,
} from './mocks/peajes-plantillas.mock';
import { createDefaultRegistry } from './motor/pipeline-builder';
import { AlgoritmoCombinado } from '../models/peajes.models';

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
    expect(() => registry.obtener('CODIGO_INEXISTENTE')).toThrowError(
      /no registrado/i
    );
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
});
