# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-07-30 — **Fase 1 Agente 03 (Plantillas & Motor) entregada**

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

No hay staging/prod separados. No reutilizar refs OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`). Agentes 01+ validan SQL contra CLI.

Decisiones vigentes:

1. Dashboard `id: 'peajes'`, ruta `/peajes`, permiso `peajes:read`.
2. Carpetas: `src/app/components/peajes/{models,wizard,catalogos,plantillas}`.
3. UI kit: CSS/SCSS + Font Awesome (patrón host).
4. Plantillas Peajes ≠ Checklists.
5. Pasada referencia `estacion_id`; peaje derivado.
6. Coordinación canónica solo en `ibarra-app/`.

## Features

F00-1…F00-4 `passing`. **F02-1…F02-9 `passing`** (Agente 02; mocks tipados; catalogos `fb` fix). **F03-1…F03-8 `passing`** (Agente 03). Persistencia real pendiente F01.

## Registro de sesiones

### 2026-07-30 — Fase 1 Agente 02 Wizard & Tablas

- Scope: `wizard/**`, `catalogos/**`. Dep `xlsx`.
- Fix TS `fb used before initialization` en catálogos → `inject(FormBuilder)` (desbloquea `ng test`).
- Wizard pasos 1–9; 3–4 consumen `PeajesMotorTransformacion` / mock plantillas 03 (sin Strategy duplicada).
- Catálogos peajes/estaciones/patentes/pases + mocks contratos 00.
- Rutas fragmento para 05 (`wizard.routes` + `catalogos.routes`); conflicto de merge anotado en handoff (sin overlap de path con plantillas).
- Evidencia: `ng build` OK; `ng test` wizard+catalogos → 12 SUCCESS.

### 2026-07-30 — Fase 1 Agente 03 Plantillas & Motor

- Scope exclusivo: `src/app/components/peajes/plantillas/**`.
- Motor Builder + Strategy: registry, 10 estrategias atómicas, PipelineBuilder, `PeajesMotorTransformacionService`.
- UI: home/builder/aplicar/algoritmos; validaciones publicar + alcance empresa.
- Mock `PeajesPlantillasMockService` (contratos 00); seed demo §21 + NORMALIZAR_PATENTE.
- Evidencia: `npm run build` OK; `npx tsx …/motor.verify.ts` PASS (§21).
- `ng test` catalogos (`fb` before init) → **corregido por Agente 02** (`inject(FormBuilder)`).
- Pedido a 05: merge rutas desde `plantillas.routes.ts`. Pedido a 01: servicio real.

### 2026-07-30 — Fase 0 Orquestador/Setup

- Rama creada: `feature/peajes-mvp` (sin commits en `main`; sin push).
- Resueltas preguntas abiertas (carpetas, UI, permisos, refs Supabase, SupabaseService).
- Registrado contrato entornos: CLI = testing, DESARROLLO = remoto.
- Skills: creadas `peajes-wizard-tablas` y `peajes-plantillas-builder`; adaptadas `backend-supabase-write` / `backend-tester` / `entornos.md`; portadas `supabase`, `backend-documenter`, `backend-tester`; baseline `documentacion-proyecto`.
- Scaffold: home, rutas, permiso, tarjeta dashboard, modelos y contratos.
- Handoff: `docs/session-handoff.md`.
- Pendiente 01: migración `system_modules` peajes + tablas dominio (validar en CLI).

### 2026-07-29 — Preparación multiagente

- Protocolo multiagente y `feature_list.json` iniciales.
- Sin código de producto Peajes en esa preparación.

## Bloqueos y riesgos

- Tarjeta Peajes queda `disabled` hasta que 01 inserte `system_modules` name=`peajes` y asigne permisos.
- `.claude/agents/` no presentes (no bloquea skills).
- Root `.agents/skills/` es legacy; canónico = `ibarra-app/.agents/skills/`.
- Rutas wizard/catalogos/plantillas pendientes de merge 05 (sin overlap de path; unificar estilo de declaración).
- Mocks frontend hasta F01 servicios reales.

## Próximo paso

Agente 01 backend; 05 integra rutas (wizard + catalogos + plantillas) y home links.
