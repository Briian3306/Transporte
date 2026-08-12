import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import { PeajesCargaSupabaseService } from './peajes-carga.service';

describe('PeajesCargaSupabaseService', () => {
  it('trata el RPC confirmado como éxito sin lecturas posteriores al commit', async () => {
    const rpc = jasmine.createSpy('rpc').and.resolveTo({
      data: {
        documento_id: '11111111-1111-4111-8111-111111111111',
        pasada_ids: ['22222222-2222-4222-8222-222222222222'],
        registro_id: '33333333-3333-4333-8333-333333333333',
      },
      error: null,
    });
    const from = jasmine.createSpy('from').and.callFake(() => {
      throw new Error('No debe hidratar después del RPC');
    });
    const supabaseMock = {
      getClient: jasmine.createSpy('getClient').and.resolveTo({ rpc, from }),
      executeWithRetry: <T>(operation: () => Promise<T>) => operation(),
    };

    TestBed.configureTestingModule({
      providers: [
        PeajesCargaSupabaseService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    const service = TestBed.inject(PeajesCargaSupabaseService);
    const result = await firstValueFrom(
      service.confirmarCarga({
        documento: {
          factura: 'FA-1',
          cuenta: null,
          empresa_id: 'empresa-1',
          fecha_factura: '2026-07-31',
          tipo: 'FC',
          importe_sin_iva: 100,
          bonificacion: 0,
          percepciones: 0,
          iva: 21,
          importe_total: 121,
        },
        pasadas: [
          {
            PASADA_ID: null,
            FECHA_HORA: '2026-07-31 10:15:00',
            PASE_ID: '44444444-4444-4444-8444-444444444444',
            PATENTE_ID: '55555555-5555-4555-8555-555555555555',
            ESTACION_ID: '66666666-6666-4666-8666-666666666666',
            PRECIO: 100,
            BONIFICACION: 0,
            QUANTITY: 1,
            IMPORTE_NETO: 100,
            CATEGORIA: ' 5 ',
          },
        ],
        plantillaId: null,
        mapeos: [],
        relacionesEstacion: [],
        nombreArchivo: 'ConsumosResumen.xlsx',
      })
    );

    expect(result.documento.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.pasadas[0].id).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.registro.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(from).not.toHaveBeenCalled();
    // Primera llamada = peajes_confirmar_carga (la 2ª es peajes_normalizar_tarifas post-commit).
    const confirmarArgs = rpc.calls.argsFor(0)[1] as {
      p_pasadas: Array<{ categoria: string | null }>;
    };
    expect(confirmarArgs.p_pasadas[0].categoria).toBe('5');
  });
});
