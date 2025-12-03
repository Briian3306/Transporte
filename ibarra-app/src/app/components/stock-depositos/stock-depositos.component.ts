import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { Deposito, StockDeposito, AlertaStock } from '../../models/stock.model';

@Component({
  selector: 'app-stock-depositos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-depositos.component.html',
  styleUrl: './stock-depositos.component.css'
})
export class StockDepositosComponent implements OnInit {
  private stockService = inject(StockService);
  private router = inject(Router);

  // Datos
  depositos: Deposito[] = [];
  stock: StockDeposito[] = [];
  stockFiltrado: StockDeposito[] = [];
  alertas: AlertaStock[] = [];

  // Selección
  depositoSeleccionado: Deposito | null = null;

  // Filtros
  filtroTexto = '';
  filtroEstado: 'todos' | 'normal' | 'bajo' | 'critico' | 'excedido' = 'todos';

  // Estados
  loading = true;
  error: string | null = null;

  // Edición de stock
  editandoStock: string | null = null;
  stockEditado: {
    cantidad_minima: number;
    cantidad_maxima: number;
    punto_reorden: number;
  } | null = null;
  guardandoEdicion = false;

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 20;
  get totalPaginas(): number {
    return Math.ceil(this.stockFiltrado.length / this.itemsPorPagina);
  }
  get stockPaginado(): StockDeposito[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.stockFiltrado.slice(inicio, fin);
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  /**
   * Carga los datos
   */
  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar depósitos
    this.stockService.getDepositos().subscribe({
      next: (depositos) => {
        this.depositos = depositos;
        if (depositos.length > 0 && !this.depositoSeleccionado) {
          this.seleccionarDeposito(depositos[0]);
        }
      },
      error: (err) => {
        console.error('Error al cargar depósitos:', err);
        this.error = 'Error al cargar depósitos';
        this.loading = false;
      }
    });

    // Cargar alertas
    this.stockService.getAlertas().subscribe({
      next: (alertas) => {
        this.alertas = alertas;
      },
      error: (err) => {
        console.error('Error al cargar alertas:', err);
      }
    });
  }

  /**
   * Selecciona un depósito
   */
  seleccionarDeposito(deposito: Deposito): void {
    this.depositoSeleccionado = deposito;
    this.loading = true;

    this.stockService.getStockPorDeposito(deposito.id).subscribe({
      next: (stock) => {
        this.stock = stock;
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar stock:', err);
        this.error = 'Error al cargar stock del depósito';
        this.loading = false;
      }
    });
  }

  /**
   * Aplica los filtros al stock
   */
  aplicarFiltros(): void {
    let resultado = [...this.stock];

    // Filtro por texto
    if (this.filtroTexto) {
      const texto = this.filtroTexto.toLowerCase();
      resultado = resultado.filter(s =>
        s.insumo_nombre?.toLowerCase().includes(texto) ||
        s.insumo_codigo?.toLowerCase().includes(texto) ||
        s.categoria_nombre?.toLowerCase().includes(texto)
      );
    }

    // Filtro por estado
    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(s => s.estado === this.filtroEstado);
    }

    this.stockFiltrado = resultado;
    this.paginaActual = 1; // Reset a la primera página
  }

  /**
   * Limpia los filtros
   */
  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstado = 'todos';
    this.aplicarFiltros();
  }

  /**
   * Cambia de página
   */
  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  /**
   * Obtiene la clase CSS para el estado del stock
   */
  getEstadoClass(estado?: string): string {
    const clases: { [key: string]: string } = {
      'normal': 'badge-success',
      'bajo': 'badge-warning',
      'critico': 'badge-danger',
      'excedido': 'badge-info'
    };
    return clases[estado || 'normal'] || 'badge-secondary';
  }

  /**
   * Obtiene el texto para el estado del stock
   */
  getEstadoTexto(estado?: string): string {
    const textos: { [key: string]: string } = {
      'normal': 'Normal',
      'bajo': 'Bajo Mínimo',
      'critico': 'Crítico',
      'excedido': 'Sobre Máximo'
    };
    return textos[estado || 'normal'] || 'Desconocido';
  }

  /**
   * Obtiene el icono para el estado del stock
   */
  getEstadoIcon(estado?: string): string {
    const iconos: { [key: string]: string } = {
      'normal': 'fas fa-check-circle',
      'bajo': 'fas fa-exclamation-triangle',
      'critico': 'fas fa-times-circle',
      'excedido': 'fas fa-arrow-circle-up'
    };
    return iconos[estado || 'normal'] || 'fas fa-question-circle';
  }

  /**
   * Calcula el porcentaje de stock
   */
  getPorcentajeStock(item: StockDeposito): number {
    if (item.cantidad_maxima === 0) return 0;
    return Math.min((item.cantidad_actual / item.cantidad_maxima) * 100, 100);
  }

  /**
   * Obtiene la clase CSS para la barra de progreso
   */
  getProgressClass(item: StockDeposito): string {
    const porcentaje = (item.cantidad_actual / item.cantidad_maxima) * 100;
    if (porcentaje <= 25) return 'progress-danger';
    if (porcentaje <= 50) return 'progress-warning';
    return 'progress-success';
  }

  /**
   * Cuenta alertas para un depósito
   */
  getAlertasDeposito(depositoId: string): number {
    return this.alertas.filter(a => a.deposito_id === depositoId).length;
  }

  /**
   * Navega a una ruta
   */
  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
  }

  /**
   * Exporta a CSV
   */
  exportarCSV(): void {
    if (!this.depositoSeleccionado) return;

    const headers = ['Insumo', 'Código', 'Categoría', 'Cantidad', 'Mínimo', 'Máximo', 'Unidad', 'Estado'];
    const rows = this.stockFiltrado.map(s => [
      s.insumo_nombre || '',
      s.insumo_codigo || '',
      s.categoria_nombre || '',
      s.cantidad_actual.toString(),
      s.cantidad_minima.toString(),
      s.cantidad_maxima.toString(),
      s.unidad_medida || '',
      this.getEstadoTexto(s.estado)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-${this.depositoSeleccionado.nombre}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Inicia la edición de un item de stock
   */
  iniciarEdicion(item: StockDeposito): void {
    this.editandoStock = item.id;
    this.stockEditado = {
      cantidad_minima: item.cantidad_minima,
      cantidad_maxima: item.cantidad_maxima,
      punto_reorden: item.punto_reorden
    };
  }

  /**
   * Cancela la edición
   */
  cancelarEdicion(): void {
    this.editandoStock = null;
    this.stockEditado = null;
  }

  /**
   * Guarda los cambios del stock
   */
  guardarEdicion(item: StockDeposito): void {
    if (!this.stockEditado || !this.editandoStock) return;

    // Validaciones
    if (this.stockEditado.cantidad_minima < 0 || this.stockEditado.cantidad_maxima < 0) {
      alert('Las cantidades no pueden ser negativas');
      return;
    }

    if (this.stockEditado.cantidad_minima >= this.stockEditado.cantidad_maxima) {
      alert('La cantidad mínima debe ser menor que la máxima');
      return;
    }

    this.guardandoEdicion = true;

    this.stockService.actualizarParametrosStock(item.id, this.stockEditado).subscribe({
      next: (stockActualizado) => {
        // Actualizar el item en el array local
        const index = this.stock.findIndex(s => s.id === item.id);
        if (index !== -1) {
          this.stock[index] = stockActualizado;
        }
        this.aplicarFiltros();
        this.cancelarEdicion();
        this.guardandoEdicion = false;
      },
      error: (err) => {
        console.error('Error al actualizar stock:', err);
        alert('Error al actualizar los parámetros de stock');
        this.guardandoEdicion = false;
      }
    });
  }

  /**
   * Verifica si un item está en modo edición
   */
  estaEditando(item: StockDeposito): boolean {
    return this.editandoStock === item.id;
  }
}
