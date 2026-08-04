import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Empresa,
  PEAJES_CATALOGO_SERVICE,
  PeajesCatalogoService,
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
    SearchMultiSelectComponent,
    DateRangePickerComponent,
  ],
  templateUrl: './paso7-factura.component.html',
  styleUrl: './paso7-factura.component.css',
})
export class Paso7FacturaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  readonly state = inject(PeajesWizardStateService);

  empresas: Empresa[] = [];
  empresaIds: string[] = [];
  fechaRange: DateRangeValue = { from: null, to: null };

  form = this.fb.nonNullable.group({
    factura: ['', Validators.required],
    cuenta: [''],
    empresa_id: [{ value: '', disabled: true }, Validators.required],
    fecha_factura: ['', Validators.required],
    importe_sin_iva: [null as number | null, [Validators.required]],
    importe_total: [null as number | null, [Validators.required]],
  });

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
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
    });
    this.empresaIds = empresaId ? [empresaId] : [];
    this.fechaRange = {
      from: parseDateInputValue(snap.factura.fecha_factura),
      to: null,
    };
  }

  get sumaNetos(): number {
    const pasadas =
      this.state.snapshot().pasadasEstandarizadas.length > 0
        ? this.state.snapshot().pasadasEstandarizadas
        : this.state.construirPasadasDesdeMapeo();
    return pasadas.reduce((acc, p) => acc + Number(p.IMPORTE_NETO ?? 0), 0);
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
      return;
    }
    const v = this.form.getRawValue();
    const factura: WizardFacturaForm = {
      factura: v.factura,
      cuenta: (v.cuenta ?? '').trim(),
      empresa_id: v.empresa_id,
      fecha_factura: v.fecha_factura,
      importe_sin_iva: v.importe_sin_iva,
      importe_total: v.importe_total,
    };
    this.state.setFactura(factura);
    this.completado.emit();
  }

  invalid(ctrl: string): boolean {
    const c = this.form.get(ctrl);
    return !!(c && c.touched && c.invalid);
  }
}
