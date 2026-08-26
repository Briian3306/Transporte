import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AccordionComponent,
  AccordionContentDirective,
  AccordionHeaderDirective,
  AccordionPanelComponent,
  AccordionPanelStatus,
  DateRangePickerComponent,
  DateRangeValue,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  parseDateInputValue,
  toDateInputValue,
  formatDateInputDisplay,
  AiCatLoaderComponent,
} from '../../../shared';
import {
  agregarIvaDocumento,
  agregarIvaImporte,
  ConfiguracionPlantilla,
  DOCUMENTO_TIPOS,
  DocumentoTipo,
  Empresa,
  Peaje,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesCatalogoService,
  PeajesPlantillasService,
  quitarIvaDocumento,
  quitarIvaImporte,
  resolverEmpresaDesdeConcesion,
} from '../../models';
import { MVP_FACTURA } from '../fixtures/mvp-ejemplo.fixture';
import {
  PeajesWizardStateService,
  WizardDocumentoGrupo,
  WizardFacturaForm,
  WizardPasoId,
} from '../services/peajes-wizard-state.service';
import { InvoiceAiService } from '../../services/ai/invoice/invoice-ai.service';
import {
  InvoiceAiError,
  InvoiceCandidate,
  InvoiceField,
} from '../../services/ai/invoice/invoice-ai.models';

type DocFormGroup = ReturnType<Paso7FacturaComponent['crearDocGroup']>;

@Component({
  selector: 'app-paso7-factura',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SearchMultiSelectComponent,
    DateRangePickerComponent,
    AccordionComponent,
    AccordionPanelComponent,
    AccordionHeaderDirective,
    AccordionContentDirective,
    AiCatLoaderComponent,
  ],
  templateUrl: './paso7-factura.component.html',
  styleUrl: './paso7-factura.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Paso7FacturaComponent implements OnInit, AfterViewInit {
  @Input() expressMode = false;
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();
  /** En masiva: volver a mapeo/estaciones cuando cambia la empresa del archivo. */
  @Output() irAPaso = new EventEmitter<WizardPasoId>();

  @ViewChild('facturaInput') facturaInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly invoiceAiApi = inject(InvoiceAiService);
  readonly state = inject(PeajesWizardStateService);
  readonly tiposDocumento = DOCUMENTO_TIPOS;
  readonly pageSize = 50;

  empresas: Empresa[] = [];
  peajes: Peaje[] = [];
  empresaIds: string[] = [];
  /** Empresa seleccionada por panel (masiva), keyed by absolute index. */
  empresaIdsPorDoc: Record<number, string[]> = {};
  fechaRanges: Record<number, DateRangeValue> = {};
  expandedValues: string[] = [];
  recomendacionVisible = false;
  nombrePlantilla = '';
  guardandoPlantilla = false;
  plantillaError = '';
  esMasiva = false;
  documentos: WizardDocumentoGrupo[] = [];
  empresaOptions: SearchMultiSelectOption[] = [];
  docPage = 0;
  /** Precomputed net sum per factura key. */
  sumaNetaPorKey = new Map<string, number>();
  /** Lazy FormGroups keyed by absolute document index. */
  private readonly docForms = new Map<number, DocFormGroup>();
  private readonly hintsConcesion = new Map<number, string>();

  /** Formulario simple (un documento). */
  form = this.fb.nonNullable.group({
    factura: ['', Validators.required],
    tipo: ['FC' as DocumentoTipo, Validators.required],
    cuenta: [''],
    empresa_id: [{ value: '', disabled: true }, Validators.required],
    fecha_factura: ['', Validators.required],
    bonificacion: [0 as number | null, [Validators.required]],
    importe_sin_iva: [null as number | null, [Validators.required]],
    percepciones: [0 as number | null, [Validators.required]],
    iva: [0 as number | null, [Validators.required]],
    importe_total: [null as number | null, [Validators.required]],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillas: PeajesPlantillasService
  ) {}

  get totalDocPages(): number {
    return Math.max(1, Math.ceil(this.documentos.length / this.pageSize));
  }

  get documentosPagina(): { doc: WizardDocumentoGrupo; index: number }[] {
    const start = this.docPage * this.pageSize;
    return this.documentos.slice(start, start + this.pageSize).map((doc, offset) => ({
      doc,
      index: start + offset,
    }));
  }

  get pageRangeLabel(): string {
    if (!this.documentos.length) return '0 documentos';
    const start = this.docPage * this.pageSize + 1;
    const end = Math.min(this.documentos.length, (this.docPage + 1) * this.pageSize);
    return `${start}–${end} de ${this.documentos.length}`;
  }

  async ngOnInit(): Promise<void> {
    const [empresas, peajes] = await Promise.all([
      firstValueFrom(this.catalogo.listarEmpresas()),
      firstValueFrom(this.catalogo.listarPeajes()),
    ]);
    this.empresas = empresas;
    this.peajes = peajes;
    this.empresaOptions = empresas.map((e) => ({ id: e.id, label: e.nombre }));

    let snap = this.state.snapshot();
    this.esMasiva = snap.modoImportacion === 'masiva';
    if (this.esMasiva && snap.documentos.length === 0) {
      this.state.rebuildDocumentosDesdeFactura();
      snap = this.state.snapshot();
    }
    if (this.esMasiva) {
      this.autofillEmpresasDesdeConcesion();
      snap = this.state.snapshot();
    }

    this.documentos = snap.documentos;
    this.rebuildHints();
    this.rebuildSumaNetaCache();

    const empresaId = snap.factura.empresa_id || snap.empresaId || '';
    this.empresaIds = empresaId ? [empresaId] : [];

    if (this.esMasiva) {
      this.cargarFormsMasiva();
    } else {
      const doc = snap.documentos[0] ?? snap.factura;
      this.form.patchValue({
        ...doc,
        tipo: doc.tipo ?? 'FC',
        empresa_id: empresaId,
        cuenta: doc.cuenta ?? '',
        bonificacion: doc.bonificacion ?? 0,
        percepciones: doc.percepciones ?? 0,
        iva: doc.iva ?? 0,
      });
      this.fechaRanges = {
        0: { from: parseDateInputValue(doc.fecha_factura), to: null },
      };
    }

    this.recomendacionVisible = !!(
      !snap.plantillaId &&
      !snap.recomendacionPlantillaDescartada &&
      snap.mapeos.length &&
      snap.relacionesEstacion.length
    );
    this.cdr.markForCheck();
    if (!this.esMasiva) {
      void this.maybeAnalyzeDeferred();
    }
  }

  get invoiceAi() {
    return this.state.snapshot().invoiceAi;
  }

  get showInvoiceAi(): boolean {
    return !this.esMasiva;
  }

  invoiceAiStatusText(): string {
    if (!this.showInvoiceAi) return '';
    const ai = this.invoiceAi;
    if (ai.status === 'loading') return '';
    if (ai.status === 'ready') {
      return 'Sugerencias listas. Clic para aplicar un valor; podés seguir editando a mano.';
    }
    if (ai.status === 'error') {
      return ai.error ?? 'No se pudieron obtener sugerencias. Podés completar el documento a mano.';
    }
    return '';
  }

  invoiceCandidates(field: InvoiceField): InvoiceCandidate<string | number>[] {
    const result = this.invoiceAi.result;
    if (!result) return [];
    switch (field) {
      case 'invoiceNumber':
        return result.invoiceNumber;
      case 'invoiceDate':
        return result.invoiceDate;
      case 'vat':
        return result.vat;
      case 'perceptions':
        return result.perceptions;
      case 'subtotal':
        return result.subtotal;
      case 'total':
        return result.total;
      default:
        return [];
    }
  }

  formatSuggestionValue(field: InvoiceField, value: string | number): string {
    if (field === 'invoiceDate' && typeof value === 'string') {
      const parsed = parseDateInputValue(value);
      return parsed ? formatDateInputDisplay(parsed) : value;
    }
    if (typeof value === 'number') {
      return value.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return String(value);
  }

  confidenceLabel(level: InvoiceCandidate<unknown>['level']): string {
    if (level === 'alta') return 'Confianza alta';
    if (level === 'media') return 'Confianza media';
    return 'Confianza baja';
  }

  confidencePercent(candidate: InvoiceCandidate<string | number>): string {
    return `${Math.round(candidate.confidence * 100)}%`;
  }

  applyInvoiceSuggestion(
    field: InvoiceField,
    candidate: InvoiceCandidate<string | number>
  ): void {
    if (this.esMasiva) return;
    const controlByField: Record<
      InvoiceField,
      'factura' | 'fecha_factura' | 'iva' | 'percepciones' | 'importe_sin_iva' | 'importe_total'
    > = {
      invoiceNumber: 'factura',
      invoiceDate: 'fecha_factura',
      vat: 'iva',
      perceptions: 'percepciones',
      subtotal: 'importe_sin_iva',
      total: 'importe_total',
    };
    const control = controlByField[field];
    if (field === 'invoiceDate') {
      const iso = String(candidate.value);
      this.form.patchValue({ fecha_factura: iso });
      this.form.controls.fecha_factura.markAsDirty();
      this.form.controls.fecha_factura.markAsTouched();
      this.fechaRanges = {
        ...this.fechaRanges,
        0: { from: parseDateInputValue(iso), to: null },
      };
    } else {
      this.form.patchValue({ [control]: candidate.value });
      this.form.controls[control].markAsDirty();
      this.form.controls[control].markAsTouched();
    }
    this.cdr.markForCheck();
  }

  async retryInvoiceAi(): Promise<void> {
    await this.runInvoiceAnalysis();
  }

  private async maybeAnalyzeDeferred(): Promise<void> {
    const ai = this.state.snapshot().invoiceAi;
    if (ai.status !== 'idle') return;
    await this.runInvoiceAnalysis();
  }

  private async runInvoiceAnalysis(): Promise<void> {
    if (this.esMasiva) return;
    const snap = this.state.snapshot();
    const text = snap.invoicePdf?.text;
    const net = this.state.invoiceExpectedNetAmount();
    if (!text || net == null || net <= 0) return;
    this.state.setInvoiceAiAnalysis('loading', null, null);
    this.cdr.markForCheck();
    try {
      const result = await firstValueFrom(this.invoiceAiApi.analyze(text, net));
      this.state.setInvoiceAiAnalysis('ready', result, null);
    } catch (e) {
      const message =
        e instanceof InvoiceAiError
          ? e.message
          : 'No se pudo analizar la factura. Completá el documento a mano o reintentá.';
      this.state.setInvoiceAiAnalysis('error', null, message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  ngAfterViewInit(): void {
    if (!this.esMasiva) {
      queueMicrotask(() => this.facturaInput?.nativeElement.focus());
    }
  }

  @HostListener('document:peajes-wizard-advance')
  onWizardAdvanceShortcut(): void {
    this.continuar();
  }

  @HostListener('keydown', ['$event'])
  onPasoKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.continuar();
    }
  }

  trackByFactura = (_: number, item: { doc: WizardDocumentoGrupo; index: number }): string =>
    item.doc.factura || `doc-${item.index}`;

  isExpanded(doc: WizardDocumentoGrupo, index: number): boolean {
    return this.expandedValues.includes(this.panelValue(doc, index));
  }

  onExpandedValuesChange(values: string[]): void {
    const prev = new Set(this.expandedValues);
    this.expandedValues = values;
    for (const item of this.documentosPagina) {
      const key = this.panelValue(item.doc, item.index);
      if (values.includes(key) && !prev.has(key)) {
        this.ensureDocForm(item.index);
      }
      if (!values.includes(key) && prev.has(key)) {
        this.syncDocFormToState(item.index);
      }
    }
    this.cdr.markForCheck();
  }

  docFormAt(index: number): FormGroup | null {
    return this.docForms.get(index) ?? null;
  }

  ensureDocForm(index: number): DocFormGroup {
    let group = this.docForms.get(index);
    if (group) return group;
    const docs = this.state.snapshot().documentos;
    const doc = docs[index];
    const defaultEmpresa = this.state.snapshot().empresaId ?? '';
    const empresaId = doc?.empresa_id || defaultEmpresa;
    group = this.crearDocGroup({
      ...(doc as WizardDocumentoGrupo),
      empresa_id: empresaId,
      tipo: doc?.tipo ?? 'FC',
      factura: doc?.factura ?? '',
    });
    this.docForms.set(index, group);
    this.empresaIdsPorDoc[index] = empresaId ? [empresaId] : [];
    this.fechaRanges[index] = {
      from: parseDateInputValue(doc?.fecha_factura),
      to: null,
    };
    return group;
  }

  crearDocGroup(doc: WizardDocumentoGrupo) {
    const empresaId = doc.empresa_id || this.empresaIds[0] || '';
    return this.fb.nonNullable.group({
      factura: [{ value: doc.factura, disabled: false }, Validators.required],
      tipo: [doc.tipo ?? ('FC' as DocumentoTipo), Validators.required],
      cuenta: [doc.cuenta ?? ''],
      empresa_id: [empresaId, Validators.required],
      fecha_factura: [doc.fecha_factura, Validators.required],
      bonificacion: [doc.bonificacion ?? 0, [Validators.required]],
      importe_sin_iva: [doc.importe_sin_iva as number | null, [Validators.required]],
      percepciones: [doc.percepciones ?? 0, [Validators.required]],
      iva: [doc.iva ?? 0, [Validators.required]],
      importe_total: [doc.importe_total as number | null, [Validators.required]],
    });
  }

  /** Prefija empresa desde Concesión en un solo setDocumentos. */
  private autofillEmpresasDesdeConcesion(): void {
    const docs = this.state.snapshot().documentos;
    let changed = false;
    const mapped = docs.map((doc) => {
      if (doc.empresa_id || !doc.concesionProveedor) {
        return doc;
      }
      const resolved = resolverEmpresaDesdeConcesion(
        doc.concesionProveedor,
        this.empresas,
        this.peajes
      );
      if (!resolved.empresaId) return doc;
      changed = true;
      return { ...doc, empresa_id: resolved.empresaId };
    });
    if (changed) {
      this.state.setDocumentos(mapped);
    }
  }

  private cargarFormsMasiva(): void {
    this.docForms.clear();
    this.fechaRanges = {};
    this.empresaIdsPorDoc = {};
    this.docPage = 0;
    this.expandedValues = this.documentos.length
      ? [this.panelValue(this.documentos[0], 0)]
      : [];
    if (this.documentos.length) {
      this.ensureDocForm(0);
    }
  }

  private rebuildHints(): void {
    this.hintsConcesion.clear();
    this.documentos.forEach((doc, i) => {
      if (doc.concesionProveedor) {
        this.hintsConcesion.set(i, `Concesión del Excel: ${doc.concesionProveedor}`);
      }
    });
  }

  private rebuildSumaNetaCache(): void {
    this.sumaNetaPorKey.clear();
    const snap = this.state.snapshot();
    const pasadas =
      snap.pasadasEstandarizadas.length > 0
        ? snap.pasadasEstandarizadas
        : this.state.construirPasadasDesdeMapeo();
    this.documentos.forEach((doc, index) => {
      const key = doc.factura || `idx-${index}`;
      const subset = this.state.pasadasDeDocumento(doc, pasadas);
      const sum =
        subset.reduce((c, p) => c + this.aCentavos(p.IMPORTE_NETO), 0) / 100;
      this.sumaNetaPorKey.set(key, sum);
    });
  }

  hintConcesion(index: number): string {
    return this.hintsConcesion.get(index) ?? '';
  }

  sumaNetaDe(doc: WizardDocumentoGrupo, index: number): number {
    return this.sumaNetaPorKey.get(doc.factura || `idx-${index}`) ?? 0;
  }

  tipoDe(index: number): DocumentoTipo {
    const fromForm = this.docForms.get(index)?.getRawValue()?.tipo;
    return fromForm ?? this.documentos[index]?.tipo ?? 'FC';
  }

  prevDocPage(): void {
    if (this.docPage <= 0) return;
    this.syncVisibleFormsToState();
    this.docPage -= 1;
    this.expandedValues = [];
    this.cdr.markForCheck();
  }

  nextDocPage(): void {
    if (this.docPage >= this.totalDocPages - 1) return;
    this.syncVisibleFormsToState();
    this.docPage += 1;
    this.expandedValues = [];
    this.cdr.markForCheck();
  }

  /** Cabecera + pasadas del documento: quitar IVA (/1,21). */
  quitarIvaDoc(index: number): void {
    const group = this.ensureDocForm(index);
    if (this.documentos[index]?.ivaPasadasModo === 'sin_iva') return;
    const v = group.getRawValue();
    const next = quitarIvaDocumento({
      importe_sin_iva: v.importe_sin_iva,
      percepciones: v.percepciones,
      iva: v.iva,
      importe_total: v.importe_total,
    });
    group.patchValue({ ...next });
    group.markAsDirty();
    this.state.ajustarIvaPasadasDocumento(index, 'sin_iva', (n) => quitarIvaImporte(n) ?? n);
    this.state.patchDocumento(index, { ...next, tipo: v.tipo });
    this.refreshDocumentosFromState();
    this.cdr.markForCheck();
  }

  /** Cabecera: IVA 21% + pasadas ×1,21 del documento. */
  agregarIvaDoc(index: number): void {
    const group = this.ensureDocForm(index);
    if (this.documentos[index]?.ivaPasadasModo === 'con_iva') return;
    const v = group.getRawValue();
    const next = agregarIvaDocumento({
      importe_sin_iva: v.importe_sin_iva,
      percepciones: v.percepciones,
      iva: v.iva,
      importe_total: v.importe_total,
    });
    group.patchValue({ ...next });
    group.markAsDirty();
    this.state.ajustarIvaPasadasDocumento(index, 'con_iva', (n) => agregarIvaImporte(n) ?? n);
    this.state.patchDocumento(index, { ...next, tipo: v.tipo });
    this.refreshDocumentosFromState();
    this.cdr.markForCheck();
  }

  onEmpresaDocChange(ids: string[], index: number): void {
    const id = ids[0] ?? '';
    this.empresaIdsPorDoc[index] = id ? [id] : [];
    this.ensureDocForm(index).patchValue({ empresa_id: id });
    this.ensureDocForm(index).controls.empresa_id.markAsTouched();
    this.state.patchDocumento(index, { empresa_id: id });
    this.refreshDocumentosFromState();
    this.cdr.markForCheck();
  }

  irAPasoParaDocumento(paso: 5 | 6, index: number): void {
    this.persistMasivaDraft();
    const doc = this.documentos[index];
    if (doc?.empresa_id) {
      this.state.setEmpresaId(doc.empresa_id);
    }
    this.irAPaso.emit(paso);
  }

  private syncVisibleFormsToState(): void {
    for (const item of this.documentosPagina) {
      if (this.docForms.has(item.index)) {
        this.syncDocFormToState(item.index);
      }
    }
  }

  private syncDocFormToState(index: number): void {
    const group = this.docForms.get(index);
    if (!group) return;
    const v = group.getRawValue();
    const prev = this.state.snapshot().documentos[index];
    if (!prev) return;
    this.state.patchDocumento(index, {
      factura: v.factura,
      tipo: v.tipo ?? 'FC',
      cuenta: (v.cuenta ?? '').trim(),
      empresa_id: v.empresa_id || this.empresaIdsPorDoc[index]?.[0] || prev.empresa_id,
      fecha_factura: v.fecha_factura,
      bonificacion: v.bonificacion,
      importe_sin_iva: v.importe_sin_iva,
      percepciones: v.percepciones,
      iva: v.iva,
      importe_total: v.importe_total,
    });
  }

  private persistMasivaDraft(): void {
    this.syncVisibleFormsToState();
    // Also sync every created form (other pages)
    for (const index of this.docForms.keys()) {
      this.syncDocFormToState(index);
    }
    this.refreshDocumentosFromState();
  }

  private refreshDocumentosFromState(): void {
    this.documentos = this.state.snapshot().documentos;
    this.rebuildHints();
  }

  panelValue(doc: WizardDocumentoGrupo, index: number): string {
    return doc.factura || `doc-${index}`;
  }

  panelStatus(index: number): AccordionPanelStatus {
    const doc = this.documentos[index];
    if (doc?.omitido) return 'warn';
    const group = this.docForms.get(index);
    if (group) {
      if (group.invalid && group.touched) return 'error';
      if (group.valid && group.dirty) return 'ok';
    }
    return doc?.status ?? 'neutral';
  }

  /** True si el documento (no omitido) tiene formulario incompleto/inválido. */
  docTieneError(index: number): boolean {
    const doc = this.documentos[index];
    if (!doc || doc.omitido) return false;
    const group = this.docForms.get(index);
    if (group) return group.invalid;
    return this.docIncomplete(doc);
  }

  get cantidadOmitidos(): number {
    return this.documentos.filter((d) => d.omitido).length;
  }

  get cantidadConError(): number {
    return this.documentos.reduce((n, _d, i) => n + (this.docTieneError(i) ? 1 : 0), 0);
  }

  get cantidadIncluidosValidos(): number {
    return this.documentos.reduce((n, d, i) => {
      if (d.omitido) return n;
      return n + (this.docTieneError(i) ? 0 : 1);
    }, 0);
  }

  get puedeOmitirInvalidosYContinuar(): boolean {
    return this.esMasiva && this.cantidadConError > 0 && this.cantidadIncluidosValidos > 0;
  }

  motivosErrorDocumento(index: number): string[] {
    const doc = this.documentos[index];
    if (!doc) return [];
    const group = this.docForms.get(index);
    const motivos: string[] = [];
    const push = (cond: boolean, msg: string) => {
      if (cond) motivos.push(msg);
    };
    if (group) {
      const v = group.getRawValue();
      push(!String(v.factura ?? '').trim(), 'Número de factura obligatorio');
      push(!v.tipo, 'Tipo de documento obligatorio');
      push(!String(v.empresa_id ?? '').trim(), 'Empresa obligatoria');
      push(!String(v.fecha_factura ?? '').trim(), 'Fecha de documento obligatoria');
      push(v.bonificacion == null, 'Bonificación obligatoria');
      push(v.importe_sin_iva == null, 'Subtotal obligatorio');
      push(v.percepciones == null, 'Percepciones obligatorias');
      push(v.iva == null, 'IVA obligatorio');
      push(v.importe_total == null, 'Total obligatorio');
      if (!motivos.length && group.invalid) {
        motivos.push('Datos del documento incompletos o inválidos');
      }
      return motivos;
    }
    push(!doc.factura?.trim(), 'Número de factura obligatorio');
    push(!doc.tipo, 'Tipo de documento obligatorio');
    push(!doc.empresa_id, 'Empresa obligatoria');
    push(!doc.fecha_factura, 'Fecha de documento obligatoria');
    push(doc.bonificacion == null, 'Bonificación obligatoria');
    push(doc.importe_sin_iva == null, 'Subtotal obligatorio');
    push(doc.percepciones == null, 'Percepciones obligatorias');
    push(doc.iva == null, 'IVA obligatorio');
    push(doc.importe_total == null, 'Total obligatorio');
    return motivos;
  }

  omitirDocumento(index: number): void {
    this.syncDocFormToState(index);
    const doc = this.state.snapshot().documentos[index];
    if (!doc || doc.omitido) return;
    const motivos = this.motivosErrorDocumento(index);
    this.state.patchDocumento(index, {
      omitido: true,
      status: 'warn',
      errores: motivos.length ? motivos : ['Documento omitido por el usuario'],
    });
    this.refreshDocumentosFromState();
    this.cdr.markForCheck();
  }

  reincluirDocumento(index: number): void {
    const doc = this.state.snapshot().documentos[index];
    if (!doc?.omitido) return;
    this.state.patchDocumento(index, {
      omitido: false,
      status: 'neutral',
      errores: [],
    });
    this.refreshDocumentosFromState();
    this.cdr.markForCheck();
  }

  omitirInvalidosYContinuar(): void {
    if (!this.puedeOmitirInvalidosYContinuar) return;
    this.persistMasivaDraft();
    const docs = this.state.snapshot().documentos;
    const next = docs.map((d, i) => {
      if (d.omitido) return d;
      const group = this.docForms.get(i);
      const invalid = group ? group.invalid : this.docIncomplete(d);
      if (!invalid) {
        return { ...d, status: 'ok' as AccordionPanelStatus, errores: [] as string[], omitido: false };
      }
      const motivos = this.motivosErrorDocumento(i);
      return {
        ...d,
        omitido: true,
        status: 'warn' as AccordionPanelStatus,
        errores: motivos.length ? motivos : ['Documento omitido por validación incompleta'],
      };
    });
    const incluidos = next.filter((d) => !d.omitido);
    if (!incluidos.length) {
      this.cdr.markForCheck();
      return;
    }
    this.state.setDocumentos(next);
    this.documentos = next;
    this.completado.emit();
  }

  countPasadas(doc: WizardDocumentoGrupo): number {
    return doc.rowIndexes?.length ?? 0;
  }

  get sumaNetos(): number {
    const pasadas =
      this.state.snapshot().pasadasEstandarizadas.length > 0
        ? this.state.snapshot().pasadasEstandarizadas
        : this.state.construirPasadasDesdeMapeo();
    return pasadas.reduce((centavos, p) => centavos + this.aCentavos(p.IMPORTE_NETO), 0) / 100;
  }

  get diferenciaNetoPasadas(): number {
    const subtotal = Number(this.form.controls.importe_sin_iva.value ?? 0);
    const bonif = Number(this.form.controls.bonificacion.value ?? 0);
    // Σ neto − bonificación − subtotal (0 = concilia)
    return this.aCentavos(this.sumaNetos - bonif - subtotal) / 100;
  }

  get toleranciaFactura(): number {
    return Math.abs(Number(this.form.controls.importe_sin_iva.value ?? 0)) * 0.01;
  }

  get diferenciaDentroTolerancia(): boolean {
    return Math.abs(this.diferenciaNetoPasadas) <= this.toleranciaFactura;
  }

  onFechaChange(range: DateRangeValue, index = 0): void {
    this.fechaRanges[index] = range;
    const iso = toDateInputValue(range.from);
    if (this.esMasiva) {
      this.ensureDocForm(index).patchValue({ fecha_factura: iso });
      this.ensureDocForm(index).controls.fecha_factura.markAsTouched();
    } else {
      this.form.patchValue({ fecha_factura: iso });
      this.form.controls.fecha_factura.markAsTouched();
    }
    this.cdr.markForCheck();
  }

  cargarFacturaMvp(): void {
    this.form.patchValue({
      ...MVP_FACTURA,
      tipo: 'FC',
      empresa_id: this.form.getRawValue().empresa_id || MVP_FACTURA.empresa_id,
    });
    this.fechaRanges = {
      0: { from: parseDateInputValue(MVP_FACTURA.fecha_factura), to: null },
    };
    this.cdr.markForCheck();
  }

  async guardarPlantillaDesdeWizard(): Promise<void> {
    const nombre = this.nombrePlantilla.trim();
    const snap = this.state.snapshot();
    if (!nombre || !snap.empresaId) {
      this.plantillaError = 'Ingresá un nombre; la empresa se toma del Paso 1.';
      this.cdr.markForCheck();
      return;
    }
    const configuraciones = this.state.toConfiguracionesPlantilla().map(
      ({ id: _id, plantilla_id: _plantillaId, ...config }) => config
    ) as Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[];
    const mapeos = snap.mapeos.map((m) => ({
      columnaOrigen: m.columnaOrigen,
      columnaDestino: m.columnaDestino,
      excluida: m.excluida,
    }));
    const relaciones = snap.relacionesEstacion
      .filter((r) => !!r.estacionId)
      .map((r) => ({
        estacion_id: r.estacionId!,
        valor_proveedor: r.valorProveedor,
        valor_normalizado: r.valorProveedor.trim().toUpperCase(),
        origen: 'plantilla' as const,
      }));
    this.guardandoPlantilla = true;
    this.plantillaError = '';
    this.cdr.markForCheck();
    try {
      const saved = await firstValueFrom(
        this.plantillas.guardarPlantilla(
          {
            nombre,
            descripcion: 'Creada desde el wizard de importación.',
            empresa_id: snap.empresaId,
            estado: 'activa',
          },
          configuraciones,
          mapeos,
          relaciones
        )
      );
      this.state.setPlantillaMeta({
        id: saved.id,
        nombre: saved.nombre,
        descripcion: saved.descripcion ?? null,
        empresa_id: saved.empresa_id,
        estado: saved.estado,
      });
      this.recomendacionVisible = false;
    } catch (e) {
      this.plantillaError = e instanceof Error ? e.message : 'No se pudo guardar la plantilla.';
    } finally {
      this.guardandoPlantilla = false;
      this.cdr.markForCheck();
    }
  }

  omitirPlantilla(): void {
    this.state.descartarRecomendacionPlantilla();
    this.recomendacionVisible = false;
    this.cdr.markForCheck();
  }

  continuar(): void {
    if (this.esMasiva) {
      this.continuarMasiva();
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusFirstInvalid();
      this.cdr.markForCheck();
      return;
    }
    const v = this.form.getRawValue();
    const factura: WizardFacturaForm = {
      factura: v.factura,
      tipo: v.tipo,
      cuenta: (v.cuenta ?? '').trim(),
      empresa_id: v.empresa_id,
      fecha_factura: v.fecha_factura,
      bonificacion: v.bonificacion,
      importe_sin_iva: v.importe_sin_iva,
      percepciones: v.percepciones,
      iva: v.iva,
      importe_total: v.importe_total,
    };
    this.state.setFactura(factura);
    this.completado.emit();
  }

  private continuarMasiva(): void {
    this.persistMasivaDraft();
    const docs = this.state.snapshot().documentos;
    const badIdx = docs.findIndex((d, i) => {
      if (d.omitido) return false;
      const group = this.docForms.get(i);
      if (group) {
        group.markAllAsTouched();
        return group.invalid;
      }
      return this.docIncomplete(d);
    });
    if (badIdx >= 0) {
      this.docPage = Math.floor(badIdx / this.pageSize);
      const val = this.panelValue(docs[badIdx], badIdx);
      this.ensureDocForm(badIdx).markAllAsTouched();
      if (!this.expandedValues.includes(val)) {
        this.expandedValues = [...this.expandedValues, val];
      }
      this.cdr.markForCheck();
      return;
    }
    const incluidos = docs.filter((d) => !d.omitido);
    if (!incluidos.length) {
      this.cdr.markForCheck();
      return;
    }
    const okDocs = docs.map((d) =>
      d.omitido
        ? d
        : {
            ...d,
            status: 'ok' as AccordionPanelStatus,
            errores: [] as string[],
            omitido: false,
          }
    );
    this.state.setDocumentos(okDocs);
    this.documentos = okDocs;
    this.completado.emit();
  }

  private docIncomplete(d: WizardDocumentoGrupo): boolean {
    return (
      !d.factura?.trim() ||
      !d.tipo ||
      !d.empresa_id ||
      !d.fecha_factura ||
      d.bonificacion == null ||
      d.importe_sin_iva == null ||
      d.percepciones == null ||
      d.iva == null ||
      d.importe_total == null
    );
  }

  invalid(ctrl: string, index?: number): boolean {
    const c =
      index == null ? this.form.get(ctrl) : this.docForms.get(index)?.get(ctrl);
    return !!(c && c.touched && c.invalid);
  }

  private focusFirstInvalid(): void {
    const order = [
      'factura',
      'cuenta',
      'fecha_factura',
      'bonificacion',
      'importe_sin_iva',
      'percepciones',
      'iva',
      'importe_total',
    ] as const;
    for (const key of order) {
      const ctrl = this.form.controls[key];
      if (ctrl.invalid) {
        const el = document.getElementById(key) as HTMLInputElement | null;
        el?.focus();
        return;
      }
    }
  }

  private aCentavos(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
  }
}
