import { TestBed } from '@angular/core/testing';
import { ConfiguracionPlantilla } from '../models/peajes.models';
import { SupabaseService } from '../../../services/supabase.service';
import { TarifaComparisonAdapterService } from './tarifa-comparison-adapter.service';
import {
  AsociacionTarifaImporte,
  PasadaValidacionTarifaInput,
  TarifaValidationService,
} from './tarifa-validation.service';

function configuracionesPlantilla(): ConfiguracionPlantilla[] {
  return [
    {
      id: 'cfg-1',
      plantilla_id: 'plt-1',
      nombre_columna: 'IMPORTE_NETO',
      columna_destino: 'IMPORTE_NETO',
      orden: 90,
      tipo: 'transformacion',
      algoritmo_combinado_id: null,
      configuracion: { algoritmo_codigo: 'ELIMINAR_IVA' },
      obligatoria: true,
    },
  ];
}

function pasadaInput(
  overrides: Partial<PasadaValidacionTarifaInput> & Pick<PasadaValidacionTarifaInput, 'idx'>
): PasadaValidacionTarifaInput {
  return {
    estacion_id: 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111',
    categoria: 5,
    status: 'NO_PICO',
    fecha_hora: '2026-07-31 10:15:00',
    precio_directo: 1210,
    pasada_id: null,
    fila: { IMPORTE_NETO: 1210, PRECIO: 1210 },
    ...overrides,
  };
}

describe('TarifaValidationService', () => {
  let service: TarifaValidationService;
  let rpc: jasmine.Spy;
  let adapter: jasmine.SpyObj<TarifaComparisonAdapterService>;
  const configuraciones = configuracionesPlantilla();

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    adapter = jasmine.createSpyObj('TarifaComparisonAdapterService', ['obtenerPrecioComparable']);

    TestBed.configureTestingModule({
      providers: [
        TarifaValidationService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jasmine.createSpy('getClient').and.resolveTo({ rpc }),
            executeWithRetry: <T>(operation: () => Promise<T>) => operation(),
          },
        },
        { provide: TarifaComparisonAdapterService, useValue: adapter },
      ],
    });

    service = TestBed.inject(TarifaValidationService);
  });

  it('resuelve y valida el lote en un RPC cada uno (sin N+1)', async () => {
    const pasadas = [pasadaInput({ idx: 0 }), pasadaInput({ idx: 1 }), pasadaInput({ idx: 2 })];
    rpc.and.callFake(async (name: string, args: { p_pasadas?: unknown[] }) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        expect(args.p_pasadas?.length).toBe(3);
        return {
          data: pasadas.map((p) => ({
            idx: p.idx,
            tarifa_id: `tarifa-${p.idx}`,
            current_tarifa_id: `imp-${p.idx}`,
            importe: 1210,
            peaje_id: 'peaje-1',
            sentido_aplicado: 'AMBAS',
            requiere_normalizacion_iva: false,
          })),
          error: null,
        };
      }
      if (name === 'peajes_validar_tarifas_actuales') {
        expect(args.p_pasadas?.length).toBe(3);
        return {
          data: pasadas.map((p) => ({
            idx: p.idx,
            codigo: 'AL_DIA',
            tarifa_importe_id: `imp-${p.idx}`,
            importe: 1210,
            precio_comparado: 1210,
            error_relativo: 0,
          })),
          error: null,
        };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    const resultado = await service.validarLote(pasadas, configuraciones);

    const resolverCalls = rpc.calls.all().filter((c) => c.args[0] === 'peajes_resolver_tarifas_actuales');
    const validatorCalls = rpc.calls.all().filter((c) => c.args[0] === 'peajes_validar_tarifas_actuales');
    expect(resolverCalls.length).toBe(1);
    expect(validatorCalls.length).toBe(1);
    expect(rpc.calls.argsFor(0)[0]).toBe('peajes_resolver_tarifas_actuales');
    expect(rpc.calls.argsFor(1)[0]).toBe('peajes_validar_tarifas_actuales');
    expect(resultado.filas.map((f: { idx: number }) => f.idx)).toEqual([0, 1, 2]);
    expect(rpc.calls.all().some((c) => c.args[0] === 'peajes_asociar_pasadas_tarifa_importe')).toBeFalse();
  });

  it('envía IDA/VUELTA tal cual al resolver y usa AMBAS si falta el mapeo SENTIDO', async () => {
    rpc.and.callFake(async (name: string, args: { p_pasadas?: Array<{ idx: number; sentido: string }> }) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        const payload = args.p_pasadas ?? [];
        expect(payload.find((r) => r.idx === 0)?.sentido).toBe('IDA');
        expect(payload.find((r) => r.idx === 1)?.sentido).toBe('VUELTA');
        expect(payload.find((r) => r.idx === 2)?.sentido).toBe('AMBAS');
        return {
          data: payload.map((r) => ({
            idx: r.idx,
            tarifa_id: `t${r.idx}`,
            current_tarifa_id: `c${r.idx}`,
            importe: 1000,
            peaje_id: 'peaje-1',
            sentido_aplicado: r.sentido,
            requiere_normalizacion_iva: false,
          })),
          error: null,
        };
      }
      if (name === 'peajes_validar_tarifas_actuales') {
        return {
          data: (args.p_pasadas ?? []).map((r) => ({
            idx: r.idx,
            codigo: 'AL_DIA',
            tarifa_importe_id: `c${r.idx}`,
            importe: 1000,
            precio_comparado: 1000,
            error_relativo: 0,
          })),
          error: null,
        };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    const resultado = await service.validarLote(
      [
        pasadaInput({ idx: 0, sentido: 'IDA' }),
        pasadaInput({ idx: 1, sentido: 'VUELTA' }),
        pasadaInput({ idx: 2, sentido: undefined }),
      ],
      configuraciones
    );

    expect(resultado.filas[0].sentido_solicitado).toBe('IDA');
    expect(resultado.filas[1].sentido_solicitado).toBe('VUELTA');
    expect(resultado.filas[2].sentido_solicitado).toBe('AMBAS');
  });

  it('no pide IVA al adapter si el resolver no marca requiere_normalizacion_iva', async () => {
    rpc.and.callFake(async (name: string, args: { p_pasadas?: Array<Record<string, unknown>> }) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        return {
          data: [
            {
              idx: 0,
              tarifa_id: 't0',
              current_tarifa_id: 'c0',
              importe: 1210,
              peaje_id: 'peaje-1',
              sentido_aplicado: 'AMBAS',
              requiere_normalizacion_iva: false,
            },
          ],
          error: null,
        };
      }
      if (name === 'peajes_validar_tarifas_actuales') {
        const row = args.p_pasadas?.[0];
        expect(row?.['precio_directo']).toBe(1210);
        expect(row?.['precio_normalizado']).toBeNull();
        expect(row?.['requiere_normalizacion_iva']).toBeFalse();
        return {
          data: [
            {
              idx: 0,
              codigo: 'AL_DIA',
              tarifa_importe_id: 'c0',
              importe: 1210,
              precio_comparado: 1210,
              error_relativo: 0,
            },
          ],
          error: null,
        };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    await service.validarLote([pasadaInput({ idx: 0, precio_directo: 1210 })], configuraciones);

    expect(adapter.obtenerPrecioComparable).not.toHaveBeenCalled();
  });

  it('pide el precio comparable al adapter exactamente una vez por fila con flag IVA', async () => {
    const normalizado = 1000;
    adapter.obtenerPrecioComparable.and.returnValue(normalizado);
    const filaIva = { IMPORTE_NETO: 1210, PRECIO: 1210 };
    const filaCruda = { IMPORTE_NETO: 1100, PRECIO: 1100 };

    rpc.and.callFake(async (name: string, args: { p_pasadas?: Array<Record<string, unknown>> }) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        return {
          data: [
            {
              idx: 0,
              tarifa_id: 't0',
              current_tarifa_id: 'c0',
              importe: 1000,
              peaje_id: 'peaje-1',
              sentido_aplicado: 'AMBAS',
              requiere_normalizacion_iva: true,
            },
            {
              idx: 1,
              tarifa_id: 't1',
              current_tarifa_id: 'c1',
              importe: 1100,
              peaje_id: 'peaje-1',
              sentido_aplicado: 'AMBAS',
              requiere_normalizacion_iva: false,
            },
          ],
          error: null,
        };
      }
      if (name === 'peajes_validar_tarifas_actuales') {
        const flagged = args.p_pasadas?.find((r) => r['idx'] === 0);
        const raw = args.p_pasadas?.find((r) => r['idx'] === 1);
        expect(flagged?.['precio_directo']).toBe(1210);
        expect(flagged?.['precio_normalizado']).toBe(normalizado);
        expect(flagged?.['requiere_normalizacion_iva']).toBeTrue();
        expect(raw?.['precio_directo']).toBe(1100);
        expect(raw?.['precio_normalizado']).toBeNull();
        return {
          data: [
            {
              idx: 0,
              codigo: 'AL_DIA',
              tarifa_importe_id: 'c0',
              importe: 1000,
              precio_comparado: normalizado,
              error_relativo: 0,
            },
            {
              idx: 1,
              codigo: 'AL_DIA',
              tarifa_importe_id: 'c1',
              importe: 1100,
              precio_comparado: 1100,
              error_relativo: 0,
            },
          ],
          error: null,
        };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    await service.validarLote(
      [
        pasadaInput({ idx: 0, precio_directo: 1210, fila: filaIva }),
        pasadaInput({ idx: 1, precio_directo: 1100, fila: filaCruda }),
      ],
      configuraciones
    );

    expect(adapter.obtenerPrecioComparable).toHaveBeenCalledTimes(1);
    expect(adapter.obtenerPrecioComparable).toHaveBeenCalledWith({
      precioDirecto: 1210,
      requiereNormalizacionIva: true,
      fila: filaIva,
      configuraciones,
    });
  });

  it('valida en lote solo las filas resueltas y conserva SIN_TARIFA del resolver', async () => {
    rpc.and.callFake(async (name: string, args: { p_pasadas?: Array<Record<string, unknown>> }) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        return {
          data: [
            { idx: 0, codigo: 'SIN_TARIFA', tarifa_id: null, current_tarifa_id: null, importe: null, peaje_id: null, sentido_aplicado: 'AMBAS', requiere_normalizacion_iva: false },
            {
              idx: 1,
              tarifa_id: 't1',
              current_tarifa_id: 'c1',
              importe: 1840,
              peaje_id: 'peaje-1',
              sentido_aplicado: 'IDA',
              requiere_normalizacion_iva: false,
            },
          ],
          error: null,
        };
      }
      if (name === 'peajes_validar_tarifas_actuales') {
        expect(args.p_pasadas?.length).toBe(1);
        expect(args.p_pasadas?.[0]['idx']).toBe(1);
        return {
          data: [
            {
              idx: 1,
              codigo: 'AL_DIA',
              tarifa_importe_id: 'c1',
              importe: 1840,
              precio_comparado: 1840,
              error_relativo: 0,
            },
          ],
          error: null,
        };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    const resultado = await service.validarLote(
      [pasadaInput({ idx: 0 }), pasadaInput({ idx: 1, sentido: 'IDA' })],
      configuraciones
    );

    expect(rpc.calls.all().filter((c) => c.args[0] === 'peajes_validar_tarifas_actuales').length).toBe(1);
    expect(resultado.filas[0].codigo).toBe('SIN_TARIFA');
    expect(resultado.filas[1].codigo).toBe('AL_DIA');
  });

  it('asocia solo AL_DIA e HISTORICA tras confirmar, en lote y de forma reintentable', async () => {
    rpc.and.callFake(async (name: string) => {
      if (name === 'peajes_asociar_pasadas_tarifa_importe') {
        return { data: null, error: null };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    const asociaciones: AsociacionTarifaImporte[] = [
      { pasada_id: 'pasada-1', tarifa_importe_id: 'imp-1', codigo: 'AL_DIA' },
      { pasada_id: 'pasada-2', tarifa_importe_id: 'imp-2', codigo: 'HISTORICA' },
      { pasada_id: 'pasada-3', tarifa_importe_id: 'imp-3', codigo: 'DESFASADO' },
      { pasada_id: 'pasada-4', tarifa_importe_id: 'imp-4', codigo: 'SIN_TARIFA' },
    ];

    await service.asociarTrasConfirmacion(asociaciones);
    await service.asociarTrasConfirmacion(asociaciones);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.calls.argsFor(0)[0]).toBe('peajes_asociar_pasadas_tarifa_importe');
    expect(rpc.calls.argsFor(1)[0]).toBe('peajes_asociar_pasadas_tarifa_importe');
    const payload = rpc.calls.argsFor(0)[1] as { p_asociaciones: AsociacionTarifaImporte[] };
    expect(payload.p_asociaciones).toEqual([
      { pasada_id: 'pasada-1', tarifa_importe_id: 'imp-1', codigo: 'AL_DIA' },
      { pasada_id: 'pasada-2', tarifa_importe_id: 'imp-2', codigo: 'HISTORICA' },
    ]);
    expect(payload.p_asociaciones.some((a) => 'tarifa_normalizada_id' in a)).toBeFalse();
    expect(rpc.calls.argsFor(1)[1]).toEqual(payload);
  });

  it('propaga el error del RPC de resolución sin llamar al validador', async () => {
    rpc.and.callFake(async (name: string) => {
      if (name === 'peajes_resolver_tarifas_actuales') {
        return { data: null, error: { message: 'timeout', code: '57014' } };
      }
      throw new Error(`RPC inesperado: ${name}`);
    });

    await expectAsync(service.validarLote([pasadaInput({ idx: 0 })], configuraciones)).toBeRejected();
    expect(rpc.calls.all().some((c) => c.args[0] === 'peajes_validar_tarifas_actuales')).toBeFalse();
    expect(adapter.obtenerPrecioComparable).not.toHaveBeenCalled();
  });
});
