# Session handoff — Módulo Peajes

> Canónico en `ibarra-app/docs/session-handoff.md`. Actualizar al cerrar cada sesión de agente.

## Estado Fase 0 (Agente 00) — 2026-07-30

**Fase 0 completada.** Habilita paralelismo de agentes **01, 02 y 03**.

### Política de rama Git (obligatoria para agentes 00–05)

| Regla | Detalle |
|-------|---------|
| Rama de trabajo | **`feature/peajes-mvp`** |
| Prohibido | Commits en `main` / `master` / `principal` |
| Prohibido | Push a principal/producción |
| Push remoto | Solo de `feature/peajes-mvp` y **solo si el usuario lo autoriza**; por defecto **no push** |
| Merge a `main` | No mergear; lo decide el usuario / Integrador con autorización explícita |

Todo el trabajo de Peajes (Fase 0 y siguientes) vive en `feature/peajes-mvp`.

### Entornos Supabase (contrato obligatorio)

| Entorno | Rol | Ref / URL |
|---------|-----|-----------|
| **Supabase CLI** | **Testing / verificación** de migraciones y SQL | `http://127.0.0.1:54321` |
| **DESARROLLO** | Remoto de desarrollo | `kfffigvyvtzyczeiadxh` → `https://kfffigvyvtzyczeiadxh.supabase.co` |

- No hay staging/prod separados en este flujo.
- Todo testing SQL → **Supabase CLI** (`npx supabase db reset --local --no-seed`, `npx supabase test db`).
- No usar MCP remoto como fuente de verdad de testing.
- **Prohibido** reutilizar refs OrdenCompra: `edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`.
- Detalle: `.agents/skills/backend-supabase-write/entornos.md`.

### Ubicación canónica de coordinación

Todo bajo `ibarra-app/`:

| Artefacto | Path |
|-----------|------|
| Protocolo agentes | `AGENTS.md` |
| Features | `feature_list.json` |
| Bitácora | `docs/claude-progress.md` |
| Este handoff | `docs/session-handoff.md` |
| PRD | `docs/plan/peaje-prd-es.md` |
| Skills | `.agents/skills/` |
| Baseline | `init.sh` |

Root `Transporte/.agents/skills/` es espejo/legacy: preferir siempre `ibarra-app/.agents/skills/`.

### Contratos TypeScript (consumir, no editar)

```
src/app/components/peajes/models/
  peajes.types.ts
  peajes.models.ts
  peajes-services.contracts.ts
  index.ts
```

Entidades: `Pasada`, `Peaje`, `Estacion`, `Patente`, `Pase`, `Factura`, `PlantillaConfiguracion`, `ConfiguracionPlantilla`, `AlgoritmoCombinado`, `AlgoritmoCombinadoPaso`.

Interfaces de servicio: `PeajesCatalogoService`, `PeajesCargaService`, `PeajesPlantillasService`, `PeajesMotorTransformacion`.

Regla de dominio: **pasada → estacion_id**; peaje derivado vía estación (no `peaje_id` en pasada).

### Integración host

- Ruta: `/peajes` (`app.routes.ts` → `loadChildren` → `peajes.routes.ts`)
- Permiso guard: `peajes:read` en `ROUTE_PERMISSIONS`
- Dashboard: tarjeta `id: 'peajes'`, `route: '/peajes'`
- Home: `PeajesHomeComponent`
- Carpetas reservadas: `wizard/`, `catalogos/`, `plantillas/`

### Preguntas abiertas — resueltas

| Pregunta | Respuesta |
|----------|-----------|
| Carpetas | `src/app/components/...` (convención del host), peajes en `components/peajes/` |
| UI kit | CSS/SCSS custom + Font Awesome; sin PrimeNG/Material/Bootstrap como kit |
| Permisos | `GranularPermissionService.accessibleModules` + match `system_modules.name` ↔ `id` tarjeta; guard vía `PermissionStateService` + `ROUTE_PERMISSIONS` |
| Supabase refs | CLI local + DESARROLLO `kfffigvyvtzyczeiadxh`; no OrdenCompra |
| SupabaseService | Expone `getClient()` + auth; servicios de peajes deben usarlo (no clientes sueltos). No hay wrapper genérico de query/RPC tipado — 01 encapsula `.from()` / `.rpc()` en servicios de dominio |

### Pendiente para agente 01

1. Migración `system_modules` name=`peajes` + permisos (patrón stock/neumáticos) para habilitar la tarjeta.
2. Migraciones de catálogos / facturas / pasadas / plantillas / algoritmos (F01-*).
3. Validar todo contra **Supabase CLI**.
4. Implementar servicios reales que cumplan las interfaces de `peajes-services.contracts.ts`.

### Pendiente para 02 / 03

- Skill: `.agents/skills/peajes-wizard-tablas` / `peajes-plantillas-builder`
- No editar `peajes.routes.ts` ni modelos; pedir merge a 05 vía este handoff
- Mocks tipados hasta F01 `passing`

### Skills presentes

- `peajes-wizard-tablas`, `peajes-plantillas-builder` (nuevas)
- `backend-supabase-write` (adaptada Peajes + entornos CLI/DESARROLLO)
- `backend-tester` (adaptada)
- `backend-documenter`, `supabase`, `supabase-postgres-best-practices` (portadas / ya en repo)
- `documentacion-proyecto` (baseline)

### Subagentes `.claude/agents/`

No encontrados en este repo en Fase 0. No bloquea 01/02/03 (usan skills + AGENTS.md). Registrar si se agregan después.

### SHA / rama

- Rama: `feature/peajes-mvp` (no `main`)
- Commit Fase 0: `47e0a3fdacd677235bce8ca7fc81c3d32d4e9c45`
- `main` permanece en `82a2802` (sin commit ni push de Fase 0)
