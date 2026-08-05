import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Paso7FacturaComponent } from './paso7-factura.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { PEAJES_CATALOGO_SERVICE, PEAJES_PLANTILLAS_SERVICE } from '../../models';
import { AUSOL_FACTURA_557074 } from '../fixtures/ausol-factura-real.fixture';

describe('Paso7FacturaComponent', () => {
  let fixture: ComponentFixture<Paso7FacturaComponent>;
  let component: Paso7FacturaComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso7FacturaComponent],
      providers: [
        PeajesWizardStateService,
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarEmpresas: () =>
              of([{ id: 'EMP-001', nombre: 'Empresa Demo', created_at: undefined }]),
          },
        },
        {
          provide: PEAJES_PLANTILLAS_SERVICE,
          useValue: {
            guardarPlantilla: () => of({ id: 'P-1', nombre: 'x', descripcion: null, empresa_id: 'EMP-001', estado: 'activa' }),
          },
        },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setEmpresaId('EMP-001');

    fixture = TestBed.createComponent(Paso7FacturaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('exige factura, empresa, fecha e importes; cuenta es opcional', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.form.invalid).toBeTrue();
    expect(spy).not.toHaveBeenCalled();

    component.form.patchValue({
      factura: 'A-0001',
      cuenta: '',
      fecha_factura: '2026-06-30',
      importe_sin_iva: 100,
      percepciones: 2,
      iva: 21,
      importe_total: 123,
    });
    component.fechaRange = { from: new Date(2026, 5, 30), to: null };
    component.continuar();
    expect(spy).toHaveBeenCalled();
    expect(state.snapshot().factura.cuenta).toBe('');
    expect(state.snapshot().factura.empresa_id).toBe('EMP-001');
    expect(state.snapshot().factura.importe_total).toBe(123);
  });

  it('conserva los cuatro importes declarados de la factura real AUSOL', () => {
    component.form.patchValue(AUSOL_FACTURA_557074);
    component.continuar();
    expect(state.snapshot().factura).toEqual(jasmine.objectContaining(AUSOL_FACTURA_557074));
  });

  it('suma por centavos para no mostrar desvíos de coma flotante', () => {
    state.setPasadasEstandarizadas([
      { IMPORTE_NETO: 560832.27 },
      { IMPORTE_NETO: 0.01 },
      { IMPORTE_NETO: -0.01 },
    ] as never);
    expect(component.sumaNetos).toBe(560832.27);
  });

  it('continúa con el atajo peajes-wizard-advance cuando el formulario es válido', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.form.patchValue({
      factura: 'A-0001',
      fecha_factura: '2020-06-13',
      importe_sin_iva: 100,
      percepciones: 0,
      iva: 21,
      importe_total: 121,
    });
    component.fechaRange = { from: new Date(2020, 5, 13), to: null };
    component.onWizardAdvanceShortcut();
    expect(spy).toHaveBeenCalled();
  });

  it('sincroniza fecha_factura al tipear en el date picker', () => {
    component.onFechaChange({ from: new Date(2020, 5, 13), to: null });
    expect(component.form.controls.fecha_factura.value).toBe('2020-06-13');
  });
});
