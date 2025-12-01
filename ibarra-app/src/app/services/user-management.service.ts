import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserProfile, UserProfileCreate, UserProfileUpdate } from '../models/user-profile.model';
import { UserRole } from '../models/user-role.model';
import { SystemModule } from '../models/system-module.model';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private supabaseService = inject(SupabaseService);

  /**
   * Crea un nuevo usuario en el sistema
   */
  async createUser(userData: UserProfileCreate): Promise<{ success: boolean; error?: string; userId?: string }> {
    try {
      // Usar contraseña personalizada o generar una temporal
      const password = userData.password || this.generateTemporaryPassword();
      
      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await this.supabaseService.signUp(
        userData.email, 
        password
      );

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'No se pudo crear el usuario' };
      }

      // Crear perfil de usuario
      const supabase = await this.supabaseService.getClient();
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.fullName,
          role_id: userData.roleId,
          is_active: userData.isActive ?? true
        });

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      return { success: true, userId: authData.user.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene todos los usuarios con sus roles
   */
  async getUsers(filters?: {
    roleId?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<{ users: any[]; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          role:user_roles(*)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.roleId) {
        query = query.eq('role_id', filters.roleId);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const { data: users, error } = await query;

      if (error) {
        return { users: [], error: error.message };
      }

      return { users: users || [] };
    } catch (error: any) {
      return { users: [], error: error.message };
    }
  }

  /**
   * Actualiza un usuario
   */
  async updateUser(userId: string, updates: UserProfileUpdate): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Elimina un usuario
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene todos los roles disponibles
   */
  async getRoles(): Promise<{ roles: UserRole[]; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('name');

      if (error) {
        return { roles: [], error: error.message };
      }

      return { roles: roles || [] };
    } catch (error: any) {
      return { roles: [], error: error.message };
    }
  }

  /**
   * Obtiene todos los módulos del sistema
   */
  async getModules(): Promise<{ modules: SystemModule[]; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: modules, error } = await supabase
        .from('system_modules')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        return { modules: [], error: error.message };
      }

      return { modules: modules || [] };
    } catch (error: any) {
      return { modules: [], error: error.message };
    }
  }

  /**
   * Obtiene los permisos de un rol específico
   */
  async getRolePermissions(roleId: string): Promise<{ permissions: any[]; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
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
        return { permissions: [], error: error.message };
      }

      return { permissions: permissions || [] };
    } catch (error: any) {
      return { permissions: [], error: error.message };
    }
  }

  /**
   * Actualiza los permisos de un rol
   */
  async updateRolePermissions(roleId: string, permissions: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();

      // Eliminar permisos existentes
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      // Insertar nuevos permisos
      if (permissions.length > 0) {
        const newPermissions = permissions.map(permission => ({
          role_id: roleId,
          module_permission_id: permission
        }));

        const { error } = await supabase
          .from('role_permissions')
          .insert(newPermissions);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email de restablecimiento de contraseña
   */
  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.supabaseService.resetPassword(email);
      
      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Genera una contraseña temporal segura
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Completar con caracteres aleatorios
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Mezclar la contraseña
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
