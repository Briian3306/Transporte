# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-07-30 — **Fase 3 Agente 05 Integrador/QA completada**. Módulo Peajes integrado en `feature/peajes-mvp`.

### Rama Git (contrato)

- Trabajo Peajes solo en **`feature/peajes-mvp`**.
- **No** commits ni push a `main`/`master`/`principal`.
- **No** merge a `main` sin autorización explícita del usuario.
- Push de la feature branch: solo si el usuario lo pide (por defecto no).

### Entornos Supabase (contrato)

| Entorno | Rol |
|---------|-----|
| **Supabase CLI** (local) | Testing / verificación obligatoria |
| **DESARROLLO** (`kfffigvyvtzyczeiadxh`) | Remoto de desarrollo |

No hay staging/prod separados. No reutilizar refs OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`).

Decisiones vigentes:

1. Dashboard `id: 'peajes'`, ruta `/peajes`, permiso `peajes:read`.
2. Carpetas: `src/app/components/peajes/{models,wizard,catalogos,plantillas}`.
3. UI kit: CSS/SCSS + Font Awesome (patrón host).
4. Plantillas Peajes ≠ Checklists.
5. Pasada referencia `estacion_id`; peaje derivado.
6. Coordinación canónica solo en `ibarra-app/`.
7. Recurso global plantillas/algoritmos: `empresa_id === '__global__'`.
8. Providers UI = servicios Supabase reales (F05); mocks solo en unit tests.
9. Catálogo SQL de algoritmos alineado a `StrategyRegistry` (F05).

## Features

F00–F05 `passing` (F05-1…F05-3).

## Registro de sesiones

### 2026-07-30 — Fase 3 Agente 05 Integrador/QA

- Merge rutas: wizard + catalogos + plantillas en `peajes.routes.ts`.
- Swap mocks → `PeajesCatalogo/Carga/PlantillasSupabaseService`.
- `peajes-home` con links reales; `ROUTE_PERMISSIONS` hijos peajes.
- Alineación catálogo SQL ↔ StrategyRegistry (migración `20260730140000_…`).
- E2E: `e2e-prd21.verify.ts` PASS (§21 + 10 filas + total 102060).
- Verificación: build OK; ng test peajes 27 SUCCESS; supabase reset + test db 30/30.
- Pendiente autorizado: `db push --linked` a DESARROLLO + `system_modules` peajes; merge a `main`.

### 2026-07-30 — Fase 2 Agente 04 Documentador

- Docs canónicas alineadas a implementación F01/F02/F03.
- Gap códigos SQL ↔ TS documentado → **resuelto por 05**.

### 2026-07-30 — Fase 1 Agente 01 Backend Supabase

- Migraciones, RPC, servicios Supabase; CLI 30/30.

### 2026-07-30 — Fase 1 Agente 03 Plantillas & Motor

- Motor Builder + Strategy; UI plantillas.

### 2026-07-30 — Fase 1 Agente 02 Wizard & Tablas

- Wizard pasos 1–9 + catálogos.

### 2026-07-30 — Fase 0 Orquestador/Setup

- Rama `feature/peajes-mvp`; contratos, rutas home, skills, handoff.

## Bloqueos y riesgos

- `system_modules` peajes solo si existe host RBAC (DESARROLLO); CLI vacío lo omite — anotar para push autorizado.
- Schema Peajes **no** está en DESARROLLO remoto hasta `db push --linked` autorizado.
- `init.sh` no ejecutable en este host Windows sin bash/WSL (evidencia F05-3).

## Próximo paso

Autorización del usuario para: (1) push rama `feature/peajes-mvp`, (2) `db push --linked` a DESARROLLO, (3) merge a `main` cuando corresponda.
