import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Verificar si ya está autenticado
    this.checkAuthStatus();
  }

  async checkAuthStatus(): Promise<void> {
    try {
      const session = await this.supabaseService.getCurrentSession();
      
      if (session) {
        this.router.navigate(['/templates']);
      }
    } catch (error) {
      console.error('Error verificando estado de autenticación:', error);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const { email, password } = this.loginForm.value;
        const result = await this.supabaseService.signInWithPassword(email, password);

        if (result.error) {
          this.errorMessage = this.getErrorMessage(result.error.message);
        } else if (result.data.user) {
          // Login exitoso
          this.router.navigate(['/templates']);
        }
      } catch (error: any) {
        this.errorMessage = 'Error inesperado. Intente nuevamente.';
        console.error('Error en login:', error);
      } finally {
        this.isLoading = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async signUp(): Promise<void> {
    if (this.loginForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const { email, password } = this.loginForm.value;
        const result = await this.supabaseService.signUp(email, password);

        if (result.error) {
          this.errorMessage = this.getErrorMessage(result.error.message);
        } else if (result.data.user) {
          this.errorMessage = 'Usuario creado exitosamente. Verifique su email para confirmar la cuenta.';
        }
      } catch (error: any) {
        this.errorMessage = 'Error inesperado. Intente nuevamente.';
        console.error('Error en registro:', error);
      } finally {
        this.isLoading = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async resetPassword(): Promise<void> {
    const email = this.loginForm.get('email')?.value;
    
    if (!email) {
      this.errorMessage = 'Ingrese su email para restablecer la contraseña.';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.errorMessage = 'Ingrese un email válido.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const result = await this.supabaseService.resetPassword(email);

      if (result.error) {
        this.errorMessage = this.getErrorMessage(result.error.message);
      } else {
        this.errorMessage = 'Se ha enviado un enlace de restablecimiento a su email.';
      }
    } catch (error: any) {
      this.errorMessage = 'Error inesperado. Intente nuevamente.';
      console.error('Error en reset password:', error);
    } finally {
      this.isLoading = false;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getErrorMessage(errorMessage: string): string {
    const errorMap: { [key: string]: string } = {
      'Invalid login credentials': 'Credenciales inválidas. Verifique su email y contraseña.',
      'Email not confirmed': 'Email no confirmado. Verifique su bandeja de entrada.',
      'Too many requests': 'Demasiados intentos. Espere unos minutos antes de intentar nuevamente.',
      'User not found': 'Usuario no encontrado.',
      'Invalid email': 'Email inválido.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
      'User already registered': 'El usuario ya está registrado.'
    };

    return errorMap[errorMessage] || 'Error de autenticación. Intente nuevamente.';
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName === 'email' ? 'Email' : 'Contraseña'} es requerido.`;
      }
      if (field.errors['email']) {
        return 'Email inválido.';
      }
      if (field.errors['minlength']) {
        return 'La contraseña debe tener al menos 6 caracteres.';
      }
    }
    
    return '';
  }
}
