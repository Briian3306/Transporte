import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { Paso6EstacionesComponent } from './paso6-estaciones.component';
import { PEAJES_CATALOGO_SERVICE } from '../../models';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { Estacion } from '../../models';

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

    await montarPaso6();
  }

  async function montarPaso6(): Promise<void> {
    fixture = TestBed.createComponent(Paso6EstacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
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

  it('FILTRAR_COLUMNA: Paso 6 solo lista estaciones que quedaron tras el filtro', async () => {
    await crearConPreview({
      columnas: ['ESTACION', 'TARIFA'],
      filas: [
        { ESTACION: '0001', TARIFA: 10 },
        { ESTACION: '0002', TARIFA: 20 },
        { ESTACION: '0003', TARIFA: 30 },
        { ESTACION: '0001', TARIFA: 40 },
      ],
      incluidas: ['ESTACION', 'TARIFA'],
      excluidas: [],
    });

    state.setConfiguracionesDraft([
      {
        clientId: 'filtro-1',
        orden: 5,
        tipo: 'transformacion',
        nombre_columna: 'ESTACION',
        columna_destino: null,
        algoritmo_combinado_id: null,
        configuracion: {
          algoritmo_codigo: 'FILTRAR_COLUMNA',
          columnas_entrada: ['ESTACION'],
          parametros: { columna: 'ESTACION', valor: '0001' },
          habilitado: true,
        },
        obligatoria: false,
      },
    ]);
    // Simula salida del motor tras filtro (origen preservado).
    state.setPasadasEstandarizadas([
      { ESTACION: '0001', TARIFA: 10 } as never,
      { ESTACION: '0001', TARIFA: 40 } as never,
    ]);

    await montarPaso6();

    const codigos = component.relaciones.map((r) => r.valorProveedor).sort();
    expect(codigos).toEqual(['0001']);
    expect(codigos).not.toContain('0002');
    expect(codigos).not.toContain('0003');
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

  it('oculta Peaje relacionado en importación masiva', async () => {
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: 'A' }, { ESTACION: 'B' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    // reiniciar() deja modo simple; aplicar masiva después del setup.
    state.setModoImportacion('masiva');
    fixture.detectChanges();
    expect(component.esCargaDensa).toBeTrue();
    expect(component.mostrarPeajeRelacionado).toBeFalse();
    const catalog = fixture.nativeElement.querySelector('.paso6__catalog');
    expect(catalog).toBeNull();
  });

  it('muestra Peaje relacionado en carga simple con pocas filas', () => {
    state.setModoImportacion('simple');
    fixture.detectChanges();
    expect(component.esCargaDensa).toBeFalse();
    expect(component.mostrarPeajeRelacionado).toBe(
      component.relaciones.length > 0 && component.peajesUnicos.length > 0
    );
  });

  it('no auto-matchea AUBASA cuando la empresa es AUTOVIA DEL MERCOSUR', async () => {
    state.reiniciar();
    state.setEmpresaId('37ab9246-a07a-40b5-b62d-7a8b8e7782db');
    state.setPreview({
      nombreArchivo: 'pasadas_2026-07-01_79157.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: '0001' }],
      filasOrigen: [{ ESTACION: '0001' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    state.setSeleccionColumnas(['ESTACION'], []);
    state.setMapeos([
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
    ]);

    await montarPaso6();

    expect(component.peajesUnicos.map((p) => p.nombre)).toEqual(['Autovía del Mercosur']);
    expect(component.relaciones.length).toBe(1);
    expect(component.relaciones[0].estacionId).toBe('EST-MER-0001');
    expect(component.relaciones[0].estacionId).not.toBe('EST-DOCK');
    expect(component.peajeDe(component.relaciones[0].estacionId)).toContain('Mercosur');
    expect(component.peajeDe(component.relaciones[0].estacionId)).not.toContain('AUBASA');
    expect(component.mostrarColumnaPeaje).toBeTrue();
    expect(component.alcanceEmpresaLabel).toBeTruthy();
  });

  it('descarta plantilla de DOCK SUD y reconoce Zarate si la empresa es MERCOSUR', async () => {
    state.reiniciar();
    state.setEmpresaId('37ab9246-a07a-40b5-b62d-7a8b8e7782db');
    state.setPreview({
      nombreArchivo: 'pasadas_2026-07-16_86802.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: '0001' }],
      filasOrigen: [{ ESTACION: '0001' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    state.setSeleccionColumnas(['ESTACION'], []);
    state.setMapeos([
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
    ]);
    state.setRelacionesEstacion([
      { valorProveedor: '0001', estacionId: 'EST-DOCK' },
    ]);

    await montarPaso6();

    expect(component.codigosFueraDeEmpresa).toEqual(['0001']);
    expect(component.relaciones[0].estacionId).toBe('EST-MER-0001');
    expect(component.relaciones[0].estacionId).not.toBe('EST-DOCK');
  });

  it('sin peajes de la empresa no cae al catálogo global ni muestra AUBASA', async () => {
    state.reiniciar();
    state.setEmpresaId('empresa-sin-peajes');
    state.setPreview({
      nombreArchivo: 'x.csv',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: '0001' }],
      filasOrigen: [{ ESTACION: '0001' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    state.setSeleccionColumnas(['ESTACION'], []);
    state.setMapeos([
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
    ]);

    await montarPaso6();

    expect(component.sinPeajesEmpresa).toBeTrue();
    expect(component.peajesUnicos.length).toBe(0);
    expect(component.relaciones[0].estacionId).toBeNull();
    expect(component.peajeDe(component.relaciones[0].estacionId, '0001')).toBe('—');
  });

  it('Acciones expone Cambiar estación cuando hay match', async () => {
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: '3' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    state.setEmpresaId('EMP-001');
    await montarPaso6();

    const matched = component.relaciones.find((r) => r.estacionId);
    expect(matched?.estacionId).toBeTruthy();
    const html = fixture.nativeElement as HTMLElement;
    const btn = Array.from(html.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Cambiar estación')
    );
    expect(btn).toBeTruthy();
  });

  it('filtra y pagina la lista de estaciones', async () => {
    const filas = Array.from({ length: 45 }, (_, i) => ({ ESTACION: `EST-${i}` }));
    await crearConPreview({
      columnas: ['ESTACION'],
      filas,
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    expect(component.relaciones.length).toBe(45);
    expect(component.relacionesPagina.length).toBe(40);
    expect(component.totalRowPages).toBe(2);
    component.onFiltroChange('EST-4');
    expect(component.relacionesFiltradas.some((r) => r.valorProveedor === 'EST-4')).toBeTrue();
    expect(component.rowPage).toBe(0);
  });

  it('conserva la relación 0001 tras recrear Paso 6 con código 1', async () => {
    const estacionId = '67486ca3-6e88-49a8-b628-7f41e946da5a';
    const catalogo = TestBed.inject(Injector).get(PEAJES_CATALOGO_SERVICE) as PeajesCatalogoMockService;
    catalogo.agregarEstacionesDePrueba([
      {
        id: estacionId,
        peaje_id: 'PEA-001',
        nombre: 'Estación 0001 F16',
        codigos_proveedor: ['0001'],
        created_at: '2026-01-01T00:00:00Z',
      } as Estacion,
    ]);
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: '1' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    state.setEmpresaId('EMP-001');
    state.setRelacionesEstacion([
      {
        valorProveedor: '0001',
        estacionId,
        peajeIdDerivado: 'PEA-001',
        peajeIdAlcance: 'PEA-001',
      },
    ]);
    await montarPaso6();
    expect(component.relaciones[0]?.estacionId).toBe(estacionId);
    expect(component.pendientesCount).toBe(0);
  });

  it('conserva la relación 3 tras recrear Paso 6 con código 0003', async () => {
    const estacionId = '60014adb-62f4-4ad9-86a0-50bd36efd1e3';
    const catalogo = TestBed.inject(Injector).get(PEAJES_CATALOGO_SERVICE) as PeajesCatalogoMockService;
    catalogo.agregarEstacionesDePrueba([
      {
        id: estacionId,
        peaje_id: 'PEA-001',
        nombre: 'Estación 0003 F16',
        codigos_proveedor: ['0003'],
        created_at: '2026-01-01T00:00:00Z',
      } as Estacion,
    ]);
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: '0003' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    state.setEmpresaId('EMP-001');
    state.setRelacionesEstacion([
      {
        valorProveedor: '3',
        estacionId,
        peajeIdDerivado: 'PEA-001',
        peajeIdAlcance: 'PEA-001',
      },
    ]);
    await montarPaso6();
    expect(component.relaciones[0]?.estacionId).toBe(estacionId);
  });

  it('vuelve a pedir estación si la relación guardada es de otra empresa', async () => {
    await crearConPreview({
      columnas: ['ESTACION'],
      filas: [{ ESTACION: '0001' }],
      incluidas: ['ESTACION'],
      excluidas: [],
    });
    state.setEmpresaId('37ab9246-a07a-40b5-b62d-7a8b8e7782db');
    state.setRelacionesEstacion([
      {
        valorProveedor: '0001',
        estacionId: 'EST-DOCK',
        peajeIdDerivado: 'PEA-AUBASA',
        peajeIdAlcance: 'PEA-AUBASA',
      },
    ]);
    await montarPaso6();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.relaciones[0]?.estacionId).not.toBe('EST-DOCK');
    expect(component.codigosFueraDeEmpresa).toContain('0001');
  });
});
