import {
  COLUMN_ALIASES,
  buildColumnLookup,
  buildDemoPipelineSeeds,
  detectColumnRecommendations,
  detectaFormatoHora,
  detectaNumeroAr,
  resolveAlias,
  recipePatente,
  tieneHeadersParaSeedDemo,
} from './column-recognition';
import { ExcelCargaPreview } from '../../models';

function previewOf(columnas: string[], filas: Record<string, unknown>[] = []): ExcelCargaPreview {
  return {
    nombreArchivo: 't.xlsx',
    tamanioBytes: 1,
    totalFilas: filas.length || 1,
    columnas,
    filasPreview: filas.length ? filas : [Object.fromEntries(columnas.map((c) => [c, 'x']))],
    filasOrigen: filas.length ? filas : [Object.fromEntries(columnas.map((c) => [c, 'x']))],
    tiposInferidos: {},
  };
}

describe('column-recognition (F02-11)', () => {
  it('resuelve aliases PATENTE y DOMINIO', () => {
    const lookupAu = buildColumnLookup(['PATENTE', 'TARIFA']);
    expect(resolveAlias(lookupAu, COLUMN_ALIASES.plate)).toBe('PATENTE');

    const lookupDemo = buildColumnLookup(['DOMINIO', 'DISPOSITIVON']);
    expect(resolveAlias(lookupDemo, COLUMN_ALIASES.plate)).toBe('DOMINIO');
    expect(resolveAlias(lookupDemo, COLUMN_ALIASES.device)).toBe('DISPOSITIVON');
  });

  it('detecta HHMMSS vs COMBINAR según muestras de HORA', () => {
    expect(detectaFormatoHora(['083015', '120000'])).toBe('HHMMSS');
    expect(detectaFormatoHora(['08:30:15', '12:00:00'])).toBe('COMBINAR');
  });

  it('detecta número estilo AR', () => {
    expect(detectaNumeroAr(['19.985,09'])).toBeTrue();
    expect(detectaNumeroAr(['19985.09', '100'])).toBeFalse();
  });

  it('AUSOL-like headers generan patente + fecha_hora + dispositivo sin DOMINIO', () => {
    const recs = detectColumnRecommendations(
      previewOf(
        ['FECHA', 'HORA', 'PATENTE', 'DISPOSITIVO', 'ESTACION', 'TARIFA', 'BONIFICACION'],
        [{ FECHA: '2026-01-01', HORA: '08:30:15', PATENTE: 'AB123CD', DISPOSITIVO: '1', ESTACION: 'X', TARIFA: '100', BONIFICACION: '0' }]
      )
    );
    const kinds = recs.map((r) => r.kind);
    expect(kinds).toContain('fecha_hora');
    expect(kinds).toContain('patente');
    expect(kinds).toContain('dispositivo');
    expect(kinds).toContain('tarifa');
    expect(kinds).toContain('bonificacion');
    expect(kinds).toContain('estacion');

    const fecha = recs.find((r) => r.kind === 'fecha_hora')!;
    expect(fecha.draftSteps[0].configuracion?.algoritmo_codigo).toBe('COMBINAR_COLUMNAS');

    const patente = recs.find((r) => r.kind === 'patente')!;
    expect(patente.columnasEntrada).toEqual(['PATENTE']);
    expect(patente.draftSteps.map((d) => d.configuracion?.algoritmo_codigo)).toEqual([
      'BORRAR_ESPACIOS',
      'ELIMINAR_GUIONES',
      'CONVERTIR_MAYUSCULAS',
    ]);
  });

  it('Demo headers usan FORMATEAR_FECHA_HORA HHMMSS', () => {
    const recs = detectColumnRecommendations(
      previewOf(
        ['FECHA', 'HORA', 'DOMINIO', 'DISPOSITIVON', 'ESTACION', 'TARIFA', 'BONIFICACION'],
        [{ FECHA: '25/06/2026', HORA: '083015', DOMINIO: 'AB-123', DISPOSITIVON: '9', ESTACION: 'E1', TARIFA: '100', BONIFICACION: '10' }]
      )
    );
    const fecha = recs.find((r) => r.kind === 'fecha_hora')!;
    expect(fecha.draftSteps[0].configuracion?.algoritmo_codigo).toBe('FORMATEAR_FECHA_HORA');
  });

  it('recipePatente produce cadena atómica hacia PATENTE_ID', () => {
    const steps = recipePatente('DOMINIO', 30);
    expect(steps[0].columna_destino).toBe('PATENTE_ID');
    expect(steps[2].configuracion?.algoritmo_codigo).toBe('CONVERTIR_MAYUSCULAS');
  });

  it('tieneHeadersParaSeedDemo acepta PATENTE o DOMINIO', () => {
    expect(
      tieneHeadersParaSeedDemo(['FECHA', 'HORA', 'PATENTE', 'DISPOSITIVO', 'TARIFA', 'BONIFICACION'])
    ).toBeTrue();
    expect(
      tieneHeadersParaSeedDemo(['FECHA', 'HORA', 'DOMINIO', 'DISPOSITIVON', 'TARIFA', 'BONIFICACION'])
    ).toBeTrue();
    expect(tieneHeadersParaSeedDemo(['FECHA', 'HORA', 'PATENTE'])).toBeFalse();
  });

  it('buildDemoPipelineSeeds arma pipeline §21 con aliases AUSOL', () => {
    const seeds = buildDemoPipelineSeeds(
      previewOf(['FECHA', 'HORA', 'PATENTE', 'DISPOSITIVO', 'TARIFA', 'BONIFICACION'], [
        { FECHA: '2026-01-01', HORA: '08:00:00', PATENTE: 'X', DISPOSITIVO: '1', TARIFA: '10', BONIFICACION: '1' },
      ])
    );
    const codes = seeds.map((s) => s.configuracion?.algoritmo_codigo);
    expect(codes).toContain('COMBINAR_COLUMNAS');
    expect(codes).toContain('COPIAR_COLUMNA');
    expect(codes).toContain('BORRAR_ESPACIOS');
    expect(codes).toContain('ASIGNAR_VALOR');
    expect(codes).toContain('CALCULAR_IMPORTE_NETO');
  });
});
