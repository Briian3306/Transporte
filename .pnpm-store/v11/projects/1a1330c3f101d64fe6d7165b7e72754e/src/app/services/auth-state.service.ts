import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, timer } from 'rxjs';
import { map, filter, take, timeout, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private supabaseService = inject(SupabaseService);
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  
  public isInitialized$ = this.isInitializedSubject.asObservable();
  public isAuthenticated$: Observable<boolean>;
  public currentUser$ = this.supabaseService.currentUser$;

  constructor() {
    // Combinar el estado de inicialización con el usuario actual
    this.isAuthenticated$ = combineLatest([
      this.isInitialized$,
      this.currentUser$
    ]).pipe(
      map(([initialized, user]) => initialized && user !== null)
    );

    // Marcar como inicializado después de un breve delay para permitir que Supabase se inicialice
    this.initializeAuthState();
  }

  private initializeAuthState(): void {
    // Esperar un poco para que Supabase se inicialice
    timer(100).pipe(
      take(1)
    ).subscribe(() => {
      this.isInitializedSubject.next(true);
    });
  }

  /**
   * Espera a que el estado de autenticación esté completamente inicializado
   */
  waitForAuthInitialization(): Observable<boolean> {
    return this.isInitialized$.pipe(
      filter(initialized => initialized),
      take(1),
      timeout(5000), // Timeout de 5 segundos
      catchError(() => {
        console.warn('Timeout esperando inicialización de autenticación');
        return [true]; // Continuar aunque haya timeout
      })
    );
  }

  /**
   * Obtiene el estado de autenticación de manera síncrona (solo para casos donde sabemos que está inicializado)
   */
  isAuthenticatedSync(): boolean {
    return this.isInitializedSubject.value && this.supabaseService.isAuthenticated();
  }
}
