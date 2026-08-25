import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PeajesPlantillasService,
  PlantillaConfiguracion,
} from '../../models';
import { Paso1CargaComponent } from './paso1-carga.component';
import { PeajesExcelService } from '../services/peajes-excel.service';
import { PeajesPlantillaApplyService } from '../services/peajes-plantilla-apply.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { InvoiceAiService } from '../../services/ai/invoice/invoice-ai.service';
import { InvoicePdfTextService } from '../../services/ai/invoice/invoice-pdf-text.service';

describe('Paso1CargaComponent', () => {
  let fixture: ComponentFixture<Paso1CargaComponent>;
  let component: Paso1CargaComponent;
  let excel: jasmine.SpyObj<PeajesExcelService>;
  let state: PeajesWizardStateService;
  let plantillasMock: jasmine.SpyObj<PeajesPlantillasService>;
  let catalogoMock: jasmine.SpyObj<PeajesCatalogoService>;
  let ai: jasmine.SpyObj<InvoiceAiService>;
  let pdfText: jasmine.SpyObj<InvoicePdfTextService>;

  const estacionId = 'est-campana';
  const patenteId = 'pat-ae751pa';

  const plantillaAusolLike: PlantillaConfiguracion = {
    id: 'plt-ausol-v2',
    nombre: 'AUSOL-V2-08-2026',
    empresa_id: 'emp-1',
    estado: 'activa',
    mapeos: [
      { columnaOrigen: 'ESTACION', columnaDestino: 'ESTACION_ID', excluida: false },
      { columnaOrigen: 'FECHA_HORA', columnaDestino: 'FECHA_HORA', excluida: false },
      { columnaOrigen: 'PASE_ID', columnaDestino: 'PASE_ID', excluida: false },
      { columnaOrigen: 'PATENTE', columnaDestino: 'PATENTE_ID', excluida: false },
      { columnaOrigen: 'PRECIO', columnaDestino: 'PRECIO', excluida: false },
      { columnaOrigen: 'BONIFICACION', columnaDestino: 'BONIFICACION', excluida: false },
      { columnaOrigen: 'QUANTITY', columnaDestino: 'QUANTITY', excluida: false },
      { columnaOrigen: 'IMPORTE_NETO', columnaDestino: 'IMPORTE_NETO', excluida: false },
    ],
    estaciones_reconocidas: [
      {
        id: 'rel-1',
        plantilla_id: 'plt-ausol-v2',
        valor_proveedor: 'CAMPANA',
        valor_normalizado: 'CAMPANA',
        estacion_id: estacionId,
        origen: 'plantilla',
      },
    ],
    configuraciones: [
      {
        id: 'c10',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'FECHA',
        columna_destino: 'FECHA_HORA',
        orden: 10,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: {
          algoritmo_codigo: 'COMBINAR_COLUMNAS',
          columnas_entrada: ['FECHA', 'HORA'],
          separador: ' ',
        },
      },
      {
        id: 'c20',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'DISPOSITIVO',
        columna_destino: 'PASE_ID',
        orden: 20,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'DISPOSITIVO' },
      },
      {
        id: 'c30',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'PATENTE',
        columna_destino: 'PATENTE_ID',
        orden: 30,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'BORRAR_ESPACIOS', columna: 'PATENTE' },
      },
      {
        id: 'c40',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'QUANTITY',
        columna_destino: 'QUANTITY',
        orden: 40,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'ASIGNAR_VALOR', valor: 1 },
      },
      {
        id: 'c50',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'TARIFA',
        columna_destino: 'PRECIO',
        orden: 50,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'TARIFA' },
      },
      {
        id: 'c60',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'BONIFICACION',
        columna_destino: 'BONIFICACION',
        orden: 60,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: { algoritmo_codigo: 'CONVERTIR_NUMERO', columna: 'BONIFICACION' },
      },
      {
        id: 'c70',
        plantilla_id: 'plt-ausol-v2',
        nombre_columna: 'IMPORTE_NETO',
        columna_destino: 'IMPORTE_NETO',
        orden: 70,
        tipo: 'transformacion',
        algoritmo_combinado_id: null,
        obligatoria: true,
        configuracion: {
          algoritmo_codigo: 'CALCULAR_IMPORTE_NETO',
          precio_columna: 'TARIFA',
          bonificacion_columna: 'BONIFICACION',
        },
      },
    ],
  };

  beforeEach(async () => {
    excel = jasmine.createSpyObj('PeajesExcelService', ['esArchivoValido', 'parsearArchivo']);
    plantillasMock = jasmine.createSpyObj<PeajesPlantillasService>('PeajesPlantillasService', [
      'listarPlantillas',
      'obtenerPlantilla',
      'guardarPlantilla',
      'sobrescribirConfiguraciones',
      'listarAlgoritmos',
      'guardarAlgoritmo',
      'expandirAlgoritmo',
    ]);
    plantillasMock.listarPlantillas.and.returnValue(of([plantillaAusolLike]));
    plantillasMock.obtenerPlantilla.and.returnValue(of(plantillaAusolLike));
    plantillasMock.listarAlgoritmos.and.returnValue(of([]));

    catalogoMock = jasmine.createSpyObj<PeajesCatalogoService>('PeajesCatalogoService', [
      'listarEmpresas',
      'crearEmpresa',
      'listarEstaciones',
      'listarPatentes',
    ]);
    catalogoMock.listarEmpresas.and.returnValue(of([{ id: 'emp-1', nombre: 'Ausol' }]));
    catalogoMock.listarEstaciones.and.returnValue(
      of([{ id: estacionId, nombre: 'Campana', peaje_id: 'peaje-1', codigos_proveedor: ['CAMPANA'] }])
    );
    catalogoMock.listarPatentes.and.returnValue(
      of([{ id: patenteId, patente: 'AE751PA', categoria: 'FLOTA CAMIONES', activa: true }])
    );

    ai = jasmine.createSpyObj<InvoiceAiService>('InvoiceAiService', ['analyze']);
    ai.analyze.and.returnValue(
      of({
        invoiceNumber: [],
        invoiceDate: [],
        vat: [],
        perceptions: [],
        subtotal: [],
        total: [],
        expectedNetAmount: 560832.27,
      })
    );
    pdfText = jasmine.createSpyObj<InvoicePdfTextService>('InvoicePdfTextService', ['extractText']);
    pdfText.extractText.and.resolveTo('invoice text');

    await TestBed.configureTestingModule({
      imports: [Paso1CargaComponent],
      providers: [
        PeajesWizardStateService,
        PeajesPlantillaApplyService,
        { provide: PeajesExcelService, useValue: excel },
        { provide: PEAJES_PLANTILLAS_SERVICE, useValue: plantillasMock },
        { provide: PEAJES_CATALOGO_SERVICE, useValue: catalogoMock },
        { provide: InvoiceAiService, useValue: ai },
        { provide: InvoicePdfTextService, useValue: pdfText },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    fixture = TestBed.createComponent(Paso1CargaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('muestra error si el archivo no es .xlsx ni .csv', async () => {
    excel.esArchivoValido.and.returnValue(false);
    const file = new File(['x'], 'pasadas.csv', { type: 'text/csv' });
    await component.procesar(file);
    fixture.detectChanges();
    expect(component.error).toContain('.csv');
    expect(fixture.nativeElement.textContent).toContain('.csv');
  });

  it('muestra nombre, tamaño y filas con .xlsx válido', async () => {
    excel.esArchivoValido.and.returnValue(true);
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'pasadas_junio_2026.xlsx',
      tamanioBytes: 4096,
      totalFilas: 10,
      columnas: ['FECHA', 'HORA'],
      filasPreview: [{ FECHA: '25/06/2026', HORA: '205005' }],
      filasOrigen: [{ FECHA: '25/06/2026', HORA: '205005' }],
      tiposInferidos: { FECHA: 'fecha', HORA: 'texto' },
    });

    const file = new File(['dummy'], 'pasadas_junio_2026.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await component.procesar(file);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('pasadas_junio_2026.xlsx');
    expect(text).toMatch(/4[,.]?096/);
    expect(text).toContain('10');
    expect(component.error).toBeNull();
  });

  it('sin plantilla emite completado (Paso 2)', async () => {
    state.setPreview({
      nombreArchivo: 'a.csv',
      tamanioBytes: 1,
      totalFilas: 1,
      columnas: ['FECHA'],
      filasPreview: [{ FECHA: '1' }],
      filasOrigen: [{ FECHA: '1' }],
      tiposInferidos: {},
    });
    component.empresaId = 'emp-1';
    component.plantillaId = '';
    const completado = jasmine.createSpy('completado');
    const factura = jasmine.createSpy('factura');
    component.completado.subscribe(completado);
    component.facturaDirecta.subscribe(factura);

    await component.continuar();

    expect(completado).toHaveBeenCalled();
    expect(factura).not.toHaveBeenCalled();
  });

  it('con plantilla compatible emite facturaDirecta (Paso 7)', async () => {
    state.setPreview({
      nombreArchivo: '557074.csv',
      tamanioBytes: 100,
      totalFilas: 1,
      columnas: ['FECHA', 'HORA', 'ESTACION', 'DISPOSITIVO', 'PATENTE', 'TARIFA', 'BONIFICACION'],
      filasPreview: [
        {
          FECHA: '2026-07-16',
          HORA: '01:34:14',
          ESTACION: 'CAMPANA',
          DISPOSITIVO: '94891934',
          PATENTE: 'AE751PA',
          TARIFA: '3976.59',
          BONIFICACION: '0.00',
        },
      ],
      filasOrigen: [
        {
          FECHA: '2026-07-16',
          HORA: '01:34:14',
          ESTACION: 'CAMPANA',
          DISPOSITIVO: '94891934',
          PATENTE: 'AE751PA',
          TARIFA: '3976.59',
          BONIFICACION: '0.00',
        },
      ],
      tiposInferidos: {},
    });
    component.empresaId = 'emp-1';
    component.plantillaId = plantillaAusolLike.id;

    const completado = jasmine.createSpy('completado');
    const factura = jasmine.createSpy('factura');
    const excepcion = jasmine.createSpy('excepcion');
    component.completado.subscribe(completado);
    component.facturaDirecta.subscribe(factura);
    component.irAExcepcion.subscribe(excepcion);

    await component.continuar();

    expect(component.erroresPlantilla).toEqual([]);
    expect(factura).toHaveBeenCalled();
    expect(completado).not.toHaveBeenCalled();
    expect(excepcion).not.toHaveBeenCalled();
    expect(state.snapshot().plantillaId).toBe(plantillaAusolLike.id);
  });

  it('en importación simple muestra que la empresa cierra el peaje', async () => {
    excel.esArchivoValido.and.returnValue(true);
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'pasadas_2026-07-16_86802.csv',
      tamanioBytes: 100,
      totalFilas: 1,
      columnas: ['ESTACION'],
      filasPreview: [{ ESTACION: '0001' }],
      filasOrigen: [{ ESTACION: '0001' }],
      tiposInferidos: { ESTACION: 'texto' },
    });
    const file = new File(['x'], 'pasadas_2026-07-16_86802.csv', { type: 'text/csv' });
    await component.procesar(file);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('La empresa cierra el peaje');
    expect(text).toContain('0001');
  });

  it('analyzes only after the template applies without exceptions', async () => {
    const apply = TestBed.inject(PeajesPlantillaApplyService);
    spyOn(apply, 'aplicarYEvaluar').and.callFake(async () => {
      state.setPlantillaId('template-1');
      state.setPasadasEstandarizadas([{ IMPORTE_NETO: 560832.27 }] as never);
      return { ok: true, excepcion: null, errores: [], mensaje: 'ok', plantillaNombre: 'T1' };
    });
    state.setPreview({
      nombreArchivo: 'pasadas.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FECHA'],
      filasPreview: [{ FECHA: '1' }],
      filasOrigen: [{ FECHA: '1' }],
      tiposInferidos: {},
    });
    state.setInvoicePdf(new File(['pdf'], 'factura.pdf', { type: 'application/pdf' }), 'invoice text');
    component.empresaId = 'emp-1';
    component.onPlantillaChange('template-1');
    await component.continuar();
    expect(ai.analyze).toHaveBeenCalledWith('invoice text', 560832.27);
  });

  it('does not call AI for mass import or absent PDF', async () => {
    const apply = TestBed.inject(PeajesPlantillaApplyService);
    spyOn(apply, 'aplicarYEvaluar').and.callFake(async () => {
      state.setPlantillaId('template-1');
      state.setPasadasEstandarizadas([{ IMPORTE_NETO: 560832.27 }] as never);
      return { ok: true, excepcion: null, errores: [], mensaje: 'ok' };
    });
    state.setPreview({
      nombreArchivo: 'masiva.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FACTURA', 'FECHA'],
      filasPreview: [{ FACTURA: 'F-1', FECHA: '1' }],
      filasOrigen: [{ FACTURA: 'F-1', FECHA: '1' }],
      tiposInferidos: {},
    });
    state.setInvoicePdf(new File(['pdf'], 'factura.pdf', { type: 'application/pdf' }), 'invoice text');
    component.empresaId = 'emp-1';
    component.onPlantillaChange('template-1');
    state.setModoImportacion('masiva');
    component.modoImportacion = 'masiva';
    await component.continuar();
    expect(ai.analyze).not.toHaveBeenCalled();

    ai.analyze.calls.reset();
    state.setModoImportacion('simple');
    component.modoImportacion = 'simple';
    state.setInvoicePdf(null, null);
    await component.continuar();
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('carga Excel y PDF juntos en una sola selección (importación simple)', async () => {
    excel.esArchivoValido.and.callFake((file: File) =>
      file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.csv')
    );
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'pasadas.xlsx',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FECHA'],
      filasPreview: [{ FECHA: '1' }],
      filasOrigen: [{ FECHA: '1' }],
      tiposInferidos: {},
    });
    const xlsx = new File(['x'], 'pasadas.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const pdf = new File(['p'], 'factura.pdf', { type: 'application/pdf' });
    await component.procesarSeleccion([xlsx, pdf]);
    fixture.detectChanges();
    expect(excel.parsearArchivo).toHaveBeenCalledWith(xlsx);
    expect(pdfText.extractText).toHaveBeenCalledWith(pdf);
    expect(state.snapshot().preview?.nombreArchivo).toBe('pasadas.xlsx');
    expect(state.snapshot().invoicePdf?.fileName).toBe('factura.pdf');
    expect(fixture.nativeElement.querySelector('.paso1__pdf')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('factura.pdf');
  });

  it('acepta solo el PDF si el Excel ya está cargado', async () => {
    excel.esArchivoValido.and.returnValue(true);
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'pasadas.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FECHA'],
      filasPreview: [{ FECHA: '1' }],
      filasOrigen: [{ FECHA: '1' }],
      tiposInferidos: {},
    });
    await component.procesar(new File(['x'], 'pasadas.csv', { type: 'text/csv' }));
    excel.parsearArchivo.calls.reset();
    const pdf = new File(['p'], 'factura.pdf', { type: 'application/pdf' });
    await component.procesarSeleccion([pdf]);
    expect(excel.parsearArchivo).not.toHaveBeenCalled();
    expect(state.snapshot().invoicePdf?.fileName).toBe('factura.pdf');
  });

  it('exige Excel/CSV si se sube solo un PDF sin pasadas', async () => {
    const pdf = new File(['p'], 'factura.pdf', { type: 'application/pdf' });
    await component.procesarSeleccion([pdf]);
    expect(component.error).toMatch(/xlsx|\.csv/i);
    expect(pdfText.extractText).not.toHaveBeenCalled();
  });

  it('ignora el PDF en importación masiva', async () => {
    component.modoImportacion = 'masiva';
    state.setModoImportacion('masiva');
    excel.esArchivoValido.and.callFake((file: File) => file.name.toLowerCase().endsWith('.csv'));
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'masiva.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FACTURA'],
      filasPreview: [{ FACTURA: 'F-1' }],
      filasOrigen: [{ FACTURA: 'F-1' }],
      tiposInferidos: {},
    });
    const csv = new File(['x'], 'masiva.csv', { type: 'text/csv' });
    const pdf = new File(['p'], 'factura.pdf', { type: 'application/pdf' });
    await component.procesarSeleccion([csv, pdf]);
    expect(pdfText.extractText).not.toHaveBeenCalled();
    expect(state.snapshot().invoicePdf).toBeFalsy();
  });

  it('reconstruye documentos desde FACTURA al cargar en modo masivo', async () => {
    component.modoImportacion = 'masiva';
    excel.esArchivoValido.and.returnValue(true);
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'masiva.xlsx',
      tamanioBytes: 10,
      totalFilas: 3,
      columnas: ['FACTURA', 'FECHA'],
      filasPreview: [
        { FACTURA: 'F-001', FECHA: '2026-08-01' },
        { FACTURA: 'F-001', FECHA: '2026-08-01' },
        { FACTURA: 'F-002', FECHA: '2026-08-02' },
      ],
      filasOrigen: [
        { FACTURA: 'F-001', FECHA: '2026-08-01' },
        { FACTURA: 'F-001', FECHA: '2026-08-01' },
        { FACTURA: 'F-002', FECHA: '2026-08-02' },
      ],
      tiposInferidos: {},
    });

    await component.procesar(new File(['xlsx'], 'masiva.xlsx'));

    expect(state.snapshot().modoImportacion).toBe('masiva');
    expect(state.snapshot().documentos.map((doc) => doc.factura)).toEqual(['F-001', 'F-002']);
    expect(state.snapshot().documentos.map((doc) => doc.rowIndexes)).toEqual([[0, 1], [2]]);
  });
});
