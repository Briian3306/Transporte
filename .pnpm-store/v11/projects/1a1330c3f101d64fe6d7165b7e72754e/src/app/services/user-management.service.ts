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
      // Validar que tenga al menos un rol
      if (!userData.roleIds || userData.roleIds.length === 0) {
        return { success: false, error: 'El usuario debe tener al menos un rol asignado' };
      }

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
          is_active: userData.isActive ?? true
        });

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      // Asignar roles al usuario
      const assignResult = await this.assignRolesToUser(authData.user.id, userData.roleIds);
      if (!assignResult.success) {
        return { success: false, error: assignResult.error };
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
      
      // Si hay filtro por rol, primero obtener los user_ids que tienen ese rol
      let userIdsWithRole: string[] | null = null;
      if (filters?.roleId) {
        const { data: userRoles, error: roleError } = await supabase
          .from('user_profile_roles')
          .select('user_id')
          .eq('role_id', filters.roleId);

        if (roleError) {
          return { users: [], error: roleError.message };
        }

        userIdsWithRole = userRoles?.map((ur: any) => ur.user_id) || [];
        if (userIdsWithRole.length === 0) {
          return { users: [] }; // No hay usuarios con ese rol
        }
      }

      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          user_profile_roles(
            role_id,
            user_roles(*)
          )
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (userIdsWithRole) {
        query = query.in('id', userIdsWithRole);
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

      // Transformar los datos para que coincidan con el modelo
      const transformedUsers = (users || []).map((user: any) => {
        // Manejar diferentes estructuras de respuesta de Supabase
        let roles: any[] = [];
        if (user.user_profile_roles) {
          if (Array.isArray(user.user_profile_roles)) {
            roles = user.user_profile_roles
              .map((upr: any) => {
                // La estructura puede ser upr.user_roles o directamente el rol
                return upr.user_roles || upr;
              })
              .filter((r: any) => r && r.id);
          }
        }
        const roleIds = roles.map((r: any) => r.id);
        
        return {
          ...user,
          roleIds: roleIds,
          roles: roles
        };
      });

      return { users: transformedUsers };
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
      
      // Separar roleIds del resto de updates
      const { roleIds, ...profileUpdates } = updates;
      
      // Actualizar perfil si hay cambios
      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      // Actualizar roles si se proporcionaron
      if (roleIds !== undefined) {
        // Validar que tenga al menos un rol
        if (roleIds.length === 0) {
          return { success: false, error: 'El usuario debe tener al menos un rol asignado' };
        }

        const assignResult = await this.assignRolesToUser(userId, roleIds);
        if (!assignResult.success) {
          return { success: false, error: assignResult.error };
        }
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
   * Asigna roles a un usuario (reemplaza los roles existentes)
   */
  async assignRolesToUser(userId: string, roleIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!roleIds || roleIds.length === 0) {
        return { success: false, error: 'Debe proporcionar al menos un rol' };
      }

      const supabase = await this.supabaseService.getClient();

      // Eliminar roles existentes
      const { error: deleteError } = await supabase
        .from('user_profile_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // Insertar nuevos roles
      const newRoles = roleIds.map(roleId => ({
        user_id: userId,
        role_id: roleId
      }));

      const { error: insertError } = await supabase
        .from('user_profile_roles')
        .insert(newRoles);

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agrega un rol a un usuario
   */
  async addRoleToUser(userId: string, roleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();

      // Verificar si el rol ya está asignado
      const { data: existing, error: checkError } = await supabase
        .from('user_profile_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { success: false, error: checkError.message };
      }

      if (existing) {
        return { success: true }; // Ya tiene el rol asignado
      }

      // Insertar el nuevo rol
      const { error: insertError } = await supabase
        .from('user_profile_roles')
        .insert({
          user_id: userId,
          role_id: roleId
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Elimina un rol de un usuario
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();

      // Verificar cuántos roles tiene el usuario
      const { data: userRoles, error: countError } = await supabase
        .from('user_profile_roles')
        .select('id')
        .eq('user_id', userId);

      if (countError) {
        return { success: false, error: countError.message };
      }

      if (userRoles && userRoles.length <= 1) {
        return { success: false, error: 'El usuario debe tener al menos un rol asignado' };
      }

      // Eliminar el rol
      const { error: deleteError } = await supabase
        .from('user_profile_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene todos los roles de un usuario
   */
  async getUserRoles(userId: string): Promise<{ roles: UserRole[]; error?: string }> {
    try {
      const supabase = await this.supabaseService.getClient();
      const { data: userRoles, error } = await supabase
        .from('user_profile_roles')
        .select(`
          role_id,
          user_roles(*)
        `)
        .eq('user_id', userId);

      if (error) {
        return { roles: [], error: error.message };
      }

      const roles = (userRoles || [])
        .map((ur: any) => ur.user_roles)
        .filter((r: any) => r);

      return { roles: roles };
    } catch (error: any) {
      return { roles: [], error: error.message };
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
