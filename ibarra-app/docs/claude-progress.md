# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-07-30 — **Fase 1 Agentes 01 + 02 + 03 en entrega**

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
7. Recurso global plantillas/algoritmos: `empresa_id === '__global__'`.

## Features

F00-1…F00-4 `passing`. **F01-1…F01-9 `passing`** (Agente 01, CLI). **F03-1…F03-8 `passing`** (Agente 03). Wire mock→servicio real pendiente en UI 03/05.

## Registro de sesiones

### 2026-07-30 — Fase 1 Agente 01 Backend Supabase

- Migraciones peajes (catálogos, facturas/pasadas, plantillas, algoritmos, RPC+auditoría).
- `empresa_id` como **text** + soporte `'__global__'` (contrato 03).
- Servicios: `PeajesCatalogoSupabaseService`, `PeajesCargaSupabaseService`, `PeajesPlantillasSupabaseService`.
- Evidencia: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` PASS (30/30).
- Docs: `docs/08-sql/peajes/**`. Handoff actualizado (swap mock documentado).
- DESARROLLO: sin push. `system_modules` peajes condicional (omitido en CLI vacío).

### 2026-07-30 — Fase 1 Agente 03 Plantillas & Motor

- Scope exclusivo: `src/app/components/peajes/plantillas/**`.
- Motor Builder + Strategy; mock tipado; UI builder/aplicar/algoritmos.
- Evidencia: build OK; `motor.verify.ts` PASS.
- Pedido a 01 servicio real → **entregado** (swap provider pendiente 03/05).

### 2026-07-30 — Fase 0 Orquestador/Setup

- Rama `feature/peajes-mvp`; contratos, rutas home, skills, handoff.

### 2026-07-29 — Preparación multiagente

- Protocolo multiagente y `feature_list.json` iniciales.

## Bloqueos y riesgos

- `system_modules` peajes solo si existe host RBAC (DESARROLLO); CLI vacío lo omite.
- Wire UI: reemplazar mocks por servicios 01 (`PeajesPlantillasSupabaseService`, catálogo, carga).
- Rutas wizard/catalogos/plantillas pendientes de merge 05.

## Próximo paso

Agente 05: merge rutas + providers reales. Push DESARROLLO solo con autorización.
