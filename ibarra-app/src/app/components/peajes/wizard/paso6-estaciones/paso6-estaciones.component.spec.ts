import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso6EstacionesComponent } from './paso6-estaciones.component';
import { PEAJES_CATALOGO_SERVICE } from '../../models';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso6EstacionesComponent', () => {
  let fixture: ComponentFixture<Paso6EstacionesComponent>;
  let component: Paso6EstacionesComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso6EstacionesComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setPreview({
      nombreArchivo: 'demo.xlsx',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: '99' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    state.setMapeos([
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
    ]);

    fixture = TestBed.createComponent(Paso6EstacionesComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('no permite continuar con estaciones sin relacionar', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.error).toContain('sin relacionar');
    expect(spy).not.toHaveBeenCalled();
  });
});
