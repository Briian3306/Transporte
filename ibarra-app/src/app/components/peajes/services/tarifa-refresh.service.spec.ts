import { PASADA_COLUMNAS_OBLIGATORIAS, PASADA_COLUMN_KEYS, PasadaEstandarizada } from '../models';
import { extraerCandidatosRefresco } from '../models/tarifa-refresh.contracts';
import { normalizarImportesPasada } from '../models/documento.helpers';

const ESTACION_DOCK = 'est-dock-sud';

function pasada(overrides: Partial<PasadaEstandarizada> = {}): PasadaEstandarizada {
  return {
    PASADA_ID: null,
    FECHA_HORA: '2026-07-31 10:15:00',
    PASE_ID: 'pase-1',
    PATENTE_ID: 'pat-1',
    ESTACION_ID: ESTACION_DOCK,
    PRECIO: 11975.15,
    BONIFICACION: 0,
    QUANTITY: 1,
    IMPORTE_NETO: 11975.15,
    CATEGORIA: '2',
    SENTIDO: null,
    TARIFA_STATUS: null,
    ...overrides,
  };
}

describe('extraerCandidatosRefresco', () => {
  it('prefers PRECIO over a different IMPORTE_NETO', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: 14968.96, IMPORTE_NETO: 12100 }),
    ]);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(14968.96);
  });

  it('falls back to IMPORTE_NETO only when PRECIO is absent', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: null, IMPORTE_NETO: 12500 }),
    ]);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(12500);
  });

  it('defaults missing direction to AMBAS and keeps requested status optional', () => {
    const candidatos = extraerCandidatosRefresco([pasada()]);

    expect(candidatos[0].sentidoSolicitado).toBe('AMBAS');
    expect(candidatos[0].statusSolicitado).toBeNull();
  });

  it('honors explicit SENTIDO and TARIFA_STATUS when present', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ SENTIDO: 'IDA', TARIFA_STATUS: 'PICO' }),
    ]);

    expect(candidatos[0].sentidoSolicitado).toBe('IDA');
    expect(candidatos[0].statusSolicitado).toBe('PICO');
  });

  it('preserves every source row index for a shared physical price', () => {
    const filas = Array.from({ length: 50 }, () => pasada({ PRECIO: 11975.15, IMPORTE_NETO: 11975.15 }));
    const candidatos = extraerCandidatosRefresco(filas);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].rowIndexes).toEqual(filas.map((_, i) => i));
    expect(candidatos[0].estacionId).toBe(ESTACION_DOCK);
    expect(candidatos[0].categoria).toBe(2);
  });

  it('excludes rows with no valid price from the candidate count', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: null, IMPORTE_NETO: null }),
      pasada({ PRECIO: 'abc' as unknown as number, IMPORTE_NETO: '' }),
      pasada({ PRECIO: 12500 }),
    ]);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(12500);
    expect(candidatos[0].rowIndexes).toEqual([2]);
  });

  it('turns an NC signed price into its absolute physical tariff price via normalizarImportesPasada', () => {
    const bruto = 14968.96;
    const firmado = normalizarImportesPasada('NC', {
      precio: bruto,
      bonificacion: 0,
      importe_neto: bruto,
    });
    expect(firmado.precio).toBe(-bruto);

    const candidatos = extraerCandidatosRefresco(
      [pasada({ PRECIO: bruto, IMPORTE_NETO: bruto })],
      { tipoDocumento: 'NC' },
    );

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(bruto);
    expect(candidatos[0].precioDirecto).toBe(Math.abs(firmado.precio));
  });

  it('groups by station, category, optional status, requested direction and canonical physical price', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: 11975.15, TARIFA_STATUS: 'NO_PICO' }),
      pasada({ PRECIO: 11975.15, TARIFA_STATUS: 'NO_PICO' }),
      pasada({ PRECIO: 14968.96, TARIFA_STATUS: 'PICO' }),
      pasada({ PRECIO: 11975.15, TARIFA_STATUS: 'PICO' }),
    ]);

    expect(candidatos.length).toBe(3);
    const noPico = candidatos.find((c) => c.statusSolicitado === 'NO_PICO' && c.precioDirecto === 11975.15);
    const picoA = candidatos.find((c) => c.statusSolicitado === 'PICO' && c.precioDirecto === 14968.96);
    const picoB = candidatos.find((c) => c.statusSolicitado === 'PICO' && c.precioDirecto === 11975.15);
    expect(noPico?.rowIndexes).toEqual([0, 1]);
    expect(picoA?.rowIndexes).toEqual([2]);
    expect(picoB?.rowIndexes).toEqual([3]);
  });

  it('keeps the original numeric price for comparison instead of a rounded key', () => {
    const candidatos = extraerCandidatosRefresco([pasada({ PRECIO: 11975.15 })]);
    expect(candidatos[0].precioDirecto).toBe(11975.15);
    expect(Number.isInteger(candidatos[0].precioDirecto)).toBeFalse();
  });
});

describe('optional SENTIDO and TARIFA_STATUS mapping keys', () => {
  it('exposes SENTIDO and TARIFA_STATUS as mapped keys without making a legacy file invalid', () => {
    expect(PASADA_COLUMN_KEYS).toContain('SENTIDO');
    expect(PASADA_COLUMN_KEYS).toContain('TARIFA_STATUS');
    expect(PASADA_COLUMNAS_OBLIGATORIAS).not.toContain('SENTIDO');
    expect(PASADA_COLUMNAS_OBLIGATORIAS).not.toContain('TARIFA_STATUS');
  });
});

describe('TarifaRefreshServiceImpl', () => {
  it('deduplica contextos de prepare y llama al adapter solo si alguna identidad requiere IVA', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { of } = await import('rxjs');
    const { TarifaRefreshServiceImpl } = await import('./tarifa-refresh.service');
    const { PEAJES_TARIFARIO_SERVICE } = await import('../models/tarifario.contracts');
    const { TarifaComparisonAdapterService } = await import('./tarifa-comparison-adapter.service');

    const preparar = jasmine.createSpy('prepararRefresco').and.returnValue(
      of([
        {
          id: 'ctx',
          peajeId: 'p',
          estacionId: ESTACION_DOCK,
          categoria: 2,
          status: 'NO_PICO',
          sentido: 'AMBAS',
          tarifaId: 't',
          importe: 11975.15,
          requiereNormalizacionIva: false,
        },
      ]),
    );
    const detectar = jasmine.createSpy('detectarRefresco').and.returnValue(
      of([
        {
          id: `${ESTACION_DOCK}|2||AMBAS|11975.15`,
          codigo: 'CURRENT_TARIFF',
          peajeId: 'p',
          estacionId: ESTACION_DOCK,
          categoria: 2,
          status: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          sentidoAplicado: 'AMBAS',
          importeActual: 11975.15,
          tarifaId: 't',
          tarifaImporteId: 'ti',
          requiereNormalizacionIva: false,
        },
      ]),
    );
    const adapter = jasmine.createSpyObj('TarifaComparisonAdapterService', ['obtenerPrecioComparable']);
    TestBed.configureTestingModule({
      providers: [
        TarifaRefreshServiceImpl,
        { provide: PEAJES_TARIFARIO_SERVICE, useValue: { prepararRefresco: preparar, detectarRefresco: detectar } },
        { provide: TarifaComparisonAdapterService, useValue: adapter },
      ],
    });
    const service = TestBed.inject(TarifaRefreshServiceImpl);
    const filas = Array.from({ length: 20 }, () => pasada({ PRECIO: 11975.15 }));
    await service.analizar({
      pasadas: filas,
      documentos: [{ tipo: 'FC', rowIndexes: filas.map((_, i) => i) }],
      configuraciones: [],
    });
    expect(preparar.calls.count()).toBe(1);
    expect(preparar.calls.mostRecent().args[0].length).toBe(1);
    expect(detectar.calls.mostRecent().args[0].length).toBe(1);
    expect(adapter.obtenerPrecioComparable).not.toHaveBeenCalled();
  });
});
