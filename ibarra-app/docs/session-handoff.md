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

## Estado Fase 1 — Agente 02 Frontend Wizard & Tablas (2026-07-30)

**F02-1…F02-9 → `passing`** (UI + tests; persistencia/catálogo real pendiente de 01).

### Entregado bajo `wizard/**` y `catalogos/**`

| Área | Path |
|------|------|
| Wizard shell | `wizard/peajes-wizard.component.*` (pasos 1–9; 3–4 placeholder → 03) |
| Estado | `wizard/services/peajes-wizard-state.service.ts` (RF-25) |
| Excel | `wizard/services/peajes-excel.service.ts` + dep `xlsx` |
| Mocks | `wizard/mocks/peajes-catalogo.mock.ts`, `peajes-carga.mock.ts` |
| Pasos | `paso1-carga` … `paso9-revision` (+ `paso-placeholder` 3/4) |
| Catálogos | `catalogos/{peajes,estaciones,patentes,pases}` + home |
| Rutas fragmento | `wizard/wizard.routes.ts`, `catalogos/catalogos.routes.ts` |

### Contratos esperados de agente 01 (reemplazar mocks)

Implementar servicios reales de `peajes-services.contracts.ts`:

**`PeajesCatalogoService`** (`PEAJES_CATALOGO_SERVICE`):
- `listarPeajes` / `obtenerPeaje` / `crearPeaje` / `actualizarPeaje`
- `listarEstaciones(peajeId?)` / `crearEstacion` / `actualizarEstacion` / `sugerirEstacion(valorProveedor)`
- `listarPatentes` / `crearPatente` / `listarPases(patenteId?)` / `crearPase`

**`PeajesCargaService`** (`PEAJES_CARGA_SERVICE`):
- `validarCarga(pasadas, factura)` → `ResultadoValidacionCarga` con `ErrorValidacionPasada` (fila, columna, valor, motivo)
- `detectarDuplicados(pasadas)` clave PASE_ID+FECHA_HORA+ESTACION_ID+PATENTE_ID
- `confirmarCarga(ConfirmacionCargaInput)` → factura + pasadas + `RegistroCargaPeajes`

Sustituir providers mock en `PeajesWizardComponent` y `PEAJES_CATALOGOS_MOCK_PROVIDERS` cuando F01-* esté `passing`.

### Contratos para agente 05 (merge rutas)

No se editó `peajes.routes.ts` ni `peajes-home`. Fusionar **sin choques**:

| Origen | Export / paths | Nota |
|--------|----------------|------|
| Agente 02 | `wizard/wizard.routes.ts` → `PEAJES_WIZARD_ROUTES` | `/peajes/wizard` |
| Agente 02 | `catalogos/catalogos.routes.ts` → `PEAJES_CATALOGOS_ROUTES` | `/peajes/catalogos…` |
| Agente 03 | `plantillas/plantillas.routes.ts` → `PLANTILLAS_ROUTES_DECLARATION` / `PLANTILLAS_ROUTE_PATHS` | `/peajes/plantillas…` |

**Conflicto a resolver por 05:** tres fragmentos independientes; no hay overlap de path (`wizard` / `catalogos` / `plantillas`), pero hay que unificar estilo (`Routes[]` tipado vs string declaration de 03) y providers mock vs servicios reales de 01 (`peajes/services/*` ya existen).

Actualizar tarjetas de `peajes-home` (Asistente + Catálogos + Plantillas) para links reales (hoy “Próximamente”).

### Integración con agente 03

Pasos 3–4 consumen solo `PeajesMotorTransformacionService` + `PeajesPlantillasMockService` (sin Strategy duplicada en `wizard/**`).

### Bloqueo resuelto

- Error TS `fb used before initialization` en catálogos → corregido con `inject(FormBuilder)`.
- Suite peajes wizard+catalogos: **12 SUCCESS**.

### Verificación ejecutada

```text
ng build --configuration=development → OK
ng test --watch=false --browsers=ChromeHeadless --include="**/peajes/wizard/**/*.spec.ts" --include="**/peajes/catalogos/**/*.spec.ts" → 12 SUCCESS
```

### Commit

- Rama: `feature/peajes-mvp`
- SHA Agente 02: `0b15952`
- Sin push.

## Estado Fase 1 — Agente 03 Frontend Plantillas & Motor (2026-07-30)

**F03-1…F03-8 → `passing`** (motor + UI + mocks; persistencia real pendiente de 01).

### Entregado bajo `plantillas/**`

| Área | Path |
|------|------|
| Motor | `motor/` — StrategyRegistry, estrategias atómicas, PipelineBuilder, `PeajesMotorTransformacionService` |
| Mocks | `mocks/peajes-plantillas.mock.ts` implementa `PeajesPlantillasService` |
| Validación | `validacion/plantillas-validacion.ts` (publicar, alcance empresa) |
| UI | `plantillas-home`, `plantilla-builder`, `aplicar-plantilla`, `algoritmo-builder` |
| Specs | `motor.spec.ts`, `builder.spec.ts`, `aplicar.spec.ts`, `algoritmos.spec.ts` |
| Verify | `motor.verify.ts` (`npx tsx …` → PASS §21) |

### Contratos para agente 01 (reemplazar mock)

Implementar `PeajesPlantillasService` real (`peajes-services.contracts.ts`):

- `guardarPlantilla` / `sobrescribirConfiguraciones` (transaccional F01-7 / RN-19)
- `guardarAlgoritmo` / `expandirAlgoritmo` / listados por `empresa_id`
- Recurso global: mock usa `empresa_id === '__global__'` (`GLOBAL_EMPRESA_ID`); 01 puede mapear a flag `es_global` o empresa nula — documentar en migración

Token sugerido: `PEAJES_PLANTILLAS_SERVICE` / `PEAJES_MOTOR_TRANSFORMACION`.

### Contratos para agente 05 (merge rutas)

No se editó `peajes.routes.ts`. Fusionar rutas declaradas en `plantillas/plantillas.routes.ts`:

- `plantillas` → `PlantillasHomeComponent`
- (opcional) vistas builder/aplicar/algoritmos ya embebidas en el home por tabs

Actualizar tarjeta “Plantillas y algoritmos” en `peajes-home` para dejar de mostrar “Próximamente”.

### Contratos para agente 02 (wizard)

Consumir solo `PeajesMotorTransformacion` / `PeajesMotorTransformacionService`:

- `aplicarPipeline(filas, configuraciones, algoritmos)`
- `validarDefinicionPlantilla` / `validarCompatibilidad`
- `expandirAlgoritmo` para preview de pasos RF-30

No duplicar lógica Strategy en `wizard/**`.

### Bloqueos

1. **`ng test` (parcial)**: el bloqueo de catálogos `fb` before init fue corregido por agente 02; suite wizard+catalogos 12 SUCCESS. Evidencia F03 vía `motor.verify.ts` + build.
2. ~~**F01-3/4/7/8** aún no `passing`~~ → **resuelto por Agente 01** (ver sección siguiente). Sustituir mock UI por `PeajesPlantillasSupabaseService` (03/05).
3. Rutas plantillas no cableadas hasta merge 05.

### Verificación ejecutada

```text
npm run build -- --configuration=development  → OK
npx tsx src/app/components/peajes/plantillas/motor.verify.ts → PASS
```

## Estado Fase 1 — Agente 01 Backend Supabase (2026-07-30)

**F01-1…F01-9 → `passing`** (CLI local). Persistencia y servicios reales listos; UI 02/03 siguen con mocks hasta swap de providers (03/05).

### Entregado (alcance 01)

| Área | Path |
|------|------|
| Migraciones | `supabase/migrations/20260730*_peajes_*.sql` (5) |
| pgTAP | `supabase/tests/peajes_f01_test.sql` (30 tests) |
| Docs SQL | `docs/08-sql/peajes/F01-schema`, `docs/08-sql/peajes/F01-rpc` |
| Servicios | `src/app/components/peajes/services/*` |

### Servicios reales para Agente 02 (reemplazan mocks wizard/catálogos)

| Contrato | Implementación | RPCs / tablas |
|----------|----------------|---------------|
| `PeajesCatalogoService` | `PeajesCatalogoSupabaseService` | `.from(peajes\|estaciones\|patentes\|pases)` |
| `PeajesCargaService` | `PeajesCargaSupabaseService` | `peajes_calcular_importe_neto`, `peajes_validar_factura_pasadas`, `peajes_detectar_duplicados`, `peajes_confirmar_carga` |

Swap sugerido (05 / 02 — **01 no edita** `wizard/**` ni `catalogos/**`):

```ts
{ provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService }
{ provide: PEAJES_CARGA_SERVICE, useExisting: PeajesCargaSupabaseService }
// quitar PEAJES_CATALOGOS_MOCK_PROVIDERS / mocks de PeajesWizardComponent
```

### Servicios reales para Agente 03 (reemplazan mock plantillas)

| Contrato | Implementación |
|----------|----------------|
| `PeajesPlantillasService` | `PeajesPlantillasSupabaseService` |

- Global: **`empresa_id === '__global__'`** (`PEAJES_GLOBAL_EMPRESA_ID`, alineado a `GLOBAL_EMPRESA_ID` del mock).
- BD: `empresa_id` es **text** (no uuid).
- Listados: empresa activa **OR** `__global__`.
- RPCs: `peajes_sobrescribir_configuraciones_plantilla`, `peajes_guardar_algoritmo_combinado`, `peajes_expandir_algoritmo`, `peajes_validar_algoritmo_combinado`.

```ts
{ provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService }
```

### RPCs expuestos (CLI verificados)

| RPC | Feature |
|-----|---------|
| `peajes_calcular_importe_neto` | F01-5 |
| `peajes_validar_factura_pasadas` / `peajes_validar_factura_id` | F01-5 |
| `peajes_detectar_duplicados` | F01-6 |
| `peajes_sobrescribir_configuraciones_plantilla` | F01-7 |
| `peajes_validar_algoritmo_combinado` / `peajes_expandir_algoritmo` / `peajes_guardar_algoritmo_combinado` | F01-8 |
| `peajes_confirmar_carga` (+ tabla `registros_carga_peajes`) | F01-9 |

### Rutas

**No fusionadas por 01.** Fragmentos de 02 (`wizard.routes.ts`, `catalogos.routes.ts`) y 03 (`plantillas.routes.ts`) → merge exclusivo Agente 05.

### Pendiente / no bloqueante F01

- **Wire UI**: swap mocks → servicios reales (02/03/05). Schema/RPC **no** pendientes.
- **`system_modules` peajes**: omitido en `db reset` CLI vacío (NOTICE); aplica en DESARROLLO con host RBAC al `db push --linked` autorizado.
- **DESARROLLO / main**: sin push.

### Verificación CLI

```text
npx supabase db reset --local --no-seed → OK (5 migraciones)
npx supabase test db → PASS 30/30 (peajes_f01_test.sql)
```

### SHA / rama

- Rama: `feature/peajes-mvp` (no `main`)
- Commit Fase 0: `47e0a3f`
- Commit Agente 03 (F03): `67d2078`
- Commit Agente 02 (F02): `0b15952`
- Commit Agente 01 (F01): `76fe6943197695511cb9fa9c8df21ee397541189`
- Sin push. `main` sin cambios de Peajes Fase 1.

## Estado Fase 2 — Agente 04 Documentador (2026-07-30)

**F04-1…F04-4 → `passing`**. Documentación alineada solo a F00–F03 implementados. Sin cambios de código de producto.

### Docs creadas

| Área | Paths |
|------|-------|
| Tablas | `docs/06-tablas/peajes/{INDEX,modelo-datos,catalogos,facturas-pasadas,plantillas-algoritmos,auditoria-y-rpcs}.md` |
| Componentes | `docs/06-components/peajes/{INDEX,wizard,catalogos,plantillas-y-algoritmos,servicios-y-providers}.md` |
| Módulo + índices | `docs/modulos/peajes.md`, `docs/modulos/INDEX.md`, `docs/INDEX.md`, `docs/06-{components,tablas}/INDEX.md` |
| Bitácora | `docs/claude-progress.md` (esta sesión) |

### Hallazgo documentado (no resuelto)

- Catálogo SQL (`TRIM`, `UPPER`, …) ≠ códigos motor TS (`BORRAR_ESPACIOS`, `CONVERTIR_MAYUSCULAS`, …). Alinear o mapear en integración antes de persistir algoritmos desde UI real.

### Checklist obligatorio — Agente 05 Integrador/QA

**Completado 2026-07-30** (ver sección Fase 3 abajo).

### Docs de lectura para 05

- `docs/modulos/peajes.md` (sección Pendiente Agente 05)
- `docs/06-components/peajes/servicios-y-providers.md`
- Este handoff (Fase 1 01/02/03 + Fase 2 04)

### SHA / rama (F04)

- Rama: `feature/peajes-mvp`
- Commit Agente 04 (F04): `ffdb0f1`
- Sin push.

## Estado Fase 3 — Agente 05 Integrador/QA (2026-07-30)

**F05-1…F05-3 → `passing`**.

### Entregado

| Ítem | Resultado |
|------|-----------|
| Merge rutas | `peajes.routes.ts` → wizard + catalogos + plantillas + `PEAJES_SUPABASE_PROVIDERS` |
| Swap mocks | Catalogo/Carga/Plantillas → servicios Supabase reales |
| peajes-home | Links `/peajes/wizard`, `/catalogos`, `/plantillas` |
| Códigos SQL↔TS | Migración `20260730140000_peajes_algoritmos_catalogo_align.sql` |
| PermissionGuard | Rutas hijas peajes + match por prefijo |
| E2E §21 | `e2e-prd21.verify.ts` PASS (total 102060) |

### Verificación

```text
npm run build -- --configuration=development → OK
npx tsx src/app/components/peajes/e2e-prd21.verify.ts → PASS
npx tsx src/app/components/peajes/plantillas/motor.verify.ts → PASS
ng test --include="**/peajes/**/*.spec.ts" → 27 SUCCESS
npx supabase db reset --local --no-seed → OK (6 migraciones)
npx supabase test db → PASS 30/30
init.sh → BLOCKED (sin bash/WSL en host Windows)
```

### Pendiente (requiere autorización del usuario)

1. Push remoto de `feature/peajes-mvp` (por defecto no).
2. `npx supabase db push --linked` a DESARROLLO `kfffigvyvtzyczeiadxh` (incluye `system_modules` peajes si host RBAC existe).
3. Merge a `main` — no hacerlo sin OK explícito.

### SHA / rama (F05)

- Rama: `feature/peajes-mvp`
- Commit Agente 05 (F05): `fa26ab8`
- Sin push. `main` sin cambios de Peajes.
