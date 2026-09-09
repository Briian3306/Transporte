import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistService } from '../../services/checklist.service';
import { ChecklistPdfService } from '../../services/checklist-pdf.service';
import { 
  Checklist, 
  VehicleInformation, 
  DriverInformation, 
  UnitInformation, 
  MachineInformation, 
  SectorInformation 
} from '../../models/checklist.model';

@Component({
  selector: 'app-checklist-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checklist-details.component.html',
  styleUrls: ['./checklist-details.component.css']
})
export class ChecklistDetailsComponent implements OnInit {
  checklist: Checklist | null = null;
  loading = false;
  error: string | null = null;
  checklistId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private checklistService: ChecklistService,
    private checklistPdfService: ChecklistPdfService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.checklistId = params['id'];
      if (this.checklistId) {
        this.loadChecklistDetails();
      }
    });
  }

  loadChecklistDetails() {
    if (!this.checklistId) return;

    this.loading = true;
    this.error = null;

    this.checklistService.getChecklistById(this.checklistId)
      .subscribe({
        next: (data) => {
          this.checklist = data;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.loading = false;
        }
      });
  }

  goBack() {
    this.router.navigate(['/checklist-history']);
  }

  exportToPdf() {
    if (!this.checklist) return;
    this.checklistPdfService.generateChecklistPdf(this.checklist);
  }

  getStatusClass(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'status-completed';
      case 'con_errores':
        return 'status-error';
      case 'parcial':
        return 'status-partial';
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
      case 'parcial':
        return 'Parcial';
      default:
        return 'Desconocido';
    }
  }

  getProgressClass(percentage: number): string {
    if (percentage >= 90) return 'progress-success';
    if (percentage >= 70) return 'progress-warning';
    return 'progress-danger';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-ES');
  }

  getResponsesArray(): any[] {
    if (!this.checklist?.respuestas) return [];
    
    return Object.entries(this.checklist.respuestas).map(([itemId, response]) => ({
      itemId,
      ...response
    }));
  }

  getObservationsArray(): any[] {
    if (!this.checklist?.observaciones) return [];
    
    return Object.entries(this.checklist.observaciones).map(([itemId, text]) => ({
      itemId,
      text
    }));
  }

  hasResponses(): boolean {
    return this.checklist?.respuestas ? Object.keys(this.checklist.respuestas).length > 0 : false;
  }

  hasObservations(): boolean {
    return this.checklist?.observaciones ? Object.keys(this.checklist.observaciones).length > 0 : false;
  }

  // Métodos para información de recursos
  getResourceType(): string {
    return this.checklist?.informacion?.tipoRecurso || 'desconocido';
  }

  getResourceInfo(): any {
    return this.checklist?.informacion?.informacionRecurso;
  }

  getVehicleInfo(): VehicleInformation | null {
    const info = this.getResourceInfo();
    return this.getResourceType() === 'vehiculo' ? info as VehicleInformation : null;
  }

  getDriverInfo(): DriverInformation | null {
    const info = this.getResourceInfo();
    return this.getResourceType() === 'chofer' ? info as DriverInformation : null;
  }

  getUnitInfo(): UnitInformation | null {
    const info = this.getResourceInfo();
    return this.getResourceType() === 'unidad' ? info as UnitInformation : null;
  }

  getMachineInfo(): MachineInformation | null {
    const info = this.getResourceInfo();
    return this.getResourceType() === 'maquina' ? info as MachineInformation : null;
  }

  getSectorInfo(): SectorInformation | null {
    const info = this.getResourceInfo();
    return this.getResourceType() === 'sector' ? info as SectorInformation : null;
  }

  getResourceDisplayName(): string {
    const type = this.getResourceType();
    const info = this.getResourceInfo();
    
    if (!info) return 'Información no disponible';

    switch (type) {
      case 'vehiculo':
        const vehicle = info as VehicleInformation;
        return `${vehicle.marca} ${vehicle.modelo} - ${vehicle.placa}`;
      case 'chofer':
        const driver = info as DriverInformation;
        return driver.nombre;
      case 'unidad':
        const unit = info as UnitInformation;
        return `${unit.camion_patente} - ${unit.chofer_nombre}`;
      case 'maquina':
        const machine = info as MachineInformation;
        return `${machine.nombre} - ${machine.modelo}`;
      case 'sector':
        const sector = info as SectorInformation;
        return sector.nombre;
      default:
        return 'Recurso desconocido';
    }
  }

  getResourceDetails(): { label: string; value: string }[] {
    const type = this.getResourceType();
    const info = this.getResourceInfo();
    
    if (!info) return [];

    switch (type) {
      case 'vehiculo':
        const vehicle = info as VehicleInformation;
        return [
          { label: 'Patente', value: vehicle.placa },
          { label: 'Marca', value: vehicle.marca },
          { label: 'Modelo', value: vehicle.modelo },
          { label: 'Kilometraje', value: vehicle.kilometraje.toString() },
          { label: 'Ubicación', value: vehicle.ubicacion }
        ];
      case 'chofer':
        const driver = info as DriverInformation;
        return [
          { label: 'Nombre', value: driver.nombre },
          { label: 'DNI', value: driver.dni }
        ];
      case 'unidad':
        const unit = info as UnitInformation;
        return [
          { label: 'Chofer', value: unit.chofer_nombre },
          { label: 'DNI', value: unit.chofer_dni },
          { label: 'Camión', value: unit.camion_patente },
          { label: 'Semi', value: unit.semi1_patente || 'N/A' },
          { label: 'Tipo', value: unit.tipo_unidad },
          { label: 'Estado', value: unit.estado }
        ];
      case 'maquina':
        const machine = info as MachineInformation;
        return [
          { label: 'Nombre', value: machine.nombre },
          { label: 'Modelo', value: machine.modelo },
          { label: 'N° Serie', value: machine.numero_serie },
          { label: 'Estado', value: machine.estado }
        ];
      case 'sector':
        const sector = info as SectorInformation;
        return [
          { label: 'Nombre', value: sector.nombre },
          { label: 'Tipo', value: sector.tipo_area }
        ];
      default:
        return [];
    }
  }

  // Métodos simplificados para estadísticas
  getCompletionStats() {
    if (!this.checklist) return null;
    
    return {
      total: this.checklist.total_items,
      completed: this.checklist.items_completados,
      correct: this.checklist.items_correctos,
      errors: this.checklist.items_con_error,
      warnings: this.checklist.items_con_advertencia,
      percentage: this.checklist.porcentaje_completado
    };
  }

  getValidationSummary() {
    if (!this.checklist?.validaciones) return null;
    
    return {
      errors: this.checklist.validaciones.errores?.length || 0,
      warnings: this.checklist.validaciones.advertencias?.length || 0,
      correct: this.checklist.validaciones.correctos?.length || 0
    };
  }

  // Métodos para aprovechar la nueva estructura de respuestas
  getEnhancedResponsesArray(): any[] {
    if (!this.checklist?.respuestas) return [];
    
    return Object.entries(this.checklist.respuestas).map(([itemId, response]) => ({
      itemId,
      ...response,
      // Información adicional de la nueva estructura
      itemConfig: response.itemConfig,
      validacion: response.validacion,
      metadata: response.metadata
    }));
  }

  // Obtener información de configuración del item desde la respuesta
  getItemConfigFromResponse(itemId: string): any {
    const response = this.checklist?.respuestas?.[itemId];
    return response?.itemConfig || null;
  }

  // Obtener información de validación desde la respuesta
  getValidationFromResponse(itemId: string): any {
    const response = this.checklist?.respuestas?.[itemId];
    return response?.validacion || null;
  }

  // Obtener metadatos desde la respuesta
  getMetadataFromResponse(itemId: string): any {
    const response = this.checklist?.respuestas?.[itemId];
    return response?.metadata || null;
  }

  // Verificar si una respuesta fue editada
  isResponseEdited(itemId: string): boolean {
    const response = this.checklist?.respuestas?.[itemId];
    return response?.metadata?.esEdicion || false;
  }

  // Obtener el timestamp de la última edición
  getLastEditTimestamp(itemId: string): string | null {
    const response = this.checklist?.respuestas?.[itemId];
    return response?.metadata?.timestampEdicion || response?.timestamp || null;
  }

  // Obtener información de la sección desde la respuesta
  getSectionInfoFromResponse(itemId: string): { id: string; titulo: string } | null {
    const response = this.checklist?.respuestas?.[itemId];
    if (response?.itemConfig?.seccionId && response?.itemConfig?.seccionTitulo) {
      return {
        id: response.itemConfig.seccionId,
        titulo: response.itemConfig.seccionTitulo
      };
    }
    return null;
  }

  // Obtener el tipo de validación del item desde la respuesta
  getValidationTypeFromResponse(itemId: string): string | null {
    const itemConfig = this.getItemConfigFromResponse(itemId);
    return itemConfig?.tipoValidacion || null;
  }

  // Obtener la configuración de validación del item desde la respuesta
  getValidationConfigFromResponse(itemId: string): any {
    const itemConfig = this.getItemConfigFromResponse(itemId);
    return itemConfig?.configuracion || null;
  }

  // Verificar si el item era obligatorio cuando se respondió
  wasItemRequired(itemId: string): boolean {
    const itemConfig = this.getItemConfigFromResponse(itemId);
    return itemConfig?.esObligatorio || false;
  }

  // Obtener la descripción detallada del item desde la respuesta
  getItemDetailedDescription(itemId: string): string | null {
    const itemConfig = this.getItemConfigFromResponse(itemId);
    return itemConfig?.descripcionDetallada || null;
  }

  // Agrupar respuestas por sección
  getResponsesBySection(): { [sectionId: string]: any[] } {
    const responses = this.getEnhancedResponsesArray();
    const grouped: { [sectionId: string]: any[] } = {};

    responses.forEach(response => {
      const sectionInfo = this.getSectionInfoFromResponse(response.itemId);
      if (sectionInfo) {
        if (!grouped[sectionInfo.id]) {
          grouped[sectionInfo.id] = [];
        }
        grouped[sectionInfo.id].push({
          ...response,
          sectionInfo
        });
      }
    });

    return grouped;
  }

  // Obtener secciones únicas con sus respuestas
  getSectionsWithResponses(): any[] {
    const grouped = this.getResponsesBySection();
    return Object.entries(grouped).map(([sectionId, responses]) => ({
      id: sectionId,
      titulo: responses[0]?.sectionInfo?.titulo || 'Sección Desconocida',
      responses: responses.sort((a, b) => (a.itemConfig?.orden || 0) - (b.itemConfig?.orden || 0))
    }));
  }
}