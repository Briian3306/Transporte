import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IncidenteService } from '../../services/incidente.service';
import { IncidenteConfigService } from '../../services/incidente-config.service';
import { Incidente, IncidenteFilters, EstadisticasIncidentes, NivelRiesgo, TipoIncidente, EstadoSeguimiento } from '../../models/incidente.model';
import { GranularPermissionDirective } from '../../directives/granular-permission.directive';

@Component({
  selector: 'app-incidente-history',
  standalone: true,
  imports: [CommonModule, FormsModule, GranularPermissionDirective],
  templateUrl: './incidente-history.component.html',
  styleUrl: './incidente-history.component.scss'
})
export class IncidenteHistoryComponent implements OnInit {
  private incidenteService = inject(IncidenteService);
  private incidenteConfigService = inject(IncidenteConfigService);
  private router = inject(Router);

  // Estados
  loading = false;
  error: string | null = null;

  // Datos
  incidentes: Incidente[] = [];
  filteredIncidentes: Incidente[] = [];
  nivelesRiesgo: NivelRiesgo[] = [];
  tiposIncidente: TipoIncidente[] = [];
  estadisticas: EstadisticasIncidentes = {
    total: 0,
    por_nivel_riesgo: {},
    por_estado: {},
    por_tipo: {}
  };

  // Filtros
  filters: IncidenteFilters = {
    fechaInicio: '',
    fechaFin: '',
    tipo_incidente: '',
    subtipo_incidente: '',
    nivel_riesgo: '',
    estado_seguimiento: '',
    categoria_reportante: ''
  };

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;

  // Opciones para filtros
  estadosSeguimiento: { value: EstadoSeguimiento; label: string; color: string }[] = [
    { value: 'pendiente', label: 'Pendiente', color: 'yellow' },
    { value: 'en_proceso', label: 'En Proceso', color: 'blue' },
    { value: 'resuelto', label: 'Resuelto', color: 'green' },
    { value: 'cerrado', label: 'Cerrado', color: 'gray' }
  ];

  categoriasReportante: { value: string; label: string; icon: string }[] = [
    { value: 'chofer', label: 'Chofer', icon: 'fas fa-truck' },
    { value: 'cliente', label: 'Cliente', icon: 'fas fa-user' },
    { value: 'policia', label: 'Policía', icon: 'fas fa-shield-alt' },
    { value: 'bomberos', label: 'Bomberos', icon: 'fas fa-fire-extinguisher' },
    { value: 'tercero', label: 'Tercero', icon: 'fas fa-users' },
    { value: 'otro', label: 'Otro', icon: 'fas fa-question' }
  ];

  constructor() {}

  ngOnInit() {
    this.initializeDateRange();
    this.loadData();
  }

  private initializeDateRange() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.filters.fechaFin = today.toISOString().split('T')[0];
    this.filters.fechaInicio = thirtyDaysAgo.toISOString().split('T')[0];
  }

  private loadData() {
    this.loading = true;
    this.error = null;

    // Cargar niveles de riesgo
    this.incidenteConfigService.getNivelesRiesgo().subscribe({
      next: (niveles) => {
        this.nivelesRiesgo = niveles;
      },
      error: (err) => {
        console.error('Error al cargar niveles de riesgo:', err);
      }
    });

    // Cargar tipos de incidente
    this.incidenteConfigService.getTiposIncidente().subscribe({
      next: (tipos) => {
        this.tiposIncidente = tipos;
      },
      error: (err) => {
        console.error('Error al cargar tipos de incidente:', err);
      }
    });

    // Cargar incidentes
    this.loadIncidentes();
  }

  private loadIncidentes() {
    if (!this.filters.fechaInicio || !this.filters.fechaFin) {
      this.error = 'Por favor seleccione un rango de fechas';
      this.loading = false;
      return;
    }

    // Validar que la fecha de inicio no sea mayor que la fecha de fin
    if (new Date(this.filters.fechaInicio!) > new Date(this.filters.fechaFin!)) {
      this.error = 'La fecha de inicio no puede ser mayor que la fecha de fin';
      this.loading = false;
      return;
    }

    this.incidenteService.getIncidentesByFilters(this.filters).subscribe({
      next: (data) => {
        this.incidentes = data;
        this.filteredIncidentes = [...this.incidentes];
        this.calculateStatistics();
        this.calculatePagination();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar incidentes:', err);
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  private calculateStatistics() {
    this.estadisticas = {
      total: this.incidentes.length,
      por_nivel_riesgo: {},
      por_estado: {},
      por_tipo: {}
    };

    this.incidentes.forEach(incidente => {
      // Por nivel de riesgo
      this.estadisticas.por_nivel_riesgo[incidente.nivel_riesgo] = 
        (this.estadisticas.por_nivel_riesgo[incidente.nivel_riesgo] || 0) + 1;
      
      // Por estado
      this.estadisticas.por_estado[incidente.estado_seguimiento] = 
        (this.estadisticas.por_estado[incidente.estado_seguimiento] || 0) + 1;
      
      // Por tipo
      this.estadisticas.por_tipo[incidente.tipo_incidente] = 
        (this.estadisticas.por_tipo[incidente.tipo_incidente] || 0) + 1;
    });
  }

  private calculatePagination() {
    this.totalPages = Math.ceil(this.filteredIncidentes.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  // Aplicar filtros
  applyFilters() {
    this.currentPage = 1;
    this.loadIncidentes();
  }

  // Limpiar filtros
  clearFilters() {
    this.filters = {
      fechaInicio: this.filters.fechaInicio,
      fechaFin: this.filters.fechaFin,
      tipo_incidente: '',
      subtipo_incidente: '',
      nivel_riesgo: '',
      estado_seguimiento: '',
      categoria_reportante: ''
    };
    this.applyFilters();
  }

  // Paginación
  getPaginatedIncidentes(): Incidente[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredIncidentes.slice(startIndex, endIndex);
  }

  onPageChange(page: number) {
    this.currentPage = page;
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Navegación
  viewIncidenteDetails(incidente: Incidente) {
    this.router.navigate(['/incidentes/detalles', incidente.id]);
  }

  goToRegistro() {
    this.router.navigate(['/incidentes/registro']);
  }

  goToConfig() {
    this.router.navigate(['/incidentes/configuracion']);
  }

  // Métodos auxiliares para el template
  getNivelRiesgoInfo(codigo: string): NivelRiesgo | null {
    return this.nivelesRiesgo.find(n => n.codigo === codigo) || null;
  }

  getTipoIncidenteInfo(codigo: string): TipoIncidente | null {
    return this.tiposIncidente.find(t => t.codigo === codigo) || null;
  }

  getSubtipoIncidenteInfo(tipoCodigo: string, subtipoCodigo: string): any {
    const tipo = this.getTipoIncidenteInfo(tipoCodigo);
    if (!tipo) return null;
    
    return tipo.subtipos.find(s => s.codigo === subtipoCodigo) || null;
  }

  getNivelRiesgoClass(nivel: string): string {
    const nivelInfo = this.getNivelRiesgoInfo(nivel);
    if (!nivelInfo) return 'bg-gray-100 text-gray-800';
    
    const colorMap: { [key: string]: string } = {
      'CRITICO': 'bg-red-100 text-red-800',
      'ALTO': 'bg-orange-100 text-orange-800',
      'MEDIO': 'bg-yellow-100 text-yellow-800',
      'BAJO': 'bg-green-100 text-green-800'
    };
    
    return colorMap[nivelInfo.codigo] || 'bg-gray-100 text-gray-800';
  }

  getEstadoClass(estado: string): string {
    const estadoInfo = this.estadosSeguimiento.find(e => e.value === estado);
    if (!estadoInfo) return 'bg-gray-100 text-gray-800';
    
    const colorMap: { [key: string]: string } = {
      'yellow': 'bg-yellow-100 text-yellow-800',
      'blue': 'bg-blue-100 text-blue-800',
      'green': 'bg-green-100 text-green-800',
      'gray': 'bg-gray-100 text-gray-800'
    };
    
    return colorMap[estadoInfo.color] || 'bg-gray-100 text-gray-800';
  }

  getCategoriaIcon(categoria: string): string {
    const categoriaInfo = this.categoriasReportante.find(c => c.value === categoria);
    return categoriaInfo?.icon || 'fas fa-question';
  }

  getCategoriaLabel(categoria: string): string {
    const categoriaInfo = this.categoriasReportante.find(c => c.value === categoria);
    return categoriaInfo?.label || categoria;
  }

  // Estadísticas
  getEstadisticaNivelRiesgo(nivel: string): number {
    return this.estadisticas.por_nivel_riesgo[nivel] || 0;
  }

  getEstadisticaEstado(estado: string): number {
    return this.estadisticas.por_estado[estado] || 0;
  }

  getEstadisticaTipo(tipo: string): number {
    return this.estadisticas.por_tipo[tipo] || 0;
  }

  // Exportar (placeholder para futuro)
  exportToExcel() {
    // TODO: Implementar exportación a Excel
    console.log('Exportar a Excel - Pendiente de implementar');
  }

  exportToPDF() {
    // TODO: Implementar exportación a PDF
    console.log('Exportar a PDF - Pendiente de implementar');
  }

  // Limpiar mensajes
  clearError() {
    this.error = null;
  }

  // Obtener índice final para paginación
  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredIncidentes.length);
  }
}
