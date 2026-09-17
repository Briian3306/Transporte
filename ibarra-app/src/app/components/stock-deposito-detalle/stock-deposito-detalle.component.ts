import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { StockPdfService } from '../../services/stock-pdf.service';
import { StockUbicacionesService } from '../../services/stock-ubicaciones.service';
import { GranularPermissionDirective } from '../../directives/granular-permission.directive';
import { Deposito, DepositoUbicacion, StockDeposito } from '../../models/stock.model';

@Component({
  selector: 'app-stock-deposito-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, GranularPermissionDirective],
  templateUrl: './stock-deposito-detalle.component.html',
  styleUrl: './stock-deposito-detalle.component.css'
})
export class StockDepositoDetalleComponent implements OnInit {
  private stockService = inject(StockService);
  private stockPdfService = inject(StockPdfService);
  private ubicacionesService = inject(StockUbicacionesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  deposito: Deposito | null = null;
  stock: StockDeposito[] = [];
  stockFiltrado: StockDeposito[] = [];
  ubicaciones: DepositoUbicacion[] = [];

  filtroTexto = '';
  filtroEstado: 'todos' | 'normal' | 'bajo' | 'critico' | 'excedido' = 'todos';
  filtroUbicacion = '';

  loading = true;
  error: string | null = null;

  editandoStock: string | null = null;
  stockEditado: {
    cantidad_minima: number;
    cantidad_maxima: number;
    punto_reorden: number;
    ubicacion_id: string | null;
  } | null = null;
  guardandoEdicion = false;
  quitandoStockId: string | null = null;

  paginaActual = 1;
  itemsPorPagina = 20;
  menuAbierto: 'mas' | 'exportar' | null = null;

  @ViewChild('menuMas') menuMas?: ElementRef<HTMLElement>;
  @ViewChild('menuExportar') menuExportar?: ElementRef<HTMLElement>;

  get totalPaginas(): number {
    return Math.ceil(this.stockFiltrado.length / this.itemsPorPagina);
  }

  get stockPaginado(): StockDeposito[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.stockFiltrado.slice(inicio, fin);
  }

  get metaLinea(): string {
    if (!this.deposito) return '';
    const partes = [
      this.deposito.ubicacion,
      this.deposito.responsable,
      this.loading ? '' : `${this.stock.length} ítems`
    ].filter(Boolean);
    return partes.join(' · ');
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.router.navigate(['/stock/dashboard']);
        return;
      }
      this.cargarDeposito(id);
    });
  }

  cargarDeposito(id: string): void {
    this.loading = true;
    this.error = null;
    this.deposito = null;
    this.cancelarEdicion();

    this.stockService.getDepositoById(id).subscribe({
      next: (deposito) => {
        if (!deposito) {
          this.router.navigate(['/stock/dashboard']);
          return;
        }
        this.deposito = deposito;
        this.cargarStock(deposito.id);
      },
      error: (err) => {
        console.error('Error al cargar depósito:', err);
        this.error = 'Error al cargar el depósito';
        this.loading = false;
      }
    });
  }

  cargarStock(depositoId: string): void {
    forkJoin({
      stock: this.stockService.getStockPorDeposito(depositoId),
      arbol: this.ubicacionesService.getUbicaciones(depositoId)
    }).subscribe({
      next: ({ stock, arbol }) => {
        this.stock = stock;
        this.ubicaciones = this.ubicacionesService.flatten(arbol);
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

  get ubicacionesFiltro(): DepositoUbicacion[] {
    return this.ubicaciones.filter(u => u.activo);
  }

  ubicacionesParaAsignar(item: StockDeposito): DepositoUbicacion[] {
    return this.ubicacionesService.ubicacionesAsignables(this.ubicaciones, item.ubicacion_id);
  }

  aplicarFiltros(): void {
    let resultado = [...this.stock];

    if (this.filtroTexto) {
      const texto = this.filtroTexto.toLowerCase();
      resultado = resultado.filter(s =>
        s.insumo_nombre?.toLowerCase().includes(texto) ||
        s.insumo_codigo?.toLowerCase().includes(texto) ||
        s.categoria_nombre?.toLowerCase().includes(texto)
      );
    }

    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(s => s.estado === this.filtroEstado);
    }

    if (this.filtroUbicacion === 'sin') {
      resultado = resultado.filter(s => !s.ubicacion_id);
    } else if (this.filtroUbicacion) {
      resultado = resultado.filter(s => s.ubicacion_id === this.filtroUbicacion);
    }

    this.stockFiltrado = resultado;
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstado = 'todos';
    this.filtroUbicacion = '';
    this.aplicarFiltros();
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  getEstadoClass(estado?: string): string {
    const clases: { [key: string]: string } = {
      'normal': 'badge-success',
      'bajo': 'badge-warning',
      'critico': 'badge-danger',
      'excedido': 'badge-info'
    };
    return clases[estado || 'normal'] || 'badge-secondary';
  }

  getEstadoTexto(estado?: string): string {
    const textos: { [key: string]: string } = {
      'normal': 'Normal',
      'bajo': 'Bajo Mínimo',
      'critico': 'Crítico',
      'excedido': 'Sobre Máximo'
    };
    return textos[estado || 'normal'] || 'Desconocido';
  }

  getEstadoIcon(estado?: string): string {
    const iconos: { [key: string]: string } = {
      'normal': 'fas fa-check-circle',
      'bajo': 'fas fa-exclamation-triangle',
      'critico': 'fas fa-times-circle',
      'excedido': 'fas fa-arrow-circle-up'
    };
    return iconos[estado || 'normal'] || 'fas fa-question-circle';
  }

  getPorcentajeStock(item: StockDeposito): number {
    if (item.cantidad_maxima === 0) return 0;
    return Math.min((item.cantidad_actual / item.cantidad_maxima) * 100, 100);
  }

  getProgressClass(item: StockDeposito): string {
    if (item.cantidad_maxima === 0) return 'progress-success';
    const porcentaje = (item.cantidad_actual / item.cantidad_maxima) * 100;
    if (porcentaje <= 25) return 'progress-danger';
    if (porcentaje <= 50) return 'progress-warning';
    return 'progress-success';
  }

  toggleMenu(menu: 'mas' | 'exportar', event: Event): void {
    event.stopPropagation();
    this.menuAbierto = this.menuAbierto === menu ? null : menu;
  }

  cerrarMenus(): void {
    this.menuAbierto = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuAbierto) return;
    const wrap = this.menuAbierto === 'mas' ? this.menuMas : this.menuExportar;
    if (wrap?.nativeElement.contains(event.target as Node)) return;
    this.cerrarMenus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrarMenus();
  }

  navegarA(ruta: string, queryParams?: Record<string, string>): void {
    this.cerrarMenus();
    this.router.navigate([ruta], queryParams ? { queryParams } : undefined);
  }

  volver(): void {
    this.router.navigate(['/stock/dashboard']);
  }

  exportarCSV(): void {
    if (!this.deposito) return;
    this.cerrarMenus();

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
    a.download = `stock-${this.deposito.nombre}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportarPDF(): void {
    if (!this.deposito) return;
    this.cerrarMenus();
    this.stockPdfService.generateStockDepositoPdf(this.deposito, this.stockFiltrado);
  }

  imprimirCartel(item: StockDeposito): void {
    if (!this.deposito) return;
    this.stockPdfService.generateKanbanCartelPdf(item, this.deposito);
  }

  iniciarEdicion(item: StockDeposito): void {
    this.editandoStock = item.id;
    this.stockEditado = {
      cantidad_minima: item.cantidad_minima,
      cantidad_maxima: item.cantidad_maxima,
      punto_reorden: item.punto_reorden,
      ubicacion_id: item.ubicacion_id || null
    };
  }

  cancelarEdicion(): void {
    this.editandoStock = null;
    this.stockEditado = null;
  }

  guardarEdicion(item: StockDeposito): void {
    if (!this.stockEditado || !this.editandoStock) return;

    if (this.stockEditado.cantidad_minima < 0 || this.stockEditado.cantidad_maxima < 0) {
      alert('Las cantidades no pueden ser negativas');
      return;
    }

    if (this.stockEditado.cantidad_minima > 0 && this.stockEditado.cantidad_maxima > 0 &&
        this.stockEditado.cantidad_minima >= this.stockEditado.cantidad_maxima) {
      alert('La cantidad mínima debe ser menor que la máxima');
      return;
    }

    this.guardandoEdicion = true;

    this.stockService.actualizarParametrosStock(item.id, {
      cantidad_minima: this.stockEditado.cantidad_minima,
      cantidad_maxima: this.stockEditado.cantidad_maxima,
      punto_reorden: this.stockEditado.punto_reorden
    }).subscribe({
      next: (stockActualizado) => {
        const ubicacionElegida = this.ubicaciones.find(u => u.id === this.stockEditado!.ubicacion_id) || null;
        const validacion = this.ubicacionesService.validarAsignacion(stockActualizado, ubicacionElegida);
        if (!validacion.ok) {
          alert(validacion.motivos.join('\n'));
          this.guardandoEdicion = false;
          return;
        }

        this.ubicacionesService.asignarUbicacion(item.id, this.stockEditado!.ubicacion_id).subscribe({
          next: () => {
            const index = this.stock.findIndex(s => s.id === item.id);
            if (index !== -1) {
              this.stock[index] = {
                ...stockActualizado,
                ubicacion_id: this.stockEditado!.ubicacion_id,
                ubicacion_codigo: ubicacionElegida?.codigo_completo
              };
            }
            this.aplicarFiltros();
            this.cancelarEdicion();
            this.guardandoEdicion = false;
          },
          error: (err) => {
            console.error('Error al asignar ubicación:', err);
            alert(err.message || 'Error al asignar la ubicación');
            this.guardandoEdicion = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al actualizar stock:', err);
        alert('Error al actualizar los parámetros de stock');
        this.guardandoEdicion = false;
      }
    });
  }

  estaEditando(item: StockDeposito): boolean {
    return this.editandoStock === item.id;
  }

  tituloQuitar(item: StockDeposito): string {
    if (!this.puedeQuitar(item)) {
      return 'Solo se puede quitar cuando la cantidad es 0. Hacé una salida o transferencia primero.';
    }
    return 'Quitar insumo del depósito';
  }

  puedeQuitar(item: StockDeposito): boolean {
    return item.cantidad_actual === 0;
  }

  quitarInsumo(item: StockDeposito): void {
    if (item.cantidad_actual !== 0 || this.quitandoStockId) {
      return;
    }

    const nombre = item.insumo_nombre || 'este insumo';
    const confirmar = window.confirm(
      `¿Quitar ${nombre} de este depósito? El historial se conserva. Si vuelve a ingresar, reaparecerá.`
    );
    if (!confirmar) {
      return;
    }

    this.quitandoStockId = item.id;
    this.stockService.desactivarInsumoDeposito(item.id).subscribe({
      next: () => {
        this.stock = this.stock.filter(s => s.id !== item.id);
        this.aplicarFiltros();
        this.quitandoStockId = null;
      },
      error: (err) => {
        console.error('Error al quitar insumo:', err);
        alert(err?.message || 'No se pudo quitar el insumo del depósito');
        this.quitandoStockId = null;
      }
    });
  }
}
