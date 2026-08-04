import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso5MapeoComponent } from './paso5-mapeo.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { PEAJES_CATALOGO_SERVICE } from '../../models';
import { of } from 'rxjs';

describe('Paso5MapeoComponent', () => {
  let fixture: ComponentFixture<Paso5MapeoComponent>;
  let component: Paso5MapeoComponent;
  let state: PeajesWizardStateService;
  let crearPatenteSpy: jasmine.Spy;

  function setupUnresolvedPreview(patentes: string[]): void {
    const filas = patentes.map((PATENTE) => ({
      FECHA: '2026-01-01',
      HORA: '08:00:00',
      PATENTE,
      ESTACION: 'E1',
      DISPOSITIVO: '1',
      TARIFA: '10',
      BONIFICACION: '0',
    }));
    state.setPreview({
      nombreArchivo: 'a.csv',
      tamanioBytes: 1,
      totalFilas: filas.length,
      columnas: ['FECHA', 'HORA', 'PATENTE', 'ESTACION', 'DISPOSITIVO', 'TARIFA', 'BONIFICACION'],
      filasPreview: filas.slice(0, 10),
      filasOrigen: filas,
      tiposInferidos: {},
    });
    state.setMapeos([
      { columnaOrigen: 'FECHA', columnaDestino: 'FECHA_HORA', excluida: false },
      { columnaOrigen: 'PATENTE', columnaDestino: 'PATENTE_ID', excluida: false },
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
      { columnaOrigen: 'DISPOSITIVO', columnaDestino: 'PASE_ID', excluida: false },
      { columnaOrigen: 'TARIFA', columnaDestino: 'PRECIO', excluida: false },
      { columnaOrigen: 'BONIFICACION', columnaDestino: 'BONIFICACION', excluida: false },
    ]);
  }

  beforeEach(async () => {
    crearPatenteSpy = jasmine
      .createSpy('crearPatente')
      .and.callFake((data: { patente: string; categoria: string }) =>
        of({ id: `p-${data.patente}`, patente: data.patente, categoria: data.categoria })
      );

    await TestBed.configureTestingModule({
      imports: [Paso5MapeoComponent],
      providers: [
        PeajesWizardStateService,
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPatentes: () => of([]),
            crearPatente: crearPatenteSpy,
          },
        },
      ],
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
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('no permite avanzar con columnas obligatorias sin mapear', async () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    await component.continuar();
    expect(component.error).toContain('obligatorias');
    expect(spy).not.toHaveBeenCalled();
  });

  it('restaura PATENTE_ID, PRECIO y BONIFICACION desde encabezados del proveedor', async () => {
    state.setPreview({
      nombreArchivo: '387882.csv', tamanioBytes: 10, totalFilas: 1,
      columnas: ['PATENTE', 'TARIFA', 'BONIFICACION'],
      filasPreview: [], filasOrigen: [], tiposInferidos: {},
    });
    state.setMapeos([]);
    await component.ngOnInit();

    expect(component.mapeos.map((m) => `${m.columnaOrigen}:${m.columnaDestino}`)).toEqual([
      'PATENTE:PATENTE_ID', 'TARIFA:PRECIO', 'BONIFICACION:BONIFICACION',
    ]);
  });

  it('F02-14: lista patentes sin resolver y permite quitarlas', async () => {
    setupUnresolvedPreview(['AH033DL']);
    await component.ngOnInit();
    expect(component.unresolvedPatentes).toContain('AH033DL');
    component.quitarPatente('AH033DL');
    expect(component.unresolvedPatentes).not.toContain('AH033DL');
    expect(state.snapshot().patentesExcluidas).toContain('AH033DL');
  });

  it('F02-16: Agregar todas crea las patentes unresolved', async () => {
    setupUnresolvedPreview(['AH033DL', 'AE751PA']);
    await component.ngOnInit();
    expect(component.unresolvedPatentes.length).toBe(2);

    await component.agregarTodasPatentes();

    expect(crearPatenteSpy).toHaveBeenCalledTimes(2);
    expect(component.unresolvedPatentes).toEqual([]);
    expect(component.error).toBeNull();
  });

  it('F02-16: Quitar todas excluye las patentes visibles del import', async () => {
    setupUnresolvedPreview(['AH033DL', 'AE751PA']);
    await component.ngOnInit();

    component.quitarTodasPatentes();

    expect(component.unresolvedPatentes).toEqual([]);
    expect(state.snapshot().patentesExcluidas).toEqual(
      jasmine.arrayContaining(['AH033DL', 'AE751PA'])
    );
  });
});
