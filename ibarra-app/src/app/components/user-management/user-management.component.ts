import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserManagementService } from '../../services/user-management.service';
import { UserProfileWithRole, UserProfileCreate } from '../../models/user-profile.model';
import { UserRole } from '../../models/user-role.model';
import { SystemModule } from '../../models/system-module.model';
import { GranularPermissionDirective } from '../../directives/granular-permission.directive';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, GranularPermissionDirective],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private userManagementService = inject(UserManagementService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  users: UserProfileWithRole[] = [];
  roles: UserRole[] = [];
  modules: SystemModule[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Filtros y búsqueda
  searchTerm = '';
  roleFilter = '';
  statusFilter = 'all';

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  // Modal y formularios
  showCreateModal = false;
  showPermissionModal = false;
  showRoleAssignmentModal = false;
  selectedUser: UserProfileWithRole | null = null;
  userForm!: FormGroup;
  permissionForm!: FormGroup;
  roleAssignmentForm!: FormGroup;

  constructor() {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadModules();
  }

  private initializeForms(): void {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      roleIds: this.fb.array([], [Validators.required, this.atLeastOneRoleValidator]),
      isActive: [true],
      password: ['', [Validators.minLength(8)]],
      useCustomPassword: [false]
    });

    // Configurar validaciones condicionales para la contraseña
    this.userForm.get('useCustomPassword')?.valueChanges.subscribe(useCustom => {
      const passwordControl = this.userForm.get('password');
      if (useCustom) {
        passwordControl?.setValidators([Validators.required, Validators.minLength(8)]);
      } else {
        passwordControl?.setValidators([Validators.minLength(8)]);
        passwordControl?.setValue('');
      }
      passwordControl?.updateValueAndValidity();
    });

    this.permissionForm = this.fb.group({
      permissions: this.fb.array([])
    });

    this.roleAssignmentForm = this.fb.group({
      roleIds: this.fb.array([], [Validators.required, this.atLeastOneRoleValidator])
    });
  }

  // Validador personalizado para asegurar al menos un rol
  private atLeastOneRoleValidator(control: any) {
    const roleIds = control.value;
    if (!roleIds || roleIds.length === 0) {
      return { atLeastOneRole: true };
    }
    return null;
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const filters = {
        roleId: this.roleFilter || undefined,
        isActive: this.statusFilter === 'all' ? undefined : this.statusFilter === 'active',
        search: this.searchTerm || undefined
      };

      const result = await this.userManagementService.getUsers(filters);

      if (result.error) {
        this.errorMessage = 'Error al cargar usuarios: ' + result.error;
        return;
      }

      this.users = result.users;
      this.totalItems = result.users.length;
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
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

  // Método para abrir modal de asignación de roles
  openRoleAssignmentModal(user: UserProfileWithRole): void {
    this.selectedUser = user;
    this.showRoleAssignmentModal = true;
    
    // Inicializar formulario con roles actuales del usuario
    const roleIdsArray = this.fb.array([]);
    user.roleIds?.forEach(roleId => {
      roleIdsArray.push(this.fb.control(roleId));
    });
    
    this.roleAssignmentForm.setControl('roleIds', roleIdsArray);
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeRoleAssignmentModal(): void {
    this.showRoleAssignmentModal = false;
    this.selectedUser = null;
    this.roleAssignmentForm.reset();
  }

  async saveUserRoles(): Promise<void> {
    if (!this.selectedUser || this.roleAssignmentForm.invalid) {
      if (this.roleAssignmentForm.invalid) {
        this.errorMessage = 'Debe seleccionar al menos un rol';
      }
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const roleIds = this.roleAssignmentForm.get('roleIds')?.value || [];
      
      const result = await this.userManagementService.assignRolesToUser(
        this.selectedUser.id,
        roleIds
      );

      if (!result.success) {
        this.errorMessage = 'Error al actualizar roles: ' + result.error;
        return;
      }

      // Actualizar roles en la lista local
      const updatedRoles = this.roles.filter(r => roleIds.includes(r.id));
      this.selectedUser.roleIds = roleIds;
      this.selectedUser.roles = updatedRoles;

      this.successMessage = 'Roles actualizados correctamente';
      setTimeout(() => this.successMessage = '', 3000);
      this.closeRoleAssignmentModal();
      this.loadUsers(); // Recargar para asegurar consistencia
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  // Método helper para manejar checkboxes de roles
  toggleRoleInForm(roleId: string): void {
    const roleIdsArray = this.roleAssignmentForm.get('roleIds') as FormArray;
    const index = roleIdsArray.controls.findIndex(control => control.value === roleId);
    
    if (index >= 0) {
      roleIdsArray.removeAt(index);
    } else {
      roleIdsArray.push(this.fb.control(roleId));
    }
    
    this.roleAssignmentForm.updateValueAndValidity();
  }

  isRoleSelected(roleId: string): boolean {
    const roleIds = this.roleAssignmentForm.get('roleIds')?.value || [];
    return roleIds.includes(roleId);
  }

  async toggleUserStatus(user: UserProfileWithRole): Promise<void> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.isActive })
        .eq('id', user.id);

      if (error) {
        this.errorMessage = 'Error al actualizar estado: ' + error.message;
        return;
      }

      user.isActive = !user.isActive;
      this.successMessage = `Usuario ${user.isActive ? 'activado' : 'desactivado'} correctamente`;
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    }
  }

  async deleteUser(user: UserProfileWithRole): Promise<void> {
    if (!confirm(`¿Está seguro de que desea eliminar al usuario "${user.fullName}"?`)) {
      return;
    }

    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id);

      if (error) {
        this.errorMessage = 'Error al eliminar usuario: ' + error.message;
        return;
      }

      this.users = this.users.filter(u => u.id !== user.id);
      this.successMessage = 'Usuario eliminado correctamente';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    }
  }

  goToRoles(): void {
    this.router.navigate(['/roles']);
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.roleFilter = '';
    this.statusFilter = 'all';
    this.currentPage = 1;
    this.loadUsers();
  }

  get filteredUsers(): UserProfileWithRole[] {
    if (!this.searchTerm) {
      return this.users;
    }

    return this.users.filter(user =>
      user.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  get paginatedUsers(): UserProfileWithRole[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getRoleBadgeClass(roleName: string): string {
    const roleClasses: { [key: string]: string } = {
      'admin': 'badge-admin',
      'administrador': 'badge-administrador',
      'operador': 'badge-operador',
      'visor': 'badge-visor',
      'supervisor': 'badge-supervisor',
      'tecnico': 'badge-tecnico'
    };
    return roleClasses[roleName] || 'badge-default';
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'badge-success' : 'badge-danger';
  }

  trackByUserId(index: number, user: UserProfileWithRole): string {
    return user.id;
  }

  // Métodos para creación de usuarios
  openCreateModal(): void {
    this.userForm.reset();
    const roleIdsArray = this.fb.array([]);
    this.userForm.setControl('roleIds', roleIdsArray);
    this.userForm.patchValue({
      isActive: true,
      useCustomPassword: false
    });
    this.showCreateModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.userForm.reset();
  }

  async createUser(): Promise<void> {
    if (this.userForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const formValue = this.userForm.value;
      const roleIds = formValue.roleIds || [];
      
      if (roleIds.length === 0) {
        this.errorMessage = 'Debe seleccionar al menos un rol';
        return;
      }

      const userData: UserProfileCreate = {
        email: formValue.email,
        fullName: formValue.fullName,
        roleIds: roleIds,
        isActive: formValue.isActive,
        password: formValue.useCustomPassword ? formValue.password : undefined
      };

      const result = await this.userManagementService.createUser(userData);

      if (!result.success) {
        this.errorMessage = 'Error al crear usuario: ' + result.error;
        return;
      }

      const message = formValue.useCustomPassword 
        ? 'Usuario creado exitosamente con contraseña personalizada.'
        : 'Usuario creado exitosamente. Se generó una contraseña temporal.';
      
      this.successMessage = message;
      this.closeCreateModal();
      this.loadUsers();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  // Método helper para manejar checkboxes de roles en creación
  toggleRoleInCreateForm(roleId: string): void {
    const roleIdsArray = this.userForm.get('roleIds') as FormArray;
    const index = roleIdsArray.controls.findIndex(control => control.value === roleId);
    
    if (index >= 0) {
      roleIdsArray.removeAt(index);
    } else {
      roleIdsArray.push(this.fb.control(roleId));
    }
    
    this.userForm.updateValueAndValidity();
  }

  isRoleSelectedInCreate(roleId: string): boolean {
    const roleIds = this.userForm.get('roleIds')?.value || [];
    return roleIds.includes(roleId);
  }

  // Métodos para gestión de permisos
  openPermissionModal(user: UserProfileWithRole): void {
    this.selectedUser = user;
    this.showPermissionModal = true;
    this.loadUserPermissions(user);
  }

  closePermissionModal(): void {
    this.showPermissionModal = false;
    this.selectedUser = null;
  }

  async loadUserPermissions(user: UserProfileWithRole): Promise<void> {
    try {
      // Cargar permisos de todos los roles del usuario
      // Por ahora, cargamos permisos del primer rol (esto se puede mejorar para mostrar permisos combinados)
      if (!user.roleIds || user.roleIds.length === 0) {
        console.warn('User has no roles assigned');
        return;
      }

      // Cargar permisos del primer rol (la gestión de permisos por rol se mantiene igual)
      const result = await this.userManagementService.getRolePermissions(user.roleIds[0]);

      if (result.error) {
        console.error('Error loading user permissions:', result.error);
        return;
      }

      // Construir formulario de permisos
      this.buildPermissionForm(result.permissions);
    } catch (error) {
      console.error('Error in loadUserPermissions:', error);
    }
  }

  private buildPermissionForm(permissions: any[]): void {
    const permissionArray = this.fb.array([]);
    
    this.modules.forEach(module => {
      const moduleGroup = this.fb.group({
        moduleId: [module.id],
        moduleName: [module.name],
        permissions: this.fb.group({
          read: [false],
          create: [false],
          update: [false],
          delete: [false],
          manage: [false]
        })
      });
      
      (permissionArray as FormArray).push(moduleGroup);
    });

    this.permissionForm.setControl('permissions', permissionArray);
  }

  async savePermissions(): Promise<void> {
    if (!this.selectedUser || !this.selectedUser.roleIds || this.selectedUser.roleIds.length === 0) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      const permissions = this.permissionForm.get('permissions')?.value;
      const newPermissions: string[] = [];

      permissions.forEach((module: any) => {
        Object.keys(module.permissions).forEach(action => {
          if (module.permissions[action]) {
            newPermissions.push(`${module.moduleId}_${action}`);
          }
        });
      });

      // Actualizar permisos del primer rol (la gestión de permisos por rol se mantiene igual)
      const result = await this.userManagementService.updateRolePermissions(
        this.selectedUser.roleIds[0], 
        newPermissions
      );

      if (!result.success) {
        this.errorMessage = 'Error al guardar permisos: ' + result.error;
        return;
      }

      this.successMessage = 'Permisos actualizados correctamente';
      this.closePermissionModal();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });
  }

  getPermissionControls(): any[] {
    return (this.permissionForm.get('permissions') as any)?.controls || [];
  }

  // Exponer Math para el template
  Math = Math;
}
