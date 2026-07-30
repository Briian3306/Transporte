import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeajesWizardStateService, WizardFacturaForm } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso7-factura',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './paso7-factura.component.html',
  styleUrl: './paso7-factura.component.css',
})
export class Paso7FacturaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  readonly state = inject(PeajesWizardStateService);

  form = this.fb.nonNullable.group({
    factura: ['', Validators.required],
    cuenta: ['', Validators.required],
    empresa_id: ['', Validators.required],
    fecha_factura: ['', Validators.required],
    importe_sin_iva: [null as number | null, [Validators.required]],
    importe_total: [null as number | null, [Validators.required]],
  });

  ngOnInit(): void {
    const f = this.state.snapshot().factura;
    this.form.patchValue(f);
  }

  continuar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const factura: WizardFacturaForm = {
      factura: v.factura,
      cuenta: v.cuenta,
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
