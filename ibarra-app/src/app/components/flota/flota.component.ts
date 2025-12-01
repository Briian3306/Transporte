import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ApiIbarraService } from '../../services/api-ibarra.service';
import { Chofer } from '../../models/chofer.model';
import { Logistica } from '../../models/logistica.model';

@Component({
  selector: 'app-flota',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flota.component.html',
  styleUrl: './flota.component.scss'
})
export class FlotaComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private apiService = inject(ApiIbarraService);

  // Datos
  choferesData: Chofer[] = [];
  logisticaData: Logistica[] = [];
  
  // Estado de la UI
  activeTab: 'choferes' | 'logistica' = 'choferes';
  isLoading = false;
  statusMessage = '';
  statusType: 'success' | 'error' | 'warning' | 'info' = 'info';
  showStatus = false;

  // Filtros
  filtroChoferes = '';
  filtroChoferLogistica = '';
  filtroPatente = '';

  // Estadísticas
  totalChoferes = 0;
  choferesVisibles = 0;
  totalLogistica = 0;

  ngOnInit(): void {
    this.loadChoferes();
  }

  // Métodos de navegación por tabs
  switchTab(tab: 'choferes' | 'logistica'): void {
    this.activeTab = tab;
    if (tab === 'choferes') {
      this.loadChoferes();
    } else if (tab === 'logistica') {
      this.loadLogistica();
    }
  }

  // Métodos de carga de datos
  async loadChoferes(): Promise<void> {
    this.isLoading = true;
    this.showStatus = false;

    try {
      const data = await this.apiService.getChoferes().toPromise();
      this.choferesData = data || [];
      this.totalChoferes = this.choferesData.length;
      this.choferesVisibles = this.choferesData.length;
      this.filtroChoferes = '';
      this.showStatusMessage('Choferes cargados correctamente', 'success');
    } catch (error) {
      console.error('Error cargando choferes:', error);
      this.showStatusMessage(`Error al cargar choferes: ${error}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadLogistica(): Promise<void> {
    this.isLoading = true;
    this.showStatus = false;

    try {
      const data = await this.apiService.getLogisticasDisponibles().toPromise();
      this.logisticaData = data || [];
      this.totalLogistica = this.logisticaData.length;
      this.filtroChoferLogistica = '';
      this.filtroPatente = '';
      this.showStatusMessage('Logística cargada correctamente', 'success');
    } catch (error) {
      console.error('Error cargando logística:', error);
      this.showStatusMessage(`Error al cargar logística: ${error}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Métodos de filtrado
  filtrarChoferes(): void {
    const filtro = this.filtroChoferes.toLowerCase();
    const choferesFiltrados = this.choferesData.filter(chofer => {
      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`.toLowerCase();
      return nombreCompleto.includes(filtro) || chofer.apellido.toLowerCase().includes(filtro);
    });
    this.choferesVisibles = choferesFiltrados.length;
  }

  filtrarLogistica(): void {
    const filtroChofer = this.filtroChoferLogistica.toLowerCase();
    const filtroPatente = this.filtroPatente.toLowerCase();
    
    const logisticaFiltrada = this.logisticaData.filter(logistica => {
      const apellidoChofer = logistica.chofer.apellido.toLowerCase();
      const patenteFilter = logistica.conjunto_veh.camiones.patente.toLowerCase();
      
      const coincideChofer = !filtroChofer || apellidoChofer.includes(filtroChofer);
      const coincidePatente = !filtroPatente || patenteFilter.includes(filtroPatente);
      
      return coincideChofer && coincidePatente;
    });
  }

  // Métodos de utilidad
  showStatusMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.statusMessage = message;
    this.statusType = type;
    this.showStatus = true;
    
    setTimeout(() => {
      this.showStatus = false;
    }, 5000);
  }

  getStatusClasses(): string {
    const classes = {
      success: 'bg-green-50 text-green-800',
      error: 'bg-red-50 text-red-800',
      warning: 'bg-yellow-50 text-yellow-800',
      info: 'bg-blue-50 text-blue-800'
    };
    return classes[this.statusType] || classes.info;
  }

  getStatusIcon(): string {
    const icons = {
      success: 'fas fa-check-circle text-green-400',
      error: 'fas fa-exclamation-circle text-red-400',
      warning: 'fas fa-exclamation-triangle text-yellow-400',
      info: 'fas fa-info-circle text-blue-400'
    };
    return icons[this.statusType] || icons.info;
  }

  // Getters para las tablas filtradas
  get choferesFiltrados(): Chofer[] {
    const filtro = this.filtroChoferes.toLowerCase();
    return this.choferesData.filter(chofer => {
      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`.toLowerCase();
      return nombreCompleto.includes(filtro) || chofer.apellido.toLowerCase().includes(filtro);
    });
  }

  get logisticaFiltrada(): Logistica[] {
    const filtroChofer = this.filtroChoferLogistica.toLowerCase();
    const filtroPatente = this.filtroPatente.toLowerCase();
    
    return this.logisticaData.filter(logistica => {
      const apellidoChofer = logistica.chofer.apellido.toLowerCase();
      const patenteFilter = logistica.conjunto_veh.camiones.patente.toLowerCase();
      
      const coincideChofer = !filtroChofer || apellidoChofer.includes(filtroChofer);
      const coincidePatente = !filtroPatente || patenteFilter.includes(filtroPatente);
      
      return coincideChofer && coincidePatente;
    });
  }
}
