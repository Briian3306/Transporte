import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './services/supabase.service';
import { GranularPermissionService } from './services/granular-permission.service';
import { SystemModule } from './models/system-module.model';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private granularPermissionService = inject(GranularPermissionService);
  private router = inject(Router);

  title = 'Sistema de Gestión';
  currentUser$: Observable<User | null>;
  isAuthenticated$: Observable<boolean>;
  accessibleModules$: Observable<SystemModule[]>;
  
  // Control del menú móvil
  isMobileMenuOpen = false;

  constructor() {
    this.currentUser$ = this.supabaseService.currentUser$;
    this.isAuthenticated$ = this.supabaseService.currentUser$.pipe(
      map(user => user !== null)
    );
    this.accessibleModules$ = this.granularPermissionService.accessibleModules;
  }

  ngOnInit(): void {
    // El AuthGuard ya maneja la verificación de autenticación
    // No es necesario verificar aquí también
  }

  getCurrentRole(): string | null {
    return this.granularPermissionService.getCurrentRole();
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  // Control del menú móvil
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }
}
