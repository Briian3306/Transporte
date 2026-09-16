import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { StockAuditoriasService } from '../../services/stock-auditorias.service';
import { StockUbicacionesService } from '../../services/stock-ubicaciones.service';
import {
  CriterioSeleccionAuditoria,
  Deposito,
  DepositoAuditoriaConfig,
  DepositoUbicacion,
  StockDeposito,
  TipoAuditoria,
} from '../../models/stock.model';

@Component({
  selector: 'app-stock-auditoria-nueva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-auditoria-nueva.component.html',
  styleUrl: './stock-auditoria-nueva.component.css'
})
export class StockAuditoriaNuevaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stockService = inject(StockService);
  private auditoriasService = inject(StockAuditoriasService);
  private ubicacionesService = inject(StockUbicacionesService);

  depositoId = '';
  tipo: TipoAuditoria = 'total';
  deposito: Deposito | null = null;
  config: DepositoAuditoriaConfig | null = null;
  stock: StockDeposito[] = [];
  stockFiltrado: StockDeposito[] = [];
  ubicaciones: DepositoUbicacion[] = [];
  seleccion = new Set<string>();
  loading = true;
  iniciando = false;
  error: string | null = null;

  filtroTexto = '';
  filtroCategoria = '';
  filtroUbicacion = '';
  filtroEstado = 'todos';

  ngOnInit(): void {
    this.depositoId = this.route.snapshot.paramMap.get('depositoId') || '';
    const tipoParam = this.route.snapshot.queryParamMap.get('tipo');
    this.tipo = tipoParam === 'parcial' ? 'parcial' : 'total';
    this.cargar();
  }

  get categorias(): string[] {
    return [...new Set(this.stock.map((s) => s.categoria_nombre || '').filter(Boolean))];
  }

  get itemsTotales(): number {
    if (!this.config || this.config.incluir_sin_stock) return this.stock.length;
    return this.stock.filter((s) => s.cantidad_actual > 0).length;
  }

  cargar(): void {
    forkJoin({
      deposito: this.stockService.getDepositoById(this.depositoId),
      config: this.auditoriasService.getConfig(this.depositoId),
      stock: this.stockService.getStockPorDeposito(this.depositoId),
      ubicaciones: this.ubicacionesService.getUbicaciones(this.depositoId)
    }).subscribe({
      next: ({ deposito, config, stock, ubicaciones }) => {
        this.deposito = deposito || null;
        this.config = config;
        this.stock = stock;
        this.ubicaciones = this.ubicacionesService.flatten(ubicaciones);
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Error al cargar el depósito';
        this.loading = false;
      }
    });
  }

  aplicarFiltros(): void {
    let resultado = [...this.stock];
    const texto = this.filtroTexto.toLowerCase();
    if (texto) {
      resultado = resultado.filter((s) =>
        (s.insumo_nombre || '').toLowerCase().includes(texto) ||
        (s.insumo_codigo || '').toLowerCase().includes(texto)
      );
    }
    if (this.filtroCategoria) {
      resultado = resultado.filter((s) => s.categoria_nombre === this.filtroCategoria);
    }
    if (this.filtroUbicacion === 'sin') {
      resultado = resultado.filter((s) => !s.ubicacion_id);
    } else if (this.filtroUbicacion) {
      resultado = resultado.filter((s) => s.ubicacion_id === this.filtroUbicacion);
    }
    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter((s) => s.estado === this.filtroEstado);
    }
    this.stockFiltrado = resultado;
  }

  toggle(id: string): void {
    if (this.seleccion.has(id)) this.seleccion.delete(id);
    else this.seleccion.add(id);
  }

  toggleTodosFiltrados(): void {
    const ids = this.stockFiltrado.map((s) => s.id);
    const todos = ids.every((id) => this.seleccion.has(id));
    if (todos) ids.forEach((id) => this.seleccion.delete(id));
    else ids.forEach((id) => this.seleccion.add(id));
  }

  iniciar(): void {
    this.iniciando = true;
    this.error = null;
    const queryParams = this.queryDeposito();
    const nav = (id: string) => this.router.navigate(['/stock/auditoria', id], queryParams ? { queryParams } : undefined);

    if (this.tipo === 'total') {
      this.auditoriasService.iniciarAuditoriaTotal(this.depositoId).subscribe({
        next: nav,
        error: (err) => {
          this.error = err.message || 'No se pudo iniciar la auditoría';
          this.iniciando = false;
        }
      });
      return;
    }

    const ids = [...this.seleccion];
    if (ids.length === 0) {
      this.error = 'Seleccione al menos un item';
      this.iniciando = false;
      return;
    }

    const criterio: CriterioSeleccionAuditoria = {
      texto: this.filtroTexto || undefined,
      categoria: this.filtroCategoria || undefined,
      ubicacion_id: this.filtroUbicacion || undefined,
      estado_stock: this.filtroEstado !== 'todos' ? this.filtroEstado : undefined,
      stock_ids: ids
    };

    this.auditoriasService.iniciarAuditoriaParcial(this.depositoId, ids, criterio).subscribe({
      next: nav,
      error: (err) => {
        this.error = err.message || 'No se pudo iniciar la auditoría';
        this.iniciando = false;
      }
    });
  }

  cancelar(): void {
    const queryParams = this.queryDeposito();
    this.router.navigate(['/stock/auditorias'], queryParams ? { queryParams } : undefined);
  }

  private queryDeposito(): Record<string, string> | undefined {
    const deposito = this.route.snapshot.queryParamMap.get('deposito') || this.depositoId;
    return deposito ? { deposito } : undefined;
  }
}
