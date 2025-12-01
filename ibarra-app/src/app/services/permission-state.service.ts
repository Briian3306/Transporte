import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, timer } from 'rxjs';
import { map, filter, take, timeout, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { GranularPermissionService } from './granular-permission.service';
import { UserCacheService } from './user-cache.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionStateService {
  private supabaseService = inject(SupabaseService);
  private permissionService = inject(GranularPermissionService);
  private userCacheService = inject(UserCacheService);
  
  // Estados de carga
  private isUserProfileLoaded$ = new BehaviorSubject<boolean>(false);
  private arePermissionsLoaded$ = new BehaviorSubject<boolean>(false);
  private isFullyInitialized$ = new BehaviorSubject<boolean>(false);
  
  // Observables públicos
  public isUserProfileLoaded = this.isUserProfileLoaded$.asObservable();
  public arePermissionsLoaded = this.arePermissionsLoaded$.asObservable();
  public isFullyInitialized = this.isFullyInitialized$.asObservable();

  constructor() {
    this.initializePermissionState();
  }

  private initializePermissionState(): void {
    // Verificar si hay datos válidos en caché
    if (this.userCacheService.hasValidCache()) {
      this.loadFromCache();
    }

    // Observar cambios en el perfil de usuario
    this.permissionService.currentUserProfile.subscribe(profile => {
      const isLoaded = profile !== null;
      this.isUserProfileLoaded$.next(isLoaded);
      
      // Guardar en caché cuando se carga el perfil
      if (profile) {
        const permissions = this.permissionService.getUserPermissions();
        const role = this.permissionService.getCurrentRole();
        this.userCacheService.saveToCache(profile, permissions, role);
      }
    });

    // Observar cambios en los permisos
    this.permissionService.userPermissions.subscribe(permissions => {
      const isLoaded = permissions.size > 0;
      this.arePermissionsLoaded$.next(isLoaded);
      
      // Actualizar caché cuando se cargan los permisos
      if (permissions.size > 0) {
        const profile = this.permissionService.getCurrentUserProfile();
        const role = this.permissionService.getCurrentRole();
        this.userCacheService.saveToCache(profile, Array.from(permissions), role);
      }
    });

    // Combinar ambos estados para determinar si está completamente inicializado
    combineLatest([
      this.isUserProfileLoaded$,
      this.arePermissionsLoaded$
    ]).subscribe(([profileLoaded, permissionsLoaded]) => {
      const fullyInitialized = profileLoaded && permissionsLoaded;
      this.isFullyInitialized$.next(fullyInitialized);
    });
  }

  /**
   * Carga datos desde el caché si están disponibles
   */
  private loadFromCache(): void {
    const cachedProfile = this.userCacheService.getCachedProfile();
    const cachedPermissions = this.userCacheService.getCachedPermissions();
    const cachedRole = this.userCacheService.getCachedRole();

    if (cachedProfile && cachedPermissions.length > 0) {
      this.isUserProfileLoaded$.next(true);
      this.arePermissionsLoaded$.next(true);
      this.isFullyInitialized$.next(true);
    }
  }

  /**
   * Espera a que el estado de permisos esté completamente inicializado
   */
  waitForPermissionInitialization(): Observable<boolean> {
    return this.isFullyInitialized$.pipe(
      filter(initialized => initialized),
      take(1),
      timeout(10000), // Timeout de 10 segundos
      catchError((error) => {
        console.warn('Timeout esperando inicialización de permisos:', error);
        // Si hay timeout, verificar si al menos hay permisos por defecto
        return this.permissionService.userPermissions.pipe(
          map(permissions => permissions.size > 0),
          take(1)
        );
      })
    );
  }

  /**
   * Verifica si el usuario tiene un permiso específico (solo si está inicializado)
   */
  hasPermission(module: string, action: string): boolean {
    // Si está completamente inicializado, usar el servicio de permisos
    if (this.isFullyInitialized$.value) {
      return this.permissionService.hasPermission(module, action);
    }
    
    // Si no está inicializado pero hay caché válido, usar caché
    if (this.userCacheService.hasValidCache()) {
      return this.userCacheService.hasCachedPermission(module, action);
    }
    
    // Si no hay caché ni inicialización, usar permisos por defecto
    return this.getDefaultPermission(module, action);
  }

  /**
   * Obtiene los permisos del usuario actual
   */
  getUserPermissions(): string[] {
    if (this.isFullyInitialized$.value) {
      return this.permissionService.getUserPermissions();
    }
    
    if (this.userCacheService.hasValidCache()) {
      return this.userCacheService.getCachedPermissions();
    }
    
    return [];
  }

  /**
   * Obtiene el rol actual del usuario
   */
  getCurrentRole(): string | null {
    if (this.isFullyInitialized$.value) {
      return this.permissionService.getCurrentRole();
    }
    
    if (this.userCacheService.hasValidCache()) {
      return this.userCacheService.getCachedRole();
    }
    
    return null;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.supabaseService.isAuthenticated();
  }

  /**
   * Fuerza la recarga de permisos
   */
  async refreshPermissions(): Promise<void> {
    this.isFullyInitialized$.next(false);
    await this.permissionService.forceReloadUserProfile();
  }

  /**
   * Permisos por defecto para casos donde no se han cargado los permisos específicos
   */
  private getDefaultPermission(module: string, action: string): boolean {
    const defaultPermissions = [
      'dashboard:read',
      'checklists:read',
      'templates:read',
      'incidentes:read'
    ];
    
    const permissionKey = `${module}:${action}`;
    return defaultPermissions.includes(permissionKey);
  }

  /**
   * Verifica si el sistema está listo para validar permisos
   */
  isReadyForPermissionCheck(): boolean {
    return this.isFullyInitialized$.value;
  }

  /**
   * Obtiene el estado actual de inicialización
   */
  getInitializationStatus(): {
    profileLoaded: boolean;
    permissionsLoaded: boolean;
    fullyInitialized: boolean;
  } {
    return {
      profileLoaded: this.isUserProfileLoaded$.value,
      permissionsLoaded: this.arePermissionsLoaded$.value,
      fullyInitialized: this.isFullyInitialized$.value
    };
  }
}
