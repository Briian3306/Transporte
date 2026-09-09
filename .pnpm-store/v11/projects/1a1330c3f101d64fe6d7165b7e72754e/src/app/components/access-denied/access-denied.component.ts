import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PermissionStateService } from '../../services/permission-state.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="access-denied-container">
      <div class="access-denied-card">
        <div class="icon-container">
          <i class="fas fa-lock"></i>
        </div>
        
        <h1>Acceso Denegado</h1>
        
        <p class="message">
          No tienes permisos para acceder a esta sección del sistema.
        </p>
        
        <div class="user-info" *ngIf="currentRole">
          <p><strong>Tu rol actual:</strong> {{ currentRole | titlecase }}</p>
        </div>
        
        <div class="actions">
          <button class="btn btn-primary" (click)="goToDashboard()">
            <i class="fas fa-home"></i>
            Ir al Dashboard
          </button>
          
          <button class="btn btn-secondary" (click)="goBack()">
            <i class="fas fa-arrow-left"></i>
            Volver Atrás
          </button>
        </div>
        
        <div class="help-text">
          <p>
            Si crees que deberías tener acceso a esta sección, 
            contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .access-denied-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .access-denied-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      width: 100%;
    }

    .icon-container {
      margin-bottom: 20px;
    }

    .icon-container i {
      font-size: 4rem;
      color: #e74c3c;
    }

    h1 {
      color: #2c3e50;
      margin-bottom: 16px;
      font-size: 2rem;
    }

    .message {
      color: #7f8c8d;
      font-size: 1.1rem;
      margin-bottom: 30px;
      line-height: 1.6;
    }

    .user-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
      text-align: left;
    }

    .user-info p {
      margin-bottom: 10px;
      color: #2c3e50;
    }

    .permissions-list {
      list-style: none;
      padding: 0;
      margin: 10px 0 0 0;
    }

    .permissions-list li {
      background: #e9ecef;
      padding: 5px 10px;
      margin: 5px 0;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
    }

    .actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-bottom: 30px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: #3498db;
      color: white;
    }

    .btn-primary:hover {
      background: #2980b9;
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: #95a5a6;
      color: white;
    }

    .btn-secondary:hover {
      background: #7f8c8d;
      transform: translateY(-2px);
    }

    .help-text {
      color: #7f8c8d;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .access-denied-card {
        padding: 20px;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class AccessDeniedComponent {
  private router = inject(Router);
  private permissionStateService = inject(PermissionStateService);

  currentRole = this.permissionStateService.getCurrentRole();
  userPermissions = this.permissionStateService.getUserPermissions();

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    window.history.back();
  }
}
