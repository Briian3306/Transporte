import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { UserManagementService } from '../../services/user-management.service';
import { UserRole } from '../../models/user-role.model';
import { SystemModule } from '../../models/system-module.model';

interface ModulePermission {
  id: string;
  module_id: string;
  action_id: string;
  module: SystemModule;
  action: {
    id: string;
    name: string;
    description: string;
    created_at: string;
  };
}

interface RolePermission {
  id: string;
  role_id: string;
  module_permission_id: string;
  module_permission: ModulePermission;
}

@Component({
  selector: 'app-role-permissions-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './role-permissions-edit.component.html',
  styleUrls: ['./role-permissions-edit.component.scss']
})
export class RolePermissionsEditComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private granularPermissionService = inject(GranularPermissionService);
  private userManagementService = inject(UserManagementService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  // Datos
  role: UserRole | null = null;
  modules: SystemModule[] = [];
  modulePermissions: ModulePermission[] = [];
  rolePermissions: RolePermission[] = [];
  
  // Permisos separados
  assignedPermissions: ModulePermission[] = [];
  availablePermissions: ModulePermission[] = [];
  
  // Estados
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Formularios
  permissionForm!: FormGroup;

  constructor() {
    this.initializeForms();
  }

  ngOnInit(): void {
    const roleId = this.route.snapshot.paramMap.get('id');
    if (roleId) {
      this.loadRoleData(roleId);
    } else {
      this.router.navigate(['/roles']);
    }
  }

  private initializeForms(): void {
    this.permissionForm = this.fb.group({
      permissions: this.fb.array([])
    });
  }

  async loadRoleData(roleId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Cargar datos en secuencia para asegurar dependencias
      await this.loadRole(roleId);
      await this.loadModules();
      await this.loadModulePermissions();
      // Solo cargar permisos del rol después de tener los modulePermissions
      await this.loadRolePermissions(roleId);
    } catch (error: any) {
      this.errorMessage = 'Error al cargar datos: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async loadRole(roleId: string): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: role, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', roleId)
        .single();

      if (error) {
        this.errorMessage = 'Error al cargar rol: ' + error.message;
        return;
      }

      this.role = role;
    } catch (error) {
      console.error('Error in loadRole:', error);
    }
  }

  async loadModules(): Promise<void> {
    try {
      const result = await this.userManagementService.getModules();
      if (result.error) {
        console.error('Error loading modules:', result.error);
        return;
      }
      this.modules = result.modules;
    } catch (error) {
      console.error('Error in loadModules:', error);
    }
  }

  async loadModulePermissions(): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: permissions, error } = await supabase
        .from('module_permissions')
        .select(`
          id,
          module_id,
          action_id,
          system_modules(
            id,
            name,
            description,
            icon,
            route,
            order_index,
            is_active,
            created_at
          ),
          system_actions(
            id,
            name,
            description,
            created_at
          )
        `)
        .order('module_id, action_id');

      if (error) {
        console.error('Error loading module permissions:', error);
        this.errorMessage = 'Error al cargar permisos de módulos: ' + error.message;
        return;
      }

      // Transformar los datos para que coincidan con la interfaz ModulePermission
      this.modulePermissions = (permissions || []).map((mp: any) => ({
        id: mp.id,
        module_id: mp.module_id,
        action_id: mp.action_id,
        module: mp.system_modules,
        action: mp.system_actions
      }));

      console.log('Module permissions loaded:', this.modulePermissions.length);
    } catch (error) {
      console.error('Error in loadModulePermissions:', error);
      this.errorMessage = 'Error inesperado al cargar permisos de módulos';
    }
  }

  async loadRolePermissions(roleId: string): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: permissions, error } = await supabase
        .from('role_permissions')
        .select(`
          id,
          role_id,
          module_permission_id,
          module_permissions(
            id,
            module_id,
            action_id,
            system_modules(
              id,
              name,
              description,
              icon,
              route,
              order_index,
              is_active,
              created_at
            ),
            system_actions(
              id,
              name,
              description,
              created_at
            )
          )
        `)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error loading role permissions:', error);
        this.errorMessage = 'Error al cargar permisos del rol: ' + error.message;
        return;
      }

      // Transformar los datos para que coincidan con la estructura esperada
      this.rolePermissions = (permissions || [])
        .filter((rp: any) => rp.module_permissions) // Filtrar solo los que tienen module_permissions
        .map((rp: any) => ({
          id: rp.id,
          role_id: rp.role_id,
          module_permission_id: rp.module_permission_id,
          module_permission: {
            id: rp.module_permissions.id,
            module_id: rp.module_permissions.module_id,
            action_id: rp.module_permissions.action_id,
            module: rp.module_permissions.system_modules,
            action: rp.module_permissions.system_actions
          }
        }));

      console.log('Role permissions loaded:', this.rolePermissions.length);
      this.separatePermissions();
      this.buildPermissionForm();
    } catch (error) {
      console.error('Error in loadRolePermissions:', error);
      this.errorMessage = 'Error inesperado al cargar permisos';
    }
  }

  private separatePermissions(): void {
    // Obtener IDs de permisos asignados al rol
    const assignedPermissionIds = this.rolePermissions
      .map(rp => rp.module_permission_id)
      .filter(id => id); // Filtrar valores nulos/undefined
    
    console.log('Assigned permission IDs:', assignedPermissionIds);
    console.log('Module permissions:', this.modulePermissions.length);
    
    // Separar permisos en asignados y disponibles
    this.assignedPermissions = this.modulePermissions.filter(mp => 
      assignedPermissionIds.includes(mp.id)
    );
    
    this.availablePermissions = this.modulePermissions.filter(mp => 
      !assignedPermissionIds.includes(mp.id)
    );
    
    console.log('Permissions separated:', {
      total: this.modulePermissions.length,
      assigned: this.assignedPermissions.length,
      available: this.availablePermissions.length,
      assignedIds: assignedPermissionIds
    });
  }

  private buildPermissionForm(): void {
    const permissionArray = this.fb.array([]);
    
    console.log('Building permission form with:', {
      modulePermissions: this.modulePermissions.length,
      rolePermissions: this.rolePermissions.length
    });
    
    // Filtrar solo los modulePermissions que tienen module y action válidos
    const validModulePermissions = this.modulePermissions.filter(mp => 
      mp.module && mp.action
    );
    
    validModulePermissions.forEach(modulePermission => {
      const isSelected = this.rolePermissions.some(rp => 
        rp.module_permission_id === modulePermission.id
      );

      const permissionGroup = this.fb.group({
        modulePermissionId: [modulePermission.id],
        isSelected: [isSelected],
        moduleName: [modulePermission.module?.name || ''],
        actionName: [modulePermission.action?.name || ''],
        moduleDescription: [modulePermission.module?.description || ''],
        actionDescription: [modulePermission.action?.description || '']
      });
      
      (permissionArray as FormArray).push(permissionGroup);
    });

    this.permissionForm.setControl('permissions', permissionArray);
    
    console.log('Permission form built with controls:', this.getPermissionControls().length);
  }

  async addPermission(modulePermission: ModulePermission): Promise<void> {
    if (!this.role) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const supabase = await this.supabaseService.getClient();
      
      // Verificar si el permiso ya está asignado
      const { data: existing } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_id', this.role.id)
        .eq('module_permission_id', modulePermission.id)
        .single();

      if (existing) {
        this.successMessage = 'El permiso ya está asignado al rol';
        this.loading = false;
        return;
      }

      const { error } = await supabase
        .from('role_permissions')
        .insert({
          role_id: this.role.id,
          module_permission_id: modulePermission.id
        });

      if (error) {
        this.errorMessage = 'Error al agregar permiso: ' + error.message;
        return;
      }

      const actionName = modulePermission.action?.name || 'permiso';
      this.successMessage = `Permiso "${actionName}" agregado exitosamente`;
      setTimeout(() => this.successMessage = '', 3000);
      
      // Recargar permisos para reflejar cambios
      await this.loadRolePermissions(this.role.id);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async addAllModulePermissions(moduleId: string): Promise<void> {
    if (!this.role) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // Obtener todos los permisos disponibles del módulo
      const modulePermissions = this.availablePermissions.filter(
        mp => mp.module_id === moduleId
      );

      if (modulePermissions.length === 0) {
        this.successMessage = 'No hay permisos disponibles para agregar en este módulo';
        setTimeout(() => this.successMessage = '', 3000);
        this.loading = false;
        return;
      }

      const supabase = await this.supabaseService.getClient();
      
      // Obtener permisos ya asignados para evitar duplicados
      const assignedIds = this.assignedPermissions
        .filter(mp => mp.module_id === moduleId)
        .map(mp => mp.id);

      // Filtrar permisos que aún no están asignados
      const permissionsToAdd = modulePermissions
        .filter(mp => !assignedIds.includes(mp.id))
        .map(mp => ({
          role_id: this.role!.id,
          module_permission_id: mp.id
        }));

      if (permissionsToAdd.length === 0) {
        this.successMessage = 'Todos los permisos de este módulo ya están asignados';
        setTimeout(() => this.successMessage = '', 3000);
        this.loading = false;
        return;
      }

      // Insertar todos los permisos del módulo
      const { error } = await supabase
        .from('role_permissions')
        .insert(permissionsToAdd);

      if (error) {
        this.errorMessage = 'Error al agregar permisos: ' + error.message;
        return;
      }

      const module = this.modules.find(m => m.id === moduleId);
      const moduleName = module?.name || 'módulo';
      this.successMessage = `${permissionsToAdd.length} permiso(s) del módulo "${moduleName}" agregado(s) exitosamente`;
      setTimeout(() => this.successMessage = '', 5000);
      
      // Recargar permisos para reflejar cambios
      await this.loadRolePermissions(this.role.id);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async removePermission(modulePermission: ModulePermission): Promise<void> {
    if (!this.role) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', this.role.id)
        .eq('module_permission_id', modulePermission.id);

      if (error) {
        this.errorMessage = 'Error al remover permiso: ' + error.message;
        return;
      }

      this.successMessage = `Permiso "${modulePermission.action.name}" removido exitosamente`;
      // Recargar permisos para reflejar cambios
      await this.loadRolePermissions(this.role.id);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async savePermissions(): Promise<void> {
    if (!this.role) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      const permissions = this.permissionForm.get('permissions')?.value;
      const selectedPermissions = permissions
        .filter((p: any) => p.isSelected)
        .map((p: any) => p.modulePermissionId);

      const result = await this.userManagementService.updateRolePermissions(
        this.role.id,
        selectedPermissions
      );

      if (!result.success) {
        this.errorMessage = 'Error al guardar permisos: ' + result.error;
        return;
      }

      this.successMessage = 'Permisos actualizados exitosamente';
      // Recargar permisos para reflejar cambios
      this.loadRolePermissions(this.role.id);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  selectAllPermissions(): void {
    const permissions = this.permissionForm.get('permissions') as FormArray;
    permissions.controls.forEach(control => {
      control.get('isSelected')?.setValue(true);
    });
  }

  deselectAllPermissions(): void {
    const permissions = this.permissionForm.get('permissions') as FormArray;
    permissions.controls.forEach(control => {
      control.get('isSelected')?.setValue(false);
    });
  }

  selectModulePermissions(moduleId: string): void {
    const permissions = this.permissionForm.get('permissions') as FormArray;
    permissions.controls.forEach(control => {
      const modulePermission = this.modulePermissions.find(mp => mp.id === control.get('modulePermissionId')?.value);
      if (modulePermission && modulePermission.module_id === moduleId) {
        control.get('isSelected')?.setValue(true);
      }
    });
  }

  deselectModulePermissions(moduleId: string): void {
    const permissions = this.permissionForm.get('permissions') as FormArray;
    permissions.controls.forEach(control => {
      const modulePermission = this.modulePermissions.find(mp => mp.id === control.get('modulePermissionId')?.value);
      if (modulePermission && modulePermission.module_id === moduleId) {
        control.get('isSelected')?.setValue(false);
      }
    });
  }

  getPermissionControls(): any[] {
    return (this.permissionForm.get('permissions') as any)?.controls || [];
  }

  getPermissionIndex(permission: any): number {
    const controls = this.getPermissionControls();
    return controls.findIndex(control => control === permission);
  }

  getModulesWithPermissions(): { module: SystemModule; permissions: any[] }[] {
    const modulesMap = new Map<string, { module: SystemModule; permissions: any[] }>();
    
    // Agrupar por módulo usando los datos de modulePermissions
    this.modulePermissions.forEach(modulePermission => {
      const moduleId = modulePermission.module_id;
      
      if (!modulesMap.has(moduleId)) {
        modulesMap.set(moduleId, {
          module: modulePermission.module,
          permissions: []
        });
      }
      
      // Buscar el control correspondiente en el FormArray
      const control = this.getPermissionControls().find(c => 
        c.get('modulePermissionId')?.value === modulePermission.id
      );
      
      if (control) {
        modulesMap.get(moduleId)!.permissions.push(control);
      }
    });

    const result = Array.from(modulesMap.values());
    console.log('Modules with permissions:', result.map(m => ({
      moduleName: m.module.name,
      permissionsCount: m.permissions.length
    })));
    
    return result;
  }

  getAssignedPermissionsByModule(): { module: SystemModule; permissions: ModulePermission[] }[] {
    const modulesMap = new Map<string, { module: SystemModule; permissions: ModulePermission[] }>();
    
    this.assignedPermissions.forEach(permission => {
      const moduleId = permission.module_id;
      
      if (!modulesMap.has(moduleId)) {
        modulesMap.set(moduleId, {
          module: permission.module,
          permissions: []
        });
      }
      
      modulesMap.get(moduleId)!.permissions.push(permission);
    });

    return Array.from(modulesMap.values());
  }

  getAvailablePermissionsByModule(): { module: SystemModule; permissions: ModulePermission[] }[] {
    const modulesMap = new Map<string, { module: SystemModule; permissions: ModulePermission[] }>();
    
    this.availablePermissions.forEach(permission => {
      const moduleId = permission.module_id;
      
      if (!modulesMap.has(moduleId)) {
        modulesMap.set(moduleId, {
          module: permission.module,
          permissions: []
        });
      }
      
      modulesMap.get(moduleId)!.permissions.push(permission);
    });

    return Array.from(modulesMap.values());
  }

  // Verificar si el usuario actual es admin
  isAdmin(): boolean {
    return this.granularPermissionService.isAdmin();
  }

  goBack(): void {
    this.router.navigate(['/roles']);
  }

  // Exponer Math para el template
  Math = Math;
}
