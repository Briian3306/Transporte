# AGENTS.md — Transporte / Ibarra App

Guía para agentes de IA que trabajan en este repositorio. Léelo antes de hacer cambios.

## Qué es este proyecto

Sistema de gestión operativa para **Transporte Ibarra**: aplicación web responsive (PWA) con Angular + Supabase.

Módulos actuales:

- **Checklists** — plantillas dinámicas, validación, historial y PDF
- **Incidentes** — registro, configuración e historial
- **Flota** — vehículos / logística
- **Neumáticos** — registro de neumáticos
- **Stock** — depósitos, entradas, salidas e historial
- **Usuarios / Roles / Permisos** — RBAC granular por módulo y acción

En planificación / MVP:

- **Peajes (Module Automation Tool)** — carga de Excel de pasadas, transformaciones, mapeo a estructura estándar, factura y persistencia. Specs en `ibarra-app/docs/plan/`.

## Estructura del repo

```
Transporte/
├── AGENTS.md                 # Este archivo
├── netlify.toml              # Deploy Netlify (base = ibarra-app)
├── netlify/functions/        # Serverless (choferes, logística, config)
└── ibarra-app/               # App Angular 19 (código principal)
    ├── src/app/
    │   ├── components/       # Componentes standalone
    │   ├── services/         # Datos, auth, PDF, permisos
    │   ├── models/           # Tipos TypeScript
    │   ├── guards/           # AuthGuard, LoginGuard, PermissionGuard
    │   ├── directives/       # Permisos en UI
    │   ├── app.routes.ts     # Rutas + PermissionGuard
    │   └── app.config.ts
    ├── src/environments/     # supabaseUrl / supabaseKey / apiUrl
    ├── supabase/migrations/  # SQL incremental de módulos
    └── docs/plan/            # PRD peajes y ejemplos MVP
```

Trabaja casi siempre dentro de `ibarra-app/`. Las funciones Netlify viven en `netlify/functions/` (ruta relativa al root del repo; ver `netlify.toml`).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Angular **19**, standalone components, RxJS, SCSS/CSS |
| Backend / DB | **Supabase** (Auth + Postgres + RLS) |
| API externa | `demo.tpteibarra.ar` (vía `environment.apiUrl` / Netlify functions) |
| PDF | pdfmake |
| Deploy | Netlify (`npm run build:prod` → `dist/ibarra-app/browser`) |
| PWA | `@angular/service-worker` |

Node 18+.

## Comandos

```bash
cd ibarra-app
npm install
npm start              # http://localhost:4200
npm run build          # build desarrollo
npm run build:prod     # build producción (Netlify)
npm test
```

Build Netlify usa `npm install --legacy-peer-deps && npm run build:prod` desde `ibarra-app`.

## Convenciones de código

### Angular

- Componentes **standalone** (`standalone: true`), no NgModules.
- Preferir `inject()` para dependencias.
- Templates/estilos en archivos aparte (`.html`, `.scss` / `.css`).
- Servicios `@Injectable({ providedIn: 'root' })`.
- Modelos en `src/app/models/`; no tipar “a ojo” en servicios si ya existe un model.
- Nuevas pantallas: componente + ruta en `app.routes.ts` + entrada en `ROUTE_PERMISSIONS` del `PermissionGuard` cuando corresponda.
- UI condicionada por permisos: `GranularPermissionService` / directivas en `directives/`.

### Datos y auth

- Acceso a Supabase solo vía `SupabaseService` (u otros servicios de dominio que lo usen). No crear clientes Supabase sueltos.
- Auth: sesión PKCE, `AuthGuard` / `LoginGuard` / `PermissionGuard`.
- Permisos: módulo + acción (`read`, `create`, `manage`, etc.). Rutas nuevas deben mapearse en `permission.guard.ts`.
- Migraciones SQL en `ibarra-app/supabase/migrations/` con prefijo de fecha (`YYYYMMDD_descripcion.sql`). No editar migraciones ya aplicadas; agregar una nueva.

### Estilo y UI

- Seguir el look existente (dashboard, formularios, paneles). No introducir un design system nuevo.
- Mantener responsive / usable en móvil (es PWA de operación).
- Textos de UI en **español**.

### Netlify Functions

- Handlers CommonJS (`exports.handler`), CORS explícito, solo métodos HTTP necesarios.
- Secretos vía `process.env` (p. ej. `API_BASE_URL`, `API_TOKEN`), no hardcodeados en funciones nuevas.

## Documentación de producto (Peajes)

Antes de implementar el módulo de peajes, leer:

1. `ibarra-app/docs/plan/peaje-prd-es.md` (fuente principal en español)
2. `ibarra-app/docs/plan/peajes-prd.md` (versión EN)
3. `ibarra-app/docs/plan/ejemplo-mvp-procesamiento-pasadas.md`

El MVP es un wizard: upload `.xlsx` → preview 10 filas → transformaciones → mapeo a columnas estándar → factura → validación → guardado en Supabase. No inventar scope fuera del PRD sin preguntar.

## Seguridad (obligatorio)

- **No** commitear ni pegar en chat claves reales, tokens de API ni service role de Supabase.
- `src/environments/environment*.ts` contienen credenciales de cliente; no ampliar exposición (no loguear keys, no copiarlas a docs).
- Preferir anon key + RLS; no usar service role en el frontend.
- No debilitar guards ni políticas RLS “para probar” en código que se vaya a commitear.

## Cómo trabajar cambios

1. Leer este archivo y el código/módulo afectado.
2. Cambios mínimos y alineados al patrón del módulo vecino.
3. Si tocas schema: migración nueva + actualizar models/services.
4. Si tocas rutas: actualizar `app.routes.ts` y `permission.guard.ts`.
5. No crear README/docs extra salvo que se pidan.
6. No hacer commit ni push salvo pedido explícito del usuario.
7. Responder en el idioma del usuario (español si escribe en español).

## Checklist rápido para features nuevas

- [ ] Componente standalone en `components/`
- [ ] Model en `models/` si hay tipos nuevos
- [ ] Service en `services/` (Supabase / API)
- [ ] Ruta + `PermissionGuard` / permisos
- [ ] Migración SQL si hay tablas nuevas
- [ ] Entrada en dashboard / navegación si el módulo debe ser visible
- [ ] Build / tipado sin errores obvios
