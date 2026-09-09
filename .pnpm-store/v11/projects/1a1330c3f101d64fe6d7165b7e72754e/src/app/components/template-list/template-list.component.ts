import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChecklistTemplateService } from '../../services/checklist-template.service';
import { ChecklistTemplate } from '../../models/checklist-template.model';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { GranularPermissionDirective } from '../../directives/granular-permission.directive';
import { RoleBasedDirective } from '../../directives/role-based.directive';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, GranularPermissionDirective],
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss']
})
export class TemplateListComponent implements OnInit {
  private templateService = inject(ChecklistTemplateService);
  private router = inject(Router);
  private granularPermissionService = inject(GranularPermissionService);

  templates: ChecklistTemplate[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading = true;
    this.templateService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = templates;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.loading = false;
      }
    });
  }

  openTemplateConfig(template?: ChecklistTemplate): void {
    if (template) {
      this.router.navigate(['/template-config', template.id]);
    } else {
      this.router.navigate(['/template-config']);
    }
  }

  deleteTemplate(template: ChecklistTemplate): void {
    if (confirm(`¿Está seguro de que desea eliminar la plantilla "${template.nombre}"?`)) {
      this.templateService.deleteTemplate(template.id).subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: (error) => {
          console.error('Error deleting template:', error);
        }
      });
    }
  }

  navigateToChecklist(templateId: string): void {
    this.router.navigate(['/checklist/new', templateId]);
  }
}
