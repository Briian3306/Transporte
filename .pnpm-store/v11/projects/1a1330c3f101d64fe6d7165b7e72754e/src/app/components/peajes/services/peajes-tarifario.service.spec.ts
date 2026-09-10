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
      { categoria: 1, status: 'NO_PICO' as const, importe: 5800, fechaVigenciaInicio: '2026-09-01' },
      { categoria: 2, status: 'NO_PICO' as const, importe: 7300, fechaVigenciaInicio: '2026-09-01' },
      { categoria: 2, status: 'PICO' as const, importe: 7900, fechaVigenciaInicio: '2026-09-01' },
    ];
    const out = await firstValueFrom(service.guardar('p', 'e', 'IDA', cambios));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_guardar_tarifas_actuales', {
      p_peaje_id: 'p',
      p_estacion_id: 'e',
      p_sentido: 'IDA',
      p_cambios: [
        { categoria: 1, status: 'NO_PICO', importe: 5800, fecha_vigencia_inicio: '2026-09-01' },
        { categoria: 2, status: 'NO_PICO', importe: 7300, fecha_vigencia_inicio: '2026-09-01' },
        { categoria: 2, status: 'PICO', importe: 7900, fecha_vigencia_inicio: '2026-09-01' },
      ],
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

  it('listarHistorial mapea vigencia y diagnostico y conserva fecha_aparicion', async () => {
    rpcSpy.and.resolveTo({
      data: [
        {
          id: 'ti-1',
          importe: 5800,
          fecha_aparicion: '2025-08-21T00:00:00.000Z',
          es_actual: true,
          fecha_vigencia_inicio: '2026-09-01',
          fecha_vigencia_fin: null,
          diagnostico: 'CONFIRMADO',
          categoria_calculada: 2,
        },
        {
          id: 'ti-legacy',
          importe: 5000,
          fecha_aparicion: '2024-01-15T00:00:00.000Z',
          es_actual: false,
        },
      ],
      error: null,
    });
    const out = await firstValueFrom(service.listarHistorial('tarifa-1'));
    expect(out[0]).toEqual({
      id: 'ti-1',
      importe: 5800,
      fecha_aparicion: '2025-08-21T00:00:00.000Z',
      es_actual: true,
      fechaVigenciaInicio: '2026-09-01',
      fechaVigenciaFin: null,
      diagnostico: 'CONFIRMADO',
      categoriaCalculada: 2,
    });
    expect(out[1].fecha_aparicion).toBe('2024-01-15T00:00:00.000Z');
    expect(out[1].fechaVigenciaInicio).toBeNull();
    expect(out[1].fechaVigenciaFin).toBeNull();
    expect(out[1].diagnostico).toBeNull();
    expect(out[1].categoriaCalculada).toBeNull();
  });

  it('listar mapea vigencia y diagnostico del precio actual', async () => {
    rpcSpy.and.resolveTo({
      data: {
        rows: [
          {
            tarifa_id: 't1',
            peaje_id: 'p',
            peaje_nombre: 'AUBASA',
            estacion_id: 'e',
            estacion_nombre: 'HUDSON',
            categoria: 1,
            status: 'NO_PICO',
            sentido: 'IDA',
            importe: 5500,
            fecha_actualizacion: '2026-03-10T00:00:00.000Z',
            current_tarifa_importe_id: 'ti-1',
            fecha_vigencia_inicio: '2026-01-01',
            fecha_vigencia_fin: null,
            diagnostico: 'CONFIRMADO',
            categoria_calculada: 1,
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      },
      error: null,
    });
    const out = await firstValueFrom(service.listar());
    expect(out.rows[0].fechaVigenciaInicio).toBe('2026-01-01');
    expect(out.rows[0].fechaVigenciaFin).toBeNull();
    expect(out.rows[0].diagnostico).toBe('CONFIRMADO');
    expect(out.rows[0].categoriaCalculada).toBe(1);
  });

  it('obtenerEditor mapea vigencia y diagnostico de identidades existentes', async () => {
    rpcSpy.and.resolveTo({
      data: {
        context: {
          peaje_id: 'p',
          peaje_nombre: 'AUBASA',
          estacion_id: 'e',
          estacion_nombre: 'HUDSON',
          sentido: 'IDA',
        },
        existentes: [
          {
            tarifa_id: 't1',
            categoria: 1,
            status: 'NO_PICO',
            current_tarifa_importe_id: 'ti-1',
            importe: 5500,
            fecha_actualizacion: '2026-03-10T00:00:00.000Z',
            fecha_vigencia_inicio: '2026-01-01',
            fecha_vigencia_fin: null,
            diagnostico: 'CONFIRMADO',
            categoria_calculada: 1,
          },
        ],
      },
      error: null,
    });
    const payload = await firstValueFrom(service.obtenerEditor('p', 'e', 'IDA'));
    expect(payload.existentes[0].fechaVigenciaInicio).toBe('2026-01-01');
    expect(payload.existentes[0].diagnostico).toBe('CONFIRMADO');
    expect(payload.existentes[0].categoriaCalculada).toBe(1);
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

  it('detectarRefresco envia fecha_pasada y categoria_proveedor', async () => {
    rpcSpy.and.resolveTo({ data: [], error: null });
    await firstValueFrom(
      service.detectarRefresco([
        {
          id: 'c1',
          estacionId: 'est-1',
          categoria: 3,
          categoriaProveedor: 3,
          statusSolicitado: null,
          sentidoSolicitado: 'AMBAS',
          fechaPasada: '2026-07-31',
          precioDirecto: 5300,
          precioNormalizado: null,
        } as never,
      ]),
    );
    expect(rpcSpy).toHaveBeenCalledWith('peajes_detectar_refresco_tarifas', {
      p_candidatos: [
        jasmine.objectContaining({
          id: 'c1',
          estacion_id: 'est-1',
          categoria: 3,
          categoria_proveedor: 3,
          fecha_pasada: '2026-07-31',
          precio_directo: 5300,
          precio_normalizado: null,
        }),
      ],
    });
  });

  it('detectarRefresco mapea correccion, possible_matches, diagnostico, vigencia y categoriaCalculada', async () => {
    rpcSpy.and.resolveTo({
      data: [
        {
          id: 'c1',
          codigo: 'CURRENT_CATEGORY_CORRECTION',
          peaje_id: 'p',
          estacion_id: 'e',
          categoria: 3,
          categoria_proveedor: 3,
          categoria_calculada: 2,
          status: 'PICO',
          sentido_solicitado: 'AMBAS',
          sentido_aplicado: 'AMBAS',
          importe_actual: 5300,
          tarifa_id: 't',
          tarifa_importe_id: 'ti',
          requiere_normalizacion_iva: false,
          diagnostico: 'CONFIRMADO',
          fecha_vigencia_inicio: '2026-06-01',
          fecha_vigencia_fin: null,
          possible_matches: [
            {
              tarifa_id: 't',
              tarifa_importe_id: 'ti',
              categoria: 2,
              status: 'PICO',
              sentido: 'AMBAS',
              importe: 5300,
              diagnostico: 'CONFIRMADO',
              fecha_vigencia_inicio: '2026-06-01',
              fecha_vigencia_fin: null,
              es_actual: true,
              error_relativo: 0,
            },
          ],
        },
      ],
      error: null,
    });
    const out = await firstValueFrom(
      service.detectarRefresco([
        {
          id: 'c1',
          estacionId: 'e',
          categoria: 3,
          statusSolicitado: 'PICO',
          sentidoSolicitado: 'AMBAS',
          fechaPasada: '2026-07-31',
          precioDirecto: 5300,
          precioNormalizado: null,
        } as never,
      ]),
    );
    expect(out[0].codigo).toBe('CURRENT_CATEGORY_CORRECTION');
    expect((out[0] as { categoriaProveedor?: number | null }).categoriaProveedor).toBe(3);
    expect((out[0] as { categoriaCalculada?: number | null }).categoriaCalculada).toBe(2);
    expect((out[0] as { diagnostico?: string | null }).diagnostico).toBe('CONFIRMADO');
    expect((out[0] as { fechaVigenciaInicio?: string | null }).fechaVigenciaInicio).toBe('2026-06-01');
    expect((out[0] as { fechaVigenciaFin?: string | null }).fechaVigenciaFin).toBeNull();
    const matches = out[0].possibleMatches ?? [];
    expect(matches.length).toBe(1);
    expect(matches[0]).toEqual(
      jasmine.objectContaining({
        tarifaId: 't',
        tarifaImporteId: 'ti',
        categoria: 2,
        status: 'PICO',
        sentido: 'AMBAS',
        importe: 5300,
        diagnostico: 'CONFIRMADO',
        fechaVigenciaInicio: '2026-06-01',
        fechaVigenciaFin: null,
        esActual: true,
        errorRelativo: 0,
      }),
    );
  });

  it('detectarRefresco acepta camelCase y guarda REVIEW_RECORDED', async () => {
    rpcSpy.and.resolveTo({
      data: [
        {
          id: 'c2',
          codigo: 'HISTORICAL_CATEGORY_CORRECTION',
          peajeId: 'p',
          estacionId: 'e',
          categoriaProveedor: 3,
          categoriaCalculada: 2,
          possibleMatches: [],
        },
        {
          id: 'c3',
          codigo: 'REVIEW_RECORDED',
          peajeId: 'p',
          estacionId: 'e',
          categoria_proveedor: 3,
          categoria_calculada: null,
          tarifa_importe_id: 'ti-rev',
          diagnostico: 'REVISAR',
        },
      ],
      error: null,
    });
    const out = await firstValueFrom(
      service.detectarRefresco([
        {
          id: 'c2',
          estacionId: 'e',
          categoria: 3,
          statusSolicitado: null,
          sentidoSolicitado: 'AMBAS',
          fechaPasada: '2026-01-15',
          precioDirecto: 5300,
          precioNormalizado: null,
        } as never,
      ]),
    );
    expect(out[0].codigo).toBe('HISTORICAL_CATEGORY_CORRECTION');
    expect((out[0] as { categoriaCalculada?: number | null }).categoriaCalculada).toBe(2);
    expect(out[1].codigo).toBe('REVIEW_RECORDED');
    expect(out[1].tarifaImporteId).toBe('ti-rev');
  });

  it('guardarRefresco mapea TarifaRefreshDecision a snake_case', async () => {
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
          tarifa_importe_id: 'ti-new',
          accion: 'ACTUALIZADA',
          candidate_id: 'cand-1',
          anterior_fin: '2026-09-01',
          fecha_vigencia_inicio: '2026-09-01',
          fecha_vigencia_fin: null,
          diagnostico: 'CONFIRMADO',
          categoria_calculada: 2,
        },
      ],
      error: null,
    });
    const decision = {
      candidateId: 'cand-1',
      action: 'CONFIRM_NEW' as const,
      peajeId: 'p',
      estacionId: 'e',
      categoriaProveedor: 3,
      categoriaCalculada: 2,
      status: 'NO_PICO' as const,
      sentido: 'AMBAS' as const,
      importe: 12500,
      fechaVigenciaInicio: '2026-09-01',
      cases: 4,
      requiereNormalizacionIva: false,
    };
    const out = await firstValueFrom(service.guardarRefresco([decision] as never));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_guardar_refresco_tarifas', {
      p_cambios: [
        jasmine.objectContaining({
          candidate_id: 'cand-1',
          action: 'CONFIRM_NEW',
          peaje_id: 'p',
          estacion_id: 'e',
          categoria_proveedor: 3,
          categoria_calculada: 2,
          status: 'NO_PICO',
          sentido: 'AMBAS',
          importe: 12500,
          fecha_vigencia_inicio: '2026-09-01',
          cases: 4,
          requiere_normalizacion_iva: false,
        }),
      ],
    });
    expect((out[0] as { diagnostico?: string | null }).diagnostico).toBe('CONFIRMADO');
    expect((out[0] as { fechaVigenciaInicio?: string | null }).fechaVigenciaInicio).toBe('2026-09-01');
    expect((out[0] as { categoriaCalculada?: number | null }).categoriaCalculada).toBe(2);
  });
});
