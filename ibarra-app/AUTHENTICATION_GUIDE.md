# Guía de Autenticación - Sistema de Neumáticos Ibarra

## Descripción General

El sistema de autenticación está implementado usando **Supabase Auth** con Angular 20, utilizando la nueva función `inject()` para la inyección de dependencias. Proporciona un inicio de sesión seguro y rápido para el sistema de gestión de neumáticos.

## Características Implementadas

### 🔐 Autenticación Completa
- **Login con email y contraseña**
- **Registro de nuevos usuarios**
- **Recuperación de contraseña**
- **Cierre de sesión seguro**
- **Persistencia de sesión**

### 🛡️ Seguridad
- **Guards de autenticación** para proteger rutas
- **Validación de formularios** en tiempo real
- **Manejo de errores** robusto
- **Tokens JWT** gestionados por Supabase

### 🎨 Interfaz de Usuario
- **Diseño moderno y responsive**
- **Validación visual** de campos
- **Estados de carga** con indicadores
- **Mensajes de error** descriptivos

## Componentes Implementados

### 1. LoginComponent (`/components/login/`)
- **Archivos**: `login.component.ts`, `login.component.html`, `login.component.scss`
- **Inyección de dependencias**: Usando `inject()` de Angular 20
- **Funcionalidades**:
  - Formulario de login con validación
  - Registro de nuevos usuarios
  - Recuperación de contraseña
  - Redirección automática después del login

### 2. SupabaseService (Modificado)
- **Archivo**: `/services/supabase.service.ts`
- **Nuevos métodos**:
  - `signInWithPassword()`
  - `signUp()`
  - `signOut()`
  - `resetPassword()`
  - `getCurrentUser()`
  - `getCurrentSession()`
  - `isAuthenticated()`

### 3. Guards de Autenticación
- **Archivo**: `/guards/auth.guard.ts`
- **Inyección de dependencias**: Usando `inject()` de Angular 20
- **Guards implementados**:
  - `AuthGuard`: Protege rutas que requieren autenticación
  - `LoginGuard`: Redirige usuarios autenticados desde la página de login

### 4. AppComponent (Modificado)
- **Archivos**: `app.component.ts`, `app.component.html`, `app.component.scss`
- **Inyección de dependencias**: Usando `inject()` de Angular 20
- **Nuevas funcionalidades**:
  - Header con información del usuario
  - Botón de logout
  - Verificación automática de autenticación
  - Navegación condicional

## Configuración de Rutas

### Rutas Públicas
```typescript
{ path: 'login', component: LoginComponent, canActivate: [LoginGuard] }
```

### Rutas Protegidas
Todas las rutas principales están protegidas con `AuthGuard`:
- `/templates` - Lista de plantillas
- `/checklist` - Nuevo checklist
- `/checklist-history` - Histórico
- `/template-config` - Configuración de plantillas

## Flujo de Autenticación

### 1. Acceso Inicial
1. Usuario accede a cualquier ruta protegida
2. `AuthGuard` verifica autenticación
3. Si no está autenticado → Redirige a `/login`
4. Si está autenticado → Permite acceso

### 2. Proceso de Login
1. Usuario ingresa credenciales en `/login`
2. `LoginComponent` valida formulario
3. `SupabaseService.signInWithPassword()` autentica
4. Si es exitoso → Redirige a `/templates`
5. Si falla → Muestra mensaje de error

### 3. Gestión de Sesión
1. `SupabaseService` mantiene estado de autenticación
2. `BehaviorSubject` notifica cambios de estado
3. Componentes reaccionan a cambios de autenticación
4. Header muestra información del usuario

## Uso del Sistema

### Para Desarrolladores

#### Verificar Estado de Autenticación
```typescript
// En cualquier componente usando inject()
export class MiComponente {
  private supabaseService = inject(SupabaseService);

  // Verificar si está autenticado
  const isAuth = this.supabaseService.isAuthenticated();

  // Suscribirse a cambios
  this.supabaseService.currentUser$.subscribe(user => {
    if (user) {
      console.log('Usuario autenticado:', user.email);
    }
  });
}
```

#### Proteger Componentes
```typescript
// En el constructor del componente
export class MiComponente {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  ngOnInit() {
    if (!this.supabaseService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }
}
```

### Para Usuarios

#### Iniciar Sesión
1. Acceder a la aplicación
2. Ser redirigido automáticamente a `/login`
3. Ingresar email y contraseña
4. Hacer clic en "Iniciar Sesión"

#### Registrarse
1. En la página de login
2. Ingresar email y contraseña
3. Hacer clic en "Registrarse"
4. Verificar email (si está configurado)

#### Cerrar Sesión
1. Hacer clic en el botón de logout en el header
2. Ser redirigido automáticamente a `/login`

## Configuración de Supabase

### Variables de Entorno
```typescript
// environment.ts
export const environment = {
  supabaseUrl: 'https://tu-proyecto.supabase.co',
  supabaseKey: 'tu-clave-publica'
};
```

### Configuración de Auth en Supabase
1. **Email Auth**: Habilitado por defecto
2. **Confirmación de Email**: Opcional
3. **Recuperación de Contraseña**: Habilitado
4. **Políticas de Contraseña**: Configurables en Supabase Dashboard

## Características de Angular 20

### Inyección de Dependencias con `inject()`
```typescript
// Antes (Angular < 20)
constructor(private service: MyService) {}

// Ahora (Angular 20)
private service = inject(MyService);
```

### Ventajas de `inject()`
- ✅ **Más limpio**: Menos código en constructores
- ✅ **Más flexible**: Puede usarse en funciones
- ✅ **Mejor tree-shaking**: Mejor optimización
- ✅ **Más legible**: Dependencias claras al inicio

## Personalización

### Estilos del Login
- Modificar `login.component.scss` para cambiar apariencia
- Colores principales: `#667eea` y `#764ba2`
- Diseño responsive incluido

### Mensajes de Error
- Personalizar en `getErrorMessage()` en `login.component.ts`
- Agregar nuevos tipos de error según necesidades

### Validaciones
- Modificar validadores en `login.component.ts`
- Agregar validaciones personalizadas según requerimientos

## Seguridad

### Mejores Prácticas Implementadas
- ✅ Validación en frontend y backend
- ✅ Tokens JWT seguros
- ✅ Persistencia de sesión controlada
- ✅ Redirección segura después del login
- ✅ Manejo de errores sin exposición de datos sensibles
- ✅ Inyección de dependencias segura con `inject()`

### Recomendaciones Adicionales
- Configurar HTTPS en producción
- Implementar rate limiting en Supabase
- Configurar políticas de contraseña robustas
- Habilitar 2FA si es necesario

## Troubleshooting

### Problemas Comunes

#### "Usuario no encontrado"
- Verificar que el email esté registrado
- Comprobar configuración de Supabase

#### "Credenciales inválidas"
- Verificar email y contraseña
- Comprobar que la cuenta esté confirmada

#### "Error de conexión"
- Verificar variables de entorno
- Comprobar conectividad a Supabase

#### "Error de inyección de dependencias"
- Verificar que se esté usando `inject()` correctamente
- Comprobar que los servicios estén marcados con `@Injectable`

### Logs de Debug
```typescript
// Habilitar logs detallados
console.log('Auth state changed:', event, session?.user?.email);
```

## Próximos Pasos

### Funcionalidades Adicionales Sugeridas
- [ ] Autenticación con Google/GitHub
- [ ] Perfil de usuario
- [ ] Cambio de contraseña
- [ ] Gestión de roles y permisos
- [ ] Sesiones múltiples
- [ ] Recordar dispositivo

### Optimizaciones
- [ ] Lazy loading de componentes de auth
- [ ] Cache de estado de autenticación
- [ ] Interceptores HTTP para tokens
- [ ] Refresh automático de tokens

---

**Nota**: Este sistema está optimizado para Angular 20 con la nueva función `inject()` y Supabase. Asegúrate de tener las dependencias correctas instaladas y la configuración de Supabase actualizada.
