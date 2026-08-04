import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso6EstacionesComponent } from './paso6-estaciones.component';
import { PEAJES_CATALOGO_SERVICE } from '../../models';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso6EstacionesComponent', () => {
  let fixture: ComponentFixture<Paso6EstacionesComponent>;
  let component: Paso6EstacionesComponent;
  let state: PeajesWizardStateService;

  const filas557074 = [
    {
      FECHA: '2026-07-16',
      HORA: '01:34:14',
      ESTACION: 'CAMPANA',
      VIA: '0003',
      DISPOSITIVO: '94891934',
      PATENTE: 'AE751PA',
    },
    {
      FECHA: '2026-07-16',
      HORA: '05:17:58',
      ESTACION: 'CAMPANA',
      VIA: '0001',
      DISPOSITIVO: '93423682',
      PATENTE: 'AH033DL',
    },
  ];

  async function crearConPreview(opts: {
    columnas: string[];
    filas: Record<string, unknown>[];
    incluidas: string[];
    excluidas: string[];
  }): Promise<void> {
    state.reiniciar();
    state.setPreview({
      nombreArchivo: '557074.csv',
      tamanioBytes: 10,
      totalFilas: opts.filas.length,
      columnas: opts.columnas,
      filasPreview: opts.filas.slice(0, 10),
      filasOrigen: opts.filas,
      tiposInferidos: Object.fromEntries(opts.columnas.map((c) => [c, 'texto'])),
    });
    state.setSeleccionColumnas(opts.incluidas, opts.excluidas);
    state.setMapeos([
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
    ]);

    fixture = TestBed.createComponent(Paso6EstacionesComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso6EstacionesComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: '99' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
  });

  it('no permite continuar con estaciones sin relacionar', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.error).toContain('sin relacionar');
    expect(spy).not.toHaveBeenCalled();
  });

  it('F02-15: con VIA excluida usa solo ESTACION (CAMPANA)', async () => {
    await crearConPreview({
      columnas: ['FECHA', 'HORA', 'ESTACION', 'VIA', 'DISPOSITIVO', 'PATENTE'],
      filas: filas557074,
      incluidas: ['FECHA', 'HORA', 'ESTACION', 'DISPOSITIVO', 'PATENTE'],
      excluidas: ['VIA'],
    });

    const codigos = component.relaciones.map((r) => r.valorProveedor);
    expect(codigos).toEqual(['CAMPANA']);
    expect(codigos.some((c) => c.includes('0003') || c.includes(' - '))).toBeFalse();
  });

  it('F02-15: con VIA incluida combina ESTACION - VIA', async () => {
    await crearConPreview({
      columnas: ['FECHA', 'HORA', 'ESTACION', 'VIA', 'DISPOSITIVO', 'PATENTE'],
      filas: filas557074,
      incluidas: ['FECHA', 'HORA', 'ESTACION', 'VIA', 'DISPOSITIVO', 'PATENTE'],
      excluidas: [],
    });

    const codigos = component.relaciones.map((r) => r.valorProveedor).sort();
    expect(codigos).toEqual(['CAMPANA - 0001', 'CAMPANA - 0003']);
  });

  it('Ninguna coincide abre el diálogo de crear estación', () => {
    component.reconocimientos['99'] = {
      tipo: 'sugerencias',
      valorProveedor: '99',
      sugerencias: [],
    };
    component.declararSinCoincidencia('99');
    expect(component.creandoPara).toBe('99');
    expect(component.nuevaEstacionNombre).toBe('99');
  });
});
