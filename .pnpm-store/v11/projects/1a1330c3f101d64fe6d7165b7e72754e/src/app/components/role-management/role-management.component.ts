import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GranularPermissionService } from '../../services/granular-permission.service';
import { UserManagementService } from '../../services/user-management.service';
import { UserRole } from '../../models/user-role.model';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.scss']
})
export class RoleManagementComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private granularPermissionService = inject(GranularPermissionService);
  private userManagementService = inject(UserManagementService);
  private fb = inject(FormBuilder);

  // Datos
  roles: UserRole[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Modal y formularios
  showCreateModal = false;
  showEditModal = false;
  selectedRole: UserRole | null = null;
  roleForm!: FormGroup;

  constructor() {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  private initializeForms(): void {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      isSystemRole: [false]
    });
  }

  async loadRoles(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const result = await this.userManagementService.getRoles();
      
      if (result.error) {
        this.errorMessage = 'Error al cargar roles: ' + result.error;
        return;
      }

      this.roles = result.roles;
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.roleForm.reset();
    this.roleForm.patchValue({
      isSystemRole: false
    });
    this.showCreateModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.roleForm.reset();
  }

  openEditModal(role: UserRole): void {
    this.selectedRole = role;
    this.roleForm.patchValue({
      name: role.name,
      description: role.description,
      isSystemRole: role.isSystemRole
    });
    this.showEditModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedRole = null;
    this.roleForm.reset();
  }

  async createRole(): Promise<void> {
    if (this.roleForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const roleData = this.roleForm.value;
      const supabase = await this.supabaseService.getClient();
      
      const { error } = await supabase
        .from('user_roles')
        .insert({
          name: roleData.name.toLowerCase(),
          description: roleData.description,
          is_system_role: roleData.isSystemRole
        });

      if (error) {
        this.errorMessage = 'Error al crear rol: ' + error.message;
        return;
      }

      this.successMessage = 'Rol creado exitosamente';
      this.closeCreateModal();
      this.loadRoles();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async updateRole(): Promise<void> {
    if (this.roleForm.invalid || !this.selectedRole) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const roleData = this.roleForm.value;
      const supabase = await this.supabaseService.getClient();
      
      const { error } = await supabase
        .from('user_roles')
        .update({
          name: roleData.name.toLowerCase(),
          description: roleData.description,
          is_system_role: roleData.isSystemRole
        })
        .eq('id', this.selectedRole.id);

      if (error) {
        this.errorMessage = 'Error al actualizar rol: ' + error.message;
        return;
      }

      this.successMessage = 'Rol actualizado exitosamente';
      this.closeEditModal();
      this.loadRoles();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  async deleteRole(role: UserRole): Promise<void> {
    if (role.isSystemRole) {
      this.errorMessage = 'No se pueden eliminar roles del sistema';
      return;
    }

    if (!confirm(`¿Está seguro de que desea eliminar el rol "${role.name}"?`)) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', role.id);

      if (error) {
        this.errorMessage = 'Error al eliminar rol: ' + error.message;
        return;
      }

      this.successMessage = 'Rol eliminado exitosamente';
      this.loadRoles();
    } catch (error: any) {
      this.errorMessage = 'Error inesperado: ' + error.message;
    } finally {
      this.loading = false;
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.roleForm.controls).forEach(key => {
      const control = this.roleForm.get(key);
      control?.markAsTouched();
    });
  }

  // Verificar si el usuario actual es admin
  isAdmin(): boolean {
    return this.granularPermissionService.isAdmin();
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

  // Exponer Math para el template
  Math = Math;
}
