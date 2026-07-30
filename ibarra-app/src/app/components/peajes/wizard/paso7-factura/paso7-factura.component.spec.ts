import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso7FacturaComponent } from './paso7-factura.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso7FacturaComponent', () => {
  let fixture: ComponentFixture<Paso7FacturaComponent>;
  let component: Paso7FacturaComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso7FacturaComponent],
      providers: [PeajesWizardStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(Paso7FacturaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exige factura, cuenta, empresa, fecha e importes', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.form.invalid).toBeTrue();
    expect(spy).not.toHaveBeenCalled();

    component.form.setValue({
      factura: 'A-0001',
      cuenta: 'CTA-1',
      empresa_id: 'EMP-001',
      fecha_factura: '2026-06-30',
      importe_sin_iva: 100,
      importe_total: 121,
    });
    component.continuar();
    expect(spy).toHaveBeenCalled();
  });
});
