import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, switchMap, of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { UserProfile, UserProfileWithRole } from '../models/user-profile.model';
import { UserRole } from '../models/user-role.model';
import { SystemModule } from '../models/system-module.model';
import { RolePermission } from '../models/permission-check.model';

@Injectable({
  providedIn: 'root'
})
export class GranularPermissionService {
  private supabaseService = inject(SupabaseService);
  
  // Estado del usuario actual
  private currentUserProfile$ = new BehaviorSubject<UserProfile | null>(null);
  private userPermissions$ = new BehaviorSubject<Set<string>>(new Set());
  private accessibleModules$ = new BehaviorSubject<SystemModule[]>([]);

  // Observables públicos
  public currentUserProfile = this.currentUserProfile$.asObservable();
  public userPermissions = this.userPermissions$.asObservable();
  public accessibleModules = this.accessibleModules$.asObservable();

  private isProfileLoaded = false;
  private currentUserId: string | null = null;

  constructor() {
    // Cargar perfil cuando cambie el usuario autenticado
    this.supabaseService.currentUser$.subscribe(async (user) => {
      if (user && user.id !== this.currentUserId) {
        this.currentUserId = user.id;
        this.isProfileLoaded = false;
        await this.loadUserProfile();
      } else if (!user) {
        this.currentUserId = null;
        this.isProfileLoaded = false;
        this.clearUserData();
      }
    });
  }

  /**
   * Carga el perfil completo del usuario actual
   */
  async loadUserProfile(): Promise<void> {
    try {
      // Evitar cargas duplicadas
      if (this.isProfileLoaded && this.currentUserProfile$.value) {
        console.log('Profile already loaded, skipping...');
        return;
      }

      const user = await this.supabaseService.getCurrentUser();
      if (!user) {
        this.clearUserData();
        return;
      }

      const supabase = await this.supabaseService.getClient();
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          role:user_roles(*)
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        this.clearUserData();
        return;
      }

      if (profile) {
        this.currentUserProfile$.next(profile);
        this.isProfileLoaded = true;
        
        // Intentar con ambos nombres de campo
        const roleId = profile.roleId || profile.role_id;
        if (roleId) {
          await this.loadUserPermissions(roleId);
        } else {
          console.warn('No roleId found in profile, assigning default permissions');
          this.assignDefaultPermissions();
        }
        await this.loadAccessibleModules();
      } else {
        console.warn('No profile found for user');
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      this.clearUserData();
    }
  }

  /**
   * Carga los permisos del usuario basado en su rol
   */
  private async loadUserPermissions(roleId: string): Promise<void> {
    try {
      
      if (!roleId) {
        console.warn('No roleId provided, skipping permission load');
        this.userPermissions$.next(new Set());
        return;
      }

      const supabase = await this.supabaseService.getClient();
      
      // Consulta simplificada para evitar problemas de tipos
      const { data: permissions, error } = await supabase
        .from('role_permissions')
        .select(`
          module_permission_id,
          module_permissions(
            system_modules(name),
            system_actions(name)
          )
        `)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error loading user permissions:', error);
        // Asignar permisos básicos por defecto si hay error
        this.assignDefaultPermissions();
        return;
      }

      const permissionSet = new Set<string>();
      
      // Manejo seguro de la respuesta
      if (permissions && Array.isArray(permissions)) {
        permissions.forEach(p => {
          try {
            const modulePermission = p.module_permissions as any;
            if (modulePermission) {
              // Manejo flexible para diferentes estructuras de datos
              let module: string | undefined;
              let action: string | undefined;
              
              // Verificar si es un objeto directo (estructura actual)
              if (modulePermission.system_modules && typeof modulePermission.system_modules === 'object' && 'name' in modulePermission.system_modules) {
                module = modulePermission.system_modules.name;
              }
              if (modulePermission.system_actions && typeof modulePermission.system_actions === 'object' && 'name' in modulePermission.system_actions) {
                action = modulePermission.system_actions.name;
              }
              
              // Si no se encontraron en la estructura directa, intentar como arrays
              if (!module && Array.isArray(modulePermission.system_modules) && modulePermission.system_modules.length > 0) {
                module = modulePermission.system_modules[0]?.name;
              }
              if (!action && Array.isArray(modulePermission.system_actions) && modulePermission.system_actions.length > 0) {
                action = modulePermission.system_actions[0]?.name;
              }
              
              if (module && action) {
                permissionSet.add(`${module}:${action}`);
              }
            }
          } catch (err) {
            console.warn('Error processing permission:', err);
          }
        });
      }
      // Si no hay permisos específicos, asignar permisos por defecto
      if (permissionSet.size === 0) {
        console.log('No specific permissions found, assigning default permissions');
        this.assignDefaultPermissions();
        return;
      }
      
      this.userPermissions$.next(permissionSet);
    } catch (error) {
      console.error('Error in loadUserPermissions:', error);
    }
  }

  /**
   * Asigna permisos por defecto cuando no se pueden cargar los específicos
   */
  public assignDefaultPermissions(): void {
    const defaultPermissions = new Set<string>([
      'dashboard:read',
      'checklists:read',
      'templates:read',
      'incidentes:read',
      'inventory:read'
    ]);
    console.log('Assigning default permissions:', Array.from(defaultPermissions));
    this.userPermissions$.next(defaultPermissions);
  }

  /**
   * Carga los módulos accesibles para el usuario actual
   */
  private async loadAccessibleModules(): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: modules, error } = await supabase
        .from('system_modules')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error loading accessible modules:', error);
        return;
      }

      const accessibleModules = modules?.filter(module => 
        this.hasPermission(module.name, 'read')
      ) || [];
      
      this.accessibleModules$.next(accessibleModules);
    } catch (error) {
      console.error('Error in loadAccessibleModules:', error);
    }
  }

  /**
   * Limpia los datos del usuario
   */
  private clearUserData(): void {
    this.currentUserProfile$.next(null);
    this.userPermissions$.next(new Set());
    this.accessibleModules$.next([]);
    this.isProfileLoaded = false;
    this.currentUserId = null;
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(module: string, action: string): boolean {
    const permissions = this.userPermissions$.value;
    return permissions.has(`${module}:${action}`) || permissions.has('*:*');
  }

  /**
   * Verifica múltiples permisos
   */
  hasAnyPermission(permissions: { module: string; action: string }[]): boolean {
    return permissions.some(p => this.hasPermission(p.module, p.action));
  }

  /**
   * Verifica que el usuario tenga todos los permisos especificados
   */
  hasAllPermissions(permissions: { module: string; action: string }[]): boolean {
    return permissions.every(p => this.hasPermission(p.module, p.action));
  }

  // Métodos específicos por módulo - CHECKLISTS
  canManageChecklists(): boolean {
    return this.hasPermission('checklists', 'manage');
  }

  canCreateChecklists(): boolean {
    return this.hasPermission('checklists', 'create');
  }

  canReadChecklists(): boolean {
    return this.hasPermission('checklists', 'read');
  }

  canUpdateChecklists(): boolean {
    return this.hasPermission('checklists', 'update');
  }

  canDeleteChecklists(): boolean {
    return this.hasPermission('checklists', 'delete');
  }

  // Métodos específicos por módulo - TEMPLATES
  canManageTemplates(): boolean {
    return this.hasPermission('templates', 'manage');
  }

  canCreateTemplates(): boolean {
    return this.hasPermission('templates', 'create');
  }

  canReadTemplates(): boolean {
    return this.hasPermission('templates', 'read');
  }

  canUpdateTemplates(): boolean {
    return this.hasPermission('templates', 'update');
  }

  canDeleteTemplates(): boolean {
    return this.hasPermission('templates', 'delete');
  }

  // Métodos específicos por módulo - INVENTORY
  canManageInventory(): boolean {
    return this.hasPermission('inventory', 'manage');
  }

  canCreateInventory(): boolean {
    return this.hasPermission('inventory', 'create');
  }

  canReadInventory(): boolean {
    return this.hasPermission('inventory', 'read');
  }

  canUpdateInventory(): boolean {
    return this.hasPermission('inventory', 'update');
  }

  canDeleteInventory(): boolean {
    return this.hasPermission('inventory', 'delete');
  }

  canImportInventory(): boolean {
    return this.hasPermission('inventory', 'import');
  }

  canExportInventory(): boolean {
    return this.hasPermission('inventory', 'export');
  }

  // Métodos específicos por módulo - MAINTENANCE
  canManageMaintenance(): boolean {
    return this.hasPermission('maintenance', 'manage');
  }

  canCreateMaintenance(): boolean {
    return this.hasPermission('maintenance', 'create');
  }

  canReadMaintenance(): boolean {
    return this.hasPermission('maintenance', 'read');
  }

  canUpdateMaintenance(): boolean {
    return this.hasPermission('maintenance', 'update');
  }

  canApproveMaintenance(): boolean {
    return this.hasPermission('maintenance', 'approve');
  }

  canRejectMaintenance(): boolean {
    return this.hasPermission('maintenance', 'reject');
  }

  canAssignMaintenance(): boolean {
    return this.hasPermission('maintenance', 'assign');
  }

  // Métodos específicos por módulo - REPORTS
  canReadReports(): boolean {
    return this.hasPermission('reports', 'read');
  }

  canExportReports(): boolean {
    return this.hasPermission('reports', 'export');
  }

  // Métodos específicos por módulo - USERS
  canManageUsers(): boolean {
    return this.hasPermission('users', 'manage');
  }

  canReadUsers(): boolean {
    return this.hasPermission('users', 'read');
  }

  canCreateUsers(): boolean {
    return this.hasPermission('users', 'create');
  }

  canUpdateUsers(): boolean {
    return this.hasPermission('users', 'update');
  }

  canDeleteUsers(): boolean {
    return this.hasPermission('users', 'delete');
  }

  // Métodos específicos por módulo - INCIDENTES
  canManageIncidentes(): boolean {
    return this.hasPermission('incidentes', 'manage');
  }

  canCreateIncidentes(): boolean {
    return this.hasPermission('incidentes', 'create');
  }

  canReadIncidentes(): boolean {
    return this.hasPermission('incidentes', 'read');
  }

  canUpdateIncidentes(): boolean {
    return this.hasPermission('incidentes', 'update');
  }

  canDeleteIncidentes(): boolean {
    return this.hasPermission('incidentes', 'delete');
  }

  canApproveIncidentes(): boolean {
    return this.hasPermission('incidentes', 'approve');
  }

  canRejectIncidentes(): boolean {
    return this.hasPermission('incidentes', 'reject');
  }

  canAssignIncidentes(): boolean {
    return this.hasPermission('incidentes', 'assign');
  }

  // Métodos específicos por módulo - DASHBOARD
  canReadDashboard(): boolean {
    return this.hasPermission('dashboard', 'read');
  }

  // Métodos específicos por módulo - ROLES
  canManageRoles(): boolean {
    return this.hasPermission('roles', 'manage');
  }

  canReadRoles(): boolean {
    return this.hasPermission('roles', 'read');
  }

  canCreateRoles(): boolean {
    return this.hasPermission('roles', 'create');
  }

  canUpdateRoles(): boolean {
    return this.hasPermission('roles', 'update');
  }

  canDeleteRoles(): boolean {
    return this.hasPermission('roles', 'delete');
  }

  // Métodos específicos por módulo - SETTINGS
  canManageSettings(): boolean {
    return this.hasPermission('settings', 'manage');
  }

  canReadSettings(): boolean {
    return this.hasPermission('settings', 'read');
  }

  canUpdateSettings(): boolean {
    return this.hasPermission('settings', 'update');
  }

  // Métodos de utilidad
  getCurrentRole(): string | null {
    return this.currentUserProfile$.value?.role?.name || null;
  }

  getCurrentUserProfile(): UserProfile | null {
    return this.currentUserProfile$.value;
  }

  isAdmin(): boolean {
    return this.getCurrentRole() === 'admin';
  }

  isAdministrador(): boolean {
    return this.getCurrentRole() === 'administrador';
  }

  isOperador(): boolean {
    return this.getCurrentRole() === 'operador';
  }

  isVisor(): boolean {
    return this.getCurrentRole() === 'visor';
  }

  isSupervisor(): boolean {
    return this.getCurrentRole() === 'supervisor';
  }

  isTecnico(): boolean {
    return this.getCurrentRole() === 'tecnico';
  }

  /**
   * Obtiene todos los permisos del usuario actual
   */
  getUserPermissions(): string[] {
    return Array.from(this.userPermissions$.value);
  }

  /**
   * Verifica si el usuario puede acceder a un módulo específico
   */
  canAccessModule(moduleName: string): boolean {
    return this.hasPermission(moduleName, 'read');
  }

  /**
   * Obtiene los módulos accesibles para el usuario actual
   */
  getAccessibleModules(): Observable<SystemModule[]> {
    return this.accessibleModules$;
  }

  /**
   * Refresca los permisos del usuario actual
   */
  async refreshPermissions(): Promise<void> {
    this.isProfileLoaded = false;
    const profile = this.currentUserProfile$.value;
    if (profile) {
      await this.loadUserPermissions(profile.roleId);
      await this.loadAccessibleModules();
    }
  }

  /**
   * Fuerza la recarga completa del perfil de usuario
   */
  async forceReloadUserProfile(): Promise<void> {
    this.isProfileLoaded = false;
    this.currentUserId = null;
    await this.loadUserProfile();
  }
}
