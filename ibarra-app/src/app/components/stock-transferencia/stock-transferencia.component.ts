import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { ApiIbarraService } from '../../services/api-ibarra.service';
import { Deposito, StockDeposito, RegistroTransferenciaDTO, ItemMovimiento } from '../../models/stock.model';
import { Insumo } from '../../models/chofer.model';
import { AutocompleteInsumoComponent } from '../autocomplete-insumo/autocomplete-insumo.component';

@Component({
  selector: 'app-stock-transferencia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutocompleteInsumoComponent],
  templateUrl: './stock-transferencia.component.html',
  styleUrl: './stock-transferencia.component.css'
})
export class StockTransferenciaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private stockService = inject(StockService);
  private apiService = inject(ApiIbarraService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  depositoContexto: string | null = null;

  transferenciaForm: FormGroup;
  itemForm: FormGroup;

  depositos: Deposito[] = [];
  insumos: Insumo[] = [];
  insumosDisponibles: Insumo[] = [];
  stockDisponible: StockDeposito[] = [];
  items: ItemMovimiento[] = [];

  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;

  constructor() {
    this.transferenciaForm = this.fb.group({
      deposito_origen_id: ['', Validators.required],
      deposito_destino_id: ['', Validators.required],
      motivo: ['', Validators.required],
      observaciones: ['']
    });

    this.itemForm = this.fb.group({
      insumo_id: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.01)]]
    });

    this.transferenciaForm.get('deposito_origen_id')?.valueChanges.subscribe(depositoId => {
      this.items = [];
      this.itemForm.reset({ cantidad: 1 });
      const destino = this.transferenciaForm.get('deposito_destino_id')?.value;
      if (destino && destino === depositoId) {
        this.transferenciaForm.patchValue({ deposito_destino_id: '' }, { emitEvent: false });
      }
      if (depositoId) {
        this.cargarStockDeposito(depositoId);
      } else {
        this.stockDisponible = [];
        this.insumosDisponibles = [];
      }
    });
  }

  ngOnInit(): void {
    this.depositoContexto = this.route.snapshot.queryParamMap.get('deposito');
    this.cargarDatos();
  }

  get depositosDestino(): Deposito[] {
    const origenId = this.transferenciaForm.get('deposito_origen_id')?.value;
    return this.depositos.filter(d => d.id !== origenId);
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    this.stockService.getDepositos().subscribe({
      next: (depositos) => {
        this.depositos = depositos;
        this.aplicarDepositoContexto();
      },
      error: (err) => {
        console.error('Error al cargar depósitos:', err);
        this.error = 'Error al cargar depósitos';
        this.loading = false;
      }
    });

    this.apiService.getInsumos().subscribe({
      next: (insumos) => {
        this.insumos = insumos;
        this.insumosDisponibles = [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar insumos:', err);
        this.error = 'Error al cargar insumos';
        this.loading = false;
      }
    });
  }

  cargarStockDeposito(depositoId: string): void {
    this.stockService.getStockPorDeposito(depositoId).subscribe({
      next: (stock) => {
        this.stockDisponible = stock.filter(s => s.cantidad_actual > 0);
        const insumosConStock = this.stockDisponible.map(s => s.insumo_id);
        this.insumosDisponibles = this.insumos.filter(i => insumosConStock.includes(i.id));
      },
      error: (err) => {
        console.error('Error al cargar stock:', err);
      }
    });
  }

  getInsumo(id: number): Insumo | undefined {
    return this.insumos.find(i => i.id === id);
  }

  getStockDisponibleInsumo(insumoId: number): number {
    const stock = this.stockDisponible.find(s => s.insumo_id === insumoId);
    return stock?.cantidad_actual || 0;
  }

  agregarItem(): void {
    if (this.itemForm.invalid) {
      this.markFormGroupTouched(this.itemForm);
      return;
    }

    const insumoId = parseInt(this.itemForm.value.insumo_id);
    const cantidad = this.itemForm.value.cantidad;
    const insumo = this.getInsumo(insumoId);
    const stockDisponible = this.getStockDisponibleInsumo(insumoId);

    const existe = this.items.find(item => item.insumo_id === insumoId);
    if (existe) {
      this.error = 'Este insumo ya está agregado';
      setTimeout(() => this.error = null, 3000);
      return;
    }

    if (cantidad > stockDisponible) {
      this.error = `Stock insuficiente para ${insumo?.nombre}. Disponible: ${stockDisponible}`;
      setTimeout(() => this.error = null, 3000);
      return;
    }

    this.items.push({
      insumo_id: insumoId,
      insumo_nombre: insumo?.nombre,
      cantidad
    });
    this.itemForm.reset({ cantidad: 1 });
    this.error = null;
  }

  eliminarItem(index: number): void {
    this.items.splice(index, 1);
  }

  onSubmit(): void {
    if (this.transferenciaForm.invalid) {
      this.markFormGroupTouched(this.transferenciaForm);
      return;
    }

    if (this.items.length === 0) {
      this.error = 'Debe agregar al menos un insumo';
      return;
    }

    const origen = this.transferenciaForm.value.deposito_origen_id;
    const destino = this.transferenciaForm.value.deposito_destino_id;
    if (origen === destino) {
      this.error = 'El depósito origen y destino deben ser distintos';
      return;
    }

    this.submitting = true;
    this.error = null;
    this.success = null;

    const dto: RegistroTransferenciaDTO = {
      deposito_origen_id: origen,
      deposito_destino_id: destino,
      items: this.items,
      motivo: this.transferenciaForm.value.motivo,
      observaciones: this.transferenciaForm.value.observaciones
    };

    this.stockService.registrarTransferencia(dto).subscribe({
      next: () => {
        this.success = `Transferencia registrada con ${this.items.length} item(s)`;
        this.submitting = false;
        setTimeout(() => {
          this.transferenciaForm.reset();
          this.itemForm.reset({ cantidad: 1 });
          this.items = [];
          this.success = null;
          this.stockDisponible = [];
          this.insumosDisponibles = [];
          this.aplicarDepositoContexto();
        }, 2000);
      },
      error: (err) => {
        console.error('Error al registrar transferencia:', err);
        this.error = err?.message || 'Error al registrar la transferencia';
        this.submitting = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  hasError(formGroup: FormGroup, field: string): boolean {
    const control = formGroup.get(field);
    return !!(control && control.invalid && control.touched);
  }

  getErrorMessage(formGroup: FormGroup, field: string): string {
    const control = formGroup.get(field);
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    if (control.errors['required']) {
      return 'Este campo es requerido';
    }
    if (control.errors['min']) {
      return `El valor mínimo es ${control.errors['min'].min}`;
    }
    return 'Campo inválido';
  }

  cancelar(): void {
    if (this.depositoContexto) {
      this.router.navigate(['/stock/deposito', this.depositoContexto]);
      return;
    }
    this.router.navigate(['/stock/dashboard']);
  }

  private aplicarDepositoContexto(): void {
    if (this.depositoContexto) {
      this.transferenciaForm.patchValue({ deposito_origen_id: this.depositoContexto });
    }
  }
}
