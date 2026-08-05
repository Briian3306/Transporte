# AGENTS.md — Transporte / Ibarra App

Guía para agentes de IA que trabajan en este repositorio. Léelo antes de hacer cambios.

## Protocolo de trabajo multiagente

El trabajo del módulo Peajes se coordina mediante tres artefactos:

- `ibarra-app/docs/plan/peaje-prd-es.md`: fuente de verdad funcional y de alcance.
- `feature_list.json`: estado canónico de features, dependencias, verificación y evidencia.
- `ibarra-app/docs/claude-progress.md`: bitácora de sesiones, decisiones y bloqueos.

Antes de implementar, cada agente deberá leer este archivo, el PRD de Peajes y el feature activo que le fue asignado. No deberá inventar alcance fuera del PRD ni modificar silenciosamente los criterios de verificación.

### Orden de inicio

1. Confirmar el directorio de trabajo y consultar `git status --short`.
2. Leer `AGENTS.md`, `ibarra-app/docs/plan/peaje-prd-es.md` y `feature_list.json`.
3. Leer `ibarra-app/docs/claude-progress.md` para conocer decisiones y bloqueos.
4. Revisar el código existente del área que se tocará.
5. Ejecutar la verificación base disponible desde `ibarra-app` antes de atribuir fallas al feature.
6. Marcar únicamente el feature asignado como `in_progress` y registrar la evidencia al finalizar.

### Trabajo paralelo permitido

Los agentes pueden trabajar en paralelo solo cuando sus archivos de propiedad no se solapan:

| Actor | Propiedad principal | No debe modificar |
|---|---|---|
| PM/arquitectura | PRD, dependencias y criterios | Implementación de UI/SQL sin asignación |
| Frontend de experiencia | wizard, preview y estados de carga | Migraciones y tablas |
| Frontend de configuración | editor de plantillas y algoritmos | Dashboard general y esquema SQL |
| Modelo de datos/Supabase | migraciones, RLS y modelos persistentes | Componentes visuales |
| Motor de transformación | contratos, Builder, Strategy y validaciones | Dashboard y estilos |
| QA/integración | pruebas, build y evidencia | Cambios funcionales no acordados |
| Documentación/handoff | progreso, feature list y documentación técnica | Código de producto salvo corrección documental |

Solo un agente debe ser propietario de cada archivo durante una iteración. Las decisiones que afecten a más de un dominio se registran primero en `ibarra-app/docs/claude-progress.md`.

### Skills y herramientas por tipo de trabajo

Cuando exista una skill instalada equivalente, debe leerse antes de actuar:

| Trabajo | Skill/capacidad recomendada |
|---|---|
| UI Angular, wizard, tablas y formularios | `frontend-design` + `browser:control-in-app-browser` para validación visual |
| Supabase, migraciones, RLS y persistencia | skill local de Supabase del proyecto, si está instalada; si no, seguir este AGENTS y validar localmente |
| Documentación de arquitectura y PRD | `notion:notion-spec-to-implementation` solo si la fuente está en Notion; para este repo, documentar en `docs/` y usar el PRD |
| Verificación de hojas Excel | `spreadsheets:Spreadsheets` para artefactos `.xlsx` aislados; no sustituye las pruebas del módulo |
| Scraper Telepase (scripts, no Angular) | `scripts/.agents/skills/telepase-scraper` + `playwright-cli` + `playwright-best-practices` |
| Descubrimiento de skills | `find-skills`, únicamente para localizar una skill faltante; no instalarla automáticamente |

La ausencia de una skill no bloquea el trabajo: el contrato del repositorio, el PRD y las pruebas son obligatorios y tienen prioridad.

### Definición de terminado multiagente

Una feature solo puede marcarse como `passing` cuando el comportamiento está implementado, las verificaciones de `feature_list.json` pasaron, la evidencia está registrada en `feature_list.json` y `claude-progress.md`, y la documentación afectada fue actualizada. Si falta una condición, permanece `in_progress` o `blocked`.

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

### Scripts Telepase (fuera de Angular)

Pipeline Node bajo `scripts/` para descargar facturas PDF y pasadas CSV desde Telepase. **No forma parte del runtime Angular**; no modificar `ibarra-app/` al trabajar aquí.

Coordinación propia (no usar `ibarra-app/feature_list.json` ni `claude-progress.md` de Peajes):

- `scripts/docs/telepase-downloader.md` — cómo ejecutar y requisitos
- `scripts/docs/claude-progress-script.md` — bitácora
- `scripts/feature-list-script.json` — features `TS*`
- Skill: `scripts/.agents/skills/telepase-scraper/SKILL.md`

## Estructura del repo

```
Transporte/
├── AGENTS.md                 # Este archivo
├── netlify.toml              # Deploy Netlify (base = ibarra-app)
├── netlify/functions/        # Serverless (choferes, logística, config)
├── scripts/                  # Telepase scraper (standalone; no Angular)
│   ├── telepase/             # Node package (parse + download)
│   ├── html/                 # HTML DataTables guardado
│   ├── downloads/            # PDF/CSV de salida (gitignored)
│   ├── docs/                 # docs + claude-progress-script.md
│   ├── feature-list-script.json
│   └── .agents/skills/       # skill telepase-scraper
└── ibarra-app/               # App Angular 19 (código principal)
    ├── src/app/
    │   ├── components/       # Componentes standalone
    │   ├── services/         # Datos, auth, PDF, permisos
    │   ├── models/           # Tipos TypeScript
    │   ├── guards/           # AuthGuard, LoginGuard, PermissionGuard
    │   ├── directives/       # Permisos en UI
    │   ├── app.routes.ts     # Rutas + PermissionGuard
    │   └── app.config.ts
    ├── src/environments/     # thin wrappers; secrets from .env.* via scripts/sync-env.mjs
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
- Secrets live in gitignored `.env.development` / `.env.local` / `.env.production` (see `.env.example`). Do not hardcode keys in `environment*.ts` or docs. Anon keys still ship in the browser bundle — never put service role in the frontend.
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
