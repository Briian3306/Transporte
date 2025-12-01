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
      await Promise.all([
        this.loadRole(roleId),
        this.loadModules(),
        this.loadModulePermissions(),
        this.loadRolePermissions(roleId)
      ]);
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
          *,
          module:system_modules(*),
          action:system_actions(*)
        `)
        .order('module_id, action_id');

      if (error) {
        console.error('Error loading module permissions:', error);
        return;
      }

      this.modulePermissions = permissions || [];
    } catch (error) {
      console.error('Error in loadModulePermissions:', error);
    }
  }

  async loadRolePermissions(roleId: string): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: permissions, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          module_permission:module_permissions(
            *,
            module:system_modules(*),
            action:system_actions(*)
          )
        `)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error loading role permissions:', error);
        return;
      }

      this.rolePermissions = permissions || [];
      this.separatePermissions();
      this.buildPermissionForm();
    } catch (error) {
      console.error('Error in loadRolePermissions:', error);
    }
  }

  private separatePermissions(): void {
    // Obtener IDs de permisos asignados al rol
    const assignedPermissionIds = this.rolePermissions.map(rp => rp.module_permission_id);
    
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
      available: this.availablePermissions.length
    });
  }

  private buildPermissionForm(): void {
    const permissionArray = this.fb.array([]);
    
    console.log('Building permission form with:', {
      modulePermissions: this.modulePermissions.length,
      rolePermissions: this.rolePermissions.length
    });
    
    this.modulePermissions.forEach(modulePermission => {
      const isSelected = this.rolePermissions.some(rp => 
        rp.module_permission_id === modulePermission.id
      );

      const permissionGroup = this.fb.group({
        modulePermissionId: [modulePermission.id],
        isSelected: [isSelected],
        moduleName: [modulePermission.module.name],
        actionName: [modulePermission.action.name],
        moduleDescription: [modulePermission.module.description],
        actionDescription: [modulePermission.action.description]
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

    try {
      const supabase = await this.supabaseService.getClient();
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

      this.successMessage = `Permiso "${modulePermission.action.name}" agregado exitosamente`;
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
