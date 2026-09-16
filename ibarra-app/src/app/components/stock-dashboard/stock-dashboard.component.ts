import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { StockAuditoriasService } from '../../services/stock-auditorias.service';
import { EstadisticasStock, AlertaStockPorDeposito, AuditoriaVencida, Deposito } from '../../models/stock.model';

@Component({
  selector: 'app-stock-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-dashboard.component.html',
  styleUrl: './stock-dashboard.component.css'
})
export class StockDashboardComponent implements OnInit {
  private stockService = inject(StockService);
  private auditoriasService = inject(StockAuditoriasService);
  private router = inject(Router);

  estadisticas: EstadisticasStock | null = null;
  depositos: Deposito[] = [];
  alertasPorDeposito: Record<string, number> = {};
  auditoriasVencidas: AuditoriaVencida[] = [];

  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      estadisticas: this.stockService.getEstadisticas(),
      depositos: this.stockService.getDepositos(),
      alertas: this.stockService.getAlertasPorDeposito()
    }).subscribe({
      next: ({ estadisticas, depositos, alertas }) => {
        this.estadisticas = estadisticas;
        this.depositos = depositos;
        this.alertasPorDeposito = Object.fromEntries(
          alertas.map((a: AlertaStockPorDeposito) => [a.deposito_id, a.total_alertas])
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar el dashboard:', err);
        this.error = 'Error al cargar estadísticas';
        this.loading = false;
      }
    });

    this.auditoriasService.getAuditoriasVencidas().subscribe({
      next: (vencidas) => {
        this.auditoriasVencidas = vencidas;
      }
    });
  }

  navegarA(ruta: string, queryParams?: Record<string, string>): void {
    this.router.navigate([ruta], queryParams ? { queryParams } : undefined);
  }

  verDeposito(deposito: Deposito): void {
    this.router.navigate(['/stock/deposito', deposito.id]);
  }

  getAlertasDeposito(depositoId: string): number {
    return this.alertasPorDeposito[depositoId] || 0;
  }

  getAuditoriaVencidaDeposito(depositoId: string): AuditoriaVencida | undefined {
    return this.auditoriasVencidas.find(a => a.deposito_id === depositoId);
  }

  getCardClass(tipo: string): string {
    const clases: { [key: string]: string } = {
      'insumos': 'card-primary',
      'valor': 'card-success',
      'criticos': 'card-danger',
      'movimientos': 'card-info'
    };
    return clases[tipo] || 'card-primary';
  }

  getCardIcon(tipo: string): string {
    const iconos: { [key: string]: string } = {
      'insumos': 'fas fa-boxes',
      'valor': 'fas fa-dollar-sign',
      'criticos': 'fas fa-exclamation-triangle',
      'movimientos': 'fas fa-exchange-alt'
    };
    return iconos[tipo] || 'fas fa-chart-bar';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  }
}
