import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';
import { SupabaseService } from './supabase.service';

interface CachedUserData {
  profile: UserProfile | null;
  permissions: string[];
  role: string | null;
  lastUpdated: number;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserCacheService {
  private supabaseService = inject(SupabaseService);
  
  private readonly CACHE_KEY = 'user_data_cache';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
  private readonly MAX_CACHE_AGE = 60 * 60 * 1000; // 1 hora máximo
  
  private cachedData$ = new BehaviorSubject<CachedUserData | null>(null);
  private isInitialized = false;

  constructor() {
    this.initializeCache();
  }

  private initializeCache(): void {
    // Cargar datos del caché al inicializar
    this.loadFromCache();
    
    // Limpiar caché cuando el usuario cierre sesión
    this.supabaseService.currentUser$.subscribe(user => {
      if (!user) {
        this.clearCache();
      }
    });
  }

  /**
   * Carga datos del usuario desde el caché local
   */
  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const data: CachedUserData = JSON.parse(cached);
        
        // Verificar si el caché no ha expirado
        if (this.isCacheValid(data)) {
          this.cachedData$.next(data);
        } else {
          this.clearCache();
        }
      }
    } catch (error) {
      console.error('Error cargando caché de usuario:', error);
      this.clearCache();
    }
  }

  /**
   * Guarda datos del usuario en el caché local
   */
  saveToCache(profile: UserProfile | null, permissions: string[], role: string | null): void {
    const now = Date.now();
    const data: CachedUserData = {
      profile,
      permissions,
      role,
      lastUpdated: now,
      expiresAt: now + this.CACHE_DURATION
    };

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      this.cachedData$.next(data);
    } catch (error) {
      console.error('Error guardando caché de usuario:', error);
    }
  }

  /**
   * Obtiene los datos del usuario desde el caché
   */
  getCachedData(): CachedUserData | null {
    return this.cachedData$.value;
  }

  /**
   * Obtiene el perfil del usuario desde el caché
   */
  getCachedProfile(): UserProfile | null {
    const data = this.getCachedData();
    return data?.profile || null;
  }

  /**
   * Obtiene los permisos del usuario desde el caché
   */
  getCachedPermissions(): string[] {
    const data = this.getCachedData();
    return data?.permissions || [];
  }

  /**
   * Obtiene el rol del usuario desde el caché
   */
  getCachedRole(): string | null {
    const data = this.getCachedData();
    return data?.role || null;
  }

  /**
   * Verifica si el caché es válido y no ha expirado
   */
  private isCacheValid(data: CachedUserData): boolean {
    const now = Date.now();
    return data.expiresAt > now && (now - data.lastUpdated) < this.MAX_CACHE_AGE;
  }

  /**
   * Verifica si hay datos válidos en caché
   */
  hasValidCache(): boolean {
    const data = this.getCachedData();
    return data !== null && this.isCacheValid(data);
  }

  /**
   * Limpia el caché
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      this.cachedData$.next(null);
    } catch (error) {
      console.error('Error limpiando caché:', error);
    }
  }

  /**
   * Refresca el caché con datos actualizados
   */
  refreshCache(profile: UserProfile | null, permissions: string[], role: string | null): void {
    this.saveToCache(profile, permissions, role);
  }

  /**
   * Obtiene el observable de datos en caché
   */
  getCachedData$(): Observable<CachedUserData | null> {
    return this.cachedData$.asObservable();
  }

  /**
   * Verifica si el usuario tiene un permiso específico en caché
   */
  hasCachedPermission(module: string, action: string): boolean {
    const permissions = this.getCachedPermissions();
    const permissionKey = `${module}:${action}`;
    return permissions.includes(permissionKey) || permissions.includes('*:*');
  }

  /**
   * Obtiene información del estado del caché
   */
  getCacheInfo(): {
    hasCache: boolean;
    isValid: boolean;
    lastUpdated: number | null;
    expiresAt: number | null;
    age: number | null;
  } {
    const data = this.getCachedData();
    const now = Date.now();
    
    return {
      hasCache: data !== null,
      isValid: data !== null ? this.isCacheValid(data) : false,
      lastUpdated: data?.lastUpdated || null,
      expiresAt: data?.expiresAt || null,
      age: data ? now - data.lastUpdated : null
    };
  }
}
