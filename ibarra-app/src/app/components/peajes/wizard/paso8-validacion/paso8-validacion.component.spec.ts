import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso8ValidacionComponent } from './paso8-validacion.component';
import { PEAJES_CARGA_SERVICE, PEAJES_CATALOGO_SERVICE } from '../../models';
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
