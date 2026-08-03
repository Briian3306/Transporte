import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso9RevisionComponent } from './paso9-revision.component';
import { PEAJES_CARGA_SERVICE } from '../../models';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso9RevisionComponent', () => {
  let fixture: ComponentFixture<Paso9RevisionComponent>;
  let component: Paso9RevisionComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso9RevisionComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setPreview({
      nombreArchivo: 'pasadas.xlsx',
      tamanioBytes: 100,
      totalFilas: 1,
      columnas: ['X'],
      filasPreview: [{ X: 1 }],
      filasOrigen: [{ X: 1 }],
      tiposInferidos: { X: 'número' },
    });
    state.setFactura({
      factura: 'A-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-30',
      importe_sin_iva: 12180,
      importe_total: 14738,
    });
    state.setPasadasEstandarizadas([
      {
        PASADA_ID: null,
        FECHA_HORA: '2026-06-25 20:50:05',
        PASE_ID: '98702170',
        PATENTE_ID: 'AD625QB',
        ESTACION_ID: 'EST-096',
        PRECIO: 17400,
        BONIFICACION: 5220,
        QUANTITY: 1,
        IMPORTE_NETO: 12180,
      },
    ]);
    state.setValidacion({
      validas: state.snapshot().pasadasEstandarizadas,
      errores: [],
      diferenciaFactura: 0,
      dentroTolerancia: true,
    });

    fixture = TestBed.createComponent(Paso9RevisionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('confirma carga y guarda pasadas + registro (mock)', async () => {
    await component.confirmar();
    fixture.detectChanges();
    expect(component.resultado).toBeTruthy();
    expect(component.resultado!.pasadas.length).toBe(1);
    expect(component.resultado!.registro.filas_procesadas).toBe(1);
    expect(component.resultado!.registro.parametros_efectivos).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Carga confirmada');
  });
});
