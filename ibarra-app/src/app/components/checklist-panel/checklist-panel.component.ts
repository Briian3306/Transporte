import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChecklistTemplateService } from '../../services/checklist-template.service';
import { ChecklistTemplate } from '../../models/checklist-template.model';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { GranularPermissionDirective } from '../../directives/granular-permission.directive';
import { ChecklistDynamicService } from '../../services/checklist-dynamic.service';
import { Checklist } from '../../models/checklist.model';

@Component({
  selector: 'app-checklist-panel',
  standalone: true,
  imports: [CommonModule, GranularPermissionDirective],
  templateUrl: './checklist-panel.component.html',
  styleUrls: ['./checklist-panel.component.scss']
})
export class ChecklistPanelComponent implements OnInit, OnDestroy {
  private templateService = inject(ChecklistTemplateService);
  private router = inject(Router);
  private granularPermissionService = inject(GranularPermissionService);
  private checklistService = inject(ChecklistDynamicService);

  // Datos
  templates: ChecklistTemplate[] = [];
  checklistsEnProgreso: Checklist[] = [];
  // Estados
  loading = false;
  loadingChecklists = false;
  errorMessage = '';
  
  // Control de dropdowns
  openDropdownId: string | null = null;
  
  // Estadísticas
  stats = {
    totalTemplates: 0,
    totalChecklists: 0,
    completedToday: 0,
    pendingToday: 0
  };

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    // Limpiar cualquier listener si es necesario
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Cerrar dropdown si se hace clic fuera de él
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.closeDropdown();
    }
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Cargar templates
    this.templateService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = templates;
        this.stats.totalTemplates = templates.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.errorMessage = 'Error al cargar los templates';
        this.loading = false;
      }
    });
    
    // Cargar checklists en progreso
    this.cargarChecklistsEnProgreso();
    
    // TODO: Cargar estadísticas y checklists recientes
    this.loadStats();
  }

  async cargarChecklistsEnProgreso(): Promise<void> {
    this.loadingChecklists = true;
    try {
      this.checklistsEnProgreso = await this.checklistService.obtenerChecklistsEnProgreso();
    } catch (error) {
      console.error('Error cargando checklists en progreso:', error);
    } finally {
      this.loadingChecklists = false;
    }
  }

  reanudarChecklist(checklist: Checklist): void {
    // Navegar al checklist con su ID para continuar
    if (checklist.template_id) {
      this.router.navigate(['/checklist', checklist.template_id, checklist.id]);
    } else {
      // Si no tiene template_id, usar un template genérico (esto no debería pasar normalmente)
      console.warn('Checklist sin template_id, usando template genérico');
      this.router.navigate(['/checklist', 'diario', checklist.id]);
    }
  }

  private loadStats(): void {
    // TODO: Implementar carga de estadísticas desde el servicio
    this.stats = {
      totalTemplates: this.templates.length,
      totalChecklists: 0,
      completedToday: 0,
      pendingToday: 0
    };
  }

  // Navegación
  navigateToChecklist(templateId?: string): void {
    if (templateId) {
      this.router.navigate(['/checklist/new', templateId]);
    } else {
      this.router.navigate(['/checklist/new']);
    }
  }

  navigateToTemplateConfig(template?: ChecklistTemplate): void {
    if (template) {
      this.router.navigate(['/template-config', template.id]);
    } else {
      this.router.navigate(['/template-config']);
    }
  }

  navigateToHistory(): void {
    this.router.navigate(['/checklist-history']);
  }

  navigateToTemplates(): void {
    this.router.navigate(['/templates']);
  }

  // Acciones de templates
  deleteTemplate(template: ChecklistTemplate): void {
    if (confirm(`¿Está seguro de que desea eliminar la plantilla "${template.nombre}"?`)) {
      this.templateService.deleteTemplate(template.id).subscribe({
        next: () => {
          this.loadData();
        },
        error: (error) => {
          console.error('Error deleting template:', error);
          this.errorMessage = 'Error al eliminar la plantilla';
        }
      });
    }
  }

  duplicateTemplate(template: ChecklistTemplate): void {
    // TODO: Implementar duplicación de template
    console.log('Duplicar template:', template);
  }

  // Métodos de permisos
  canCreateChecklist(): boolean {
    return this.granularPermissionService.canCreateChecklists();
  }

  canManageTemplates(): boolean {
    return this.granularPermissionService.canManageTemplates();
  }

  canReadTemplates(): boolean {
    return this.granularPermissionService.canReadTemplates();
  }

  canReadHistory(): boolean {
    return this.granularPermissionService.canReadChecklists();
  }

  // Control de dropdowns
  toggleDropdown(templateId: string): void {
    this.openDropdownId = this.openDropdownId === templateId ? null : templateId;
  }

  isDropdownOpen(templateId: string): boolean {
    return this.openDropdownId === templateId;
  }

  closeDropdown(): void {
    this.openDropdownId = null;
  }

  // Métodos auxiliares
  getTemplateItemCount(template: ChecklistTemplate): number {
    if (!template.secciones) return 0;
    return template.secciones.reduce((total, seccion) => {
      return total + (seccion.items ? seccion.items.length : 0);
    }, 0);
  }

  // Getters para el template
  get hasTemplates(): boolean {
    return this.templates.length > 0;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get hasError(): boolean {
    return !!this.errorMessage;
  }
}
