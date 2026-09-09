import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AuthStateService } from '../services/auth-state.service';
import { PermissionStateService } from '../services/permission-state.service';

export interface PermissionPair {
  module: string;
  action: string;
}

export interface CompositePermissionRequirement {
  all?: PermissionRequirement[];
  any?: PermissionRequirement[];
}

export type PermissionRequirement = PermissionPair | CompositePermissionRequirement;

const all = (...permissions: PermissionRequirement[]): CompositePermissionRequirement => ({ all: permissions });
const any = (...permissions: PermissionRequirement[]): CompositePermissionRequirement => ({ any: permissions });

const peajesRead = { module: 'peajes', action: 'read' };
const peajesCreate = { module: 'peajes', action: 'create' };
const peajesManage = { module: 'peajes', action: 'manage' };
const peajesOperational = all(peajesRead, peajesCreate);
const peajesAdminOrOperational = any(peajesManage, peajesOperational);

export const PEAJES_ROUTE_PERMISSIONS: Record<string, PermissionRequirement> = {
  '/peajes': peajesAdminOrOperational,
  '/peajes/wizard': peajesOperational,
  '/peajes/pasadas': peajesOperational,
  '/peajes/pasadas-pendientes': peajesOperational,
  '/peajes/auditoria-tarifas': peajesOperational,
  '/peajes/tarifario': all(peajesManage),
  '/peajes/auditoria-estaciones': peajesOperational,
  '/peajes/pdf-reader': peajesRead,
  '/peajes/carga-express': all(peajesManage),
  '/peajes/catalogos': all(peajesManage),
  '/peajes/catalogos/empresas': all(peajesManage),
  '/peajes/catalogos/peajes': all(peajesManage),
  // Read access keeps the catalogue viewable; the editor disables mutations
  // unless the user also has the operational peajes:create permission.
  '/peajes/catalogos/estaciones': peajesRead,
  '/peajes/catalogos/patentes': all(peajesManage),
  '/peajes/catalogos/pases': all(peajesManage),
  '/peajes/plantillas': all(peajesManage),
};

export function matchesPermissionRequirement(
  requirement: PermissionRequirement,
  hasPermission: (module: string, action: string) => boolean,
  hasGlobalPermission = false,
): boolean {
  if (hasGlobalPermission) return true;

  if ('module' in requirement) {
    return (
      hasPermission(requirement.module, requirement.action) ||
      (requirement.action !== 'manage' &&
        hasPermission(requirement.module, 'manage'))
    );
  }

  const matches = (permission: PermissionRequirement) =>
    matchesPermissionRequirement(permission, hasPermission);
  const matchesAll = requirement.all?.every(matches) ?? true;
  const matchesAny = requirement.any ? requirement.any.some(matches) : true;

  return matchesAll && matchesAny;
}

// Mapeo de rutas a permisos requeridos
const ROUTE_PERMISSIONS: { [key: string]: PermissionRequirement } = {
  // Dashboard - siempre accesible si está autenticado
  
  // Templates
  '/templates': { module: 'templates', action: 'read' },
  '/template-config': { module: 'templates', action: 'manage' },
  '/template-config/:id': { module: 'templates', action: 'manage' },
  
  // Checklists
  '/checklist': { module: 'checklists', action: 'read' },
  '/checklist/new/:templateId': { module: 'checklists', action: 'create' },
  '/checklist-history': { module: 'checklists', action: 'read' },
  '/checklist-details/:id': { module: 'checklists', action: 'read' },
  
  // Incidentes
  '/incidentes/registro': { module: 'incidentes', action: 'create' },
  '/incidentes/configuracion': { module: 'incidentes', action: 'manage' },
  '/incidentes/historial': { module: 'incidentes', action: 'read' },
  '/incidentes/detalles/:id': { module: 'incidentes', action: 'read' },

  // Neumáticos
  '/neumaticos/registro': { module: 'neumaticos', action: 'create' },
  
  // Stock
  '/stock/dashboard': { module: 'stock', action: 'read' },
  '/stock/depositos': { module: 'stock', action: 'read' },
  '/stock/deposito/nuevo': { module: 'stock', action: 'create' },
  '/stock/entrada': { module: 'stock', action: 'create' },
  '/stock/salida': { module: 'stock', action: 'create' },
  '/stock/historial': { module: 'stock', action: 'read' },

  // Peajes: requisitos compuestos por perfil operativo o administrativo
  ...PEAJES_ROUTE_PERMISSIONS,
  
  // Usuarios y Roles
  '/users': { module: 'users', action: 'read' },
  '/roles': { module: 'users', action: 'manage' },
  '/role-permissions': { module: 'users', action: 'manage' },
  '/role-permissions/:id': { module: 'users', action: 'manage' },
};

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {
  private authStateService = inject(AuthStateService);
  private permissionStateService = inject(PermissionStateService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    
    // Esperar a que se inicialice completamente el estado de autenticación
    return this.authStateService.waitForAuthInitialization().pipe(
      switchMap(() => this.authStateService.isAuthenticated$),
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          this.router.navigate(['/login'], { 
            queryParams: { returnUrl: state.url } 
          });
          return of(false);
        }

        // Verificar si los permisos están cargados
        if (!this.permissionStateService.isReadyForPermissionCheck()) {
          // Esperar a que se carguen los permisos
          return this.waitForPermissionsAndCheck(state.url, route);
        }

        // Verificar permisos para la ruta específica
        const hasPermission = this.checkRoutePermission(state.url, route);
        
        if (hasPermission) {
          return of(true);
        } else {
          this.router.navigate(['/access-denied']);
          return of(false);
        }
      }),
      catchError((error) => {
        console.error('Error en PermissionGuard:', error);
        // En caso de error, redirigir al dashboard
        this.router.navigate(['/dashboard']);
        return of(false);
      })
    );
  }

  /**
   * Espera a que se carguen los permisos y luego verifica el acceso
   */
  private waitForPermissionsAndCheck(url: string, route: ActivatedRouteSnapshot): Observable<boolean> {
    return this.permissionStateService.waitForPermissionInitialization().pipe(
      map(() => {
        const hasPermission = this.checkRoutePermission(url, route);
        
        if (hasPermission) {
          return true;
        } else {
          this.router.navigate(['/access-denied']);
          return false;
        }
      }),
      catchError((error) => {
        console.error('Error esperando permisos:', error);
        // En caso de error, usar permisos por defecto
        const hasPermission = this.checkRoutePermission(url, route);
        if (hasPermission) {
          return of(true);
        } else {
          this.router.navigate(['/access-denied']);
          return of(false);
        }
      })
    );
  }

  /**
   * Verifica si el usuario tiene permisos para acceder a una ruta específica
   */
  private checkRoutePermission(url: string, route: ActivatedRouteSnapshot): boolean {
    // Obtener la ruta base sin parámetros
    const routePath = this.getRoutePath(url, route);
    const urlPath = url.split('?')[0];

    // Exacto, luego prefijo más largo (p.ej. /peajes/wizard → /peajes/wizard o /peajes)
    let requiredPermission = ROUTE_PERMISSIONS[routePath] ?? ROUTE_PERMISSIONS[urlPath];
    if (!requiredPermission) {
      const prefix = Object.keys(ROUTE_PERMISSIONS)
        .filter((r) => !r.includes(':') && (urlPath === r || urlPath.startsWith(r + '/')))
        .sort((a, b) => b.length - a.length)[0];
      if (prefix) {
        requiredPermission = ROUTE_PERMISSIONS[prefix];
      }
    }

    if (!requiredPermission) {
      // Si no hay permisos definidos, permitir acceso (para rutas nuevas o especiales)
      return true;
    }

    // Verificar si el usuario tiene el permiso requerido
    return matchesPermissionRequirement(
      requiredPermission,
      (module, action) => this.permissionStateService.hasPermission(module, action),
    );
  }

  /**
   * Obtiene la ruta base sin parámetros para hacer match con ROUTE_PERMISSIONS
   */
  private getRoutePath(url: string, route: ActivatedRouteSnapshot): string {
    // Si la URL tiene parámetros, intentar hacer match con el patrón de ruta
    if (route.routeConfig?.path) {
      return `/${route.routeConfig.path}`;
    }
    
    // Fallback: usar la URL completa
    return url;
  }

  /**
   * Verifica si una ruta específica requiere permisos especiales
   */
  static requiresPermission(url: string): boolean {
    return Object.keys(ROUTE_PERMISSIONS).some(route => {
      // Hacer match con rutas que tienen parámetros
      if (route.includes(':')) {
        const routePattern = route.replace(/:[^/]+/g, '[^/]+');
        const regex = new RegExp(`^${routePattern}$`);
        return regex.test(url);
      }
      return route === url;
    });
  }

  /**
   * Obtiene los permisos requeridos para una ruta específica
   */
  static getRequiredPermission(url: string): PermissionRequirement | null {
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      if (route.includes(':')) {
        const routePattern = route.replace(/:[^/]+/g, '[^/]+');
        const regex = new RegExp(`^${routePattern}$`);
        if (regex.test(url)) {
          return permission;
        }
      } else if (route === url) {
        return permission;
      }
    }
    return null;
  }
}
