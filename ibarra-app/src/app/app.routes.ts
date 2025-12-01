import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TemplateListComponent } from './components/template-list/template-list.component';
import { ChecklistDynamicComponent } from './components/checklist-dynamic/checklist-dynamic.component';
import { ChecklistPanelComponent } from './components/checklist-panel/checklist-panel.component';
import { TemplateConfigComponent } from './components/template-config/template-config.component';
import { ChecklistHistoryComponent } from './components/checklist-history/checklist-history.component';
import { ChecklistDetailsComponent } from './components/checklist-details/checklist-details.component';
import { LoginComponent } from './components/login/login.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { RoleManagementComponent } from './components/role-management/role-management.component';
import { RolePermissionManagementComponent } from './components/role-permission-management/role-permission-management.component';
import { RolePermissionsEditComponent } from './components/role-permissions-edit/role-permissions-edit.component';
import { IncidenteRegistroComponent } from './components/incidente-registro/incidente-registro.component';
import { IncidenteConfigComponent } from './components/incidente-config/incidente-config.component';
import { IncidenteHistoryComponent } from './components/incidente-history/incidente-history.component';
import { IncidenteDetailsComponent } from './components/incidente-details/incidente-details.component';
import { FlotaComponent } from './components/flota/flota.component';
import { NeumaticosRegistroComponent } from './components/neumaticos-registro/neumaticos-registro.component';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { AuthGuard, LoginGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';

export const routes: Routes = [
  // Rutas públicas
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [LoginGuard]
  },
  
  // Ruta de redirección (sin canActivate)
  { 
    path: '', 
    redirectTo: '/dashboard', 
    pathMatch: 'full'
  },
  
  // Rutas protegidas con validación de permisos
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'templates', 
    component: TemplateListComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'template-config', 
    component: TemplateConfigComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'template-config/:id', 
    component: TemplateConfigComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'checklist', 
    component: ChecklistPanelComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'checklist/new/:templateId', 
    component: ChecklistDynamicComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'checklist/:templateId/:checklistId', 
    component: ChecklistDynamicComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'checklist-history', 
    component: ChecklistHistoryComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'checklist-details/:id', 
    component: ChecklistDetailsComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'users', 
    component: UserManagementComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'roles', 
    component: RoleManagementComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'role-permissions', 
    component: RolePermissionManagementComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'role-permissions/:id', 
    component: RolePermissionsEditComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'incidentes/registro', 
    component: IncidenteRegistroComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'incidentes/configuracion', 
    component: IncidenteConfigComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'incidentes/historial', 
    component: IncidenteHistoryComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'incidentes/detalles/:id', 
    component: IncidenteDetailsComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'flota', 
    component: FlotaComponent,
    canActivate: [PermissionGuard]
  },
  { 
    path: 'neumaticos/registro', 
    component: NeumaticosRegistroComponent,
    canActivate: [PermissionGuard]
  },
  
  // Ruta de acceso denegado
  { 
    path: 'access-denied', 
    component: AccessDeniedComponent
  },
  
  // Ruta de fallback (sin canActivate)
  { 
    path: '**', 
    redirectTo: '/dashboard'
  }
];
