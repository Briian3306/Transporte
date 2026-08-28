import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Paso8ValidacionComponent } from './paso8-validacion.component';
import {
  ErrorValidacionPasada,
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
} from '../../models';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
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
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setFactura({
      factura: 'A-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-30',
      bonificacion: 0,
      importe_sin_iva: 100,
      percepciones: 21,
      iva: 0,
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
        CATEGORIA: null,
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

  it('explica el UUID inválido sin ocultar los demás controles', () => {
    expect(component.diagnosticos.length).toBe(5);
    const duplicados = component.diagnosticos.find((d) => d.id === 'duplicados');
    expect(duplicados?.estado).toBe('error');
    expect(duplicados?.detalle).toContain('no es un UUID');
    expect(duplicados?.tecnico?.rpc).toBe('peajes_detectar_duplicados');
    expect(duplicados?.tecnico?.postgresCode).toBe('22P02');
    expect(duplicados?.tecnico?.httpStatus).toBe(400);
  });

  it('ofrece los detalles técnicos expandibles y el enlace al paso de corrección', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Detalles técnicos');
    expect(text).toContain('Ir al Paso 5');
  });

  it('no emite completado cuando hay errores de validación', async () => {
    const spy = spyOn(component.completado, 'emit');
    await component.validar();
    expect(component.puedeContinuar).toBeFalse();
    expect(spy).not.toHaveBeenCalled();
  });

  it('resuelve el código de dispositivo del proveedor al UUID de pase del catálogo', async () => {
    const catalogo = TestBed.inject(PEAJES_CATALOGO_SERVICE as never) as PeajesCatalogoMockService;
    const pase = (await new Promise<unknown>((resolve) => catalogo.listarPases().subscribe(resolve))) as Array<{ id: string; pase: string }>;
    state.setPasadasEstandarizadas([{ ...state.snapshot().pasadasEstandarizadas[0], PASE_ID: pase[0].pase }] as never);
    await component.validar();
    expect(state.snapshot().pasadasEstandarizadas[0].PASE_ID).toBe(pase[0].id);
  });

  it('masiva: no valida pasadas de documentos omitidos', async () => {
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    state.setModoImportacion('masiva');
    state.setDocumentos([
      {
        factura: 'OK-1',
        tipo: 'FC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: 100,
        percepciones: 0,
        iva: 21,
        importe_total: 121,
        rowIndexes: [0],
        status: 'ok',
        errores: [],
        omitido: false,
      },
      {
        factura: 'BAD-2',
        tipo: 'FC',
        cuenta: '',
        empresa_id: '',
        fecha_factura: '',
        bonificacion: null,
        importe_sin_iva: null,
        percepciones: null,
        iva: null,
        importe_total: null,
        rowIndexes: [1],
        status: 'warn',
        errores: ['Empresa obligatoria'],
        omitido: true,
      },
    ]);
    state.setPasadasEstandarizadas([
      {
        FECHA_HORA: '2026-06-25 20:50:05',
        PASE_ID: uuid,
        PATENTE_ID: uuid,
        ESTACION_ID: uuid,
        PRECIO: 100,
        BONIFICACION: 0,
        QUANTITY: 1,
        IMPORTE_NETO: 100,
      },
      {
        FECHA_HORA: '',
        PASE_ID: 'not-uuid',
        PATENTE_ID: '',
        ESTACION_ID: 'bad',
        PRECIO: 50,
        BONIFICACION: 0,
        QUANTITY: 1,
        IMPORTE_NETO: 50,
      },
    ] as never);
    await component.validar();
    expect(component.documentosOmitidosCount).toBe(1);
    // Errores de la fila omitida no deben aparecer
    expect(component.resultado!.errores.some((e) => String(e.valor) === 'not-uuid')).toBeFalse();
    expect(component.resultado!.errores.some((e) => e.columna === 'FECHA_HORA' && e.fila === 2)).toBeFalse();
  });
});

describe('Paso8ValidacionComponent last pase from patente', () => {
  const patenteId = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111';
  const oldPaseId = 'aaaaaaaa-bbbb-4ccc-8ddd-222222222222';
  const newPaseId = 'aaaaaaaa-bbbb-4ccc-8ddd-333333333333';
  const estacionId = 'aaaaaaaa-bbbb-4ccc-8ddd-444444444444';
  const patenteSinPaseId = 'aaaaaaaa-bbbb-4ccc-8ddd-666666666666';

  let fixture: ComponentFixture<Paso8ValidacionComponent>;
  let component: Paso8ValidacionComponent;
  let state: PeajesWizardStateService;
  let crearPaseSpy: jasmine.Spy;
  let detectarSpy: jasmine.Spy;
  let duplicadosRespuesta: ErrorValidacionPasada[];

  const pasadaBase = {
    PASADA_ID: null as string | null,
    FECHA_HORA: '2026-07-01 10:00:00',
    PASE_ID: null as string | null,
    PATENTE_ID: patenteId,
    ESTACION_ID: estacionId,
    PRECIO: 1840,
    BONIFICACION: 0,
    QUANTITY: 1,
    IMPORTE_NETO: 1840,
    CATEGORIA: null as string | null,
  };

  beforeEach(async () => {
    crearPaseSpy = jasmine.createSpy('crearPase');
    duplicadosRespuesta = [];
    detectarSpy = jasmine.createSpy('detectarDuplicados').and.callFake(() =>
      of(duplicadosRespuesta)
    );

    await TestBed.configureTestingModule({
      imports: [Paso8ValidacionComponent],
      providers: [
        PeajesWizardStateService,
        {
          provide: PEAJES_CARGA_SERVICE,
          useValue: {
            validarCarga: () =>
              of({
                validas: [pasadaBase],
                errores: [],
                diferenciaFactura: 0,
                dentroTolerancia: true,
              }),
            detectarDuplicados: detectarSpy,
          },
        },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPatentes: () =>
              of([
                { id: patenteId, patente: 'AD625QB', categoria: 'FLOTA CAMIONES', activa: true },
                {
                  id: patenteSinPaseId,
                  patente: 'XX000YY',
                  categoria: 'FLOTA CAMIONES',
                  activa: true,
                },
              ]),
            listarPases: () =>
              of([
                {
                  id: oldPaseId,
                  pase: 'TAG-OLD',
                  patente_id: patenteId,
                  created_at: '2026-01-01T00:00:00Z',
                },
                {
                  id: newPaseId,
                  pase: 'TAG-NEW',
                  patente_id: patenteId,
                  created_at: '2026-08-01T00:00:00Z',
                },
              ]),
            crearPase: crearPaseSpy,
          },
        },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setFactura({
      factura: 'A-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-30',
      bonificacion: 0,
      importe_sin_iva: 1840,
      percepciones: 0,
      iva: 0,
      importe_total: 1840,
    });
    state.setPasadasEstandarizadas([pasadaBase]);

    fixture = TestBed.createComponent(Paso8ValidacionComponent);
    component = fixture.componentInstance;
  });

  it('fills empty PASE_ID with the latest catalog pase of that patente', async () => {
    await component.validar();
    expect(state.snapshot().pasadasEstandarizadas[0].PASE_ID).toBe(newPaseId);
    expect(crearPaseSpy).not.toHaveBeenCalled();
    expect(detectarSpy).toHaveBeenCalled();
    const duplicados = component.diagnosticos.find((d) => d.id === 'duplicados');
    expect(duplicados?.estado).toBe('ok');
  });

  it('shows the imported and persisted values for a duplicate', async () => {
    duplicadosRespuesta = [{
      fila: 1,
      columna: 'CLAVE_DUPLICADO',
      valor: 'duplicate-key',
      motivo: 'Ya existe una pasada',
      pasada: newPaseId,
      patente: patenteId,
      pase_nombre: 'TAG-NEW',
      patente_nombre: 'AD625QB',
      fecha_hora: pasadaBase.FECHA_HORA,
      fecha_hora_repetida: '2026-07-01T10:00:00.000Z',
      valor_repetido: 1700,
      file_upload_name: 'carga-original.csv',
      duplicado: true,
    }];

    await component.validar();
    fixture.detectChanges();

    expect(component.error).toBeNull();
    expect(component.duplicados.length).toBe(1);
    expect(component.duplicadosComparacion.length).toBe(1);

    expect(component.duplicadosComparacion[0].valor).toBe(1840);
    expect(component.duplicadosComparacion[0].valor_repetido).toBe(1700);
    expect(component.duplicadosComparacion[0].patente).toBe('AD625QB');
    expect(component.duplicadosComparacion[0].pasada).toBe('TAG-NEW');
    expect(component.duplicadosComparacion[0].file_upload_name).toBe('carga-original.csv');
    await component.validar();
    expect(component.duplicadosComparacion.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Fecha_Hora repetida');
    expect(fixture.nativeElement.textContent).toContain('Valor repetido');
    expect(fixture.nativeElement.textContent).toContain('1700');
    expect(fixture.nativeElement.textContent).toContain('Subir igualmente');
    expect(component.puedeContinuar).toBeFalse();

    component.subirIgualmente();
    fixture.detectChanges();
    expect(state.snapshot().permitirDuplicados).toBeTrue();
    expect(component.puedeContinuar).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('DUPLICADO = sí');
  });

  it('reuses one latest pase for every row of the same patente', async () => {
    state.setPasadasEstandarizadas([
      { ...pasadaBase },
      { ...pasadaBase, FECHA_HORA: '2026-07-01 11:00:00' },
    ]);
    await component.validar();
    const rows = state.snapshot().pasadasEstandarizadas;
    expect(rows[0].PASE_ID).toBe(newPaseId);
    expect(rows[1].PASE_ID).toBe(newPaseId);
    expect(crearPaseSpy).not.toHaveBeenCalled();
  });

  it('names the plate when the patente has no pase', async () => {
    state.setPasadasEstandarizadas([{ ...pasadaBase, PATENTE_ID: patenteSinPaseId }]);
    await component.validar();
    fixture.detectChanges();
    expect(crearPaseSpy).not.toHaveBeenCalled();
    expect(detectarSpy).not.toHaveBeenCalled();
    expect(component.resultado!.errores.some((e) => String(e.motivo).includes('XX000YY'))).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('XX000YY');
  });

  it('emite completado cuando todas las validaciones están ok', async () => {
    const spy = spyOn(component.completado, 'emit');
    await component.validar();
    expect(component.puedeContinuar).toBeTrue();
    expect(spy).toHaveBeenCalled();
  });
});

