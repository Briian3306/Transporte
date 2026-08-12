import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso9RevisionComponent } from './paso9-revision.component';
import { PEAJES_CARGA_SERVICE } from '../../models';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso9RevisionComponent', () => {
  let fixture: ComponentFixture<Paso9RevisionComponent>;
  let component: Paso9RevisionComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso9RevisionComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setPreview({
      nombreArchivo: 'pasadas.xlsx',
      tamanioBytes: 100,
      totalFilas: 1,
      columnas: ['X'],
      filasPreview: [{ X: 1 }],
      filasOrigen: [{ X: 1 }],
      tiposInferidos: { X: 'número' },
    });
    state.setFactura({
      factura: 'A-1',
      cuenta: 'C-1',
      empresa_id: 'E-1',
      fecha_factura: '2026-06-30',
      bonificacion: 0,
      importe_sin_iva: 12180,
      percepciones: 2558,
      iva: 0,
      importe_total: 14738,
    });
    state.setPasadasEstandarizadas([
      {
        PASADA_ID: null,
        FECHA_HORA: '2026-06-25 20:50:05',
        PASE_ID: '98702170',
        PATENTE_ID: 'AD625QB',
        ESTACION_ID: 'EST-096',
        PRECIO: 17400,
        BONIFICACION: 5220,
        QUANTITY: 1,
        IMPORTE_NETO: 12180,
        CATEGORIA: null,
      },
    ]);
    state.setValidacion({
      validas: state.snapshot().pasadasEstandarizadas,
      errores: [],
      diferenciaFactura: 0,
      dentroTolerancia: true,
    });

    fixture = TestBed.createComponent(Paso9RevisionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('confirma carga y guarda pasadas + registro (mock)', async () => {
    await component.confirmar();
    fixture.detectChanges();
    expect(component.resultado).toBeTruthy();
    expect(component.resultado!.pasadas.length).toBe(1);
    expect(component.resultado!.registro.filas_procesadas).toBe(1);
    expect(component.resultado!.registro.parametros_efectivos).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Carga confirmada');
  });

  it('masiva: no confirma documentos omitidos y los lista en el resumen', async () => {
    state.setModoImportacion('masiva');
    state.setDocumentos([
      {
        factura: 'OK-1',
        tipo: 'FC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: 12180,
        percepciones: 0,
        iva: 0,
        importe_total: 12180,
        rowIndexes: [0],
        status: 'ok',
        errores: [],
        omitido: false,
      },
      {
        factura: 'SKIP-2',
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
      state.snapshot().pasadasEstandarizadas[0],
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        IMPORTE_NETO: 50,
      },
    ] as never);
    state.setValidacion({
      validas: state.snapshot().pasadasEstandarizadas,
      errores: [],
      diferenciaFactura: 0,
      dentroTolerancia: true,
    });
    fixture.detectChanges();
    expect(component.documentosOmitidos.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Omitidos');
    expect(fixture.nativeElement.textContent).toContain('SKIP-2');
    expect(fixture.nativeElement.textContent).toContain('Empresa obligatoria');

    await component.confirmar();
    fixture.detectChanges();
    expect(component.importadosResumen.length).toBe(1);
    expect(component.importadosResumen[0].numero).toBe('OK-1');
    expect(component.erroresPorDocumento.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Importados correctamente');
  });

  it('masiva: confirma con rowIndexes sobre pasadasEstandarizadas, no validacion.validas concatenadas', async () => {
    // String token (not InjectionToken) — cast for TestBed.inject typing.
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    const confirmSpy = spyOn(carga, 'confirmarCarga').and.callThrough();
    const base = state.snapshot().pasadasEstandarizadas[0];
    const p = (neto: number) => ({ ...base, IMPORTE_NETO: neto });

    // Excel: idx0=100 (doc A), idx1=200 (doc B), idx2=50 (doc A)
    state.setModoImportacion('masiva');
    state.setPasadasEstandarizadas([p(100), p(200), p(50)] as never);
    state.setDocumentos([
      {
        factura: 'DOC-A',
        tipo: 'FC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: 150,
        percepciones: 0,
        iva: 0,
        importe_total: 150,
        rowIndexes: [0, 2],
        status: 'ok',
        errores: [],
        omitido: false,
      },
      {
        factura: 'DOC-B',
        tipo: 'FC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: 200,
        percepciones: 0,
        iva: 0,
        importe_total: 200,
        rowIndexes: [1],
        status: 'ok',
        errores: [],
        omitido: false,
      },
    ]);
    // Paso 8 concatena subsets A+B → [100, 50, 200]. Filtrar A con {0,2} ahí daría [100, 200]=300 (bug RN-17).
    state.setValidacion({
      validas: [p(100), p(50), p(200)] as never,
      errores: [],
      diferenciaFactura: 0,
      dentroTolerancia: true,
    });
    fixture.detectChanges();

    await component.confirmar();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    const netosA = confirmSpy.calls.argsFor(0)[0].pasadas.map((x) => Number(x.IMPORTE_NETO));
    const netosB = confirmSpy.calls.argsFor(1)[0].pasadas.map((x) => Number(x.IMPORTE_NETO));
    expect(netosA).toEqual([100, 50]);
    expect(netosB).toEqual([200]);
    expect(component.erroresPorDocumento.length).toBe(0);
  });
});
