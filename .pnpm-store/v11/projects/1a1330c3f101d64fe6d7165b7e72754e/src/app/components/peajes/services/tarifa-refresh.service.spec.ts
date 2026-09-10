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

  it('keeps PRECIO as the tariff candidate when the line has invoice bonification', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: 10000, BONIFICACION: 500, IMPORTE_NETO: 9500 }),
    ]);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(10000);
    expect(candidatos[0].candidatePrice).toBe(10000);
  });

  it('falls back to IMPORTE_NETO only when PRECIO is absent', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ PRECIO: null, IMPORTE_NETO: 12500 }),
    ]);

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].precioDirecto).toBe(12500);
  });

  it('keeps missing direction unresolved and keeps requested status optional', () => {
    const candidatos = extraerCandidatosRefresco([pasada()]);

    expect(candidatos[0].sentidoSolicitado).toBeNull();
    expect(candidatos[0].directionConfidence).toBe('UNRESOLVED');
    expect(candidatos[0].statusSolicitado).toBeNull();
  });

  it('honors explicit SENTIDO and TARIFA_STATUS when present', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ SENTIDO: 'IDA', TARIFA_STATUS: 'PICO' }),
    ]);

    expect(candidatos[0].sentidoSolicitado).toBe('IDA');
    expect(candidatos[0].statusSolicitado).toBe('PICO');
  });

  it('resolves provider lane metadata without changing the source context', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ SOURCE_ESTACION: '0004', SOURCE_VIA: '51M', SENTIDO: null, PRECIO: 28740.39 }),
    ], {
      estacionesViasSentido: [{ codigoEstacion: '0004', via: '51M', sentido: 'VUELTA' }],
    });
    expect(candidatos[0].sentidoSolicitado).toBe('VUELTA');
    expect(candidatos[0].directionConfidence).toBe('LANE_MAP');
    expect(candidatos[0].sourceLane).toBe('51M');
    expect(candidatos[0].candidatePrice).toBe(28740.39);
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

  it('splits the same physical price on different pasada calendar dates', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ FECHA_HORA: '2026-06-01 08:00:00', PRECIO: 5300, SENTIDO: 'AMBAS' }),
      pasada({ FECHA_HORA: '2026-09-01 08:00:00', PRECIO: 5300, SENTIDO: 'AMBAS' }),
    ]);

    expect(candidatos.length).toBe(2);
    expect(candidatos.map((c) => (c as { fechaPasada?: string | null }).fechaPasada).sort()).toEqual([
      '2026-06-01',
      '2026-09-01',
    ]);
    expect(candidatos[0].id).toContain('2026-06-01');
    expect(candidatos[1].id).toContain('2026-09-01');
    expect(candidatos[0].rowIndexes).toEqual([0]);
    expect(candidatos[1].rowIndexes).toEqual([1]);
  });

  it('keeps every original row index when the calendar date and physical price match', () => {
    const filas = [
      pasada({ FECHA_HORA: '2026-07-31 10:15:00', PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
      pasada({ FECHA_HORA: '2026-07-31 18:40:00', PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
      pasada({ FECHA_HORA: '2026-07-31 21:02:00', PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
    ];
    const candidatos = extraerCandidatosRefresco(filas);

    expect(candidatos.length).toBe(1);
    expect((candidatos[0] as { fechaPasada?: string | null }).fechaPasada).toBe('2026-07-31');
    expect(candidatos[0].rowIndexes).toEqual([0, 1, 2]);
  });

  it('excludes omitted document row indexes while preserving included original indexes', () => {
    const candidatos = extraerCandidatosRefresco(
      [
        pasada({ PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 11975.15, SENTIDO: 'AMBAS' }),
      ],
      {
        documentos: [
          { tipo: 'FC', rowIndexes: [0, 2], omitido: false },
          { tipo: 'FC', rowIndexes: [1], omitido: true },
        ],
      } as never,
    );

    expect(candidatos.length).toBe(1);
    expect(candidatos[0].rowIndexes).toEqual([0, 2]);
  });

  it('keeps the provider category separate from the calculated category', () => {
    const candidatos = extraerCandidatosRefresco([
      pasada({ CATEGORIA: '3', PRECIO: 5300, SENTIDO: 'AMBAS' }),
    ]);

    expect(candidatos[0].categoria).toBe(3);
    expect((candidatos[0] as { categoriaProveedor?: number | null }).categoriaProveedor).toBe(3);
    expect((candidatos[0] as { categoriaCalculada?: number | null }).categoriaCalculada).toBeNull();
  });

  it('adds fechaPasada, station display metadata, source price and count without dropping lane-map confidence', () => {
    const candidatos = extraerCandidatosRefresco(
      [
        pasada({
          FECHA_HORA: '2026-07-31 10:15:00',
          SOURCE_ESTACION: '0004',
          SOURCE_VIA: '51M',
          SENTIDO: null,
          PRECIO: 28740.39,
        }),
        pasada({
          FECHA_HORA: '2026-07-31 11:00:00',
          SOURCE_ESTACION: '0004',
          SOURCE_VIA: '51M',
          SENTIDO: null,
          PRECIO: 28740.39,
        }),
      ],
      {
        estacionesViasSentido: [{ codigoEstacion: '0004', via: '51M', sentido: 'VUELTA' }],
        estacionesCatalogo: [
          {
            estacionId: ESTACION_DOCK,
            estacionNombre: 'Dock Sud',
            peajeId: 'peaje-aubasa',
            peajeNombre: 'AUBASA',
          },
        ],
      } as never,
    );

    expect(candidatos.length).toBe(1);
    const c = candidatos[0] as {
      fechaPasada?: string | null;
      estacionNombre?: string | null;
      peajeId?: string | null;
      peajeNombre?: string | null;
      cases?: number;
    };
    expect(c.fechaPasada).toBe('2026-07-31');
    expect(c.estacionNombre).toBe('Dock Sud');
    expect(c.peajeId).toBe('peaje-aubasa');
    expect(c.peajeNombre).toBe('AUBASA');
    expect(c.cases).toBe(2);
    expect(candidatos[0].candidatePrice).toBe(28740.39);
    expect(candidatos[0].directionConfidence).toBe('LANE_MAP');
    expect(candidatos[0].sentidoSolicitado).toBe('VUELTA');
    expect(candidatos[0].sourceLane).toBe('51M');
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
    const filas = Array.from({ length: 20 }, () => pasada({ PRECIO: 11975.15, SENTIDO: 'AMBAS' }));
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

  it('sends fechaPasada to detect so the same price on two dates stays two candidates', async () => {
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
          importe: 5300,
          requiereNormalizacionIva: false,
        },
      ]),
    );
    const detectar = jasmine.createSpy('detectarRefresco').and.callFake((inputs: Array<{ id: string }>) =>
      of(
        inputs.map((item) => ({
          id: item.id,
          codigo: 'HISTORICAL_TARIFF_MATCH',
          peajeId: 'p',
          estacionId: ESTACION_DOCK,
          categoria: 2,
          status: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          sentidoAplicado: 'AMBAS',
          importeActual: 5300,
          tarifaId: 't',
          tarifaImporteId: 'ti-hist',
          requiereNormalizacionIva: false,
        })),
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        TarifaRefreshServiceImpl,
        { provide: PEAJES_TARIFARIO_SERVICE, useValue: { prepararRefresco: preparar, detectarRefresco: detectar } },
        {
          provide: TarifaComparisonAdapterService,
          useValue: jasmine.createSpyObj('TarifaComparisonAdapterService', ['obtenerPrecioComparable']),
        },
      ],
    });
    const service = TestBed.inject(TarifaRefreshServiceImpl);
    const resumen = await service.analizar({
      pasadas: [
        pasada({ FECHA_HORA: '2026-06-01 08:00:00', PRECIO: 5300, SENTIDO: 'AMBAS' }),
        pasada({ FECHA_HORA: '2026-09-01 08:00:00', PRECIO: 5300, SENTIDO: 'AMBAS' }),
      ],
      documentos: [{ tipo: 'FC', rowIndexes: [0, 1] }],
      configuraciones: [],
    });
    const detectArgs = detectar.calls.mostRecent().args[0] as Array<{ fechaPasada?: string | null }>;
    expect(detectArgs.length).toBe(2);
    expect(detectArgs.map((c) => c.fechaPasada).sort()).toEqual(['2026-06-01', '2026-09-01']);
    expect(resumen.candidatos.length).toBe(2);
    expect(resumen.resultados.length).toBe(2);
  });

  it('calls TarifaComparisonAdapterService once and never applies a second IVA path', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { of } = await import('rxjs');
    const { TarifaRefreshServiceImpl } = await import('./tarifa-refresh.service');
    const { PEAJES_TARIFARIO_SERVICE } = await import('../models/tarifario.contracts');
    const { TarifaComparisonAdapterService } = await import('./tarifa-comparison-adapter.service');

    const configs = [{ id: 'cfg-iva' }] as never;
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
          importe: 9900,
          requiereNormalizacionIva: true,
        },
      ]),
    );
    const detectar = jasmine.createSpy('detectarRefresco').and.returnValue(
      of([
        {
          id: 'detect-iva',
          codigo: 'CURRENT_TARIFF',
          peajeId: 'p',
          estacionId: ESTACION_DOCK,
          categoria: 2,
          status: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          sentidoAplicado: 'AMBAS',
          importeActual: 9900,
          tarifaId: 't',
          tarifaImporteId: 'ti',
          requiereNormalizacionIva: true,
        },
      ]),
    );
    const adapter = jasmine.createSpyObj('TarifaComparisonAdapterService', ['obtenerPrecioComparable']);
    adapter.obtenerPrecioComparable.and.returnValue(9900);
    TestBed.configureTestingModule({
      providers: [
        TarifaRefreshServiceImpl,
        { provide: PEAJES_TARIFARIO_SERVICE, useValue: { prepararRefresco: preparar, detectarRefresco: detectar } },
        { provide: TarifaComparisonAdapterService, useValue: adapter },
      ],
    });
    const service = TestBed.inject(TarifaRefreshServiceImpl);
    const fila = pasada({ PRECIO: 11975.15, SENTIDO: 'AMBAS' });
    await service.analizar({
      pasadas: [fila],
      documentos: [{ tipo: 'FC', rowIndexes: [0] }],
      configuraciones: configs,
    });
    expect(adapter.obtenerPrecioComparable).toHaveBeenCalledTimes(1);
    expect(adapter.obtenerPrecioComparable).toHaveBeenCalledWith(
      jasmine.objectContaining({
        precioDirecto: 11975.15,
        requiereNormalizacionIva: true,
        configuraciones: configs,
      }),
    );
    const detectArg = detectar.calls.mostRecent().args[0][0] as {
      precioDirecto: number;
      precioNormalizado: number | null;
    };
    expect(detectArg.precioDirecto).toBe(11975.15);
    expect(detectArg.precioNormalizado).toBe(9900);
    expect(detectArg.precioNormalizado).not.toBe(Math.round((11975.15 / 1.21) * 100) / 100);
  });

  it('counts current, historical, category-correction, confirmed-new, unresolved and validity-change rows', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { of } = await import('rxjs');
    const { TarifaRefreshServiceImpl } = await import('./tarifa-refresh.service');
    const { PEAJES_TARIFARIO_SERVICE } = await import('../models/tarifario.contracts');
    const { TarifaComparisonAdapterService } = await import('./tarifa-comparison-adapter.service');

    const codes = [
      'CURRENT_TARIFF',
      'HISTORICAL_TARIFF_MATCH',
      'CURRENT_CATEGORY_CORRECTION',
      'NEW_TARIFF',
      'REVIEW_RECORDED',
    ] as const;
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
          importe: 1000,
          requiereNormalizacionIva: false,
        },
      ]),
    );
    const detectar = jasmine.createSpy('detectarRefresco').and.callFake((inputs: Array<{ id: string }>) =>
      of(
        inputs.map((item, i) => ({
          id: item.id,
          codigo: codes[i],
          peajeId: 'p',
          estacionId: ESTACION_DOCK,
          categoria: 2,
          categoriaProveedor: 2,
          categoriaCalculada: codes[i] === 'CURRENT_CATEGORY_CORRECTION' ? 1 : null,
          status: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
          sentidoAplicado: 'AMBAS',
          importeActual: 1000 + i,
          tarifaId: 't',
          tarifaImporteId: `ti-${i}`,
          requiereNormalizacionIva: false,
          fechaVigenciaInicio: i === 0 ? '2026-09-01' : i === 1 ? '2026-01-01' : null,
          fechaVigenciaFin: i === 1 ? '2026-09-01' : null,
        })),
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        TarifaRefreshServiceImpl,
        { provide: PEAJES_TARIFARIO_SERVICE, useValue: { prepararRefresco: preparar, detectarRefresco: detectar } },
        {
          provide: TarifaComparisonAdapterService,
          useValue: jasmine.createSpyObj('TarifaComparisonAdapterService', ['obtenerPrecioComparable']),
        },
      ],
    });
    const service = TestBed.inject(TarifaRefreshServiceImpl);
    const resumen = await service.analizar({
      pasadas: [
        pasada({ PRECIO: 1000, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 2000, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 3000, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 4000, SENTIDO: 'AMBAS' }),
        pasada({ PRECIO: 5000, SENTIDO: 'AMBAS' }),
      ],
      documentos: [{ tipo: 'FC', rowIndexes: [0, 1, 2, 3, 4] }],
      configuraciones: [],
    });
    const counts = resumen as unknown as {
      filasVigentes: number;
      filasHistoricas: number;
      filasCorreccionCategoria: number;
      filasNuevasConfirmadas: number;
      filasSinResolver: number;
      filasCambioVigencia: number;
      pendientes: number;
    };
    expect(counts.filasVigentes).toBe(1);
    expect(counts.filasHistoricas).toBe(1);
    expect(counts.filasCorreccionCategoria).toBe(1);
    expect(counts.filasNuevasConfirmadas).toBe(0);
    expect(counts.filasSinResolver).toBe(1);
    expect(counts.filasCambioVigencia).toBe(1);
    expect(counts.pendientes).toBe(1);
  });

  it('maps current/history category corrections and REVIEW_RECORDED as associable without touching pasadas.categoria', async () => {
    const contracts = (await import('../models/tarifa-refresh.contracts')) as unknown as {
      asociacionDesdeResultadoRefresco: (input: {
        codigo: string;
        tarifaImporteId: string | null;
        categoriaProveedor?: number | null;
        categoriaCalculada?: number | null;
      }) => { tarifa_importe_id: string; codigo: 'AL_DIA' | 'HISTORICA' } | null;
    };
    const { asociacionDesdeResultadoRefresco } = contracts;
    expect(
      asociacionDesdeResultadoRefresco({
        codigo: 'CURRENT_CATEGORY_CORRECTION',
        tarifaImporteId: 'ti-cur',
        categoriaProveedor: 3,
        categoriaCalculada: 2,
      }),
    ).toEqual({ tarifa_importe_id: 'ti-cur', codigo: 'AL_DIA' });
    expect(
      asociacionDesdeResultadoRefresco({
        codigo: 'HISTORICAL_CATEGORY_CORRECTION',
        tarifaImporteId: 'ti-hist',
        categoriaProveedor: 3,
        categoriaCalculada: 2,
      }),
    ).toEqual({ tarifa_importe_id: 'ti-hist', codigo: 'HISTORICA' });
    expect(
      asociacionDesdeResultadoRefresco({
        codigo: 'REVIEW_RECORDED',
        tarifaImporteId: 'ti-rev',
        categoriaProveedor: 3,
        categoriaCalculada: null,
      }),
    ).toEqual({ tarifa_importe_id: 'ti-rev', codigo: 'HISTORICA' });
    expect(
      asociacionDesdeResultadoRefresco({
        codigo: 'NEW_TARIFF',
        tarifaImporteId: null,
        categoriaProveedor: 3,
        categoriaCalculada: null,
      }),
    ).toBeNull();
    expect(
      Object.keys(
        asociacionDesdeResultadoRefresco({
          codigo: 'CURRENT_TARIFF',
          tarifaImporteId: 'ti',
          categoriaProveedor: 3,
          categoriaCalculada: null,
        }) ?? {},
      ),
    ).not.toContain('categoria');
  });
});
