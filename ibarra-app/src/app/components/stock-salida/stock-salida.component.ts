import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { ResourceService, RecursoSeleccion } from '../../services/resource.service';
import { ApiIbarraService } from '../../services/api-ibarra.service';
import { Deposito, StockDeposito, RegistroSalidaDTO, ItemMovimiento } from '../../models/stock.model';
import { TemplateResourceType } from '../../models/checklist-template.model';
import { Insumo } from '../../models/chofer.model';
import { AutocompleteInsumoComponent } from '../autocomplete-insumo/autocomplete-insumo.component';

@Component({
  selector: 'app-stock-salida',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AutocompleteInsumoComponent],
  templateUrl: './stock-salida.component.html',
  styleUrl: './stock-salida.component.css'
})
export class StockSalidaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private stockService = inject(StockService);
  private resourceService = inject(ResourceService);
  private apiService = inject(ApiIbarraService);
  private router = inject(Router);

  // Formulario principal
  salidaForm: FormGroup;

  // Formulario para agregar items
  itemForm: FormGroup;

  // Datos
  depositos: Deposito[] = [];
  insumos: Insumo[] = [];
  insumosDisponibles: Insumo[] = [];
  stockDisponible: StockDeposito[] = [];
  recursos: RecursoSeleccion[] = [];
  items: ItemMovimiento[] = [];

  // Estados
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  asignarRecurso = false;

  // Tipos de recursos
  tiposRecurso: { value: TemplateResourceType; label: string }[] = [
    { value: 'vehiculo', label: 'Vehículo' },
    { value: 'chofer', label: 'Chofer' },
    { value: 'unidad', label: 'Unidad' },
    { value: 'maquina', label: 'Máquina' },
    { value: 'sector', label: 'Sector' }
  ];

  constructor() {
    this.salidaForm = this.fb.group({
      deposito_id: ['', Validators.required],
      solicitante: ['', Validators.required],
      motivo: ['', Validators.required],
      observaciones: [''],
      recurso_tipo: [''],
      recurso_id: ['']
    });

    this.itemForm = this.fb.group({
      insumo_id: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.01)]]
    });

    // Cargar recursos cuando cambia el tipo
    this.salidaForm.get('recurso_tipo')?.valueChanges.subscribe(tipo => {
      if (tipo) {
        this.cargarRecursos(tipo);
      } else {
        this.recursos = [];
      }
      this.salidaForm.patchValue({ recurso_id: '' });
    });

    // Cargar stock cuando cambia el depósito
    this.salidaForm.get('deposito_id')?.valueChanges.subscribe(depositoId => {
      if (depositoId) {
        this.cargarStockDeposito(depositoId);
      }
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
        this.insumosDisponibles = insumos;
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
   * Carga el stock de un depósito
   */
  cargarStockDeposito(depositoId: string): void {
    this.stockService.getStockPorDeposito(depositoId).subscribe({
      next: (stock) => {
        this.stockDisponible = stock.filter(s => s.cantidad_actual > 0);
        // Filtrar insumos solo con stock disponible
        const insumosConStock = this.stockDisponible.map(s => s.insumo_id);
        this.insumosDisponibles = this.insumos.filter(i => insumosConStock.includes(i.id));
      },
      error: (err) => {
        console.error('Error al cargar stock:', err);
      }
    });
  }

  /**
   * Carga recursos según el tipo
   */
  cargarRecursos(tipo: TemplateResourceType): void {
    this.resourceService.cargarRecursosPorTipo(tipo).subscribe({
      next: (recursos) => {
        this.recursos = recursos;
      },
      error: (err) => {
        console.error('Error al cargar recursos:', err);
        this.recursos = [];
      }
    });
  }

  /**
   * Maneja el cambio del checkbox de asignar recurso
   */
  onAsignarRecursoChange(value: boolean): void {
    this.asignarRecurso = value;
    if (!value) {
      // Limpiar campos cuando se desactiva
      this.salidaForm.patchValue({
        recurso_tipo: '',
        recurso_id: ''
      });
      this.recursos = [];
    }
  }

  /**
   * Obtiene un insumo por ID
   */
  getInsumo(id: number): Insumo | undefined {
    return this.insumos.find(i => i.id === id);
  }

  /**
   * Obtiene el stock disponible del insumo seleccionado
   */
  getStockDisponibleInsumo(insumoId: number): number {
    const depositoId = this.salidaForm.get('deposito_id')?.value;
    if (!depositoId) return 0;

    const stock = this.stockDisponible.find(
      s => s.deposito_id === depositoId && s.insumo_id === insumoId
    );

    return stock?.cantidad_actual || 0;
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
    const cantidad = this.itemForm.value.cantidad;
    const insumo = this.getInsumo(insumoId);
    const stockDisponible = this.getStockDisponibleInsumo(insumoId);

    // Verificar si ya existe
    const existe = this.items.find(item => item.insumo_id === insumoId);
    if (existe) {
      this.error = 'Este insumo ya está agregado';
      setTimeout(() => this.error = null, 3000);
      return;
    }

    // Verificar stock disponible
    if (cantidad > stockDisponible) {
      this.error = `Stock insuficiente para ${insumo?.nombre}. Disponible: ${stockDisponible}`;
      setTimeout(() => this.error = null, 3000);
      return;
    }

    const item: ItemMovimiento = {
      insumo_id: insumoId,
      insumo_nombre: insumo?.nombre,
      cantidad: cantidad
    };

    this.items.push(item);
    this.itemForm.reset({ cantidad: 1 });
    this.error = null;
  }

  /**
   * Elimina un item de la lista
   */
  eliminarItem(index: number): void {
    this.items.splice(index, 1);
  }

  /**
   * Envía el formulario
   */
  onSubmit(): void {
    if (this.salidaForm.invalid) {
      this.markFormGroupTouched(this.salidaForm);
      return;
    }

    if (this.items.length === 0) {
      this.error = 'Debe agregar al menos un insumo';
      return;
    }

    this.submitting = true;
    this.error = null;
    this.success = null;

    // Obtener nombre del recurso si está seleccionado
    let recursoNombre: string | undefined;
    if (this.asignarRecurso) {
      const recursoId = this.salidaForm.value.recurso_id;
      const recurso = this.recursos.find(r => r.id === recursoId);
      recursoNombre = recurso?.nombre;
    }

    const salida: RegistroSalidaDTO = {
      deposito_id: this.salidaForm.value.deposito_id,
      items: this.items,
      solicitante: this.salidaForm.value.solicitante,
      motivo: this.salidaForm.value.motivo,
      observaciones: this.salidaForm.value.observaciones,
      recurso_tipo: this.asignarRecurso ? this.salidaForm.value.recurso_tipo : undefined,
      recurso_id: this.asignarRecurso ? this.salidaForm.value.recurso_id : undefined,
      recurso_nombre: recursoNombre
    };

    this.stockService.registrarSalida(salida).subscribe({
      next: (resultado) => {
        this.success = `Salida registrada exitosamente con ${resultado.length} item(s)`;
        this.submitting = false;
        
        // Resetear formulario después de 2 segundos
        setTimeout(() => {
          this.salidaForm.reset();
          this.itemForm.reset({ cantidad: 1 });
          this.asignarRecurso = false;
          this.items = [];
          this.success = null;
          this.stockDisponible = [];
          this.insumosDisponibles = this.insumos;
        }, 2000);
      },
      error: (err) => {
        console.error('Error al registrar salida:', err);
        this.error = err || 'Error al registrar la salida';
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
