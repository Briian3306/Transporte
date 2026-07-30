import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso8ValidacionComponent } from './paso8-validacion.component';
import { PEAJES_CARGA_SERVICE } from '../../models';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso8ValidacionComponent', () => {
  let fixture: ComponentFixture<Paso8ValidacionComponent>;
  let component: Paso8ValidacionComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso8ValidacionComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setFactura({
      factura: 'A-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-30',
      importe_sin_iva: 100,
      importe_total: 121,
    });
    state.setPasadasEstandarizadas([
      {
        PASADA_ID: null,
        FECHA_HORA: '2026-06-25 20:50:05',
        PASE_ID: '98702170',
        PATENTE_ID: '',
        ESTACION_ID: 'EST-096',
        PRECIO: 17400,
        BONIFICACION: 5220,
        QUANTITY: 1,
        IMPORTE_NETO: 12180,
      },
    ]);

    fixture = TestBed.createComponent(Paso8ValidacionComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('muestra fila, columna, valor y motivo en errores (RNF-08)', () => {
    expect(component.resultado).toBeTruthy();
    expect(component.resultado!.errores.length).toBeGreaterThan(0);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fila');
    expect(text).toContain('Columna');
    expect(text).toContain('Valor');
    expect(text).toContain('Motivo');
    expect(text).toContain('PATENTE_ID');
  });
});
