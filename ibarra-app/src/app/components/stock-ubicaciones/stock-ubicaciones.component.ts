import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { StockUbicacionesService } from '../../services/stock-ubicaciones.service';
import { Deposito, DepositoUbicacion, TipoUbicacion } from '../../models/stock.model';
import { asignablePorDefecto } from '../../services/stock-ubicaciones.util';

@Component({
  selector: 'app-stock-ubicaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-ubicaciones.component.html',
  styleUrl: './stock-ubicaciones.component.css'
})
export class StockUbicacionesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stockService = inject(StockService);
  private ubicacionesService = inject(StockUbicacionesService);

  depositoId = '';
  deposito: Deposito | null = null;
  ubicaciones: DepositoUbicacion[] = [];
  loading = true;
  error: string | null = null;
  guardando = false;

  nueva: { parent: DepositoUbicacion | null; codigo: string; nombre: string; asignable: boolean } | null = null;
  editandoId: string | null = null;
  editCodigo = '';
  editNombre = '';
  formError: string | null = null;
  mostrarGuia = true;

  readonly niveles: { tipo: TipoUbicacion; icono: string; titulo: string; paraQue: string; ejemplo: string }[] = [
    { tipo: 'zona', icono: 'fas fa-th-large', titulo: 'Zona', paraQue: 'Sector grande del depósito (nave, playón, contenedor).', ejemplo: 'Z1 · Nave A' },
    { tipo: 'pasillo', icono: 'fas fa-grip-lines-vertical', titulo: 'Pasillo', paraQue: 'Corredor dentro de una zona.', ejemplo: 'P3 · Pasillo 3' },
    { tipo: 'estante', icono: 'fas fa-bars', titulo: 'Estante', paraQue: 'Estantería o rack del pasillo.', ejemplo: 'E2 · Estante 2' },
    { tipo: 'posicion', icono: 'fas fa-map-pin', titulo: 'Posición', paraQue: 'Hueco concreto. Queda asignable por defecto para colgar el insumo.', ejemplo: '05 · Posición 05' },
  ];

  ngOnInit(): void {
    this.depositoId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.depositoId) {
      this.error = 'Depósito no indicado';
      this.loading = false;
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.stockService.getDepositoById(this.depositoId).subscribe({
      next: (deposito) => {
        this.deposito = deposito || null;
      }
    });
    this.ubicacionesService.getUbicaciones(this.depositoId).subscribe({
      next: (arbol) => {
        this.ubicaciones = arbol;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Error al cargar ubicaciones';
        this.loading = false;
      }
    });
  }

  tipoHijoLabel(nodo: DepositoUbicacion): string {
    const tipo = this.ubicacionesService.tipoHijo(nodo.tipo);
    return tipo ? this.etiqueta(tipo) : '';
  }

  etiqueta(tipo: TipoUbicacion): string {
    return this.ubicacionesService.etiquetaTipo(tipo);
  }

  puedeAgregarHijo(nodo: DepositoUbicacion | null): boolean {
    return this.ubicacionesService.tipoHijo(nodo?.tipo || null) !== null;
  }

  tipoNuevo(): TipoUbicacion | null {
    return this.ubicacionesService.tipoHijo(this.nueva?.parent?.tipo || null);
  }

  ayudaTipo(tipo: TipoUbicacion | null): { codigo: string; nombre: string; hint: string } {
    switch (tipo) {
      case 'zona':
        return { codigo: 'Z1', nombre: 'Nave A', hint: 'Una letra + número corto. El código se usa en carteles y auditorías.' };
      case 'pasillo':
        return { codigo: 'P3', nombre: 'Pasillo 3', hint: 'Numerá los pasillos como están en el predio, de izquierda a derecha o de frente hacia el fondo.' };
      case 'estante':
        return { codigo: 'E2', nombre: 'Estante 2', hint: 'Contá los estantes de abajo hacia arriba o como estén rotulados en el rack.' };
      case 'posicion':
        return { codigo: '05', nombre: 'Posición 05', hint: 'El último nivel. Queda asignable por defecto para colgar el insumo en Depósitos.' };
      default:
        return { codigo: '', nombre: '', hint: '' };
    }
  }

  previewCodigo(): string {
    if (!this.nueva) return '';
    const codigo = this.nueva.codigo.trim().toUpperCase() || '…';
    const padre = this.nueva.parent?.codigo_completo;
    return padre ? `${padre}-${codigo}` : codigo;
  }

  iniciarAlta(parent: DepositoUbicacion | null): void {
    const tipo = this.ubicacionesService.tipoHijo(parent?.tipo || null);
    this.nueva = {
      parent,
      codigo: '',
      nombre: '',
      asignable: tipo ? asignablePorDefecto(tipo) : false
    };
    this.editandoId = null;
    this.formError = null;
    this.error = null;
  }

  cancelarAlta(): void {
    this.nueva = null;
    this.formError = null;
  }

  guardarAlta(): void {
    if (!this.nueva) return;
    const codigo = this.nueva.codigo.trim();
    const nombre = this.nueva.nombre.trim();
    if (!codigo || !nombre) {
      this.formError = 'Completá código y nombre para guardar.';
      return;
    }
    const tipo = this.tipoNuevo();
    if (!tipo) return;
    this.formError = null;

    this.guardando = true;
    this.ubicacionesService.crear({
      deposito_id: this.depositoId,
      parent_id: this.nueva.parent?.id || null,
      tipo,
      codigo,
      nombre,
      asignable: this.nueva.asignable
    }).subscribe({
      next: () => {
        this.nueva = null;
        this.guardando = false;
        this.cargar();
      },
      error: (err) => {
        this.error = err.message || 'No se pudo crear la ubicación';
        this.guardando = false;
      }
    });
  }

  iniciarEdicion(nodo: DepositoUbicacion): void {
    this.editandoId = nodo.id;
    this.editCodigo = nodo.codigo;
    this.editNombre = nodo.nombre;
    this.nueva = null;
  }

  guardarEdicion(nodo: DepositoUbicacion): void {
    this.guardando = true;
    this.ubicacionesService.actualizar(nodo.id, {
      codigo: this.editCodigo,
      nombre: this.editNombre
    }).subscribe({
      next: () => {
        this.editandoId = null;
        this.guardando = false;
        this.cargar();
      },
      error: (err) => {
        this.error = err.message || 'No se pudo actualizar';
        this.guardando = false;
      }
    });
  }

  toggleActivo(nodo: DepositoUbicacion): void {
    this.ubicacionesService.actualizar(nodo.id, { activo: !nodo.activo }).subscribe({
      next: () => this.cargar(),
      error: (err) => this.error = err.message || 'No se pudo cambiar el estado'
    });
  }

  toggleAsignable(nodo: DepositoUbicacion): void {
    this.ubicacionesService.actualizar(nodo.id, { asignable: !nodo.asignable }).subscribe({
      next: () => this.cargar(),
      error: (err) => this.error = err.message || 'No se pudo cambiar la asignación'
    });
  }

  volver(): void {
    this.router.navigate(['/stock/deposito', this.depositoId]);
  }
}
