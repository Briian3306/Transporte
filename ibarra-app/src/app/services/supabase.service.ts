import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { ConnectionManagerService } from './connection-manager.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase!: SupabaseClient;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Auth state management
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private currentSessionSubject = new BehaviorSubject<Session | null>(null);
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public currentSession$ = this.currentSessionSubject.asObservable();

  constructor(private connectionManager: ConnectionManagerService) {
    // Interceptar errores de Navigator LockManager globalmente
    this.interceptNavigatorLockErrors();
    this.initializeClient();
    this.setupAuthListener();
  }

  private async initializeClient(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.createClientWithRetry();
    await this.initPromise;
  }

  private async createClientWithRetry(retries = 3): Promise<void> {
    // Deshabilitar Navigator LockManager globalmente
    this.disableNavigatorLocks();
    
    for (let i = 0; i < retries; i++) {
      try {
        this.supabase = createClient(
          environment.supabaseUrl,
          environment.supabaseKey,
          {
            auth: {
              persistSession: true, // Rehabilitado con Navigator LockManager deshabilitado
              autoRefreshToken: true,
              detectSessionInUrl: false,
              flowType: 'pkce'
            },
            global: {
              headers: {
                'X-Client-Info': 'ibarra-app'
              }
            }
          }
        );
        
        this.isInitialized = true;
        return;
      } catch (error) {
        console.warn(`Intento ${i + 1} de inicialización de Supabase falló:`, error);
        
        if (i === retries - 1) {
          throw new Error('No se pudo inicializar Supabase después de múltiples intentos');
        }
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  /**
   * Intercepta errores de Navigator LockManager globalmente
   */
  private interceptNavigatorLockErrors(): void {
    // Interceptar console.error para filtrar errores de Navigator LockManager
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Filtrar errores y warnings de Navigator LockManager
      if (message.includes('NavigatorLockAcquireTimeoutError') || 
          message.includes('lock:sb-') ||
          message.includes('acquiring an exclusive Navigator LockManager lock') ||
          message.includes('Navigator LockManager returned a null lock') ||
          message.includes('@supabase/gotrue-js: Navigator LockManager') ||
          message.includes('ifAvailable set to true') ||
          message.includes('browser is not following the LockManager spec')) {
        // No mostrar estos errores en la consola
        return;
      }
      
      // Mostrar otros errores normalmente
      originalConsoleError.apply(console, args);
    };

    // Interceptar console.warn para filtrar warnings de Navigator LockManager
    const originalConsoleWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      
      // Filtrar warnings de Navigator LockManager
      if (message.includes('Navigator LockManager returned a null lock') ||
          message.includes('@supabase/gotrue-js: Navigator LockManager') ||
          message.includes('ifAvailable set to true') ||
          message.includes('browser is not following the LockManager spec')) {
        // No mostrar estos warnings en la consola
        return;
      }
      
      // Mostrar otros warnings normalmente
      originalConsoleWarn.apply(console, args);
    };

    // Interceptar window.onerror para errores no capturados
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (message && typeof message === 'string' && 
          (message.includes('NavigatorLockAcquireTimeoutError') || 
           message.includes('lock:sb-') ||
           message.includes('Navigator LockManager returned a null lock'))) {
        // No mostrar estos errores
        return true;
      }
      
      // Llamar al handler original si existe
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      
      return false;
    };

    // Interceptar unhandledrejection para promesas rechazadas
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && 
          (event.reason.message?.includes('NavigatorLockAcquireTimeoutError') ||
           event.reason.name === 'NavigatorLockAcquireTimeoutError' ||
           event.reason.message?.includes('Navigator LockManager returned a null lock'))) {
        // Prevenir que se muestre en la consola
        event.preventDefault();
      }
    });
  }

  /**
   * Deshabilita Navigator LockManager para evitar errores de bloqueo
   */
  private disableNavigatorLocks(): void {
    try {
      // Verificar si navigator.locks existe
      if (typeof navigator !== 'undefined' && navigator.locks) {
        // Sobrescribir el método request para que no use bloqueos
        const originalRequest = navigator.locks.request.bind(navigator.locks);
        
        navigator.locks.request = function(name: string, optionsOrCallback: any, callback?: any) {
          // Determinar si es la versión con opciones o sin opciones
          const hasOptions = optionsOrCallback && typeof optionsOrCallback === 'object' && !Array.isArray(optionsOrCallback);
          const actualCallback = hasOptions ? callback : optionsOrCallback;
          const actualOptions = hasOptions ? optionsOrCallback : {};
          
          // Si es un callback, ejecutarlo directamente sin bloqueo
          if (typeof actualCallback === 'function') {
            // Simular el comportamiento de un lock exitoso
            return Promise.resolve(actualCallback({
              name: name,
              mode: actualOptions.mode || 'exclusive',
              signal: null // Simular que no hay señal de aborto
            }));
          }
          
          // Si es una promesa, resolverla directamente
          if (actualCallback && typeof actualCallback.then === 'function') {
            return actualCallback;
          }
          
          // Fallback al comportamiento original
          return originalRequest(name, optionsOrCallback, callback);
        };
        
        // También sobrescribir query si existe
        if (navigator.locks.query) {
          const originalQuery = navigator.locks.query.bind(navigator.locks);
          navigator.locks.query = function() {
            // Retornar un estado vacío para evitar problemas
            return Promise.resolve({
              held: [],
              pending: []
            });
          };
        }
        
        console.log('Navigator LockManager deshabilitado para evitar errores de bloqueo');
      }
    } catch (error) {
      console.warn('No se pudo deshabilitar Navigator LockManager:', error);
    }
  }

  /**
   * Crea un storage personalizado que evita el uso de Navigator LockManager
   */
  private createCustomStorage() {
    return {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.warn('Error al obtener item del localStorage:', error);
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.warn('Error al establecer item en localStorage:', error);
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn('Error al remover item del localStorage:', error);
        }
      }
    };
  }

  async getClient(): Promise<SupabaseClient> {
    if (!this.isInitialized) {
      await this.initializeClient();
    }
    return this.supabase;
  }

  // Auth listener setup
  private async setupAuthListener(): Promise<void> {
    try {
      const supabase = await this.getClient();
      
      supabase.auth.onAuthStateChange((event, session) => {
        this.currentSessionSubject.next(session);
        this.currentUserSubject.next(session?.user ?? null);
      });
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }
  }

  // Authentication methods
  async signInWithPassword(email: string, password: string) {
    try {
      const supabase = await this.getClient();
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (result.data.user) {
        this.currentUserSubject.next(result.data.user);
        this.currentSessionSubject.next(result.data.session);
      }
      
      return result;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signUp(email: string, password: string) {
    try {
      const supabase = await this.getClient();
      const result = await supabase.auth.signUp({
        email,
        password
      });
      
      return result;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      const supabase = await this.getClient();
      const result = await supabase.auth.signOut();
      
      this.currentUserSubject.next(null);
      this.currentSessionSubject.next(null);
      
      return result;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async resetPassword(email: string, redirectTo?: string) {
    try {
      const supabase = await this.getClient();
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || `${window.location.origin}/reset-password`
      });
      
      return result;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const supabase = await this.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const supabase = await this.getClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentSessionValue(): Session | null {
    return this.currentSessionSubject.value;
  }

  // Método para operaciones con reintento automático y gestión de conexiones
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    operationId?: string
  ): Promise<T> {
    const opId = operationId || `supabase-op-${Date.now()}-${Math.random()}`;
    
    return this.connectionManager.executeWithLock(opId, async () => {
      let lastError: any;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await operation();
        } catch (error: any) {
          lastError = error;
          
          // Verificar si es un error de bloqueo de navegador
          if (error?.message?.includes('NavigatorLockAcquireTimeoutError') || 
              error?.message?.includes('lock') ||
              error?.name === 'NavigatorLockAcquireTimeoutError') {
            
            console.warn(`Error de bloqueo detectado, reintentando... (${i + 1}/${maxRetries})`);
            
            if (i < maxRetries - 1) {
              // Esperar con backoff exponencial
              const waitTime = delay * Math.pow(2, i);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          // Si no es un error de bloqueo o se agotaron los reintentos, lanzar el error
          throw error;
        }
      }
      
      throw lastError;
    });
  }
}
