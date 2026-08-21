import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PermissionStateService } from '../../services/permission-state.service';

export const PEAJES_HOME_SECTION_IDS = [
  'wizard',
  'pasadas',
  'pasadas-pendientes',
  'auditoria-tarifas',
  'auditoria-estaciones',
  'catalogos',
  'plantillas',
  'carga-express',
  'documentos',
] as const;

const PEAJES_OPERATIONAL_SECTION_IDS = [
  'wizard',
  'catalogos',
  'pasadas',
  'pasadas-pendientes',
  'auditoria-tarifas',
  'auditoria-estaciones',
] as const;

export function getVisiblePeajesHomeSectionIds(
  permissions: ReadonlySet<string>,
): string[] {
  if (permissions.has('*:*') || permissions.has('peajes:manage')) {
    return [...PEAJES_HOME_SECTION_IDS];
  }

  if (permissions.has('peajes:read') && permissions.has('peajes:create')) {
    return [...PEAJES_OPERATIONAL_SECTION_IDS];
  }

  return [];
}

/**
 * Pantalla inicial del módulo Peajes (Fase 0).
 * Wizard, catálogos y plantillas se agregan por agentes 02/03/05.
 */
@Component({
  selector: 'app-peajes-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './peajes-home.component.html',
  styleUrl: './peajes-home.component.css',
})
export class PeajesHomeComponent {
  private readonly permissionState = inject(PermissionStateService);

  isSectionVisible(sectionId: string): boolean {
    return getVisiblePeajesHomeSectionIds(
      new Set(this.permissionState.getUserPermissions()),
    ).includes(sectionId);
  }
}
