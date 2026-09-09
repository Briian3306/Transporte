import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { Deposito } from '../../models/stock.model';

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
  private router = inject(Router);

  depositoForm: FormGroup;
  loading = false;
  error: string | null = null;
  success = false;

  constructor() {
    this.depositoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', Validators.required],
      ubicacion: ['', Validators.required],
      responsable: ['', Validators.required],
      activo: [true]
    });
  }

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.depositoForm.invalid) {
      this.depositoForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const nuevoDeposito = this.depositoForm.value;

    this.stockService.crearDeposito(nuevoDeposito).subscribe({
      next: (deposito: Deposito) => {
        this.success = true;
        this.loading = false;
        
        setTimeout(() => {
          this.router.navigate(['/stock/depositos']);
        }, 1500);
      },
      error: (err) => {
        this.error = err.message || 'Error al crear el depósito';
        this.loading = false;
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/stock/depositos']);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.depositoForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.depositoForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `Debe tener al menos ${minLength} caracteres`;
    }
    return '';
  }
}
