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
});
