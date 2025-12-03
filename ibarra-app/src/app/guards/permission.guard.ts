import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AuthStateService } from '../services/auth-state.service';
import { PermissionStateService } from '../services/permission-state.service';

// Mapeo de rutas a permisos requeridos
const ROUTE_PERMISSIONS: { [key: string]: { module: string; action: string } } = {
  // Dashboard - siempre accesible si está autenticado
  '/dashboard': { module: 'checklists', action: 'read' },
  
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
    
    // Buscar permisos requeridos para esta ruta
    const requiredPermission = ROUTE_PERMISSIONS[routePath];
    
    if (!requiredPermission) {
      // Si no hay permisos definidos, permitir acceso (para rutas nuevas o especiales)
      return true;
    }

    // Verificar si el usuario tiene el permiso requerido
    const hasPermission = this.permissionStateService.hasPermission(
      requiredPermission.module, 
      requiredPermission.action
    );

    return hasPermission;
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
  static getRequiredPermission(url: string): { module: string; action: string } | null {
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
