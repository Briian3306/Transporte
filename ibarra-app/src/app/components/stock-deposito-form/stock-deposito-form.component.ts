import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { StockAuditoriasService } from '../../services/stock-auditorias.service';
import { Deposito, DepositoAuditoriaConfig, PeriodicidadAuditoria } from '../../models/stock.model';

@Component({
  selector: 'app-stock-deposito-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stock-deposito-form.component.html',
  styleUrl: './stock-deposito-form.component.css'
})
export class StockDepositoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private stockService = inject(StockService);
  private auditoriasService = inject(StockAuditoriasService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  depositoForm: FormGroup;
  auditoriaForm: FormGroup;
  loading = false;
  loadingDatos = false;
  error: string | null = null;
  success = false;
  modoEdicion = false;
  depositoId: string | null = null;

  periodicidades: { value: PeriodicidadAuditoria; label: string }[] = [
    { value: 'semanal', label: 'Semanal' },
    { value: 'quincenal', label: 'Quincenal' },
    { value: 'mensual', label: 'Mensual' },
    { value: 'bimestral', label: 'Bimestral' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
    { value: 'personalizada', label: 'Personalizada' },
  ];

  constructor() {
    this.depositoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', Validators.required],
      ubicacion: ['', Validators.required],
      responsable: ['', Validators.required],
      activo: [true]
    });

    this.auditoriaForm = this.fb.group({
      periodicidad: ['mensual' as PeriodicidadAuditoria, Validators.required],
      intervalo_dias: [30, [Validators.required, Validators.min(1)]],
      dias_aviso_previo: [3, [Validators.required, Validators.min(0)]],
      tolerancia_desvio_pct: [0, [Validators.required, Validators.min(0)]],
      incluir_sin_stock: [true],
      responsable: [''],
      activo: [true],
      proxima_fecha: ['']
    });
  }

  ngOnInit(): void {
    this.depositoId = this.route.snapshot.paramMap.get('id');
    this.modoEdicion = !!this.depositoId && this.router.url.includes('/editar');

    this.auditoriaForm.get('periodicidad')?.valueChanges.subscribe((valor: PeriodicidadAuditoria) => {
      if (valor !== 'personalizada') {
        this.auditoriaForm.patchValue({
          intervalo_dias: this.auditoriasService.intervaloPorPeriodicidad(valor)
        }, { emitEvent: false });
      }
    });

    if (this.modoEdicion && this.depositoId) {
      this.cargarDeposito(this.depositoId);
    }
  }

  get titulo(): string {
    return this.modoEdicion ? 'Editar Depósito' : 'Nuevo Depósito';
  }

  get esPersonalizada(): boolean {
    return this.auditoriaForm.get('periodicidad')?.value === 'personalizada';
  }

  onSubmit(): void {
    if (this.depositoForm.invalid) {
      this.depositoForm.markAllAsTouched();
      return;
    }
    if (this.auditoriaForm.invalid) {
      this.auditoriaForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const datosDeposito = this.depositoForm.value;

    const despuesDeGuardar = (deposito: Deposito) => {
      this.auditoriasService.guardarConfig(deposito.id, this.payloadAuditoria()).subscribe({
        next: () => {
          this.success = true;
          this.loading = false;
          setTimeout(() => this.router.navigate(['/stock/deposito', deposito.id]), 1200);
        },
        error: (err) => {
          this.error = err.message || 'El depósito se guardó, pero falló la configuración de auditoría';
          this.loading = false;
        }
      });
    };

    if (this.modoEdicion && this.depositoId) {
      this.stockService.actualizarDeposito(this.depositoId, datosDeposito).subscribe({
        next: despuesDeGuardar,
        error: (err) => {
          this.error = err.message || 'Error al actualizar el depósito';
          this.loading = false;
        }
      });
    } else {
      this.stockService.crearDeposito(datosDeposito).subscribe({
        next: despuesDeGuardar,
        error: (err) => {
          this.error = err.message || 'Error al crear el depósito';
          this.loading = false;
        }
      });
    }
  }

  onCancel(): void {
    if (this.modoEdicion && this.depositoId) {
      this.router.navigate(['/stock/deposito', this.depositoId]);
      return;
    }
    this.router.navigate(['/stock/dashboard']);
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (!field) return '';
    if (field.hasError('required')) return 'Este campo es requerido';
    if (field.hasError('minlength')) {
      return `Debe tener al menos ${field.getError('minlength').requiredLength} caracteres`;
    }
    if (field.hasError('min')) return 'El valor no puede ser negativo';
    return '';
  }

  private cargarDeposito(id: string): void {
    this.loadingDatos = true;
    forkJoin({
      deposito: this.stockService.getDepositoById(id),
      config: this.auditoriasService.getConfig(id)
    }).subscribe({
      next: ({ deposito, config }) => {
        if (!deposito) {
          this.error = 'No se encontró el depósito';
          this.loadingDatos = false;
          return;
        }
        this.depositoForm.patchValue(deposito);
        if (config) {
          this.auditoriaForm.patchValue({
            ...config,
            proxima_fecha: config.proxima_fecha || ''
          });
        } else {
          this.auditoriaForm.patchValue({ responsable: deposito.responsable });
        }
        this.loadingDatos = false;
      },
      error: (err) => {
        this.error = err.message || 'Error al cargar el depósito';
        this.loadingDatos = false;
      }
    });
  }

  private payloadAuditoria(): Omit<DepositoAuditoriaConfig, 'id' | 'deposito_id'> {
    const value = this.auditoriaForm.value;
    return {
      periodicidad: value.periodicidad,
      intervalo_dias: Number(value.intervalo_dias),
      dias_aviso_previo: Number(value.dias_aviso_previo),
      tolerancia_desvio_pct: Number(value.tolerancia_desvio_pct),
      incluir_sin_stock: !!value.incluir_sin_stock,
      responsable: value.responsable,
      activo: !!value.activo,
      proxima_fecha: value.proxima_fecha || null
    };
  }
}
