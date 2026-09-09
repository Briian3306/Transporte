import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChecklistService } from '../../services/checklist.service';
import { Checklist } from '../../models/checklist.model';

@Component({
  selector: 'app-checklist-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checklist-history.component.html',
  styleUrls: ['./checklist-history.component.css']
})
export class ChecklistHistoryComponent implements OnInit {
  checklists: Checklist[] = [];
  filteredChecklists: Checklist[] = [];
  loading = false;
  error: string | null = null;
  
  // Filtros
  fechaInicio: string = '';
  fechaFin: string = '';
  estadoFiltro: string = 'todos';
  tipoRecursoFiltro: string = 'todos';
  nombreRecursoFiltro: string = '';
  
  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  
  // Estadísticas
  estadisticas = {
    total: 0,
    completados: 0,
    conErrores: 0
  };

  constructor(
    private checklistService: ChecklistService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializeDateRange();
    this.loadChecklists();
  }

  private initializeDateRange() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.fechaFin = today.toISOString().split('T')[0];
    this.fechaInicio = thirtyDaysAgo.toISOString().split('T')[0];
  }

  loadChecklists() {
    if (!this.fechaInicio || !this.fechaFin) {
      this.error = 'Por favor seleccione un rango de fechas';
      return;
    }

    // Validar que la fecha de inicio no sea mayor que la fecha de fin
    if (new Date(this.fechaInicio) > new Date(this.fechaFin)) {
      this.error = 'La fecha de inicio no puede ser mayor que la fecha de fin';
      return;
    }

    this.loading = true;
    this.error = null;

    this.checklistService.getChecklistsByDateRange(this.fechaInicio, this.fechaFin)
      .subscribe({
        next: (data) => {
          this.checklists = data;
          this.filterChecklists();
          this.calculateStatistics();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar checklists:', err);
          this.error = err.message;
          this.loading = false;
        }
      });
  }

  filterChecklists() {
    let filtered = [...this.checklists];

    // Filtro por estado
    if (this.estadoFiltro !== 'todos') {
      filtered = filtered.filter(c => c.estado === this.estadoFiltro);
    }

    // Filtro por tipo de recurso
    if (this.tipoRecursoFiltro !== 'todos') {
      filtered = filtered.filter(c => c.informacion.tipoRecurso === this.tipoRecursoFiltro);
    }

    // Filtro por nombre del recurso (búsqueda local)
    if (this.nombreRecursoFiltro.trim()) {
      const searchTerm = this.nombreRecursoFiltro.toLowerCase().trim();
      filtered = filtered.filter(c => {
        const nombreRecurso = this.getNombreRecurso(c).toLowerCase();
        return nombreRecurso.includes(searchTerm);
      });
    }

    this.filteredChecklists = filtered;
    this.currentPage = 1;
    this.calculatePagination();
  }

  applyFilters() {
    // Recargar datos con filtros aplicados
    this.loadChecklists();
  }


  calculatePagination() {
    this.totalPages = Math.ceil(this.filteredChecklists.length / this.itemsPerPage);
  }

  calculateStatistics() {
    this.estadisticas = {
      total: this.checklists.length,
      completados: this.checklists.filter(c => c.estado === 'completado').length,
      conErrores: this.checklists.filter(c => c.estado === 'con_errores').length
    };
  }

  getPaginatedChecklists(): Checklist[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredChecklists.slice(startIndex, endIndex);
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

  viewChecklistDetails(checklist: Checklist) {
    this.router.navigate(['/checklist-details', checklist.id]);
  }

  getStatusClass(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'status-completed';
      case 'con_errores':
        return 'status-error';
      default:
        return 'status-default';
    }
  }

  getStatusText(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'con_errores':
        return 'Con Errores';
      default:
        return 'Desconocido';
    }
  }

  clearFilters() {
    this.estadoFiltro = 'todos';
    this.tipoRecursoFiltro = 'todos';
    this.nombreRecursoFiltro = '';
    this.filterChecklists();
  }

  exportToExcel() {
    // TODO: Implementar exportación a Excel
  }

  exportToPDF() {
    // TODO: Implementar exportación a PDF
  }

  getEndRecordNumber(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredChecklists.length);
  }

  // Métodos auxiliares para obtener información de recursos
  getRecursoInfo(checklist: Checklist): any {
    return checklist.informacion.informacionRecurso || null;
  }

  getTipoRecurso(checklist: Checklist): string {
    return checklist.informacion.tipoRecurso || 'legacy';
  }

  getNombreRecurso(checklist: Checklist): string {
    const info = this.getRecursoInfo(checklist);
    if (!info) {
      // Fallback a campos legacy
      return `Indefinido`;
    }

    // Según el tipo de recurso, mostrar información relevante
    switch (checklist.informacion.tipoRecurso) {
      case 'vehiculo':
        return `${info.patente || info.placa}`;
      case 'chofer':
        return info.nombre || `${info.chofer_nombre}`;
      case 'unidad':
        return `${info.camion_patente}${info.semi1_patente ? ' - ' + info.semi1_patente : ''}`;
      case 'maquina':
        return `${info.nombre} - ${info.modelo}`;
      case 'sector':
        return info.nombre;
      default:
        return info.nombre || 'Recurso desconocido';
    }
  }

}