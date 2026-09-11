import { ComponentFixture, TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { Paso9RevisionComponent } from './paso9-revision.component';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  TARIFA_REFRESH_SERVICE,
} from '../../models';
import {
  PEAJES_TARIFARIO_SERVICE,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';
import {
  CandidatoRefrescoTarifa,
  ResultadoDetectarRefresco,
  ResumenRefrescoTarifas,
} from '../../models/tarifa-refresh.contracts';
import { PeajesCargaMockService } from '../mocks/peajes-carga.mock';
import { PeajesCatalogoMockService } from '../mocks/peajes-catalogo.mock';
import { ESTACION_DOCK_SUD, TarifaRefreshMockService } from '../mocks/tarifa-refresh.mock';
import { TarifarioMockService } from '../../tarifario/mocks/tarifario.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { GranularPermissionService } from '../../../../services/granular-permission.service';
import { TarifaValidationService } from '../../services/tarifa-validation.service';

const ESTACION_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function candidatoResumen(
  partial: Partial<CandidatoRefrescoTarifa> & { estacionId: string },
): CandidatoRefrescoTarifa {
  return {
    id: partial.id ?? partial.estacionId,
    categoria: 2,
    categoriaProveedor: 2,
    categoriaCalculada: null,
    statusSolicitado: 'NO_PICO',
    sentidoSolicitado: 'AMBAS',
    directionConfidence: 'EXPLICIT',
    sourceStationCode: null,
    sourceLane: null,
    fechaPasada: '2026-06-25',
    estacionNombre: null,
    peajeId: 'PEA-001',
    peajeNombre: 'Peaje',
    candidatePrice: 12500,
    precioDirecto: 12500,
    cases: 1,
    filaRepresentativa: {},
    rowIndexes: [0],
    ...partial,
  };
}

function resultadoResumen(
  partial: Partial<ResultadoDetectarRefresco> & { codigo: ResultadoDetectarRefresco['codigo'] },
): ResultadoDetectarRefresco {
  return {
    id: partial.id ?? partial.codigo,
    peajeId: 'peaje-aubasa',
    estacionId: 'EST-096',
    categoria: 2,
    categoriaProveedor: 2,
    categoriaCalculada: null,
    status: 'NO_PICO',
    sentidoSolicitado: 'AMBAS',
    sentidoAplicado: 'AMBAS',
    importeActual: 11975.15,
    tarifaId: 'tarifa-1',
    tarifaImporteId: 'ti-1',
    requiereNormalizacionIva: false,
    diagnostico: null,
    fechaVigenciaInicio: null,
    fechaVigenciaFin: null,
    fechaPasada: '2026-06-25',
    possibleMatches: [],
    rowIndexes: [0],
    ...partial,
  };
}

function resumenTarifas(
  resultados: ResultadoDetectarRefresco[],
  candidatos: CandidatoRefrescoTarifa[] = [],
): ResumenRefrescoTarifas {
  return {
    candidatos,
    resultados,
    filasVigentes: resultados.filter((r) => r.codigo === 'CURRENT_TARIFF').length,
    filasHistoricas: resultados.filter((r) => r.codigo === 'HISTORICAL_TARIFF_MATCH').length,
    filasCorreccionCategoria: resultados.filter((r) =>
      r.codigo.includes('CATEGORY_CORRECTION'),
    ).length,
    filasNuevasConfirmadas: 0,
    filasSinResolver: resultados.filter((r) => r.codigo === 'NEW_TARIFF').length,
    filasCambioVigencia: resultados.filter((r) => !!r.fechaVigenciaFin).length,
    pendientes: resultados.filter((r) => r.codigo === 'NEW_TARIFF').length,
    contextIncomplete: false,
  };
}

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
        { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
        { provide: TARIFA_REFRESH_SERVICE, useClass: TarifaRefreshMockService },
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        { provide: GranularPermissionService, useValue: { hasPermission: () => true } },
        {
          provide: TarifaValidationService,
          useValue: { asociarTrasConfirmacion: () => Promise.resolve() },
        },
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
        PASE_ID: 'PAS-001',
        PATENTE_ID: 'PAT-001',
        ESTACION_ID: 'EST-096',
        PRECIO: 17400,
        BONIFICACION: 5220,
        QUANTITY: 1,
        IMPORTE_NETO: 12180,
        CATEGORIA: null,
        SENTIDO: 'AMBAS',
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
    await component.ngOnInit();
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

  it('muestra Pase (ext), Patente y Estación en vez de IDs internos', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pase (ext)');
    expect(text).toContain('Patente');
    expect(text).toContain('Estación');
    expect(text).not.toContain('PASE_ID');
    expect(text).not.toContain('PATENTE_ID');
    expect(text).not.toContain('ESTACION_ID');
    expect(text).toContain('98702170');
    expect(text).toContain('AD625QB');
    expect(text).toContain('Monte Grande');
    expect(text).not.toContain('PAS-001');
    expect(text).not.toContain('PAT-001');
  });

  it('pone Confirmar carga en el encabezado, no en el pie', () => {
    const head = fixture.nativeElement.querySelector('.pw__head') as HTMLElement;
    const footer = fixture.nativeElement.querySelector('.pw__footer') as HTMLElement;
    expect(head.textContent).toContain('Confirmar carga');
    expect(head.textContent).toContain('Volver');
    expect(footer.textContent).not.toContain('Confirmar carga');
  });

  it('tras confirmar muestra el diálogo y al cerrarlo emite reiniciar', async () => {
    const spy = spyOn(component.reiniciar, 'emit');
    await component.confirmar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Se subieron 1 registros correctamente!');
    expect(fixture.nativeElement.textContent).toContain('Cargar otro archivo');
    component.onExitoCerrado();
    expect(spy).toHaveBeenCalled();
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

  it('no abre diálogo ni bloquea confirmar cuando el precio vigente coincide', async () => {
    expect(component.dialogNeeded).toBeFalse();
    expect(component.confirmationBlocked).toBeFalse();
    expect(component.refreshOpen).toBeFalse();
  });

  it('abre el diálogo y bloquea confirmar ante una tarifa nueva de Dock Sud', async () => {
    const { ESTACION_DOCK_SUD } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: ESTACION_DOCK_SUD,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'NEW_TARIFF')).toBeTrue();
    expect(component.dialogNeeded).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();
    expect(component.refreshOpen).toBeTrue();
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    const spy = spyOn(carga, 'confirmarCarga').and.callThrough();
    await component.confirmar();
    expect(spy).not.toHaveBeenCalled();
  });

  it('no vuelve a armar plantillas ni a listar tarifario en cada CD del diálogo', async () => {
    const { ESTACION_DOCK_SUD } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: ESTACION_DOCK_SUD,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    await fixture.whenStable();
    const plantillaSpy = spyOn(state, 'toConfiguracionesPlantilla').and.callThrough();
    const tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    const listar = spyOn(tarifario, 'listar').and.callThrough();
    fixture.detectChanges();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(plantillaSpy).not.toHaveBeenCalled();
    expect(listar).not.toHaveBeenCalled();
  });

  it('marca coincidencia histórica como informativa sin diálogo', async () => {
    const { ESTACION_DOCK_SUD } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: ESTACION_DOCK_SUD,
        PRECIO: 12100,
        IMPORTE_NETO: 12100,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.resumenRefresco?.filasHistoricas).toBeGreaterThan(0);
    expect(component.dialogNeeded).toBeFalse();
    expect(component.refreshOpen).toBeFalse();
  });

  it('incluye sentido AMBAS por defecto en el payload de confirmación', async () => {
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    const spy = spyOn(carga, 'confirmarCarga').and.callThrough();
    await component.confirmar();
    expect(spy.calls.mostRecent().args[0].pasadas[0].SENTIDO).toBe('AMBAS');
  });

  it('renderiza las seis secciones de tarifas con nombres, corrección y vigencia dd/MM/yyyy', () => {
    const guardada: TarifaRefrescoGuardada = {
      peaje_id: 'PEA-001',
      estacion_id: 'EST-096',
      sentido: 'AMBAS',
      categoria: 2,
      status: 'NO_PICO',
      tarifa_id: 'tarifa-nueva',
      anterior: 11975.15,
      nueva: 12500,
      tarifa_importe_id: 'ti-nueva',
      accion: 'ACTUALIZADA',
      diagnostico: 'CONFIRMADO',
      fecha_vigencia_inicio: '2026-09-01',
      candidate_id: 'cand-nueva',
    };
    component.tarifasActualizadas = [guardada];
    component.resumenRefresco = resumenTarifas(
      [
        resultadoResumen({ codigo: 'CURRENT_TARIFF', estacionId: 'EST-096', rowIndexes: [0] }),
        resultadoResumen({
          codigo: 'HISTORICAL_TARIFF_MATCH',
          estacionId: ESTACION_UUID,
          rowIndexes: [1],
          tarifaImporteId: 'ti-hist',
        }),
        resultadoResumen({
          codigo: 'CURRENT_CATEGORY_CORRECTION',
          estacionId: 'EST-096',
          categoriaProveedor: 3,
          categoriaCalculada: 2,
          rowIndexes: [2],
          tarifaImporteId: 'ti-corr',
        }),
        resultadoResumen({
          codigo: 'REVIEW_RECORDED',
          estacionId: ESTACION_DOCK_SUD,
          diagnostico: 'REVISAR',
          rowIndexes: [3],
          tarifaImporteId: 'ti-rev',
        }),
      ],
      [
        candidatoResumen({ estacionId: 'EST-096', estacionNombre: 'Monte Grande' }),
        candidatoResumen({
          estacionId: ESTACION_UUID,
          estacionNombre: 'Hudson',
          rowIndexes: [1],
        }),
        candidatoResumen({
          estacionId: ESTACION_DOCK_SUD,
          estacionNombre: 'Dock Sud',
          rowIndexes: [3],
        }),
      ],
    );
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Coincidencias vigentes');
    expect(text).toContain('Coincidencias históricas');
    expect(text).toContain('Correcciones de categoría');
    expect(text).toContain('Tarifas nuevas confirmadas');
    expect(text).toContain('Marcadas REVISAR');
    expect(text).toContain('Cambios de vigencia');
    expect(text).toContain('Monte Grande');
    expect(text).toContain('Hudson');
    expect(text).toContain('Dock Sud');
    expect(text).toContain('Categoría proveedor 3 -> calculada 2');
    expect(text).toContain('Vigente desde');
    expect(text).toContain('01/09/2026');
    expect(text).not.toContain(ESTACION_UUID);
    expect(text).not.toContain(ESTACION_DOCK_SUD);
  });

  it('bloquea un candidato sin resolver y habilita confirmar solo tras persistir REVISAR', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: dock,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'NEW_TARIFF')).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();

    component.onRefreshCancelled();
    fixture.detectChanges();
    expect(component.refreshOpen).toBeFalse();
    expect(component.confirmationBlocked).toBeTrue();
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    const spy = spyOn(carga, 'confirmarCarga').and.callThrough();
    await component.confirmar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.refreshOpen).toBeTrue();

    component.refreshOpen = false;
    fixture.detectChanges();
    expect(component.confirmationBlocked).toBeTrue();

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    const candidato = component.resumenRefresco!.candidatos[0];
    const saved = await refresh.guardar([
      {
        candidateId: candidato.id,
        action: 'MARK_REVIEW',
        peajeId: 'peaje-aubasa',
        estacionId: dock,
        categoriaProveedor: 2,
        categoriaCalculada: 2,
        status: 'NO_PICO',
        sentido: 'AMBAS',
        importe: 12500,
        fechaVigenciaInicio: null,
        cases: 1,
        requiereNormalizacionIva: false,
      },
    ]);
    await component.onRefreshSaved(saved);
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'REVIEW_RECORDED')).toBeTrue();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'NEW_TARIFF')).toBeFalse();
    expect(component.confirmationBlocked).toBeFalse();
    expect(component.refreshOpen).toBeFalse();
    await component.confirmar();
    expect(spy).toHaveBeenCalled();
  });

  it('habilita confirmar tras REVISAR persistido aunque re-analizar siga en NEW_TARIFF', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: dock,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    const candidato = component.resumenRefresco!.candidatos[0];
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    spyOn(refresh, 'analizar').and.callFake(async () => ({
      ...component.resumenRefresco!,
      resultados: component.resumenRefresco!.resultados.map((row) => ({
        ...row,
        codigo: 'NEW_TARIFF' as const,
      })),
    }));
    await component.onRefreshSaved([
      {
        peaje_id: 'peaje-aubasa',
        estacion_id: dock,
        sentido: 'AMBAS',
        categoria: 2,
        status: 'NO_PICO',
        tarifa_id: 'tarifa-rev',
        anterior: 11975.15,
        nueva: 12500,
        tarifa_importe_id: 'ti-rev',
        accion: 'ACTUALIZADA',
        candidate_id: candidato.id,
        diagnostico: 'REVISAR',
        fecha_vigencia_inicio: null,
      },
    ]);
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'REVIEW_RECORDED')).toBeTrue();
    expect(component.confirmationBlocked).toBeFalse();
  });

  it('sin peajes:manage puede inspeccionar pero no sortea la puerta de decisión', async () => {
    const perms = TestBed.inject(GranularPermissionService);
    spyOn(perms, 'hasPermission').and.returnValue(false);
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: dock,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.canManageTarifas).toBeFalse();
    expect(component.dialogNeeded).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('peajes:manage');
    component.onRefreshCancelled();
    fixture.detectChanges();
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    const spy = spyOn(carga, 'confirmarCarga').and.callThrough();
    await component.confirmar();
    expect(spy).not.toHaveBeenCalled();
    expect(component.confirmationBlocked).toBeTrue();
  });

  it('asocia vigentes, históricas, correcciones, nuevas y REVISAR sin tocar pasadas.categoria', async () => {
    const tarifaValidation = TestBed.inject(TarifaValidationService);
    const assocSpy = spyOn(tarifaValidation, 'asociarTrasConfirmacion').and.resolveTo();
    const base = state.snapshot().pasadasEstandarizadas[0];
    state.setModoImportacion('masiva');
    state.setPasadasEstandarizadas([
      { ...base, IMPORTE_NETO: 10 },
      { ...base, IMPORTE_NETO: 20 },
      { ...base, IMPORTE_NETO: 30 },
      { ...base, IMPORTE_NETO: 40 },
      { ...base, IMPORTE_NETO: 50 },
    ] as never);
    state.setDocumentos([
      {
        factura: 'A-1',
        tipo: 'FC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: 150,
        percepciones: 0,
        iva: 0,
        importe_total: 150,
        rowIndexes: [0, 1, 2, 3, 4],
        status: 'ok',
        errores: [],
        omitido: false,
      },
    ]);
    component.resumenRefresco = resumenTarifas([
      resultadoResumen({ codigo: 'CURRENT_TARIFF', rowIndexes: [0], tarifaImporteId: 'ti-cur' }),
      resultadoResumen({
        codigo: 'HISTORICAL_TARIFF_MATCH',
        rowIndexes: [1],
        tarifaImporteId: 'ti-hist',
      }),
      resultadoResumen({
        codigo: 'CURRENT_CATEGORY_CORRECTION',
        rowIndexes: [2],
        tarifaImporteId: 'ti-corr',
        categoriaProveedor: 3,
        categoriaCalculada: 2,
      }),
      resultadoResumen({
        codigo: 'HISTORICAL_CATEGORY_CORRECTION',
        rowIndexes: [3],
        tarifaImporteId: 'ti-hcorr',
      }),
      resultadoResumen({
        codigo: 'REVIEW_RECORDED',
        rowIndexes: [4],
        tarifaImporteId: 'ti-rev',
        diagnostico: 'REVISAR',
      }),
    ]);
    await component.confirmar();
    expect(assocSpy).toHaveBeenCalled();
    const asociaciones = assocSpy.calls.mostRecent().args[0];
    expect(asociaciones).toEqual([
      { pasada_id: 'PSD-1', tarifa_importe_id: 'ti-cur', codigo: 'AL_DIA' },
      { pasada_id: 'PSD-2', tarifa_importe_id: 'ti-hist', codigo: 'HISTORICA' },
      { pasada_id: 'PSD-3', tarifa_importe_id: 'ti-corr', codigo: 'AL_DIA' },
      { pasada_id: 'PSD-4', tarifa_importe_id: 'ti-hcorr', codigo: 'HISTORICA' },
      { pasada_id: 'PSD-5', tarifa_importe_id: 'ti-rev', codigo: 'HISTORICA' },
    ]);
    expect(JSON.stringify(asociaciones)).not.toContain('categoria');
  });

  it('conserva aviso de asociación, documentos omitidos y fallo parcial masivo', async () => {
    const tarifaValidation = TestBed.inject(TarifaValidationService);
    spyOn(tarifaValidation, 'asociarTrasConfirmacion').and.rejectWith(new Error('rpc'));
    const carga = TestBed.inject(PEAJES_CARGA_SERVICE as never) as PeajesCargaMockService;
    spyOn(carga, 'confirmarCarga').and.callFake((input) => {
      if (input.documento.factura === 'FAIL-2') {
        return throwError(() => new Error('fallo parcial'));
      }
      return PeajesCargaMockService.prototype.confirmarCarga.call(carga, input);
    });
    const base = state.snapshot().pasadasEstandarizadas[0];
    state.setModoImportacion('masiva');
    state.setPasadasEstandarizadas([base, { ...base, IMPORTE_NETO: 50 }, { ...base, IMPORTE_NETO: 70 }] as never);
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
        factura: 'FAIL-2',
        tipo: 'NC',
        cuenta: '',
        empresa_id: 'E-1',
        fecha_factura: '2026-06-30',
        bonificacion: 0,
        importe_sin_iva: -50,
        percepciones: 0,
        iva: 0,
        importe_total: -50,
        rowIndexes: [1],
        status: 'ok',
        errores: [],
        omitido: false,
      },
      {
        factura: 'SKIP-3',
        tipo: 'FC',
        cuenta: '',
        empresa_id: '',
        fecha_factura: '',
        bonificacion: null,
        importe_sin_iva: null,
        percepciones: null,
        iva: null,
        importe_total: null,
        rowIndexes: [2],
        status: 'warn',
        errores: ['Empresa obligatoria'],
        omitido: true,
      },
    ]);
    component.resumenRefresco = resumenTarifas([
      resultadoResumen({ codigo: 'CURRENT_TARIFF', rowIndexes: [0], tarifaImporteId: 'ti-cur' }),
    ]);
    fixture.detectChanges();
    await component.confirmar();
    fixture.detectChanges();
    expect(component.importadosResumen.map((d) => d.numero)).toEqual(['OK-1']);
    expect(component.erroresPorDocumento.map((e) => e.numero)).toEqual(['FAIL-2']);
    expect(fixture.nativeElement.textContent).toContain('SKIP-3');
    expect(component.avisoAsociacion).toContain('no se pudieron asociar las tarifas');
  });

  it('habilita confirmar tras REVISAR persistido sobre DIRECTION_REQUIRED; cancelar sigue bloqueando', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    const candidato = candidatoResumen({
      id: 'cand-dir',
      estacionId: dock,
      estacionNombre: 'Dock Sud',
      sentidoSolicitado: null,
      directionConfidence: 'UNRESOLVED',
      unresolvedReason: 'MISSING_MAPPING',
      candidatePrice: 12500,
      precioDirecto: 12500,
    });
    const detectado = resumenTarifas(
      [
        resultadoResumen({
          id: candidato.id,
          codigo: 'DIRECTION_REQUIRED',
          estacionId: dock,
          sentidoSolicitado: null,
          sentidoAplicado: null,
          candidatePrice: 12500,
          rowIndexes: [0],
        }),
      ],
      [candidato],
    );
    detectado.contextIncomplete = true;
    detectado.filasSinResolver = 1;
    detectado.pendientes = 1;

    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    spyOn(refresh, 'analizar').and.resolveTo(detectado);

    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'DIRECTION_REQUIRED')).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();

    component.onRefreshCancelled();
    fixture.detectChanges();
    expect(component.refreshOpen).toBeFalse();
    expect(component.confirmationBlocked).toBeTrue();

    const saved = await refresh.guardar([
      {
        candidateId: candidato.id,
        action: 'MARK_REVIEW',
        peajeId: 'peaje-aubasa',
        estacionId: dock,
        categoriaProveedor: 2,
        categoriaCalculada: 2,
        status: 'NO_PICO',
        sentido: 'AMBAS',
        importe: 12500,
        fechaVigenciaInicio: null,
        cases: 1,
        requiereNormalizacionIva: false,
      },
    ]);
    await component.onRefreshSaved(saved);
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'REVIEW_RECORDED')).toBeTrue();
    expect(component.resumenRefresco?.contextIncomplete).toBeFalse();
    expect(component.confirmationBlocked).toBeFalse();
  });

  it('sigue bloqueando CONTEXT_INCOMPLETE sin identidad persistible', async () => {
    const detectado = resumenTarifas(
      [
        resultadoResumen({
          id: 'cand-ctx',
          codigo: 'CONTEXT_INCOMPLETE',
          estacionId: '',
          categoria: null,
          categoriaProveedor: null,
          candidatePrice: 12500,
          rowIndexes: [0],
        }),
      ],
      [candidatoResumen({ id: 'cand-ctx', estacionId: '', categoria: null, candidatePrice: 12500 })],
    );
    detectado.contextIncomplete = true;
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    spyOn(refresh, 'analizar').and.resolveTo(detectado);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.confirmationBlocked).toBeTrue();

    await component.onRefreshSaved([
      {
        peaje_id: '',
        estacion_id: '',
        sentido: 'AMBAS',
        categoria: 2,
        status: 'NO_PICO',
        tarifa_id: 'tarifa-ctx',
        anterior: null,
        nueva: 12500,
        tarifa_importe_id: null,
        accion: 'SIN_CAMBIO',
        candidate_id: 'cand-ctx',
        diagnostico: 'REVISAR',
        fecha_vigencia_inicio: null,
      },
    ]);
    fixture.detectChanges();
    expect(component.resumenRefresco?.resultados.some((r) => r.codigo === 'CONTEXT_INCOMPLETE')).toBeTrue();
    expect(component.resumenRefresco?.contextIncomplete).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();
  });

  it('no lista una tarifa CONFIRMADO overlayada también como coincidencia vigente', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    const candidato = candidatoResumen({
      id: 'cand-new',
      estacionId: dock,
      estacionNombre: 'Dock Sud',
      candidatePrice: 12500,
      precioDirecto: 12500,
    });
    const detectado = resumenTarifas(
      [
        resultadoResumen({
          id: candidato.id,
          codigo: 'NEW_TARIFF',
          estacionId: dock,
          candidatePrice: 12500,
          tarifaImporteId: null,
          rowIndexes: [0],
        }),
      ],
      [candidato],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    spyOn(refresh, 'analizar').and.resolveTo(detectado);
    await component.onRefreshSaved([
      {
        peaje_id: 'peaje-aubasa',
        estacion_id: dock,
        sentido: 'AMBAS',
        categoria: 2,
        status: 'NO_PICO',
        tarifa_id: 'tarifa-nueva',
        anterior: 11975.15,
        nueva: 12500,
        tarifa_importe_id: 'ti-nueva-conf',
        accion: 'ACTUALIZADA',
        candidate_id: candidato.id,
        diagnostico: 'CONFIRMADO',
        fecha_vigencia_inicio: null,
      },
    ]);
    fixture.detectChanges();
    expect(component.seccionVigentes.length).toBe(0);
    expect(component.seccionNuevasConfirmadas.length).toBe(1);
    expect(component.resumenRefresco?.filasVigentes).toBe(0);
    expect(component.resumenRefresco?.filasNuevasConfirmadas).toBe(1);
    const tarifasNote = Array.from(
      fixture.nativeElement.querySelectorAll('.pw__note') as NodeListOf<HTMLElement>,
    ).find((el) => el.textContent?.includes('Tarifas'));
    expect(tarifasNote?.textContent).toContain('0 vigentes');
    expect(tarifasNote?.textContent).toContain('1 nuevas');
    expect(tarifasNote?.textContent).toContain(`${component.seccionRevisar.length} REVISAR`);
    expect(fixture.nativeElement.textContent).toContain('Tarifas nuevas confirmadas');
    expect(fixture.nativeElement.textContent).not.toContain('Coincidencias vigentes');
  });

  it('tras cancelar muestra Revisar tarifas y reabre el diálogo sin habilitar confirmar', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    state.setPasadasEstandarizadas([
      {
        ...state.snapshot().pasadasEstandarizadas[0],
        ESTACION_ID: dock,
        PRECIO: 12500,
        IMPORTE_NETO: 12500,
        CATEGORIA: '2',
        TARIFA_STATUS: 'NO_PICO',
        SENTIDO: 'AMBAS',
      },
    ]);
    await component.analizarTarifas();
    fixture.detectChanges();
    expect(component.dialogNeeded).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();

    component.onRefreshCancelled();
    fixture.detectChanges();
    expect(component.refreshOpen).toBeFalse();

    const confirmar = fixture.nativeElement.querySelector('[data-testid="confirmar-carga"]') as HTMLButtonElement;
    expect(confirmar.disabled).toBeTrue();
    const revisar = fixture.nativeElement.querySelector('[data-testid="revisar-tarifas"]') as HTMLButtonElement;
    expect(revisar).toBeTruthy();
    expect(revisar.textContent).toContain('Revisar tarifas');
    expect(revisar.disabled).toBeFalse();
    revisar.click();
    fixture.detectChanges();
    expect(component.refreshOpen).toBeTrue();
    expect(component.confirmationBlocked).toBeTrue();
    expect(confirmar.disabled).toBeTrue();
  });

  it('asocia una tarifa CONFIRMADO overlayada con el tarifa_importe_id persistido, sin pasadas.categoria', async () => {
    const { ESTACION_DOCK_SUD: dock } = await import('../mocks/tarifa-refresh.mock');
    const tarifaValidation = TestBed.inject(TarifaValidationService);
    const assocSpy = spyOn(tarifaValidation, 'asociarTrasConfirmacion').and.resolveTo();
    const candidato = candidatoResumen({
      id: 'cand-assoc',
      estacionId: dock,
      estacionNombre: 'Dock Sud',
      candidatePrice: 12500,
      precioDirecto: 12500,
    });
    const detectado = resumenTarifas(
      [
        resultadoResumen({
          id: candidato.id,
          codigo: 'NEW_TARIFF',
          estacionId: dock,
          candidatePrice: 12500,
          tarifaImporteId: null,
          rowIndexes: [0],
        }),
      ],
      [candidato],
    );
    const refresh = TestBed.inject(TARIFA_REFRESH_SERVICE as never) as TarifaRefreshMockService;
    spyOn(refresh, 'analizar').and.resolveTo(detectado);
    await component.onRefreshSaved([
      {
        peaje_id: 'peaje-aubasa',
        estacion_id: dock,
        sentido: 'AMBAS',
        categoria: 2,
        status: 'NO_PICO',
        tarifa_id: 'tarifa-nueva',
        anterior: 11975.15,
        nueva: 12500,
        tarifa_importe_id: 'ti-nueva-assoc',
        accion: 'ACTUALIZADA',
        candidate_id: candidato.id,
        diagnostico: 'CONFIRMADO',
        fecha_vigencia_inicio: null,
      },
    ]);
    await component.confirmar();
    expect(assocSpy).toHaveBeenCalled();
    const asociaciones = assocSpy.calls.mostRecent().args[0];
    expect(asociaciones).toEqual([
      { pasada_id: 'PSD-1', tarifa_importe_id: 'ti-nueva-assoc', codigo: 'AL_DIA' },
    ]);
    expect(JSON.stringify(asociaciones)).not.toContain('categoria');
  });
});

