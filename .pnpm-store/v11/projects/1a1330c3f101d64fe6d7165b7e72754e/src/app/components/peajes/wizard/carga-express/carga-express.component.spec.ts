import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PeajesCargaExpressComponent } from './carga-express.component';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
} from '../../models';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('PeajesCargaExpressComponent', () => {
  let fixture: ComponentFixture<PeajesCargaExpressComponent>;
  let component: PeajesCargaExpressComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeajesCargaExpressComponent],
      providers: [
        provideRouter([]),
        PeajesWizardStateService,
        { provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService },
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
        {
          provide: PEAJES_PLANTILLAS_SERVICE,
          useValue: {
            listarPlantillas: () => ({ subscribe: (next: (value: never[]) => void) => next([]) }),
            listarAlgoritmos: () => ({ subscribe: (next: (value: never[]) => void) => next([]) }),
            obtenerPlantilla: () => ({ subscribe: (next: (value: null) => void) => next(null) }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PeajesCargaExpressComponent);
    component = fixture.componentInstance;
    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    fixture.detectChanges();
  });

  it('inicia en carga y expone solo los pasos Express', () => {
    expect(component.pasoActual).toBe(1);
    expect(component.pasos.map((paso) => paso.id)).toEqual([1, 7, 9]);
    expect(component.pasos.map((paso) => paso.numero)).toEqual([1, 2, 3]);
    expect(fixture.nativeElement.querySelector('app-paso2-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-paso3-transformaciones')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-paso4-plantilla')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-paso5-mapeo')).toBeNull();
  });

  it('agrega el paso Patentes solo cuando la plantilla deja patentes pendientes', () => {
    component.mostrarPasoPatentes();

    expect(component.pasos.map((paso) => paso.id)).toEqual([1, 5, 6, 7, 9]);
    expect(component.pasos.map((paso) => paso.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it('omite Estaciones cuando no hay relaciones pendientes', () => {
    component.omitirEstaciones();

    expect(component.pasos.map((paso) => paso.id)).toEqual([1, 7, 9]);
    expect(component.pasos.map((paso) => paso.numero)).toEqual([1, 2, 3]);
  });

  it('muestra validación solo cuando el estado contiene errores', () => {
    expect(component.mostrarValidacion).toBeFalse();

    state.setValidacion({
      validas: [],
      errores: [
        { fila: 2, columna: 'PRECIO', valor: 'x', motivo: 'No numérico' },
      ],
      diferenciaFactura: null,
      dentroTolerancia: false,
    });
    component.onFacturaCompletada();
    fixture.detectChanges();

    expect(component.mostrarValidacion).toBeTrue();
  });

  it('no permite continuar desde carga sin plantilla', () => {
    state.setPaso(1);
    state.setPreview({
      nombreArchivo: 'pasadas.xlsx',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: 'A' }],
      filasOrigen: [{ ESTACION: 'A' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    state.setEmpresaId('empresa-1');
    fixture.detectChanges();

    const paso1 = fixture.nativeElement.querySelector('app-paso1-carga') as HTMLElement;
    expect(paso1.textContent).not.toContain('Cargar ejemplo MVP');
    expect(paso1.textContent).not.toContain('Usar ejemplo MVP');
  });
});
