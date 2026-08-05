import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Empresa,
  PEAJES_CATALOGO_SERVICE,
  PeajesCatalogoService,
  ConfiguracionPlantilla,
  PEAJES_PLANTILLAS_SERVICE,
  PeajesPlantillasService,
} from '../../models';
import { MVP_FACTURA } from '../fixtures/mvp-ejemplo.fixture';
import { PeajesWizardStateService, WizardFacturaForm } from '../services/peajes-wizard-state.service';
import {
  DateRangePickerComponent,
  DateRangeValue,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  parseDateInputValue,
  toDateInputValue,
} from '../../../shared';

@Component({
  selector: 'app-paso7-factura',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SearchMultiSelectComponent,
    DateRangePickerComponent,
  ],
  templateUrl: './paso7-factura.component.html',
  styleUrl: './paso7-factura.component.css',
})
export class Paso7FacturaComponent implements OnInit, AfterViewInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  @ViewChild('facturaInput') facturaInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  readonly state = inject(PeajesWizardStateService);

  empresas: Empresa[] = [];
  empresaIds: string[] = [];
  fechaRange: DateRangeValue = { from: null, to: null };
  recomendacionVisible = false;
  nombrePlantilla = '';
  guardandoPlantilla = false;
  plantillaError = '';

  form = this.fb.nonNullable.group({
    factura: ['', Validators.required],
    cuenta: [''],
    empresa_id: [{ value: '', disabled: true }, Validators.required],
    fecha_factura: ['', Validators.required],
    importe_sin_iva: [null as number | null, [Validators.required]],
    percepciones: [0 as number | null, [Validators.required, Validators.min(0)]],
    iva: [0 as number | null, [Validators.required, Validators.min(0)]],
    importe_total: [null as number | null, [Validators.required]],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillas: PeajesPlantillasService
  ) {}

  get empresaOptions(): SearchMultiSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  async ngOnInit(): Promise<void> {
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    const snap = this.state.snapshot();
    const empresaId = snap.factura.empresa_id || snap.empresaId || '';
    this.form.patchValue({
      ...snap.factura,
      empresa_id: empresaId,
      cuenta: snap.factura.cuenta ?? '',
      percepciones: snap.factura.percepciones ?? 0,
      iva: snap.factura.iva ?? 0,
    });
    this.empresaIds = empresaId ? [empresaId] : [];
    this.fechaRange = {
      from: parseDateInputValue(snap.factura.fecha_factura),
      to: null,
    };
    this.recomendacionVisible = !!(
      !snap.plantillaId &&
      !snap.recomendacionPlantillaDescartada &&
      snap.mapeos.length &&
      snap.relacionesEstacion.length
    );
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.facturaInput?.nativeElement.focus());
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

  async guardarPlantillaDesdeWizard(): Promise<void> {
    const nombre = this.nombrePlantilla.trim();
    const snap = this.state.snapshot();
    if (!nombre || !snap.empresaId) {
      this.plantillaError = 'Ingresá un nombre; la empresa se toma del Paso 1.';
      return;
    }
    const configuraciones = this.state.toConfiguracionesPlantilla().map(
      ({ id: _id, plantilla_id: _plantillaId, ...config }) => config
    ) as Omit<ConfiguracionPlantilla, 'id' | 'plantilla_id'>[];
    // Snapshot canónico: mapeos activos del Paso 5 + relaciones confirmadas del Paso 6.
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
    try {
      const saved = await firstValueFrom(this.plantillas.guardarPlantilla(
        { nombre, descripcion: 'Creada desde el wizard de importación.', empresa_id: snap.empresaId, estado: 'activa' },
        configuraciones,
        mapeos,
        relaciones
      ));
      this.state.setPlantillaMeta({ id: saved.id, nombre: saved.nombre, descripcion: saved.descripcion ?? null, empresa_id: saved.empresa_id, estado: saved.estado });
      this.recomendacionVisible = false;
    } catch (e) {
      this.plantillaError = e instanceof Error ? e.message : 'No se pudo guardar la plantilla.';
    } finally {
      this.guardandoPlantilla = false;
    }
  }

  omitirPlantilla(): void {
    this.state.descartarRecomendacionPlantilla();
    this.recomendacionVisible = false;
  }

  get sumaNetos(): number {
    const pasadas =
      this.state.snapshot().pasadasEstandarizadas.length > 0
        ? this.state.snapshot().pasadasEstandarizadas
        : this.state.construirPasadasDesdeMapeo();
    return pasadas.reduce((centavos, p) => centavos + this.aCentavos(p.IMPORTE_NETO), 0) / 100;
  }

  get diferenciaNetoPasadas(): number {
    return this.aCentavos(Number(this.form.controls.importe_sin_iva.value ?? 0) - this.sumaNetos) / 100;
  }

  /** Tolerancia adaptativa: 1% del subtotal declarado. */
  get toleranciaFactura(): number {
    return Math.abs(Number(this.form.controls.importe_sin_iva.value ?? 0)) * 0.01;
  }

  get diferenciaDentroTolerancia(): boolean {
    return Math.abs(this.diferenciaNetoPasadas) <= this.toleranciaFactura;
  }

  onFechaChange(range: DateRangeValue): void {
    this.fechaRange = range;
    this.form.patchValue({ fecha_factura: toDateInputValue(range.from) });
    this.form.controls.fecha_factura.markAsTouched();
  }

  cargarFacturaMvp(): void {
    this.form.patchValue({
      ...MVP_FACTURA,
      empresa_id: this.form.getRawValue().empresa_id || MVP_FACTURA.empresa_id,
    });
    this.fechaRange = {
      from: parseDateInputValue(MVP_FACTURA.fecha_factura),
      to: null,
    };
  }

  continuar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }
    const v = this.form.getRawValue();
    const factura: WizardFacturaForm = {
      factura: v.factura,
      cuenta: (v.cuenta ?? '').trim(),
      empresa_id: v.empresa_id,
      fecha_factura: v.fecha_factura,
      importe_sin_iva: v.importe_sin_iva,
      percepciones: v.percepciones,
      iva: v.iva,
      importe_total: v.importe_total,
    };
    this.state.setFactura(factura);
    this.completado.emit();
  }

  invalid(ctrl: string): boolean {
    const c = this.form.get(ctrl);
    return !!(c && c.touched && c.invalid);
  }

  private focusFirstInvalid(): void {
    const order = [
      'factura',
      'cuenta',
      'fecha_factura',
      'importe_sin_iva',
      'percepciones',
      'iva',
      'importe_total',
    ] as const;
    for (const key of order) {
      const ctrl = this.form.controls[key];
      if (ctrl.invalid) {
        if (key === 'fecha_factura') {
          const dateEl = document.getElementById('fecha_factura') as HTMLInputElement | null;
          dateEl?.focus();
          return;
        }
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
