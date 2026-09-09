import { TestBed } from '@angular/core/testing';
import { PEAJES_SUPABASE_PROVIDERS } from './peajes.providers';
import { PEAJES_TARIFARIO_SERVICE } from './models/tarifario.contracts';
import { TARIFA_REFRESH_SERVICE } from './models/tarifa-refresh.contracts';
import { TarifaRefreshServiceImpl } from './services/tarifa-refresh.service';
import { PeajesTarifarioSupabaseService } from './services/peajes-tarifario.service';

describe('PEAJES_SUPABASE_PROVIDERS', () => {
  it('registers TarifaRefreshServiceImpl in the same injector as PEAJES_TARIFARIO_SERVICE', () => {
    const prov = (TarifaRefreshServiceImpl as { ɵprov?: { providedIn?: unknown } }).ɵprov;
    expect(prov?.providedIn).not.toBe('root');
    expect(PEAJES_SUPABASE_PROVIDERS).toContain(TarifaRefreshServiceImpl);
  });

  it('can construct TARIFA_REFRESH_SERVICE when only the peajes route providers are present', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PeajesTarifarioSupabaseService, useValue: {} },
        ...PEAJES_SUPABASE_PROVIDERS,
      ],
    });
    expect(TestBed.inject(TARIFA_REFRESH_SERVICE)).toBeInstanceOf(TarifaRefreshServiceImpl);
    expect(TestBed.inject(PEAJES_TARIFARIO_SERVICE)).toBeTruthy();
  });
});
