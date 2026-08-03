import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso5MapeoComponent } from './paso5-mapeo.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso5MapeoComponent', () => {
  let fixture: ComponentFixture<Paso5MapeoComponent>;
  let component: Paso5MapeoComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso5MapeoComponent],
      providers: [PeajesWizardStateService],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setPreview({
      nombreArchivo: 'demo.xlsx',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['DOMINIO', 'TARIFA'],
      filasPreview: [{ DOMINIO: 'AD625QB', TARIFA: 17400 }],
      filasOrigen: [{ DOMINIO: 'AD625QB', TARIFA: 17400 }],
      tiposInferidos: { DOMINIO: 'texto', TARIFA: 'número' },
    });

    fixture = TestBed.createComponent(Paso5MapeoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('no permite avanzar con columnas obligatorias sin mapear', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.error).toContain('obligatorias');
    expect(spy).not.toHaveBeenCalled();
  });
});
