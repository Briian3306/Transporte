import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { ApiIbarraService } from '../../services/api-ibarra.service';
import { Deposito, RegistroEntradaDTO, ItemMovimiento } from '../../models/stock.model';
import { Insumo } from '../../models/chofer.model';

@Component({
  selector: 'app-stock-entrada',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './stock-entrada.component.html',
  styleUrl: './stock-entrada.component.css'
})
export class StockEntradaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private stockService = inject(StockService);
  private apiService = inject(ApiIbarraService);
  private router = inject(Router);

  // Formulario principal
  entradaForm: FormGroup;

  // Formulario para agregar items
  itemForm: FormGroup;

  // Datos
  depositos: Deposito[] = [];
  insumos: Insumo[] = [];
  insumosFiltrados: Insumo[] = [];
  items: ItemMovimiento[] = [];

  // Estados
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;

  // Filtro de insumos
  filtroInsumo = '';

  constructor() {
    this.entradaForm = this.fb.group({
      deposito_id: ['', Validators.required],
      proveedor: ['', Validators.required],
      numero_factura: ['', Validators.required],
      motivo: ['', Validators.required],
      observaciones: ['']
    });

    this.itemForm = this.fb.group({
      insumo_id: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.01)]],
      costo_unitario: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  /**
   * Carga los datos necesarios
   */
  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar depósitos
    this.stockService.getDepositos().subscribe({
      next: (depositos) => {
        this.depositos = depositos;
      },
      error: (err) => {
        console.error('Error al cargar depósitos:', err);
        this.error = 'Error al cargar depósitos';
        this.loading = false;
      }
    });

    // Cargar insumos
    this.apiService.getInsumos().subscribe({
      next: (insumos) => {
        this.insumos = insumos;
        this.insumosFiltrados = insumos;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar insumos:', err);
        this.error = 'Error al cargar insumos';
        this.loading = false;
      }
    });
  }

  /**
   * Filtra insumos por texto
   */
  filtrarInsumos(): void {
    const texto = this.filtroInsumo.toLowerCase();
    if (!texto) {
      this.insumosFiltrados = this.insumos;
    } else {
      this.insumosFiltrados = this.insumos.filter(i =>
        i.nombre.toLowerCase().includes(texto) ||
        i.codigo?.toLowerCase().includes(texto) ||
        i.categoria.nombre.toLowerCase().includes(texto)
      );
    }
  }

  /**
   * Obtiene un insumo por ID
   */
  getInsumo(id: number): Insumo | undefined {
    return this.insumos.find(i => i.id === id);
  }

  /**
   * Agrega un item a la lista
   */
  agregarItem(): void {
    if (this.itemForm.invalid) {
      this.markFormGroupTouched(this.itemForm);
      return;
    }

    const insumoId = parseInt(this.itemForm.value.insumo_id);
    const insumo = this.getInsumo(insumoId);

    // Verificar si ya existe
    const existe = this.items.find(item => item.insumo_id === insumoId);
    if (existe) {
      this.error = 'Este insumo ya está agregado';
      setTimeout(() => this.error = null, 3000);
      return;
    }

    const item: ItemMovimiento = {
      insumo_id: insumoId,
      insumo_nombre: insumo?.nombre,
      cantidad: this.itemForm.value.cantidad,
      costo_unitario: this.itemForm.value.costo_unitario
    };

    this.items.push(item);
    this.itemForm.reset({ cantidad: 1, costo_unitario: 0 });
    this.error = null;
  }

  /**
   * Elimina un item de la lista
   */
  eliminarItem(index: number): void {
    this.items.splice(index, 1);
  }

  /**
   * Calcula el costo total de un item
   */
  getCostoTotalItem(item: ItemMovimiento): number {
    return item.cantidad * (item.costo_unitario || 0);
  }

  /**
   * Calcula el costo total de todos los items
   */
  get costoTotal(): number {
    return this.items.reduce((total, item) => total + this.getCostoTotalItem(item), 0);
  }

  /**
   * Envía el formulario
   */
  onSubmit(): void {
    if (this.entradaForm.invalid) {
      this.markFormGroupTouched(this.entradaForm);
      return;
    }

    if (this.items.length === 0) {
      this.error = 'Debe agregar al menos un insumo';
      return;
    }

    this.submitting = true;
    this.error = null;
    this.success = null;

    const entrada: RegistroEntradaDTO = {
      deposito_id: this.entradaForm.value.deposito_id,
      items: this.items,
      proveedor: this.entradaForm.value.proveedor,
      numero_factura: this.entradaForm.value.numero_factura,
      motivo: this.entradaForm.value.motivo,
      observaciones: this.entradaForm.value.observaciones
    };

    this.stockService.registrarEntrada(entrada).subscribe({
      next: (resultado) => {
        this.success = `Entrada registrada exitosamente con ${resultado.length} item(s)`;
        this.submitting = false;
        
        // Resetear formulario después de 2 segundos
        setTimeout(() => {
          this.entradaForm.reset();
          this.itemForm.reset({ cantidad: 1, costo_unitario: 0 });
          this.items = [];
          this.success = null;
        }, 2000);
      },
      error: (err) => {
        console.error('Error al registrar entrada:', err);
        this.error = err || 'Error al registrar la entrada';
        this.submitting = false;
      }
    });
  }

  /**
   * Marca todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(formGroup: FormGroup, field: string): boolean {
    const control = formGroup.get(field);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
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

  /**
   * Cancela y vuelve atrás
   */
  cancelar(): void {
    this.router.navigate(['/stock/dashboard']);
  }
}
