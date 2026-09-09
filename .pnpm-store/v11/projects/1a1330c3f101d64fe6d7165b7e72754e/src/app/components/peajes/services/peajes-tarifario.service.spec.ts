import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import { PeajesTarifarioSupabaseService } from './peajes-tarifario.service';

describe('PeajesTarifarioSupabaseService', () => {
  let rpcSpy: jasmine.Spy;
  let service: PeajesTarifarioSupabaseService;

  beforeEach(() => {
    rpcSpy = jasmine.createSpy('rpc').and.resolveTo({
      data: { rows: [], total: 0, page: 1, page_size: 50 },
      error: null,
    });
    TestBed.configureTestingModule({
      providers: [
        PeajesTarifarioSupabaseService,
        {
          provide: SupabaseService,
          useValue: {
            executeWithRetry: (fn: () => Promise<unknown>) => fn(),
            getClient: async () => ({ rpc: rpcSpy }),
          },
        },
      ],
    });
    service = TestBed.inject(PeajesTarifarioSupabaseService);
  });

  it('listar llama peajes_listar_tarifas_actuales con filtros y pagina', async () => {
    await firstValueFrom(
      service.listar({
        filters: { sentidos: ['IDA'], q_estacion: 'HUD' },
        page: 2,
        pageSize: 25,
        sort: 'importe:desc',
      }),
    );
    expect(rpcSpy).toHaveBeenCalledWith('peajes_listar_tarifas_actuales', {
      p_filtros: { sentidos: ['IDA'], q_estacion: 'HUD' },
      p_page: 2,
      p_page_size: 25,
      p_sort: 'importe:desc',
    });
  });

  it('obtenerEditor llama peajes_obtener_tarifario_editor', async () => {
    rpcSpy.and.resolveTo({
      data: {
        context: {
          peaje_id: 'p',
          peaje_nombre: 'AUBASA',
          estacion_id: 'e',
          estacion_nombre: 'HUDSON',
          sentido: 'IDA',
        },
        existentes: [],
      },
      error: null,
    });
    const payload = await firstValueFrom(service.obtenerEditor('p', 'e', 'IDA'));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_obtener_tarifario_editor', {
      p_peaje_id: 'p',
      p_estacion_id: 'e',
      p_sentido: 'IDA',
    });
    expect(payload.existentes).toEqual([]);
  });

  it('guardar envia el array de cambios sin vacios', async () => {
    rpcSpy.and.resolveTo({ data: { actualizadas: 3 }, error: null });
    const cambios = [
      { categoria: 1, status: 'NO_PICO' as const, importe: 5800 },
      { categoria: 2, status: 'NO_PICO' as const, importe: 7300 },
      { categoria: 2, status: 'PICO' as const, importe: 7900 },
    ];
    const out = await firstValueFrom(service.guardar('p', 'e', 'IDA', cambios));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_guardar_tarifas_actuales', {
      p_peaje_id: 'p',
      p_estacion_id: 'e',
      p_sentido: 'IDA',
      p_cambios: cambios,
    });
    expect(out.actualizadas).toBe(3);
  });

  it('listarHistorial llama peajes_listar_tarifa_historial', async () => {
    rpcSpy.and.resolveTo({ data: [], error: null });
    await firstValueFrom(service.listarHistorial('tarifa-1'));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_listar_tarifa_historial', {
      p_tarifa_id: 'tarifa-1',
    });
  });

  it('prepararRefresco envia candidatos en forma RPC snake_case', async () => {
    rpcSpy.and.resolveTo({ data: [], error: null });
    await firstValueFrom(
      service.prepararRefresco([
        {
          id: 'c1',
          estacionId: 'est-1',
          categoria: 2,
          statusSolicitado: 'NO_PICO',
          sentidoSolicitado: 'AMBAS',
        },
      ]),
    );
    expect(rpcSpy).toHaveBeenCalledWith('peajes_preparar_refresco_tarifas', {
      p_candidatos: [
        {
          id: 'c1',
          estacion_id: 'est-1',
          categoria: 2,
          status_solicitado: 'NO_PICO',
          sentido_solicitado: 'AMBAS',
        },
      ],
    });
  });

  it('detectarRefresco propaga el error RPC', async () => {
    rpcSpy.and.resolveTo({ data: null, error: { message: 'p_candidatos debe ser un arreglo JSON' } });
    await expectAsync(
      firstValueFrom(
        service.detectarRefresco([
          {
            id: 'c1',
            estacionId: 'est-1',
            categoria: 2,
            statusSolicitado: null,
            sentidoSolicitado: 'AMBAS',
            precioDirecto: 12500,
            precioNormalizado: null,
          },
        ]),
      ),
    ).toBeRejectedWith(jasmine.objectContaining({ message: 'p_candidatos debe ser un arreglo JSON' }));
  });

  it('guardarRefresco mapea el resumen de celdas', async () => {
    rpcSpy.and.resolveTo({
      data: [
        {
          peaje_id: 'p',
          estacion_id: 'e',
          sentido: 'AMBAS',
          categoria: 2,
          status: 'NO_PICO',
          tarifa_id: 't',
          anterior: 11975.15,
          nueva: 12500,
          tarifa_importe_id: 'ti',
          accion: 'ACTUALIZADA',
        },
      ],
      error: null,
    });
    const out = await firstValueFrom(
      service.guardarRefresco([
        {
          peajeId: 'p',
          estacionId: 'e',
          sentido: 'AMBAS',
          categoria: 2,
          status: 'NO_PICO',
          importe: 12500,
          cases: 3,
          requiereNormalizacionIva: false,
        },
      ]),
    );
    expect(rpcSpy).toHaveBeenCalledWith('peajes_guardar_refresco_tarifas', {
      p_cambios: [
        {
          peaje_id: 'p',
          estacion_id: 'e',
          sentido: 'AMBAS',
          categoria: 2,
          status: 'NO_PICO',
          importe: 12500,
          cases: 3,
          requiere_normalizacion_iva: false,
        },
      ],
    });
    expect(out[0].accion).toBe('ACTUALIZADA');
    expect(out[0].anterior).toBe(11975.15);
  });
});
