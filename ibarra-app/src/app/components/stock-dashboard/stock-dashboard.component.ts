import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { EstadisticasStock, AlertaStock } from '../../models/stock.model';

@Component({
  selector: 'app-stock-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-dashboard.component.html',
  styleUrl: './stock-dashboard.component.css'
})
export class StockDashboardComponent implements OnInit {
  private stockService = inject(StockService);
  private router = inject(Router);

  // Datos
  estadisticas: EstadisticasStock | null = null;
  alertas: AlertaStock[] = [];
  alertasVisibles: AlertaStock[] = [];

  // Estados
  loading = true;
  error: string | null = null;

  // Configuración
  maxAlertasVisibles = 10;

  ngOnInit(): void {
    this.cargarDatos();
  }

  /**
   * Carga los datos del dashboard
   */
  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar estadísticas
    this.stockService.getEstadisticas().subscribe({
      next: (stats) => {
        this.estadisticas = stats;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar estadísticas:', err);
        this.error = 'Error al cargar estadísticas';
        this.loading = false;
      }
    });

    // Cargar alertas
    this.stockService.getAlertas().subscribe({
      next: (alertas) => {
        this.alertas = alertas;
        this.alertasVisibles = alertas.slice(0, this.maxAlertasVisibles);
      },
      error: (err) => {
        console.error('Error al cargar alertas:', err);
      }
    });
  }

  /**
   * Navega a una sección específica
   */
  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
  }

  /**
   * Obtiene la clase CSS para una tarjeta de estadística
   */
  getCardClass(tipo: string): string {
    const clases: { [key: string]: string } = {
      'insumos': 'card-primary',
      'valor': 'card-success',
      'criticos': 'card-danger',
      'movimientos': 'card-info'
    };
    return clases[tipo] || 'card-primary';
  }

  /**
   * Obtiene el icono para una tarjeta de estadística
   */
  getCardIcon(tipo: string): string {
    const iconos: { [key: string]: string } = {
      'insumos': 'fas fa-boxes',
      'valor': 'fas fa-dollar-sign',
      'criticos': 'fas fa-exclamation-triangle',
      'movimientos': 'fas fa-exchange-alt'
    };
    return iconos[tipo] || 'fas fa-chart-bar';
  }

  /**
   * Obtiene la clase CSS para una alerta según su severidad
   */
  getAlertClass(severidad: string): string {
    const clases: { [key: string]: string } = {
      'alta': 'alert-danger',
      'media': 'alert-warning',
      'baja': 'alert-info'
    };
    return clases[severidad] || 'alert-info';
  }

  /**
   * Obtiene el icono para una alerta según su severidad
   */
  getAlertIcon(severidad: string): string {
    const iconos: { [key: string]: string } = {
      'alta': 'fas fa-exclamation-circle',
      'media': 'fas fa-exclamation-triangle',
      'baja': 'fas fa-info-circle'
    };
    return iconos[severidad] || 'fas fa-info-circle';
  }

  /**
   * Formatea un número como moneda
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  }
}
