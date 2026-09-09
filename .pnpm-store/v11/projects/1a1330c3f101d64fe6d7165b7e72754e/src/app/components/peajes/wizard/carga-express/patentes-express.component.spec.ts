import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PEAJES_CATALOGO_SERVICE } from '../../models';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { PatentesExpressComponent } from './patentes-express.component';

describe('PatentesExpressComponent', () => {
  let fixture: ComponentFixture<PatentesExpressComponent>;
  let component: PatentesExpressComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatentesExpressComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setPasadasEstandarizadas([
      {
        PASADA_ID: null,
        FECHA_HORA: '2026-08-20 10:00:00',
        PASE_ID: 'TAG-1',
        PATENTE_ID: 'NUEVA123',
        ESTACION_ID: 'EST-101',
        PRECIO: 100,
        BONIFICACION: 0,
        QUANTITY: 1,
        IMPORTE_NETO: 100,
        CATEGORIA: null,
      },
    ]);

    fixture = TestBed.createComponent(PatentesExpressComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
  });

  it('muestra una patente inexistente y no permite continuar hasta resolverla', () => {
    expect(component.patentesPendientes).toEqual(['NUEVA123']);
    expect(component.puedeContinuar).toBeFalse();
  });

  it('agrega una patente y reemplaza el código por el id del catálogo', async () => {
    await component.agregarPatente('NUEVA123');

    expect(component.patentesPendientes).toEqual([]);
    expect(state.snapshot().pasadasEstandarizadas[0].PATENTE_ID).toMatch(/^PAT-/);
    expect(component.puedeContinuar).toBeTrue();
  });

  it('excluye una patente del import sin dejarla como referencia inválida', () => {
    component.quitarPatente('NUEVA123');

    expect(component.patentesPendientes).toEqual([]);
    expect(state.snapshot().patentesExcluidas).toContain('NUEVA123');
  });
});
