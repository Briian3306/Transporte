import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase.service';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { SystemModule } from '../../models/system-module.model';
import { User } from '@supabase/supabase-js';

interface DashboardModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  isAvailable: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private granularPermissionService = inject(GranularPermissionService);

  currentUser$: Observable<User | null>;
  accessibleModules$: Observable<SystemModule[]>;
  dashboardModules: DashboardModule[] = [];

  constructor() {
    this.currentUser$ = this.supabaseService.currentUser$;
    this.accessibleModules$ = this.granularPermissionService.accessibleModules;
  }

  ngOnInit(): void {
    this.initializeDashboardModules();
    this.loadUserModules();
  }

  private initializeDashboardModules(): void {
    this.dashboardModules = [
      {
        id: 'checklists',
        name: 'Checklists',
        description: 'Gestionar checklists de vehículos y neumáticos',
        icon: 'fas fa-clipboard-check',
        route: '/checklist',
        color: 'primary',
        isAvailable: false
      },
      {
        id: 'templates',
        name: 'Plantillas',
        description: 'Configurar plantillas de checklists',
        icon: 'fas fa-file-alt',
        route: '/templates',
        color: 'success',
        isAvailable: false
      },
      {
        id: 'history',
        name: 'Historial',
        description: 'Ver historial de checklists realizados',
        icon: 'fas fa-history',
        route: '/checklist-history',
        color: 'info',
        isAvailable: false
      },
      {
        id: 'inventory',
        name: 'Inventario',
        description: 'Gestionar inventario de neumáticos',
        icon: 'fas fa-boxes',
        route: '/inventory',
        color: 'warning',
        isAvailable: false
      },
      {
        id: 'maintenance',
        name: 'Mantenimiento',
        description: 'Programar y gestionar mantenimientos',
        icon: 'fas fa-tools',
        route: '/maintenance',
        color: 'danger',
        isAvailable: false
      },
      {
        id: 'reports',
        name: 'Reportes',
        description: 'Generar reportes del sistema',
        icon: 'fas fa-chart-bar',
        route: '/reports',
        color: 'secondary',
        isAvailable: false
      },
      {
        id: 'users',
        name: 'Usuarios',
        description: 'Gestionar usuarios del sistema',
        icon: 'fas fa-users',
        route: '/users',
        color: 'dark',
        isAvailable: false
      },
      {
        id: 'roles',
        name: 'Roles',
        description: 'Configurar roles y permisos',
        icon: 'fas fa-user-shield',
        route: '/roles',
        color: 'primary',
        isAvailable: false
      },
      {
        id: 'incidentes',
        name: 'Incidentes de Seguridad',
        description: 'Registrar y gestionar incidentes de seguridad',
        icon: 'fas fa-exclamation-triangle',
        route: '/incidentes/registro',
        color: 'danger',
        isAvailable: false
      },
      {
        id: 'incidentes-historial',
        name: 'Historial de Incidentes',
        description: 'Ver y consultar el historial de incidentes',
        icon: 'fas fa-history',
        route: '/incidentes/historial',
        color: 'info',
        isAvailable: false
      },
      {
        id: 'incidentes-config',
        name: 'Configuración de Incidentes',
        description: 'Configurar tipos, subtipos y niveles de riesgo',
        icon: 'fas fa-cog',
        route: '/incidentes/configuracion',
        color: 'secondary',
        isAvailable: false
      },
      {
        id: 'flota',
        name: 'Gestión de Flota',
        description: 'Administrar choferes y unidades logísticas',
        icon: 'fas fa-truck',
        route: '/flota',
        color: 'info',
        isAvailable: false
      }
    ];
  }

  private loadUserModules(): void {
    this.accessibleModules$.subscribe(modules => {
      // Actualizar disponibilidad basada en módulos accesibles
      this.dashboardModules.forEach(module => {
        const accessibleModule = modules.find(m => 
          m.name.toLowerCase() === module.id || 
          m.route === module.route
        );
        module.isAvailable = !!accessibleModule;
      });
    });
  }

  getCurrentRole(): string | null {
    return this.granularPermissionService.getCurrentRole();
  }

  getModuleClass(module: DashboardModule): string {
    return `dashboard-module ${module.color} ${module.isAvailable ? 'available' : 'disabled'}`;
  }

  onModuleClick(module: DashboardModule): void {
    if (!module.isAvailable) {
      return;
    }
    // La navegación se maneja automáticamente por RouterLink
  }
}
