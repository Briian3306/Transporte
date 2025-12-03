import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { Deposito, EntradaStock, SalidaStock, FiltrosMovimiento } from '../../models/stock.model';
import { Insumo } from '../../models/chofer.model';
import { ApiIbarraService } from '../../services/api-ibarra.service';

@Component({
  selector: 'app-stock-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-historial.component.html',
  styleUrl: './stock-historial.component.css'
})
export class StockHistorialComponent implements OnInit {
  private stockService = inject(StockService);
  private apiService = inject(ApiIbarraService);
  private router = inject(Router);

  // Datos
  movimientos: (EntradaStock | SalidaStock)[] = [];
  movimientosFiltrados: (EntradaStock | SalidaStock)[] = [];
  depositos: Deposito[] = [];
  insumos: Insumo[] = [];

  // Filtros
  filtros: FiltrosMovimiento = {};
  filtroTipo: 'todos' | 'entrada' | 'salida' = 'todos';
  filtroDepositoId = '';
  filtroInsumoId = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';

  // Estados
  loading = true;
  error: string | null = null;

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 20;
  get totalPaginas(): number {
    return Math.ceil(this.movimientosFiltrados.length / this.itemsPorPagina);
  }
  get movimientosPaginados(): (EntradaStock | SalidaStock)[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.movimientosFiltrados.slice(inicio, fin);
  }

  // Estadísticas del filtro
  get totalEntradas(): number {
    return this.movimientosFiltrados.filter(m => m.tipo === 'entrada').length;
  }
  get totalSalidas(): number {
    return this.movimientosFiltrados.filter(m => m.tipo === 'salida').length;
  }
  get totalCantidadEntradas(): number {
    return this.movimientosFiltrados
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.cantidad, 0);
  }
  get totalCantidadSalidas(): number {
    return this.movimientosFiltrados
      .filter(m => m.tipo === 'salida')
      .reduce((sum, m) => sum + m.cantidad, 0);
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

    // Cargar depositos
    this.stockService.getDepositos().subscribe({
      next: (depositos) => {
        this.depositos = depositos;
      },
      error: (err) => {
        console.error('Error al cargar depósitos:', err);
      }
    });

    // Cargar insumos
    this.apiService.getInsumos().subscribe({
      next: (insumos) => {
        this.insumos = insumos;
      },
      error: (err) => {
        console.error('Error al cargar insumos:', err);
      }
    });

    // Cargar movimientos
    this.stockService.getMovimientos().subscribe({
      next: (movimientos) => {
        this.movimientos = movimientos;
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar movimientos:', err);
        this.error = 'Error al cargar el historial de movimientos';
        this.loading = false;
      }
    });
  }

  /**
   * Aplica los filtros
   */
  aplicarFiltros(): void {
    // Construir objeto de filtros
    this.filtros = {};

    if (this.filtroTipo !== 'todos') {
      this.filtros.tipo = this.filtroTipo;
    }

    if (this.filtroDepositoId) {
      this.filtros.deposito_id = this.filtroDepositoId;
    }

    if (this.filtroInsumoId) {
      this.filtros.insumo_id = parseInt(this.filtroInsumoId);
    }

    if (this.filtroFechaDesde) {
      this.filtros.fecha_desde = new Date(this.filtroFechaDesde);
    }

    if (this.filtroFechaHasta) {
      this.filtros.fecha_hasta = new Date(this.filtroFechaHasta);
    }

    // Aplicar filtros
    this.stockService.getMovimientosFiltrados(this.filtros).subscribe({
      next: (movimientos) => {
        this.movimientosFiltrados = movimientos;
        this.paginaActual = 1;
      },
      error: (err) => {
        console.error('Error al filtrar movimientos:', err);
      }
    });
  }

  /**
   * Limpia los filtros
   */
  limpiarFiltros(): void {
    this.filtroTipo = 'todos';
    this.filtroDepositoId = '';
    this.filtroInsumoId = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
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
   * Verifica si un movimiento es entrada
   */
  isEntrada(movimiento: EntradaStock | SalidaStock): movimiento is EntradaStock {
    return movimiento.tipo === 'entrada';
  }

  /**
   * Verifica si un movimiento es salida
   */
  isSalida(movimiento: EntradaStock | SalidaStock): movimiento is SalidaStock {
    return movimiento.tipo === 'salida';
  }

  /**
   * Obtiene la clase CSS para el tipo de movimiento
   */
  getTipoClass(tipo: string): string {
    return tipo === 'entrada' ? 'badge-success' : 'badge-danger';
  }

  /**
   * Obtiene el icono para el tipo de movimiento
   */
  getTipoIcon(tipo: string): string {
    return tipo === 'entrada' ? 'fas fa-arrow-down' : 'fas fa-arrow-up';
  }

  /**
   * Formatea la fecha
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Navega a una ruta
   */
  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
  }

  /**
   * Formatea moneda
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  }

  /**
   * Exporta a CSV
   */
  exportarCSV(): void {
    const headers = [
      'Fecha',
      'Tipo',
      'Depósito',
      'Insumo',
      'Cantidad',
      'Usuario',
      'Motivo',
      'Proveedor',
      'Factura',
      'Costo',
      'Solicitante',
      'Recurso'
    ];

    const rows = this.movimientosFiltrados.map(m => {
      const isEntrada = this.isEntrada(m);
      return [
        this.formatDate(m.fecha),
        m.tipo,
        m.deposito_nombre || '',
        m.insumo_nombre || '',
        m.cantidad.toString(),
        m.usuario_nombre || '',
        m.motivo,
        isEntrada ? m.proveedor : '',
        isEntrada ? m.numero_factura : '',
        isEntrada ? m.costo_total?.toString() || '' : '',
        this.isSalida(m) ? m.solicitante : '',
        this.isSalida(m) ? m.recurso_nombre || '' : ''
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
