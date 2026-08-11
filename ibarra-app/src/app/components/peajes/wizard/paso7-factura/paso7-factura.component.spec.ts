import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Paso7FacturaComponent } from './paso7-factura.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { PEAJES_CATALOGO_SERVICE, PEAJES_PLANTILLAS_SERVICE } from '../../models';
import { AUSOL_FACTURA_557074 } from '../fixtures/ausol-factura-real.fixture';

describe('Paso7FacturaComponent', () => {
  let fixture: ComponentFixture<Paso7FacturaComponent>;
  let component: Paso7FacturaComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso7FacturaComponent],
      providers: [
        PeajesWizardStateService,
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarEmpresas: () =>
              of([{ id: 'EMP-001', nombre: 'Empresa Demo', created_at: undefined }]),
            listarPeajes: () => of([]),
          },
        },
        {
          provide: PEAJES_PLANTILLAS_SERVICE,
          useValue: {
            guardarPlantilla: () => of({ id: 'P-1', nombre: 'x', descripcion: null, empresa_id: 'EMP-001', estado: 'activa' }),
          },
        },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    state.setEmpresaId('EMP-001');

    fixture = TestBed.createComponent(Paso7FacturaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('exige factura, empresa, fecha e importes; cuenta es opcional', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.continuar();
    expect(component.form.invalid).toBeTrue();
    expect(spy).not.toHaveBeenCalled();

    component.form.patchValue({
      factura: 'A-0001',
      cuenta: '',
      fecha_factura: '2026-06-30',
      importe_sin_iva: 100,
      percepciones: 2,
      iva: 21,
      importe_total: 123,
    });
    component.fechaRanges = { 0: { from: new Date(2026, 5, 30), to: null } };
    component.continuar();
    expect(spy).toHaveBeenCalled();
    expect(state.snapshot().factura.cuenta).toBe('');
    expect(state.snapshot().factura.empresa_id).toBe('EMP-001');
    expect(state.snapshot().factura.importe_total).toBe(123);
  });

  it('conserva los cuatro importes declarados de la factura real AUSOL', () => {
    component.form.patchValue(AUSOL_FACTURA_557074);
    component.continuar();
    expect(state.snapshot().factura).toEqual(jasmine.objectContaining(AUSOL_FACTURA_557074));
  });

  it('suma por centavos para no mostrar desvíos de coma flotante', () => {
    state.setPasadasEstandarizadas([
      { IMPORTE_NETO: 560832.27 },
      { IMPORTE_NETO: 0.01 },
      { IMPORTE_NETO: -0.01 },
    ] as never);
    expect(component.sumaNetos).toBe(560832.27);
  });

  it('continúa con el atajo peajes-wizard-advance cuando el formulario es válido', () => {
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.form.patchValue({
      factura: 'A-0001',
      fecha_factura: '2020-06-13',
      importe_sin_iva: 100,
      percepciones: 0,
      iva: 21,
      importe_total: 121,
    });
    component.fechaRanges = { 0: { from: new Date(2020, 5, 13), to: null } };
    component.onWizardAdvanceShortcut();
    expect(spy).toHaveBeenCalled();
  });

  it('sincroniza fecha_factura al tipear en el date picker', () => {
    component.onFechaChange({ from: new Date(2020, 5, 13), to: null });
    expect(component.form.controls.fecha_factura.value).toBe('2020-06-13');
  });

  async function setupMasiva(docCount: number): Promise<void> {
    state.reiniciar();
    state.setEmpresaId('EMP-001');
    state.setModoImportacion('masiva');
    const docs = Array.from({ length: docCount }, (_, i) => ({
      factura: `F-${i + 1}`,
      tipo: 'FC' as const,
      cuenta: '',
      empresa_id: 'EMP-001',
      fecha_factura: '2026-06-01',
      bonificacion: 0,
      importe_sin_iva: 100,
      percepciones: 0,
      iva: 21,
      importe_total: 121,
      rowIndexes: [i],
      status: 'neutral' as const,
      errores: [] as string[],
    }));
    state.setDocumentos(docs);
    state.setPasadasEstandarizadas(
      docs.map((d, i) => ({ FACTURA: d.factura, IMPORTE_NETO: 100 + i * 0.01 })) as never
    );
    fixture = TestBed.createComponent(Paso7FacturaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  }

  it('masiva: permite seleccionar y persistir tipo NC', async () => {
    await setupMasiva(2);
    const group = component.ensureDocForm(0);
    group.patchValue({ tipo: 'NC' });
    component.continuar();
    expect(state.snapshot().documentos[0].tipo).toBe('NC');
  });

  it('masiva: pagina documentos y cachea suma neta', async () => {
    await setupMasiva(55);
    expect(component.documentosPagina.length).toBe(50);
    expect(component.totalDocPages).toBe(2);
    expect(component.sumaNetaDe(component.documentos[0], 0)).toBe(100);
    component.nextDocPage();
    expect(component.documentosPagina.length).toBe(5);
    expect(component.docPage).toBe(1);
  });

  it('masiva: autofill de empresas no llama patchDocumento por cada doc', async () => {
    state.reiniciar();
    state.setEmpresaId('EMP-001');
    state.setModoImportacion('masiva');
    state.setDocumentos(
      Array.from({ length: 3 }, (_, i) => ({
        factura: `F-${i}`,
        tipo: 'FC' as const,
        cuenta: '',
        empresa_id: '',
        fecha_factura: '',
        bonificacion: 0,
        importe_sin_iva: null,
        percepciones: 0,
        iva: 0,
        importe_total: null,
        rowIndexes: [i],
        status: 'neutral' as const,
        errores: [] as string[],
        concesionProveedor: 'Empresa Demo',
      }))
    );
    const patchSpy = spyOn(state, 'patchDocumento').and.callThrough();
    const setSpy = spyOn(state, 'setDocumentos').and.callThrough();
    fixture = TestBed.createComponent(Paso7FacturaComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    expect(patchSpy).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();
  });

  it('masiva: omite documento inválido y continúa con los válidos', async () => {
    await setupMasiva(2);
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    // Doc 1 sin empresa → inválido
    component.ensureDocForm(1).patchValue({ empresa_id: '' });
    component.empresaIdsPorDoc[1] = [];
    expect(component.puedeOmitirInvalidosYContinuar).toBeTrue();
    component.omitirInvalidosYContinuar();
    expect(spy).toHaveBeenCalled();
    const docs = state.snapshot().documentos;
    expect(docs[0].omitido).toBeFalse();
    expect(docs[1].omitido).toBeTrue();
    expect(docs[1].errores.some((e) => /empresa/i.test(e))).toBeTrue();
  });

  it('masiva: omitirDocumento marca omitido y continuar ignora ese panel', async () => {
    await setupMasiva(2);
    const spy = jasmine.createSpy('completado');
    component.completado.subscribe(spy);
    component.omitirDocumento(1);
    expect(state.snapshot().documentos[1].omitido).toBeTrue();
    component.continuar();
    expect(spy).toHaveBeenCalled();
    expect(state.snapshot().documentos[0].status).toBe('ok');
    expect(state.snapshot().documentos[1].omitido).toBeTrue();
  });
});