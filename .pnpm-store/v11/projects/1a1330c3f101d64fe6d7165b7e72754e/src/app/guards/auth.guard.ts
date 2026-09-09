import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../services/supabase.service';
import { AuthStateService } from '../services/auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private supabaseService = inject(SupabaseService);
  private authStateService = inject(AuthStateService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Esperar a que se inicialice completamente el estado de autenticación
    return this.authStateService.waitForAuthInitialization().pipe(
      switchMap(() => this.authStateService.isAuthenticated$),
      map(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Usuario autenticado, permitiendo acceso a:', state.url);
          return true;
        } else {
          console.log('Usuario no autenticado, redirigiendo a login desde:', state.url);
          this.router.navigate(['/login'], { 
            queryParams: { returnUrl: state.url } 
          });
          return false;
        }
      }),
      catchError((error) => {
        console.error('Error en AuthGuard:', error);
        // En caso de error, redirigir al login
        this.router.navigate(['/login'], { 
          queryParams: { returnUrl: state.url } 
        });
        return of(false);
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {
  private authStateService = inject(AuthStateService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Esperar a que se inicialice completamente el estado de autenticación
    return this.authStateService.waitForAuthInitialization().pipe(
      switchMap(() => this.authStateService.isAuthenticated$),
      map(isAuthenticated => {
        if (isAuthenticated) {
          // Usuario autenticado, redirigir a la URL de retorno o dashboard
          const returnUrl = route.queryParams['returnUrl'] || '/dashboard';
          console.log('LoginGuard: Usuario autenticado, redirigiendo a:', returnUrl);
          this.router.navigate([returnUrl]);
          return false;
        }
        console.log('LoginGuard: Usuario no autenticado, permitiendo acceso al login');
        return true;
      }),
      catchError((error) => {
        console.error('Error en LoginGuard:', error);
        // En caso de error, permitir acceso al login
        return of(true);
      })
    );
  }
}
