# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-07-30 — **Fase 2 Agente 04 Documentador completada**. Listo para Agente 05 (Integrador/QA).

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

## Features

F00–F03 `passing`. **F04-1…F04-4 `passing`** (Agente 04). F05-* `not_started`.

## Registro de sesiones

### 2026-07-30 — Fase 2 Agente 04 Documentador

- Docs canónicas alineadas a implementación F01/F02/F03:
  - `docs/06-tablas/peajes/**` (modelo, catálogos, facturas/pasadas, plantillas, RPCs)
  - `docs/06-components/peajes/**` (wizard, catálogos, plantillas-y-algoritmos, servicios)
  - `docs/modulos/peajes.md` + índices (`docs/INDEX.md`, `06-*`, `modulos/`)
- Documentado gap códigos SQL catálogo ↔ `StrategyRegistry` (no inventado como resuelto).
- Checklist explícito para 05: merge rutas, swap mocks→Supabase, E2E §21, `system_modules` DESARROLLO.
- Sin cambios de código de producto.

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

### 2026-07-30 — Fase 1 Agente 02 Wizard & Tablas

- Wizard pasos 1–9 + catálogos; mocks tipados; fragmentos de rutas.
- Evidencia: build OK; ng test wizard+catalogos 12 SUCCESS.

### 2026-07-30 — Fase 0 Orquestador/Setup

- Rama `feature/peajes-mvp`; contratos, rutas home, skills, handoff.

### 2026-07-29 — Preparación multiagente

- Protocolo multiagente y `feature_list.json` iniciales.

## Bloqueos y riesgos

- `system_modules` peajes solo si existe host RBAC (DESARROLLO); CLI vacío lo omite.
- Wire UI: reemplazar mocks por servicios 01.
- Rutas wizard/catalogos/plantillas pendientes de merge 05.
- Gap códigos algoritmos SQL vs motor TS (documentado; resolver en integración).

## Próximo paso

**Agente 05 Integrador/QA:** merge rutas + providers reales + E2E §21 + evidencia F05. Push DESARROLLO solo con autorización.
