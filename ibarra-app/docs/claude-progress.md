# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-08-04 — **Shared `app-dialog`**: Paso 6 «Ninguna coincide» / crear estación en modal; Paso 1 crear empresa migrado al mismo dialog.

Fecha previa: 2026-08-04 — **Bloqueo CLI post `db reset`:** `GET …/auth/v1/user` **403** → no se pueden crear patentes en Paso 5 (`pnpm dev`). Mitigación: `seed:local` + re-login (ver sesión abajo). Paso 7 factura UX ya entregado.

Fecha previa: 2026-08-04 — **Paso 7 factura UX**: `cuenta` opcional (migración + RPC); empresa SMS single locked Paso 1; fecha DRP `mode=single`.

Fecha previa: 2026-08-04 — **DataTable column filters**: `filterableColumnsInputs` + `searchableInputMain` + `clientFilter`; catálogos usan filtros por columna (labels claros). Docs shared actualizadas.

Fecha previa: 2026-08-04 — **F02-15 / F02-16 passing**: Paso 6 respeta exclusión de VIA; Paso 5 Agregar/Quitar todas. Shared DataTable / F08-1 siguen en curso.

Fecha previa: 2026-08-04 — **Bugs/features documentados (sin code fix):** F02-15 (Paso 6 ESTACION+VIA ignora exclusión de VIA) `not_started`; F02-16 (Agregar todas patentes unresolved) `not_started`. Shared DataTable / F08-1 siguen en curso.

Fecha previa: 2026-08-04 — **Shared DataTable library**: docs `docs/06-components/shared/`; `DateRangePicker` + `SearchMultiSelect`; pasadas-filters refactor; catálogos listados migrados a `app-data-table` + SMS. F08-1 sigue `in_progress`.

Fecha previa: 2026-08-04 — **F02-12 / F02-13 / F02-14 passing**: default-include columnas reconocidas; Paso 6 estaciones por empresa; Paso 5 patentes sin resolver (DataTable). En paralelo: **F08-1 in_progress**.

Fecha previa: 2026-08-04 — **F02-12 / F02-13 / F02-14 in_progress**: default-include columnas reconocidas; Paso 6 estaciones por empresa; Paso 5 patentes sin resolver (DataTable).

Fecha previa: 2026-08-03 — **F02-11 passing**: reconocimiento automático de columnas + recomendaciones Paso 2. En paralelo: **F08-1 in_progress** (gestión de pasadas).

Fecha previa: 2026-08-03 — **F02-11 in_progress**: reconocimiento automático de columnas + recomendaciones en Paso 2 (semántica → pipeline drafts). En paralelo: **F08-1 in_progress** (gestión de pasadas).

Fecha previa: 2026-08-03 — **F08-1 in_progress**: gestión de pasadas (audit cols + vista `pasadas_gestion` + RPCs list/CRUD + UI `/peajes/pasadas` + shared `DataTable`). Sin tablas nuevas.

Fecha previa: 2026-07-31 — **F02-10** y **F03-9** `passing` (pipeline editable Paso 3 + motor descriptors/deps). Baseline F00–F05 sigue `passing`.

Fecha previa: 2026-07-30 — **Fase 3 Agente 05 Integrador/QA completada**. Módulo Peajes integrado en `feature/peajes-mvp`.

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

**2026-07-31 — CLI local login/admin:** `pnpm start` → DESARROLLO; `pnpm dev` → CLI (`environment.local.ts`). Dump Auth + seed RBAC documentados en [docs/05-configuracion/cli-local-credenciales-y-permisos.md](./05-configuracion/cli-local-credenciales-y-permisos.md).

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
10. Reconocimiento de columnas (F02-11) por **semántica/aliases**, no por concesionaria; ESTACION → Paso 6.
## Features

F00–F05 `passing`. **F02-10** + **F03-9** `passing` (2026-07-31). **F02-11** `passing` (2026-08-03). **F02-12/13/14** `passing` (2026-08-04). **F02-15** + **F02-16** `passing` (2026-08-04).

## Registro de sesiones

### 2026-08-04 — Shared Dialog + Paso 6 alta estación

- **Hecho:** `app-dialog` en `shared/dialog` (eyebrow/title/body/actions, Esc/backdrop).
- Paso 6: «Ninguna coincide» / Nueva / Crear abren el modal (se quitó el bloque inline al pie).
- Paso 1: crear empresa usa el mismo dialog.
- Docs: `docs/06-components/shared/dialog.md` + INDEX / reconocimiento-estaciones / wizard.

### 2026-08-04 — Bloqueo: Auth 403 CLI + Agregar patente Paso 5

- **Síntoma (app `pnpm dev` / CLI `127.0.0.1:54321`):**
  - Consola: `GET http://127.0.0.1:54321/auth/v1/user` → **403 Forbidden**
  - Stack: `SupabaseService.getCurrentUser` → `GranularPermissionService.loadUserProfile` (también en `visibilitychange` / reinit cliente)
  - Efecto: en wizard **Paso 5** (`paso5-mapeo`) no se pueden **Agregar** / **Agregar todas** patentes unresolved (INSERT a `patentes` vía catálogo falla o no autentica).
- **Causa probable:** verificación Paso 7 corrió `npx supabase db reset --local --no-seed` → Auth local y seeds RBAC se borraron; el browser conserva sesión/JWT vieja inválida para el CLI recreado.
- **No es bug de F02-14/F02-16** (UI/bulk); es entorno CLI post-reset.
- **Mitigación (usuario / agente):**
  1. `cd ibarra-app` → `npm run seed:local` (o flujo en [cli-local-credenciales-y-permisos.md](./05-configuracion/cli-local-credenciales-y-permisos.md) § Tras un `db reset`)
  2. Cerrar sesión en la app / borrar storage del origen `localhost` / hard refresh
  3. Login de nuevo con usuario seed local
  4. Reintentar Paso 5 Agregar patente
- **Status:** documentado; fix de entorno, no de código del wizard.

### 2026-08-04 — Paso 7 factura (cuenta opcional + SMS/DRP)

- **Cuenta opcional:** migración `20260804141122_peajes_facturas_cuenta_nullable.sql`; RPC `peajes_confirmar_carga` NULLIF vacío; frontend sin `Validators.required` en cuenta.
- **Empresa:** `app-search-multi-select` `mode=single` disabled/clearable=false (empresa Paso 1).
- **Fecha:** `app-date-range-picker` `mode=single`.
- **Docs:** shared date-range/SMS, facturas-pasadas, wizard, `docs/08-sql/peajes/facturas-cuenta-opcional/`.
- **Verify:** ng test paso7+SMS+DRP **8 SUCCESS**; build OK; `supabase test db` **55 PASS** (CLI).

### 2026-08-04 — F02-15 / F02-16 (fix VIA + bulk patentes)

- **Objetivo:** (1) Paso 6 no combine ESTACION+VIA si VIA está excluida en Paso 2; (2) toolbar Agregar todas / Quitar todas sobre patentes unresolved.
- **Hecho:**
  - F02-15: `viaIncluidaEnSeleccion` en paso6; `valorEstacionProveedorDesdeFila` en state (reemplaza hardcode `387882.csv`)
  - F02-16: `agregarTodasPatentes` / `quitarTodasPatentes` (filtro rápido, errores parciales)
  - Docs: `reconocimiento-estaciones.md`, `patentes-sin-resolver.md`
- **Verify:** `ng test` paso5+paso6+wizard-state → **17 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-15 / F02-16 `passing`

### 2026-08-04 — Reportes F02-15 / F02-16 (solo documentación)

- **F02-15 (bug, sin fix):** con `557074.csv`, Paso 2 deja `ESTACION` incluida y `VIA` excluida, pero Paso 6 arma código proveedor `CAMPANA - 0003`. Causa probable: `valorEstacionProveedor` concatena ESTACION+VIA sin respetar `columnasExcluidas`. Contexto en `docs/06-components/peajes/reconocimiento-estaciones.md`.
- **F02-16 (feature, sin impl):** botón encima de la tabla de patentes unresolved para **Agregar todas** (optimizar workflow). Spec en `docs/06-components/peajes/patentes-sin-resolver.md`.
- **feature_list.json:** entradas F02-15 / F02-16 `not_started` + evidence de reporte.

### 2026-08-04 — F02-12/13/14 Wizard UX (columnas, estaciones, patentes)

- **Objetivo:** (1) Paso 2 incluir solo columnas reconocidas; (2) Paso 6 filtrar estaciones por empresa + reconocimiento + alta mínima; (3) Paso 5 resolver patentes faltantes vía DataTable Agregar/Quitar.
- **Hecho:**
  - F02-12: `aplicarSeleccionPorReconocimiento` en `setPreview`
  - F02-14: `patentesExcluidas` + DataTable unresolved (Agregar/Quitar + filtro rápido)
  - F02-13: estaciones filtradas por peajes de empresa; auto exacta; slim create (sin peaje inline); reco crear
  - Docs: `reconocimiento-estaciones.md`, `patentes-sin-resolver.md`, INDEX/wizard/testing_plan
- **Verify:** `ng test` wizard-state+paso2+paso5+paso6+recognition → **24 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-12/13/14 `passing`

### 2026-08-03 — F02-11 Reconocimiento automático de columnas (Paso 2)

- **Objetivo:** asistente de importación semántico — detectar columnas comunes (PATENTE/DOMINIO, TARIFA, BONIFICACION, FECHA+HORA, ESTACION, DISPOSITIVO) y recomendar transformaciones reutilizables con un clic en Paso 2.
- **Decisión:** reconocimiento por **semántica de columna**, no por concesionaria. ESTACION prepara Paso 6 (reconocedor de catálogo); no se inventa Strategy `RESOLVER_ESTACION`.
- **Hecho:**
  - `column-recognition.ts` (aliases + recetas) + `PeajesColumnRecognitionService`
  - State: `recomendaciones`, `aceptarRecomendacion` / `descartar` / `aceptarTodas`; `seedDemoPipelineIfEmpty` comparte recetas
  - Paso 2 rail «Asistente de importación» (Aplicar / Descartar / Aplicar todas)
  - Docs: `reconocimiento-columnas.md` + INDEX / wizard / plantillas / testing_plan §10a
- **Verify:** `ng test` column-recognition + paso2 + wizard-state → **19 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-11 `passing`

### 2026-08-03 — Empresas catalog + algoritmo UX PATENTE + docs

- **Catálogos:** card Empresas (`CATALOGOS_CARDS`), ruta `/peajes/catalogos/empresas`, peajes con dropdown empresa + crear (patrón Paso 1).
- **Algoritmos UI:** preview filas mock (estilo Paso 3), pasos guiados, botón Ejemplo PATENTE, empresa select, Guardar + plantilla `PATENTE_ID`.
- **Supabase CLI:** reparada/aplicada F06 (`20260803170620_…`); verificado `NORMALIZAR_PATENTE` (BORRAR → GUIONES → MAYÚSCULAS) y configs `→ PATENTE_ID` para Acceso Oeste y Demo. Fix SQL `UPDATE estaciones` FROM/WHERE.
- **Docs:** `guia-crear-plantillas.md`, actualización `plantillas-y-algoritmos.md` / `catalogos.md` / INDEX / F06 README.
- **Verify:** `ng build --configuration=development` OK; specs catalogos+algoritmos **6 SUCCESS**. Remoto MCP `uurlssweuhshbwpxxatw` no es DESARROLLO Peajes (sin tablas peajes) — testing solo CLI.

### 2026-07-31 — Pipeline editable Paso 3 (F02-10 / F03-9) — multiagente

- **Wave 0:** feature stubs + API contract en `session-handoff.md`.
- **Wave 1 (Grok parallel):** 03 motor (`AlgorithmDescriptor`, skip-disabled, `validarDependenciasPipeline`, `previsualizarPaso`); 02 draft state + AU fixture; 04 docs outline.
- **Wave 2 (Grok parallel):** 02 Paso3 CDK DnD editor + save/load plantilla + Paso4 `filasOrigen`; QA I-P* + `testing_plan.md` §10b; Demo **102060** / AU **132940.19**.
- **Wave 3:** Paso1 spec providers fixed; docs finalizados; features marcadas `passing`.
- **Verify:** `motor.verify.ts` PASS; `e2e-prd21.verify.ts` PASS; `npm run build` OK; `@angular/cdk@19.2.0`.
- **Docs:** `docs/06-components/peajes/pipeline-editable-paso3.md` (ya no outline).

### 2026-07-31 — Wave 0/1 outline docs — Agente 04

- Outline inicial `pipeline-editable-paso3.md` + enlaces INDEX / módulo (luego finalizado en Wave 3).

### 2026-07-30 — Rediseño wizard Peajes ↔ mockup + ejemplo MVP

- **Objetivo:** alinear UI/UX del wizard al mockup `module-automation-tool-mockup.html` y cablear el caso de `ejemplo-mvp-procesamiento-pasadas.md`.
- **Hecho:**
  - Shell + tokens CSS del mockup (stepper, content-card, status, tablas, footer).
  - Pasos 1–9 rediseñados (upload 2 columnas, chips de columnas, transform cards + preview I/O, mapeo con panel detalle, estaciones relation-layout, factura/validación cards, revisión con métricas + tabla).
  - Fixture `wizard/fixtures/mvp-ejemplo.fixture.ts` + botón **Cargar ejemplo MVP** (10 filas, selección/mapeo/factura sugeridos, total 102060).
  - Heurísticas MVP en `construirPasadasDesdeMapeo` (FECHA+HORA, patente, pase, importe neto).
  - Filtros de listado en catálogos peajes/estaciones (inputs tipo incidente-details).
- **Verificación:** `npm run build` OK.
- **Queda:** colapsar 9→7 pasos como el mockup (PRD mantiene plantilla/validación separados); editor modal de filtros del mockup; parse directo de `docs/plan/csv/1947768.xlsx` vía assets (hoy: fixture TS + upload .xlsx manual); polish plantillas F03.

### 2026-07-30 — DESARROLLO: sync historial + db push Peajes

- **Causa drift:** remoto `kfffigvyvtzyczeiadxh` tenía 6 versiones aplicadas (maquinas/sectores/stock/user_profile_roles) ausentes en `supabase/migrations/` local → `db push --linked` bloqueaba con “Remote migration versions not found”.
- **Estrategia A falló:** no había SQL hermano con esos timestamps (solo existían en `schema_migrations` remoto).
- **Acción segura:** `pnpm supabase migration fetch --linked` → recuperó los 6 SQL con los mismos version IDs. **No** se usó `migration repair --status reverted`.
- **Push:** `pnpm supabase db push --linked --yes` aplicó las 7 migraciones Peajes (`20260730125513`…`20260730150000`). Warning post-apply de cache pg-delta (timeout) — no falló el apply.
- **Verificación MCP** (`list_migrations` + `execute_sql`): 13 migraciones en remoto; `system_modules.name='peajes'` activo; roles `admin` y `administrador` tienen `peajes:read` (+ create/manage y resto de acciones del módulo); tablas peajes/estaciones/pasadas/plantillas/algoritmos presentes.
- **Next usuario:** cerrar sesión en la app / hard refresh y volver a entrar para refrescar caché de permisos JWT/UI.

### 2026-07-30 — Fix Admin acceso denegado Peajes

- **Causa raíz:** `PermissionGuard` exige `peajes:read`; F01 omitía `system_modules` peajes en CLI vacío y el alta **nunca se aplicó** a DESARROLLO → Admin tiene rol pero no `peajes:read` → `/access-denied` con “Tu rol actual: Admin”.
- **Fix:** migración repair `20260730150000_peajes_system_module_admin_permissions.sql` (idempotente; asigna peajes read/create/manage a roles `admin`/`administrador` case-insensitive; no-op si host RBAC ausente).
- CLI: `migration up --local` OK (NOTICE omit en CLI vacío). Frontend/guards ya alineados (`peajes` + `read`).
- **DESARROLLO:** aplicado vía `db push --linked` (sesión sync historial). Re-login app obligatorio.

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

- Schema Peajes **no** está en DESARROLLO remoto: `db push --linked` autorizado pero **bloqueado por ACL**.
- `init.sh` no ejecutable en este host Windows sin bash/WSL (evidencia F05-3).

### 2026-07-30 — Intento `db push --linked` DESARROLLO (BLOCKED)

- Rama: `feature/peajes-mvp`; migraciones peajes presentes (incl. `20260730150000_peajes_system_module_admin_permissions.sql`).
- Link local OK: `supabase/.temp/project-ref` = `kfffigvyvtzyczeiadxh` (proyecto “Check-list”).
- App apunta a DESARROLLO (`environment.ts`).
- **No** se usaron refs OrdenCompra.
- `npx supabase db push --linked` → **403** `LegacyDbConfigLoginRoleStatusError` (cuenta CLI sin privilegios sobre el proyecto).
- CLI/MCP listan solo proyectos OrdenCompra de otras orgs; no aparece DESARROLLO en la cuenta activa.
- Verificación SQL/MCP de `system_modules` peajes: **no posible** sin acceso.
- **Acción requerida del usuario:** login CLI (`npx supabase login`) con cuenta miembro de la org del proyecto Check-list / DESARROLLO, o invitar la cuenta actual con rol Developer+; luego reintentar `npx supabase db push --linked` desde `ibarra-app`. Tras éxito: re-login app + `/peajes`.

## Próximo paso

1. Desbloquear ACL Supabase DESARROLLO y reintentar `db push --linked`.
2. Merge a `main` solo con OK explícito del usuario.

### 2026-08-03 — F07 AUSOL: seed y reconocedor de estaciones (en curso)

- Alcance autorizado: seed idempotente desde `docs/plan/seed/ESTACIONES.xlsx`, campos geográficos de estaciones, aliases por empresa, reconocimiento confirmable y plantilla/pipeline para `docs/plan/csv/557074.csv`.
- Contrato agregado: `EstacionAliasProveedor` y `ResultadoReconocimientoEstacion`; el Paso 6 resolverá coincidencias exactas automáticamente y exigirá confirmación para sugerencias parciales antes de habilitar una estación nueva.
- El motor incorporará `REEMPLAZAR_TEXTO` como estrategia registrada, con reglas ordenadas y sin ejecución dinámica.
- Estado: `F07-1` permanece `in_progress`; no hay evidencia de migración, pruebas Angular ni Supabase CLI todavía.

### 2026-08-03 — F08-1 fix vista `pasadas_con_peaje` (CLI)

- Causa: `CREATE OR REPLACE VIEW` con `p.*` tras `ALTER` de `user_id`/`file_upload_name` → 42P16.
- Fix en migración pendiente `20260803190348`: `DROP VIEW IF EXISTS` + `CREATE VIEW` (contrato intacto).
- `npx supabase migration up --local` → aplicada OK.
- `npx supabase test db`: `peajes_f01_test.sql` ok; fallos en AUSOL/F06 (conteos seed preexistentes: REVIEW 18 vs 14, aliases F06) **no atribuibles a F08**.
- DESARROLLO no tocado.

### 2026-08-04 — Sincronización documental

- Se revisaron `feature_list.json`, `src/app/components` y la documentación existente.
- Se documentaron los módulos host y se actualizó el índice.
- Peajes queda documentado como MVP integrado: F00–F05 passing; F06-1/2/3, F07-1 y F08-1 en progreso; F06-5 no iniciado.
- Se eliminó `docs/08-sql`; las migraciones y RPC se referencian desde `supabase/migrations` y servicios.
- Riesgos: evidencia E2E Acceso Oeste/AUSOL, discrepancias de seeds/conteos, cierre de gestión de pasadas e `init.sh` en Windows.
