import { TestBed } from '@angular/core/testing';
import { PeajesWizardStateService } from './peajes-wizard-state.service';

describe('PeajesWizardStateService (F02-9)', () => {
  let state: PeajesWizardStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PeajesWizardStateService] });
    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
  });

  it('conserva configuración al volver atrás y avanzar', () => {
    state.setPreview({
      nombreArchivo: 'a.xlsx',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['A'],
      filasPreview: [{ A: 1 }],
      tiposInferidos: { A: 'número' },
    });
    state.setFactura({
      factura: 'F-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-01-01',
      importe_sin_iva: 10,
      importe_total: 12,
    });
    state.setPaso(7);
    state.setPaso(5);
    state.setPaso(7);
    expect(state.snapshot().factura.factura).toBe('F-1');
    expect(state.snapshot().preview?.nombreArchivo).toBe('a.xlsx');
  });
});
