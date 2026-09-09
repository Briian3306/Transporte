import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { UserManagementService } from '../../services/user-management.service';
import { UserRole } from '../../models/user-role.model';
import { SystemModule } from '../../models/system-module.model';

interface ModulePermission {
  id: string;
  moduleId: string;
  actionId: string;
  module: SystemModule;
  action: {
    id: string;
    name: string;
    description: string;
  };
}

interface RolePermission {
  id: string;
  roleId: string;
  modulePermissionId: string;
  modulePermission: ModulePermission;
}

@Component({
  selector: 'app-role-permission-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './role-permission-management.component.html',
  styleUrls: ['./role-permission-management.component.scss']
})
export class RolePermissionManagementComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private granularPermissionService = inject(GranularPermissionService);
  private userManagementService = inject(UserManagementService);
  private fb = inject(FormBuilder);

  // Datos
  roles: UserRole[] = [];
  modules: SystemModule[] = [];
  modulePermissions: ModulePermission[] = [];
  rolePermissions: RolePermission[] = [];
  
  // Estados
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Filtros
  selectedRoleId = '';
  selectedModuleId = '';
  
  // Formularios
  modulePermissionForm!: FormGroup;
  rolePermissionForm!: FormGroup;

  constructor() {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadData();
  }

  private initializeForms(): void {
    this.modulePermissionForm = this.fb.group({
      moduleId: ['', [Validators.required]],
      actionId: ['', [Validators.required]]
    });

    this.rolePermissionForm = this.fb.group({
      roleId: ['', [Validators.required]],
      permissions: this.fb.array([])
    });
  }

  async loadData(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      await Promise.all([
        this.loadRoles(),
        this.loadModules(),
        this.loadModulePermissions()
      ]);
    } catch (error: any) {
      this.errorMessage = 'Error al cargar datos: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async loadRoles(): Promise<void> {
    try {
      const result = await this.userManagementService.getRoles();
      if (result.error) {
        console.error('Error loading roles:', result.error);
        return;
      }
      this.roles = result.roles;
    } catch (error) {
      console.error('Error in loadRoles:', error);
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

  async loadRolePermissions(): Promise<void> {
    if (!this.selectedRoleId) return;

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
        .eq('role_id', this.selectedRoleId);

      if (error) {
        console.error('Error loading role permissions:', error);
        return;
      }

      this.rolePermissions = permissions || [];
      this.buildRolePermissionForm();
    } catch (error) {
      console.error('Error in loadRolePermissions:', error);
    }
  }

  private buildRolePermissionForm(): void {
    const permissionArray = this.fb.array([]);
    
    this.modulePermissions.forEach(modulePermission => {
      const isSelected = this.rolePermissions.some(rp => 
        rp.modulePermissionId === modulePermission.id
      );

      const permissionGroup = this.fb.group({
        modulePermissionId: [modulePermission.id],
        isSelected: [isSelected],
        moduleName: [modulePermission.module.name],
        actionName: [modulePermission.action.name]
      });
      
      (permissionArray as FormArray).push(permissionGroup);
    });

    this.rolePermissionForm.setControl('permissions', permissionArray);
  }

  async createModulePermission(): Promise<void> {
    if (this.modulePermissionForm.invalid) {
      this.markFormGroupTouched(this.modulePermissionForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const { moduleId, actionId } = this.modulePermissionForm.value;
      const supabase = await this.supabaseService.getClient();
      
      const { error } = await supabase
        .from('module_permissions')
        .insert({
          module_id: moduleId,
          action_id: actionId
        });

      if (error) {
        this.errorMessage = 'Error al crear permiso: ' + error.message;
        return;
      }

      this.successMessage = 'Permiso de módulo creado exitosamente';
      this.modulePermissionForm.reset();
      this.loadModulePermissions();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async deleteModulePermission(permissionId: string): Promise<void> {
    if (!confirm('¿Está seguro de que desea eliminar este permiso de módulo?')) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('module_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) {
        this.errorMessage = 'Error al eliminar permiso: ' + error.message;
        return;
      }

      this.successMessage = 'Permiso de módulo eliminado exitosamente';
      this.loadModulePermissions();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async saveRolePermissions(): Promise<void> {
    if (this.rolePermissionForm.invalid || !this.selectedRoleId) {
      this.markFormGroupTouched(this.rolePermissionForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const permissions = this.rolePermissionForm.get('permissions')?.value;
      const selectedPermissions = permissions
        .filter((p: any) => p.isSelected)
        .map((p: any) => p.modulePermissionId);

      const result = await this.userManagementService.updateRolePermissions(
        this.selectedRoleId,
        selectedPermissions
      );

      if (!result.success) {
        this.errorMessage = 'Error al guardar permisos: ' + result.error;
        return;
      }

      this.successMessage = 'Permisos de rol actualizados exitosamente';
      this.loadRolePermissions();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  onRoleChange(): void {
    if (this.selectedRoleId) {
      this.loadRolePermissions();
    }
  }

  onModuleFilterChange(): void {
    // Filtrar permisos por módulo si es necesario
    this.loadRolePermissions();
  }

  private markFormGroupTouched(form: FormGroup): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      control?.markAsTouched();
    });
  }

  getPermissionControls(): any[] {
    return (this.rolePermissionForm.get('permissions') as any)?.controls || [];
  }

  getFilteredModulePermissions(): ModulePermission[] {
    if (!this.selectedModuleId) {
      return this.modulePermissions;
    }
    return this.modulePermissions.filter(mp => mp.moduleId === this.selectedModuleId);
  }

  // Verificar si el usuario actual es admin
  isAdmin(): boolean {
    return this.granularPermissionService.isAdmin();
  }

  // Exponer Math para el template
  Math = Math;
}
