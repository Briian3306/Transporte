# Progreso de agentes — Módulo Peajes

## Fuente de verdad

> 2026-08-21 — **CLI seed pasadas DESARROLLO.** `seed:local` / `db reset --local` aplican `seed_peajes_pasadas_fks.sql` (UUID de patentes/pases/estaciones/documentos/tarifas) y luego `pasadas_rows.sql` (~8326, `ON CONFLICT (id)`). F14 sintético queda al final. pgTAP sigue con `--no-seed`. Sin `db push --linked`.

> 2026-08-21 — **F16 passing (local).** F14 (auditoría de tarifas) ya estaba en home; F16 es **Auditoría de estaciones**. Catálogos: `peajes:manage` no veía la tarjeta porque `PEAJES_HOME_SECTION_IDS` omitía `'catalogos'` y el grid filtraba `isSectionVisible('catalogos')`. Seed CLI: `seed_peajes_desarrollo.sql` (24 empresas / 22 peajes MCP); `db dump --linked` 403; pasadas 8326 no versionadas — sigue `seed_peajes_f14.sql`. pgTAP **210 PASS**. Sin `db push --linked`.

- PRD principal: `docs/plan/peaje-prd-short.md.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-09-11 — **Paso 9 review status-only flow deployed.** Paso 9 review rows now use only **No pico** / **Pico** buttons; selecting a status never writes a `Nuevo` draft nor displays the unresolved amount in `Detectado`. Save resolution reuses the active station identity for the selected status and effective direction (`AMBAS` for AMBAS stations, otherwise `IDA`), choosing the highest category; when that status is absent it uses the station's highest active category. Provider category never creates a duplicate PICO/NO_PICO identity. Migration `20260910195747_peajes_tarifario_ocultar_revision.sql` changes `peajes_listar_tarifas_actuales` to exclude parents with `current_tarifa_id IS NULL`, so review-only parents stay out of the active Tarifario. Verification: `npx supabase test db` **Files=18 Tests=590 PASS**; `tsc` app/spec passed. Focused dialog/board Karma compiled, but ChromeHeadless could not launch because of Windows encryption/GPU-cache failures before executing tests. Applied through production Supabase MCP as migration `20260911111515`; live SQL verification confirms the active list filters review-only identities. No commit.

Fecha: 2026-09-10 — **F14-20 en progreso: revalidación progresiva de precios en Paso 9.** Se agregó la migración `20260910180017_peajes_refresh_revalidacion_tarifas.sql`: matching estación + precio con tolerancia inclusiva 1%, categoría mayor y reutilización de identidad completa. El diálogo conserva borradores, agrega **Revalidar precios** y mueve a **Detectado** (solo lectura) los candidatos resueltos por catálogo o borradores de la sesión, usando categoría/status/sentido efectivos; no guarda ni cierra al revalidar. Esto corrige AUSA/PASEO DEL BAJO: $13.541,75 provisto como categorías 7, 8 o 9 se muestra en categoría 9 cuando 7–9 comparten el precio. El catálogo tiene prioridad sobre borradores y la máxima categoría ambigua permanece en revisión. Specs de diálogo/tablero agregadas; `tsc --noEmit` app+spec EXIT 0. La ejecución de Karma está bloqueada por ChromeHeadless GPU y el build de desarrollo por permisos de lectura del sandbox, ambos externos al cambio. pgTAP RED: nuevo caso categoría 2/3 mismo precio falla en el matcher anterior. La migración se aplicó en producción mediante MCP como `20260910182814_peajes_refresh_revalidacion_tarifas`; la corrección de permisos `20260910183000_peajes_refresh_revalidacion_tarifas_permissions.sql` se aplicó como `20260910182926`, dejando ambas RPC con `SECURITY INVOKER`, `search_path=public`, acceso `authenticated` y sin acceso `anon`. Verificación final local bloqueada: `supabase db reset --local --no-seed` dejó el esquema local vacío por configuración dañada de Supabase CLI (`profile`); no se usó DESARROLLO ni se hizo commit.

Fecha: 2026-09-10 — **Paso 9 precio final + REVISAR automático** (follow-up F14-19, sin schema/RPC nuevos). Extractor usa `TARIFA_PESOS` → `PRECIO` → `IMPORTE_NETO`; AUSA-V3 `20792.47` es el candidato/`precio_directo` aunque `PRECIO` sea `15872.114503816794`. Rail «Candidatos detectados» eliminado; Detectado `$20.792,47 (3)`; filas finales con selectores status/sentido; IVA checkbox solo identidades nuevas (herencia tarifario → plantilla → override). Nuevo vacío + identidad completa → `MARK_REVIEW`; Nuevo escrito → `CONFIRM_NEW`. Rama `feat/paso9-precio-final` desde `main` @ `b2b126d`. Verify: `npx supabase test db` **Files=18 Tests=589 PASS** (sin DESARROLLO); `tsc` app+spec **EXIT 0**; `ng build --configuration=development` **EXIT 0** (NG8107 Paso 9 preexistente); ng test refresh/dialog/helpers/board **103 SUCCESS**, Paso 9 **21 SUCCESS**. Browser CSV AUSA no caminado (auth/wizard; formato cubierto por specs). Docs: `refresh-tarifas-paso9.md`, `tarifario.md`. F14-16/F14-17/F14-18 evidence no reescrita. Sin commit.

Fecha: 2026-09-10 — **F14-19 `passing` (Task 13 docs + gates automatizados).** Vigencia/diagnóstico en `tarifa_importe`; refresh Paso 9 con agrupación de estaciones, CONFIRM_NEW/MARK_REVIEW, corrección de categoría y gate REVISAR. Migraciones `20260909181737`, `20260909192938`. Merge `main` @ `b2b126d` (incl. cleanup `.pnpm-store`). DESARROLLO: mismas migraciones aplicadas (MCP; historial alineado). Verify CLI: `npx supabase test db` **Files=18 Tests=589 PASS**; Angular focused refresh/Paso9/tarifario/dialog **172 SUCCESS**; `tsc` app+spec **EXIT 0**. **Browser Paso 9 / accesibilidad visual:** no recorrido (deferido, como F14-18). Docs: `docs/backend/peajes/refresh-tarifas-paso9.md`, `docs/06-components/peajes/tarifario.md`, tablas/backend `tarifas-tarifa-importe.md`. `tarifas_normalizadas` intacto.

Fecha: 2026-09-10 — **Skill `backend-supabase-write`: historial MCP vs CLI.** Companion [historial-migraciones.md](../.agents/skills/backend-supabase-write/historial-migraciones.md): list/fetch/repair timestamps, `db push --linked`, luego `pnpm seed:local`. Prohibido `apply_migration` si el archivo ya está en `supabase/migrations/`. Puntero en [backend-workflow.md](./backend/supabase/backend-workflow.md). Sin DESARROLLO. Sin commit.

Fecha: 2026-09-09 — **F14-19 registrado `in_progress` (solo baseline docs).** Título exacto: `Tarifa Refresh Dialog validity, category correction and unresolved review`. Owner `02-frontend-wizard-tablas`. depends_on F14-16, F14-17, F14-18. Plan: `docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md` (+ plan F14-18 `docs/plan/refactor-tarifas-importe/PLAN_refresh-tarifas-paso9.md`). Insertado en `feature_list.json` inmediatamente después de F14-18 y antes de F17-1. F14-16/F14-17/F14-18 status/verification/evidence no se tocaron. Sin código producto, SQL, Tasks 2–13, DESARROLLO ni commit.

HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9` (`codex/tarifa-importe-cases`). `git status --short` (antes de editar `feature_list.json` / este log):
```
 M .superpowers/sdd/progress.md
?? .pnpm-store/v11/projects/1a1330c3f101d64fe6d7165b7e72754e/docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md
?? .superpowers/sdd/task-1-f14-19-brief.md
?? ibarra-app/docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md
```

Verify baseline desde `ibarra-app` (fallas existentes, no atribuidas a F14-19): `pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/peajes/services/tarifa-refresh.service.spec.ts" --include="**/peajes/wizard/paso9-revision/**/*.spec.ts" --include="**/peajes/tarifario/**/*.spec.ts" --include="**/peajes-tarifario.service.spec.ts"` **EXIT 1** TOTAL **7 FAILED, 85 SUCCESS**. Las 7 fallas están en `paso9-revision.component.spec.ts`: `marca coincidencia histórica como informativa sin diálogo`; `masiva: confirma con rowIndexes sobre pasadasEstandarizadas, no validacion.validas concatenadas`; `no abre diálogo ni bloquea confirmar cuando el precio vigente coincide`; `incluye sentido AMBAS por defecto en el payload de confirmación`; `confirma carga y guarda pasadas + registro (mock)`; `masiva: no confirma documentos omitidos y los lista en el resumen`; `tras confirmar muestra el diálogo y al cerrarlo emite reiniciar`. `npx supabase test db` **EXIT 1** Files=17 Tests=487 FAIL. `peajes_refresh_tarifas_test.sql` Failed 4/44 tests 41–44: directional collision audit is read-only and callable; directionless refresh candidates fail closed instead of becoming AMBAS (have HISTORICAL_TARIFF_MATCH want DIRECTION_REQUIRED); station/lane direction catalogue exists; station/lane catalogue rejects inferred AMBAS (`relation "public.estaciones_vias_sentido" does not exist`). `peajes_tarifa_importe_cases_test.sql` Failed 2/16 tests 13, 16: Paso 9 writes each detected row count to its own IDA or VUELTA identity; invalid Paso 9 payload leaves both directional current pointers unchanged. Resto de archivos pgTAP ok. Sin DESARROLLO. Sin commit.

Fecha: 2026-09-08 — **F14-18 Refresh Tarifas en Paso 9 `passing` (CLI).** Migración `20260908150000_peajes_refresh_tarifas_paso9.sql`. RPCs `peajes_preparar_refresco_tarifas` / `peajes_detectar_refresco_tarifas` / `peajes_guardar_refresco_tarifas`. Helper `_peajes_tarifas_montos_candidatos` compartido; firmas F14-16 intactas. `peajes_confirmar_carga` misma firma + `pasadas.sentido` (default AMBAS). pgTAP Files=16 Tests=467 PASS. tsc app+spec EXIT 0. ng test focused TOTAL 50 SUCCESS. Tres casos SQL AUSOL CAMPANA (`557074.csv`): CURRENT 3976.59, HISTORICAL 2796.36, NEW 4771.95 NO_PICO; guardar txn 2→3 filas y ROLLBACK. Autopistas Urbanas no sembrado (VARELA 19985.09 → NEW). Paso 9 UI no caminada en browser. Docs: `docs/backend/peajes/refresh-tarifas-paso9.md`.

Fecha: 2026-09-08 — **F14-18 Refresh Tarifas en Paso 9 registrado `not_started` (solo plan).** Plan: `docs/plan/refactor-tarifas-importe/PLAN_refresh-tarifas-paso9.md`. Alcance acordado: extraer candidatos distintos de las pasadas incluidas; contrastar vigente, histórico y posible nuevo con tolerancia relativa inclusiva de 1%; resolver `sentido`; no inferir PICO/NO_PICO desde horarios; reutilizar el pipeline IVA y el tablero del Tarifario en diálogo grande sin abandonar Paso 9; exigir confirmación explícita antes de crear identidad/importes; y mostrar resumen de cambios de la importación. F14-16/F14-17 son prerrequisitos y no se modifican. Sin código producto, SQL, pruebas, DESARROLLO ni commit.

Fecha: 2026-09-08 — **F14-17 Tarifario `passing` (RPCs CLI).** Migración `20260908140000_peajes_tarifario_rpcs.sql` (cuatro INVOKER: listar actuales / editor / guardar append / historial). Provider vivo: `PeajesTarifarioSupabaseService`. Mock solo specs. `npx supabase db reset --local --no-seed` EXIT 0; `npx supabase test db` **Files=15 Tests=427 PASS**; `ng test` service **4 SUCCESS**; tarifario specs **37 SUCCESS**; `pnpm seed:local` EXIT 0 (`seed:tarifario-v2` pointer mismatches 0). Sin DESARROLLO. Sin commit.

Fecha: 2026-09-08 — **CLI local: Kong half-stack.** `npx supabase start` / `pnpm dev` sobre stack “already running” dejaba `supabase_kong_ibarra-app` Exited → login `ERR_CONNECTION_REFUSED` en `:54321`. Recuperación: `supabase stop` + `start --ignore-health-check`. `pnpm dev` y `pnpm seed:local` ahora corren `ensure-supabase-local.mjs` (skip si `/auth/v1/health` 200). `seed:local` salta `seed_auth.sql` solo si existe `francis@transporteibarra.com.ar`; siempre aplica `seed_cli_login.sql` (`Transporte2026`) y `migrate-tarifario-v2.mjs --load-local`. Skill `backend-supabase-write`: tras `db reset --local --no-seed` + `test db`, obligatorio `pnpm seed:local` (no dejar CLI vacío). Docs: [cli-local-credenciales-y-permisos.md](./05-configuracion/cli-local-credenciales-y-permisos.md) § Kong caído. Verify: Kong healthy; Studio 200; `auth.users` Francis. Sin DESARROLLO.

Fecha: 2026-09-08 — **F14-16 `passing` (Task 10 docs).** Canónicos: `docs/06-tablas/peajes/tarifas-tarifa-importe.md` + `docs/backend/peajes/tarifas-tarifa-importe.md`. Task 9 local 2026-09-08: `npx supabase start` EXIT 0; `db reset --local --no-seed` EXIT 0; `npx supabase test db` **Files=14 Tests=412 PASS**; Node ETL/matcher **53/53 skipped 0**; `ng test` adapter+validation+paso8 **35 SUCCESS**; auditoria-tarifas **52 SUCCESS**; `tsc --noEmit` app+spec EXIT 0. Paridad unexplained 0; pasadas 0/0/0 tras `--no-seed` **explicado**. Diferidos: `asociarTrasConfirmacion` no cableado post-confirm; `pwbi_tarifas_v2` LEFT JOIN puede NULL `Importe` (no clon de `pwbi_tarifas`); backfill de volumen real no probado; `_stg_precio_last` staging. `tarifas_normalizadas` se retiene. Sin DESARROLLO. Sin commit.

Fecha: 2026-09-08 — **F14-16 Task 9 verificación local (gates green; status entonces `in_progress`).** `npx supabase start` EXIT 0. `db reset --local --no-seed` EXIT 0. `npx supabase test db` **Files=14 Tests=412 PASS**. Node ETL/matcher **53 pass / 0 skip / 0 fail** (unskip `splitSentidoCollisions remaps the second sentido onto a new parent id`). `ng test` adapter+validation+paso8 **35 SUCCESS**; auditoria-tarifas **52 SUCCESS**. `tsc --noEmit` app + spec EXIT 0. Paridad Task 7: unexplained 0; pasadas 0/0/0 tras `--no-seed` **explicado**. Diferidos: `asociarTrasConfirmacion` post-confirm; LEFT JOIN null Importe en `pwbi_tarifas_v2`; v2 no es clon drop-in de `pwbi_tarifas`; backfill de volumen real no probado. Sin DESARROLLO. Sin commit. Siguiente en esa fecha: Task 10 docs.

Fecha: 2026-09-07 — **F14-17 Tarifario UI `in_progress` (mock vivo).** Listado + editor dual + historial contra `PEAJES_TARIFARIO_SERVICE` / `TarifarioMockService`. Permiso `peajes:manage`. `TARIFA_CATEGORIAS` 0–10. New vacío omitido; faltante `—`. Sin RPC, sin `peajes-tarifario.service.ts`, sin DESARROLLO. Verify: `ng test` tarifario **30 SUCCESS**; home+permission **12 SUCCESS**. Docs: `docs/06-components/peajes/tarifario.md`. Swap a Supabase bloqueado en F14-16.

Fecha: 2026-09-07 — **F14-16 registrado `in_progress` (solo docs).** Plan ejecutable: `docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`. Wave 0 / F14-11 `passing` intacto (fixtures, sin SQL). F14-12..F14-15 `not_started` + evidence: superseded by F14-16, never implemented (el contrato nuevo agrega sentido, puntero current, Cross auditado, flag IVA e historia inmutable). F14-16 es additive/shadow: `tarifas_normalizadas` permanece como camino de compatibilidad (tabla, columnas, FKs, writers, firmas RPC existentes, vistas y `pasadas.tarifa_normalizada_id`). No se elimina, renombra ni reemplaza. Sin SQL/TS. Sin DESARROLLO. Sin commit.

Fecha: 2026-09-04 — **Wave 0 dump completo → 2 CSV + Excel 2 pestañas (sin SQL).** `fixtures/tarifas.csv` (520 claves) y `fixtures/tarifas_importe.csv` (1079 importes; omite PENDIENTE). Excel: `out/tarifas-tarifas-importe.xlsx` hojas `tarifas` y `tarifas_importe`. Tests **21 PASS**. F14-11 `passing`. No DESARROLLO.

Fecha: 2026-09-04 — **[histórico]** Plan refactor `tarifas` + `tarifa_importe` (solo docs). Fuente de verdad del catálogo: `scripts/peajes-catalogo-audit/out/auditoria-catalogo-20260904.xlsx` (641 Catalogue, 116 Summary, columna `modificated`: 4 TRUE). Plan Wave 0: `docs/plan/refactor-tarifas-importe/PLAN_refactor_tarifas_importe.md`. En esa fecha Features **F14-11..F14-15** estaban `not_started`. Vigente 2026-09-07: F14-11 `passing`; F14-12..F14-15 superseded by F14-16 (never implemented); F14-16 `in_progress`. Validación: si `cluster=has_pico`, el set de categorías PICO debe ser igual al de NO_PICO (cada categoría necesita ambos `tarifas`). Bloqueo ETL: AUSA ALBERTI y AUTOPISTA DEL OESTE BRANDSEN pasaron a `has_pico` a mano y siguen solo NO_PICO. No se tocó `tarifas_normalizadas` ni DESARROLLO.

Fecha: 2026-09-02 — **`pwbi_tarifas.fecha_aparicion` (snake_case) en DESARROLLO.** La vista tenía `"Fecha_Aparicion"` quoted; SQL/`select=fecha_aparicion` no la veía. DROP+CREATE + `NOTIFY pgrst`. 1142/1142 filas con valor. Local: `20260902185000_peajes_pwbi_tarifas_fecha_aparicion.sql`; `npx supabase test db` **232 PASS**.

Fecha: 2026-09-02 — **F14-10 `fecha_aparicion` en DESARROLLO** (`kfffigvyvtzyczeiadxh`). `npx supabase db push --linked` dio **403** (CLI sin privilegios). Aplicado vía MCP `apply_migration` `peajes_tarifas_fecha_aparicion` (historial remoto `20260902194010`; archivo local `20260902163000`). Post: 1142/1142 niveles con `fecha_aparicion` (0 NULL); mismatches vs `MIN(pasadas.fecha_hora)` = 0; trigger `trg_pasadas_fecha_aparicion` OK. Rango 2025-08-21 → 2026-08-29. Sin `db reset --linked`.

Fecha: 2026-09-01 — **Excel CONFIRMAR=SI aplicado en DESARROLLO** (`kfffigvyvtzyczeiadxh`) vía RPC `peajes_confirmar_status_tarifa`. 842 niveles (277 PICO / 565 NO_PICO) + ~14810 pasadas. Excluidos: **Rutas Sur Atlántico** (0 confirmados hoy) y **6 overwrite de julio** (AUBASA Dock Sud 2/6/7, AUSA Salguero 9, AUSOL Belgrano 6, Corredores Ricchieri $6500). Fuente: `scripts/peajes-pico/out/propuesta-pico-20260831.xlsx`. El NO_PICO masivo de peajes sin hora pico **sigue sin ejecutar**.

Fecha: 2026-08-31 — **Clasificación PICO/NO_PICO (sin write a DESARROLLO).** SQL ad hoc en `supabase/scripts/`: verificación + `update_no_pico_masivo.sql` + postvalidación para peajes **sin** hora pico (preserva `confirmado_manual`). El UPDATE **no se ejecutó**. Excel propuesta ene–jul: `scripts/peajes-pico/out/propuesta-pico-20260831.xlsx` (1716 filas, columna CONFIRMAR). Autovalidación Patrón B vs julio: **123/132 = 93,2 %**. Tests: `node --test scripts/peajes-pico/classifier.test.mjs` **14 pass**. Doc: `docs/06-components/peajes/propuesta-pico-excel.md`.

Fecha: 2026-08-28 — **F18-2 en DESARROLLO** (`kfffigvyvtzyczeiadxh`). `npx supabase db push --linked` dio **403** (la cuenta CLI no tiene privilegios sobre este proyecto). Aplicado vía MCP `apply_migration` `peajes_duplicados_permitidos`; historial alineado a `20260828120000`. Post: `pasadas.duplicado boolean NOT NULL default false`; índice único parcial `pasadas_duplicado_uk WHERE (duplicado = false)`; `peajes_confirmar_carga` con `p_permitir_duplicados boolean`. Sin `db reset --linked`.

Fecha: 2026-08-28 — **F18-1 / F18-2 passing (local).** Importación masiva acepta N PDF opcionales (nombre = columna FACTURA) y Paso 7 corre IA 1→n con badges y retry de pendientes. Paso 8 muestra patente/pase por nombre + archivo + DUPLICADO; «Subir igualmente» confirma el lote. Migración `20260828120000_peajes_duplicados_permitidos.sql`: columna `pasadas.duplicado`, índice único parcial, `peajes_detectar_duplicados` enriquecido, `peajes_confirmar_carga(..., p_permitir_duplicados default false)`. La detección RN-16 corre siempre. Verify: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` → **220 PASS**; `tsc` app+spec EXIT 0; `ng test` helpers+state+queue+paso1+paso7+paso8+carga **75 SUCCESS**. Visual wizard no corrido (auth).

Fecha: 2026-08-24 — **Invoice AI Task 7 catch-up.** Code sibling Tasks 1–5 on disk. `wizard.md` documents PDF opcional, disparo post-plantilla, neto en centavos, retry, privacidad y click-to-apply (masiva fuera de alcance). **F17-1 passing**, **F17-2 passing**, **F17-3 in_progress** (sin smoke visual `/peajes/carga-express`), **F17-4 in_progress** (live OpenRouter no autorizado), **F17-5 in_progress**. Verify: `node --test peajes-invoice-ai.test.js` **10 pass EXIT 0**; fixtures test **1 pass EXIT 0**; `verify-invoice-ai-fixtures.mjs` skip EXIT 0; `ng test` ai+paso1+paso7+wizard-state **TOTAL: 47 SUCCESS**; `tsc` app+spec EXIT 0; `ng build` development EXIT 0 (NG8107 paso9 preexistente). Live no corrido. Sin commit.

Fecha: 2026-08-24 — **Invoice AI Tasks 6–7 (QA/docs).** Plan `docs/plan/invoice-ai/PLAN_invoice-ai.md`. Canonical IDs **F17-1..F17-5** (PLAN F16-1..F16-5 collide with auditoría F16-0..3). F17-1 `in_progress` (Task 1 files appeared; proxy missing). F17-2/3 `not_started`. F17-4/5 `in_progress`. Fixtures JSON + skip-live runner + `peajes-invoice-ai.fixtures.test.js`. Verify: fixtures test **1 pass EXIT 0**; runner skip EXIT 0; `peajes-invoice-ai.test.js` **Could not find … EXIT 1**; `ng test` ai+paso1+paso7 **TOTAL: 20 SUCCESS**; `tsc` app+spec EXIT 0; `ng build` development EXIT 0 (NG8107 paso9 preexistente). Live OpenRouter **not authorized**. `wizard.md` not updated (no PDF/Paso 7 IA APIs). Handoff: server owns credentials; frontend owns UI/state; **no Supabase write**. No commit.

Fecha: 2026-08-21 — **CLI seed F14 + login**. `db reset --local` aplica `seed_auth` → `seed_cli_login` (francis@transporteibarra.com.ar password CLI) → `seed_rbac_schema`/`seed_rbac` → `seed_peajes_f14` (80 pasadas sintéticas, peaje CLI Auditoría tarifas). Verify: reset OK; login GoTrue local OK; tarifas 4 niveles (PICO 3000 POSIBLE_HORARIO + 3 CATEGORIA). pgTAP sigue con `--no-seed`.

Fecha: 2026-08-21 — **F14-0/F14-3/F14-4 gap-fill agente 02**. Contrato CATEGORIA ya ok. Wizard: descartar `rec-categoria` excluye columna y limpia mapeo (Patrón A). Auditoría: expand al click de fila padre, `POSIBLE_HORARIO` en botones de catálogo, sticky estación y layout móvil `at__` bajo 720px. Verify: `tsc` app OK; wizard-state + column-recognition + paso5 + auditoria-tarifas **90 SUCCESS**. Suite wizard completa **129 SUCCESS / 5 FAILED** (carga-express conteo de pasos y specs Paso 6 preexistentes). Persistencia `categoria` ya está en `PeajesCargaSupabaseService` (01). **F14-6 no cerrado.** Sin commit/push.

Fecha: 2026-08-21 — **F14-1/F14-2 gap-fill agente 01 (CLI)**. Checklist §7.1: tablas/RPC/índices/RLS/UTC ya estaban; hueco real = hook SQL. Migración `20260821141019_peajes_confirmar_carga_hook_normalizar.sql`: `peajes_confirmar_carga` llama `peajes_normalizar_tarifas` por documento (firma pública intacta; `EXCEPTION` no revierte carga válida). Angular conserva `.rpc` idempotente hasta push DESARROLLO. Verify: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` → **198 PASS**; `ng test` peajes-carga **1 SUCCESS**. Advisors: `security_definer_view` en `pwbi_*` preexistente. **No** `db push --linked`. **F14-6 no cerrado.**

Fecha: 2026-08-21 — **Plan F16 corregido: persistencia Paso 6 + auditoría con estados**. Plan: `docs/plan/auditoria-reconocimiento-estaciones/PLAN_auditoria-reconocimiento-estaciones.md`. Ola 0: F16-0 (`00`, contrato); ola 1 en paralelo: F16-1 (`01`, casos/RPC/pgTAP/servicio) y F16-2 (`02`, Paso 6 + UI); ola 2: F16-3 (`04` documentación y `05` integración/QA). La regresión principal es guardar una relación, recrear Paso 6 y continuar sin volver a seleccionar, usando la clave canónica `0001=1`/`0003=3`. Los casos persisten por fingerprint con estados PENDIENTE, VALIDADO, DESCARTADO, REQUIERE_CORRECCION y CORREGIDO para no revisar lo mismo. `['3','5']` es válido: solo alerta con perfil secuencial (p. ej. `1,2,3,5` ⇒ falta `4`). La auditoría no toca Paso 6: una corrección confirmada puede prevenir futuros movimientos vía catálogo/alias y, con preview/confirmación adicional, corregir las pasadas históricas exactas y dejar trazabilidad. Todas las features quedan `not_started`; UUID como fixtures locales y DESARROLLO solo lectura.

Fecha: 2026-08-19 — **F02-18 Paso 5 blockers + último pase por patente**. `PASE_ID` deja de ser obligatorio en mapeo; Paso 8 toma `pases.created_at` más reciente de la `patente_id` (sin crear pase con el texto de la placa). Sin `PRECIO` y con `IMPORTE_NETO`, se completa el precio. Continuar en Paso 5 permanece clicable y la tira «Para avanzar» nombra destinos. Verify: `ng test` paso5+paso8+ultimo-pase+plantilla-apply **27 SUCCESS** (ChromeHeadless). Docs `wizard.md` + `validacion-carga.md`.

Fecha: 2026-08-18 — **`pwbi_pasadas.Categoria_Calculated`**. Si `Categoria` es NULL (Patrón A), la vista copia `tarifas_normalizadas.categoria_calculated` (0–10) y `Categoria_Calculated_Boolean = TRUE`; si hay categoría de proveedor, calculated queda NULL y el boolean es FALSE. Migración `20260818144011_peajes_pwbi_pasadas_categoria_calculated.sql`. M de Power BI actualizado. `db push --linked` DESARROLLO: 4900 pasadas; 2860 TRUE (clase rellenada); 2040 FALSE. Docker local apagado: pgTAP CLI pendiente.

Fecha: 2026-08-18 — **Bugfix auditoría PICO/NO_PICO + CAT**. El panel ya no pisa la clasificación ni la clase 0–10 con la sugerencia por precio al recargar. Status guardado (≠ `PENDIENTE`) y ediciones manuales se conservan; Asignar status envía `NO_PICO`/`PICO` y `categoria_calculated`. Search-select deja la opción actual visible y rankea `PICO` exacto sobre «No pico». Sello CAT: vacío = «Sin clase», filled = CAT + dígito. Verify: `ng test` auditoria-tarifas **49/49 SUCCESS** (ChromeHeadless); search-select **9/9 SUCCESS**.

Fecha: 2026-08-18 — **Power Query M con tipos**. `docs/05-configuracion/powerbi-supabase.md`: cada consulta `pwbi_*` expande columnas por nombre y aplica `Table.TransformColumnTypes` (texto, `datetimezone`, `date`, `number`, `Int64`, `logical`, cultura `en-US`). Sin eso el JSON deja fechas como texto e importes como `Any`.

Fecha: 2026-08-18 — **Power BI `pwbi_tarifas` + `Estacion_Geocodificacion_Status`**. Vista dimensión desde `tarifas_normalizadas` (`Status` PICO/NO_PICO; sin `Tipo_Meta`; `Hora_Min`/`Hora_Max`/`Hora_Media`). `pwbi_pasadas` suma `Estacion_Geocodificacion_Status` (`OK`|`REVIEW`). Relación Power BI: `Tarifa_Normalizada_ID`. CLI: migración `20260818131012_peajes_pwbi_tarifas.sql`; `db reset --local --no-seed` OK; `npx supabase test db` → **187 PASS**. `db push --linked` → DESARROLLO `kfffigvyvtzyczeiadxh`: vista 304 filas; `pwbi_pasadas` 4900; anon SELECT OK; sin `Tipo_Meta`. Refrescar Power BI y agregar tabla `pwbi_tarifas`.

Fecha: 2026-08-18 — **Catálogo PICO/NO_PICO en DESARROLLO**. `db push --linked` aplicó `20260818125312_peajes_tarifas_status_catalogo_default.sql` a `kfffigvyvtzyczeiadxh`. Post: **22/22 peajes** tienen PICO + NO_PICO (incl. Autovía del Mercosur). Recargar `/peajes/auditoria-tarifas` para ver el select. Zárate (8 precios) no muestra «Reconocimiento detectado»; asignar status por nivel.

Fecha: 2026-08-14 — **F14-9 categoria_calculated (Patrón A)**. Columna opcional `tarifas_normalizadas.categoria_calculated` smallint 0–10. `peajes_confirmar_status_tarifa` acepta la clave (sin ella conserva el valor); listar la expone; recálculo no la pisa. UI: sello CAT en la familia, solo Patrón A. CLI: migración `20260814204300_peajes_tarifas_categoria_calculated.sql`; `peajes_f14_test.sql` **42/42**; `ng test` auditoria-tarifas **45/45**. `db push --linked` → DESARROLLO `kfffigvyvtzyczeiadxh` aplicó la migración. Confirming PICO/NO_PICO no exige clase.

Fecha: 2026-08-14 — **Recalcular prune huérfanos (DESARROLLO aplicado)**. `peajes_recalcular_tarifas` DELETE niveles sin pasadas FC. CLI: `20260814190600_peajes_recalcular_prune_orphans.sql`; `peajes_f14_test.sql` **ok** (plan 34). `db push --linked` → migración aplicada. Recalc AUBASA `ab449656-…` (0 pasadas upsert; prune) + Mercosur `cc292b0a-…` (0). DOCK SUD: **23536.62 / 28243.94 y 6 huérfanos más desaparecieron**; quedan 7 niveles con pasadas (cat 2/6/7 + 1 Patrón A 14370.19). AUBASA: 38 niveles, 0 huérfanos, 0× `23536.62`. Recargar `/peajes/auditoria-tarifas`.

Fecha: 2026-08-14 — **F02-17 código `0001` Zarate vs DOCK SUD (wizard)**. Paso 1 empresa acota `reconocerEstacion` (aliases + `codigos_proveedor`, `1` ≡ `0001`). Sin empresa, código compartido = sugerencias (no el primero). Plantilla que restaura estación de otra empresa no salta a Factura: Paso 6 descarta el id y reconoce de nuevo. UI: recuadro «La empresa cierra el peaje». Verify: `ng test` helpers+paso1+paso6+plantilla-apply **26 SUCCESS**. Docs `reconocimiento-estaciones.md`. Data fix DESARROLLO 244 pasadas (sesión previa) intacto.

Fecha: 2026-08-14 — **MERCOSUR `0001` → Zarate (data)**. DESARROLLO: 244 pasadas (`86802`/`86803`/`79158`) `estacion_id` DOCK SUD → Zarate `c9ed477b-11e7-4698-a81d-97813a9ae538`; `peajes_recalcular_tarifas` Mercosur 244 + AUBASA 0 (niveles `cases` upsert). Prevención de wizard: **F02-17** (entrada de arriba).

Fecha: 2026-08-14 — **Autovía del Mercosur Patrón B→A**. CSV Telepase `CATEGORIA` no coincide con la clase tarifaria (cat `7` = 5×/6×/7×/9×). Backup `supabase/mercosur-patron-b-backup.local.sql`. CLI: migración `20260814180732_peajes_mercosur_plantillas_patron_a.sql`; pgTAP `peajes_mercosur_patron_a_test.sql` **13/13** (+ F14 51 tests PASS). DESARROLLO: 4 plantillas `MERCA-SUR-*` excluyen CATEGORIA; 1191 pasadas `categoria NULL`; 15 niveles B borrados; `peajes_recalcular_tarifas` → 15 niveles Patrón A (CATEGORIA 11 / MUESTRA_INSUFICIENTE 4). Fingerprint `importe_neto` intacto (`9737e20f…`, Σ 14682935.92). **15/15 documentos** `peajes_validar_documento_id` valido (máx diff $4.97 ≪ 1%). AUSA-8-2026 sigue Patrón B. Historial alineado: `migration repair --status reverted` de timestamps MCP `20260813122703` / `20260813182717` / `20260813195804`; `--status applied` de `20260813100000` / `20260813182631` / `20260813195728` / `20260814180732`. `db push --linked` → **Remote database is up to date.**

Fecha: 2026-08-14 — **Auditoría tarifas: Reconocimiento detectado**. En familias de exactamente dos precios, el panel muestra el recuadro «Reconocimiento detectado»: más bajo → No Pico, más alto → Pico, y `confirmarStatus` deja `diagnostico = CONFIRMADO`. Si el usuario toca ambos selects y deja esa misma asignación, se confirma solo (no con la propuesta automática ni si están invertidos). Tests helpers + familia-panel.

Fecha: 2026-08-13 — **empresas.tarifa_url**: columna en `empresas` + CHECK http(s). Seed AUSA `https://www.ausa.com.ar/sections/tarifas.html`. En auditoría, el nombre del peaje abre esa URL y el lápiz la edita (`actualizarEmpresa`). Migración `20260813195728_peajes_empresas_tarifa_url.sql` aplicada en DESARROLLO vía MCP. pgTAP `peajes_empresas_tarifa_url_test.sql`.

Fecha: 2026-08-13 — **Bugfix preview FILTRAR_COLUMNA (0003/0004)**: Paso 3 ya no limita el preview a las primeras 10 filas del Excel cuando hay filtro; escanea `filasOrigen` hasta reunir ~10 filas que pasan. Mensaje vacío distingue “sin archivo” vs “filtro sin matches”. Tests paso3 agregados.

Fecha: 2026-08-13 — **Paso 6 empresa≠AUBASA**: ya no se hace fallback al catálogo global cuando la empresa no tiene peajes. Seed DESARROLLO peaje **Autovía del Mercosur** + estaciones `0001`–`0004` para empresa `37ab9246-…`. Acciones: **Cambiar estación** / **Crear estación**. Tests paso6 **11/11**.

Fecha: 2026-08-13 — **Bugfix FILTRAR_COLUMNA → Paso 6**: motor conserva columnas origen; `construirPasadasDesdeMapeo` / `filasParaReconocimientoEstaciones` usan set filtrado (no rezip a `filasOrigen`); Paso 3 sin salida Structure Goal (`PASADA_ID`) y aplica pipeline al Continuar; preview no rezip por índice. Tests: **52 SUCCESS**.

Fecha: 2026-08-13 — **F14-8 Ver casos en DESARROLLO**: `peajes_listar_pasadas` ya filtra `tarifa_normalizada_id`. Aplicado en `kfffigvyvtzyczeiadxh` (`20260813175138`). Smoke PASEO DEL BAJO 9731.46: **total 6** (antes 3465). Recargar la pantalla y volver a abrir Ver casos.

Fecha previa: 2026-08-13 — **F14-8 passing**: plantillas de la tabla anidada usan `appDataTableColumn="clave"` (el `key=` dejaba Clasificación como texto crudo y Franja vacía). Select buscable PICO/NO_PICO; franja `HH:mm – HH:mm` desde `hora_min`/`hora_max`; **Ver casos** abre pasadas del nivel. Migración `20260813175138_peajes_listar_pasadas_tarifa_normalizada.sql` (filtro `tarifa_normalizada_id`). Verify: `tsc` app+spec EXIT 0; `ng test` auditoria-tarifas **29/29**.

Fecha previa: 2026-08-13 — **F14-8 refactor UI de auditoría tarifaria en curso**: se restauró la expansión inline de familias con `expandedId` y `app-tarifa-familia-panel`, alineada con la tabla de referencia. Cada nivel expone selección PICO/NO_PICO y el panel agrega `Asignar status`; `CONFIRMADO` se filtra porque es diagnóstico posterior, no clasificación tarifaria. Verificación TypeScript app/specs OK. Pendiente ejecutar Karma/ChromeHeadless (el entorno Windows presenta fallo GPU) y validar manualmente la interacción.

Fecha: 2026-08-13 — **F14-7 plantillas CATEGORIA (Patrón B)**: migración `20260813100000_peajes_plantillas_mapeo_categoria.sql` activa mapeo `CATEGORIA→CATEGORIA` (`excluida=false`) en 7 plantillas Telepase DESARROLLO (`kfffigvyvtzyczeiadxh`). Pre: todas `cat_activa=0`; post: **7/7 Telepase `cat_activa=1`**, MASIVOOO=0. Sin tocar `pasadas` (ConsumosResumen 1711 null; Telepase 1750; tarifas 281). Verify: `ng test` plantilla-apply **3/3** + paso5 **8/8**; pgTAP `peajes_f14_plantillas_categoria_test.sql`. **F14-7 → passing**. Pendiente §6.2 wizard smoke manual (AUSA CSV + MASIVOOO).

Fecha previa: 2026-08-13 — **F14-6 local verify suite (agente 05)**: `tsc` EXIT 0; `ng test` auditoria-tarifas **14/14** + peajes/** **178/178**; `clasificacion.verify.ts` ZARATE **5/5** (NO_PICO,PICO,PICO,PICO,PICO); `motor.verify.ts` + `e2e-prd21.verify.ts` PASS; `supabase test db` **144 PASS**. Sin `db reset --linked`. **F14-6 → in_progress** (recalc/reconcile DESARROLLO + E2E manual confirmación PICO/NO_PICO: sibling).

Fecha previa: 2026-08-13 — **F14-6 DESARROLLO recalc + reconcile (medio camino)**. Project-ref `kfffigvyvtzyczeiadxh` confirmado. `peajes_recalcular_tarifas` ejecutado para los 9 peajes con pasadas vía MCP `execute_sql` (sin `db reset --linked`). Resultado: `tarifas_normalizadas` **0 → 281**; **3465/3465** pasadas FC `precio>0` con `tarifa_normalizada_id`. ConsumosResumen **1015+696=1711**; cero cargas `202607-2`. Patrón A confirmado (1711 `categoria IS NULL`); Telepase 1750 con categoría backfill. `tarifas_status_catalogo` 18 filas (PICO/NO_PICO × 9 peajes). Diagnóstico: MUESTRA_INSUFICIENTE 220 · CATEGORIA 27 · REVISAR 25 · POSIBLE_HORARIO 6 · TARIFA_UNICA 3. `pasadas.tarifa_status`: PENDIENTE 3273 · POSIBLE_HORARIO 192. CSV 119: **117/119** keys matched; **116/117** cases exactos (único gap ZARATE 1500: 89 vs CSV 114); ZARATE 5 niveles CATEGORIA; desvío UTC 4/5 ±0.01. `pwbi_pasadas.Tarifa_Status` OK. **F14-6 → in_progress** (falta ng test local + E2E confirmación manual PICO/NO_PICO). R1 CSV `PATRON=B` pendiente PO; R2 NC `0104-00077675`.

Fecha previa: 2026-08-12 — **DESARROLLO `db push --linked` F14 + FILTRAR_COLUMNA** (autorizado; sin `db reset --linked`). Project-ref confirmado `kfffigvyvtzyczeiadxh`. Previo local: `db reset --local --no-seed` OK; `npx supabase test db` → **144 PASS** (incl. `peajes_f14_test`). Dry-run + push aplicaron 8 migraciones aditivas: `20260811190002_peajes_algoritmo_filtrar_columna`, `20260812140628`…`20260812140653` (tablas `tarifas_*`, columnas `pasadas.categoria`/`tarifa_*`, 6 RPC, vistas recreadas). Verify remoto no destructivo: tablas/columnas/RPC + `FILTRAR_COLUMNA` en catálogo + 8 versiones en `schema_migrations`. **F14-6** sigue `not_started` (QA dataset 1711/119 no corrido en esta sesión).

Fecha previa: 2026-08-12 — **F14-3 + F14-5**: wizard detecta `CATEGORIA` (aliases `CATEGORIA`/`CATEG`/`CLASE`/`TIPO VEHICULO`/`CATEGORIA VEHICULO`); `rec-categoria` sin pipeline; MVP/AU incluyen y mapean `CATEGORIA` (Patrón B en fixtures); Paso 5 marca opcionales; payload `categoria` trim ya en carga (F14-2). Docs: reconocimiento-columnas/estaciones, `auditoria-tarifas.md`, `tarifas-normalizadas.md`, wizard/módulo/INDEX. Verify: `tsc` EXIT 0; `ng test` wizard/**/*.spec.ts + peajes-carga → **96 SUCCESS**. **F14-0..F14-5 → passing**. Abierto: F14-6 dataset DESARROLLO; `fecha_desde`/`fecha_hasta` no-ops.

Fecha previa: 2026-08-12 — **F14-0 + integración auditoría**: `CATEGORIA` en `PasadaColumnKey` / `PASADA_COLUMN_KEYS` (10 keys; **no** en obligatorias). Inicializador wizard `CATEGORIA: null`. Specs `PasadaEstandarizada` ajustados. Verify: `npx tsc --noEmit -p tsconfig.app.json` EXIT 0; `ng test` auditoria-tarifas **14/14**; peajes-carga+paso8+paso9 **9/9**. `contracts.local.ts` re-export canónico OK; provider Supabase sigue activo. **F14-0/F14-4 → passing**. Abierto: F14-3 (aliases/MVP exclusión); F14-6 dataset DESARROLLO (sin remote, skip); `fecha_desde`/`fecha_hasta` no-ops en listar agregado. **No** `db push`.

Fecha previa: 2026-08-12 — **F14-1 / F14-2 backend passing (CLI)**: tablas `tarifas_*` + ALTER `pasadas` (sin `peaje_id`); 6 RPC; enganche post-carga opción (b) en `PeajesCargaSupabaseService`; `PeajesAuditoriaTarifasSupabaseService` + provider real en `/peajes/auditoria-tarifas`. Verify: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` → **144 PASS** (`peajes_f14_test` + regresiones). Docs: `docs/backend/peajes/auditoria-tarifas.md`. **No** `db push --linked`. Bloqueos: F14-0 (`CATEGORIA` en `PasadaColumnKey`) pendiente agente 00; dataset 1711/119 → F14-6; drift `20260811190002_filtrar_columna` viaja en el próximo push remoto.

Fecha previa: 2026-08-12 — **F14-4 frontend** pantalla `/peajes/auditoria-tarifas` (commit `706beee`); provider ahora Supabase (F14-2).

Fecha previa: 2026-08-11 — **FILTRAR_COLUMNA**: estrategia atómica de filtro de filas (`ESTACION=1` ≡ `0001`); motor `aplicarPipeline` descarta no coincidentes; catálogo SQL `20260811190002_peajes_algoritmo_filtrar_columna.sql`; ejemplo `docs/plan/ejemplo-mercosur-procesamiento-pasadas.md` + CSV `pasadas_2026-07-01_79157.csv` (164 filas → Σ 4721445.29 = TOTAL factura). Fixture `mercosur.fixture.ts`. Verify: `motor.verify` PASS; `ng test` plantillas **46 SUCCESS**; `supabase test db` **112 PASS**. No push DESARROLLO aún.

Fecha previa: 2026-08-11 — **AUBASA plantilla HHMMSS + ELIMINAR_IVA**: fixture `aubasa.fixture.ts`, tests motor (AG309CO `2026-07-03 11:42:54`), docs `docs/plan/aubasa-plantilla-fecha-hora.md` (DELETE SQL `5364164`/`5364165`). Plantilla DESARROLLO **AUBASA-7-2026**. No borrar batches hasta re-upload.

Fecha previa: 2026-08-11 — **`pwbi_estacion` + Latitud/Longitud**: columnas `Latitud` / `Longitud` desde `estaciones.latitud` / `estaciones.longitud`. Migración `20260811131009_peajes_pwbi_estacion_lat_long.sql` aplicada en DESARROLLO. Refrescar consulta Power BI `pwbi_estacion`.

Fecha previa: 2026-08-11 — **`pwbi_documentos` en DESARROLLO**: vista dimensión documentos (FC|NC + empresa + importes cabecera); `security_invoker=false` + `GRANT SELECT` a `anon`. Migración `20260811121811_peajes_pwbi_documentos.sql`. Relación Power BI: `pwbi_pasadas.Documento_ID` → `pwbi_documentos.Documento_ID`. Docs actualizados (`pwbi-views.md`, `powerbi-supabase.md`).

Fecha previa: 2026-08-11 — **Power BI API-only**: docs `05-configuracion/powerbi-supabase.md` (URL + anon key, Power Query M). DESARROLLO: migración `peajes_pwbi_anon_api_access` aplicada (`security_invoker=false` + `GRANT SELECT` a `anon` en `pwbi_*`). Archivo local `20260811114646_…`. CLI verify pendiente (Docker).

Fecha previa: 2026-08-10 — **Docs: conectar Power BI ↔ Supabase DESARROLLO**: guía `docs/05-configuracion/powerbi-supabase.md` (API URL, host Postgres, anon key vía MCP; Session pooler + vistas `pwbi_*`). Enlaces desde `05-configuracion/INDEX`, `backend/supabase/index`, `pwbi-views.md`. Password DB y `service_role` fuera del doc.

Fecha previa: 2026-08-10 — **DESARROLLO: vistas Power BI `pwbi_*` aplicadas**: `db push --linked` → `20260810194113_peajes_pwbi_views.sql` en `kfffigvyvtzyczeiadxh`. Para alinear historial, archivo local bonificación renombrado `20260810151849_*` → `20260810191639_peajes_documentos_bonificacion.sql` (mismo SQL; version ID remoto). Vistas: `pwbi_estacion`, `pwbi_patentes`, `pwbi_pasadas`. Docs: `docs/backend/peajes/pwbi-views.md`. Verify CLI previo: `supabase test db` → **103 PASS**.

Fecha previa: 2026-08-10 — **DESARROLLO: bonificación cabecera aplicada (PGRST202)**: migración local `20260810151849_peajes_documentos_bonificacion.sql` aplicada en `kfffigvyvtzyczeiadxh` (registro remoto `20260810191639_peajes_documentos_bonificacion`); `NOTIFY pgrst, 'reload schema'`. Causa del fallo Paso 8: app enviaba `p_bonificacion` contra RPC 3-arg antigua. Verify remoto: firma `p_importe_sin_iva, p_importes_neto, p_tolerancia, p_bonificacion`; `documentos.bonificacion` existe; smoke AUSA `peajes_validar_factura_pasadas(1656836.19, [1833574.47], NULL, 176737.7)` → `valido=true`, `diferencia=0.58`, `dentro_tolerancia=true`.

Fecha previa: 2026-08-10 — **AUSOL/AUSA `fecha_hora` −1 día**: evidencia en `docs/plan/ausa-ausol-fecha-hora-minus-one-day.md`. Fix preventivo motor/plantillas; **DESARROLLO data repair aplicado**: `UPDATE pasadas … +1 day` → **185 filas** (`493556`=162, `493557`=23). Spot-check `1851b71d-…` → `2026-07-13 14:13:49` (match CSV).

Fecha previa: 2026-08-10 — **Bonificación de cabecera en documento**: columna `documentos.bonificacion`; Paso 7 input manual; RN-13/17 = `Σ IMPORTE_NETO − bonificacion ≈ subtotal` (±1%); migración `20260810151849_peajes_documentos_bonificacion.sql`; docs backend/validacion + stitch paso_7. Verify: `db reset --local --no-seed` OK; `supabase test db` → **85 PASS**; ng test focalizado → **39 SUCCESS**; `tsc --noEmit` OK.

Fecha previa: 2026-08-10 — **F08-2 passing**: vista `/peajes/pasadas-pendientes` (estaciones PENDING agregadas + expand pasadas + drawer ubicación). RPC `peajes_listar_estaciones_pendientes` (`20260810142350_…`); docs `docs/backend/peajes/estaciones-pendientes.md` + index + functions catalog. Verify: `db reset --local --no-seed` OK; `supabase test db` → **81 PASS**.

Fecha previa: 2026-08-10 — **F04-5 passing**: documentación `docs/backend/` (catálogo RPC + peajes + workflow/testing), sync `documentos-pasadas` / índices, PRD `peaje-prd-short.md.md` alineado F13 (masiva, FC|NC, RN-16 hora). `docs/08-sql/` eliminada (canonical = backend + migrations).

Fecha previa: 2026-08-10 — **Docs: eliminado `docs/08-sql/`** (incl. `peajes/`). Skills `documentacion-proyecto`, `backend-documenter`, `backend-supabase-write` + `AGENTS.md` documentan SQL/RPC solo en `docs/backend/` + fuente `supabase/migrations/`.

Fecha previa: 2026-08-10 — **F13-RN16-FECHA + F13-5 passing**: (1) Excel `Date` → `yyyy-MM-dd HH:mm:ss` vía `normalizarCeldaExcel` (ya no trunca a medianoche; cierra falsos RN-16 en ConsumosResumen). (2) Importación masiva: omitir documentos inválidos en Paso 7 y continuar con válidos; Paso 8/9 respetan `omitido`; Paso 9 resume importados / omitidos+errores. Verify: `ng test` peajes-excel + fecha.util + paso7/8/9 → **29 SUCCESS**. (3) DESARROLLO: migración F13 aplicada (`20260807140000_peajes_documentos_tipo_nc`), cache PostgREST recargada y carga `ConsumosResumen-202607-1.xlsx` preservada con **696 pasadas / 11 documentos**. (4) Hardening: `confirmarCarga` ya no hace SELECTs posteriores al RPC confirmado; evita mostrar fallo tras commit. Verify: spec focalizada **1 SUCCESS** + `tsc --noEmit` OK.

Fecha previa: 2026-08-07 — **Issue abierta F13-RN16-FECHA** (ver registro abajo): al cargar el sample Telepase `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (1040 filas) en importación masiva, Paso 8 / `peajes_detectar_duplicados` reporta cientos de `Duplicado dentro del lote (RN-16)` porque `FECHA_HORA` llega con hora `00:00:00`. El Excel **no** tiene filas duplicadas (`Fecha` trae `MM/DD/YYYY HH:mm:ss`). Decisión owner: **no** agregar paso de transformación para alterar `FECHA_HORA`; queda asentado para regresión/tests.

Fecha previa: 2026-08-07 — **F13-4 / RN-26**: `Concesion`→Peaje→Estaciones por empresa. PRD + `wizard.md`; Paso 5 recomienda peaje; Paso 6 filtra estaciones al peaje (corregible). No listar estaciones ajenas por defecto.

Fecha previa: 2026-08-07 — **F13-3 ConsumosResumen**: aliases Tag Nº→PASE_ID, Estación→ESTACION_ID, Concesion→empresa/peaje; Paso 7 FC fijo + autofill FACTURA + Quitar/Agregar IVA por accordion; Paso 6 masiva permite estaciones cross-empresa. Guía: `docs/06-components/peajes/importacion-masiva-consumos-resumen.md`. Sample: `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx`.

Fecha previa: 2026-08-07 — **F13-2 masiva multi-empresa**: en importación masiva la empresa del Paso 1 es opcional; en Paso 7 cada panel FACTURA permite elegir/cambiar empresa y saltar a mapeo (5) o estaciones (6) según el archivo. Referencia UI stitch: `docs/templates-stich/stitch_json_developer_toolkit/paso_1_cargar_archivo/`. Feature `F13-2` en `feature_list.json`.

Fecha previa: 2026-08-07 — **Documentos + importación masiva (F13)**: migración `facturas`→`documentos` + `tipo` FC|NC + `documento_id`; normalización de signos NC; wizard modo masiva con columna `FACTURA`; shared `app-accordion` (sin PrimeNG, ledger style); Paso 7 accordion multi-documento. Docs: migración `20260807140000_peajes_documentos_tipo_nc.sql` (canonical docs → `docs/backend/`; `docs/08-sql/` eliminada). Verificación: `ng build` OK; unit tests (17) OK; `db reset --local --no-seed` + `supabase test db` → 75 PASS. DESARROLLO aplicado el 2026-08-10.

Fecha previa: 2026-08-06 — **CSV AR + CONVERTIR_NUMERO_ARS**: SheetJS coerceaba `19.985,09` → `19.98509`; `PeajesExcelService` parsea CSV como texto. Tras reload, `CONVERTIR_NUMERO_ARS` produce `19985.09`.

Fecha previa: 2026-08-06 — **CONVERTIR_NUMERO_ARS**: estrategia + catálogo SQL; Paso 2 recomienda ARS si muestra `19.985,09` y `CONVERTIR_NUMERO` si decimal con punto; plantilla DESARROLLO `AUSA-8-2026` (`efec4fd3-…`) paso TARIFA→PRECIO actualizado. Docs plantillas/reconocimiento/AU + migración `20260806120000_peajes_algoritmo_convertir_numero_ars.sql` (docs → `docs/backend/`).

Fecha previa: 2026-08-05 — **Paso 5 BONIFICACION opcional**: si el archivo no trae descuento (Telepase/Autopistas), `asegurarMapeosObligatorios` inyecta mapeo sintético + `ASIGNAR_VALOR=0` (mismo patrón que QUANTITY); `construirPasadasDesdeMapeo` default 0 e `IMPORTE_NETO=PRECIO`; apply repara plantillas sin BONIFICACION.

Fecha previa: 2026-08-05 — **FECHA_HORA ISO / duplicados 22008**: `COMBINAR_COLUMNAS` FECHA+HORA → ISO; Excel Date → `yyyy-MM-dd`; `toPostgresFechaHora` en RPC duplicados/confirmar; AUSOL-7-2026 paso 10 → `FORMATEAR_FECHA_HORA` (`DD/MM/YYYY HH:MM:SS`). Corrige `2026-13-07` por DateStyle MDY.

Fecha previa: 2026-08-05 — **QUANTITY mapping / AUSOL-7-2026**: Paso 5 exige mapeo QUANTITY (fila sintética + `ASIGNAR_VALOR=1`); apply repara plantillas legacy sin QUANTITY; DESARROLLO plantilla `AUSOL-7-2026` (`7c42ac64-…`) actualizada con config orden 100 + mapeo `QUANTITY→QUANTITY`.

Fecha previa: 2026-08-05 — **F11 tolerancia ±1% + Search Select Paso 1**: `peajes_validar_factura_pasadas` usa `abs(subtotal)*0.01` por defecto; `app-search-select` en Empresa/Plantilla.

Fecha previa: 2026-08-04 — **F09 early skip from Paso 1**: con archivo+empresa+plantilla, `PeajesPlantillaApplyService` aplica y salta a Factura (o 5/6). Paso 4 reutiliza el mismo servicio.

Fecha previa: 2026-08-04 — **F09 plantilla restore**: `validarDefinicionPlantilla` acepta `mapeos` (cubre `ESTACION_ID` sin paso de pipeline; caso AUSOL-V2-08-2026). Paso 4 restaura mapeos/estaciones, salta a Factura o `irAExcepcion` 5|6. Saves Paso 3/builder no pisan snapshot incompleto. PRD §4/§7.4 + wizard/estaciones docs.

Fecha previa: 2026-08-04 — **Shared `app-dialog`**: Paso 6 «Ninguna coincide» / crear estación en modal; Paso 1 crear empresa migrado al mismo dialog.

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

F00–F05 `passing`. **F02-10** + **F03-9** `passing` (2026-07-31). **F02-11** `passing` (2026-08-03). **F02-12/13/14** `passing` (2026-08-04). **F02-15** + **F02-16** `passing` (2026-08-04). **F14-8** `passing` (2026-08-13).

## Registro de sesiones

### 2026-08-13 — F14-8 Clasificación editable, franja y Ver casos

**Agente:** 02-frontend-wizard-tablas  
**Scope:** plantillas `appDataTableColumn="…"` en `tarifa-familia-panel`; search-select de status; franja `hora_min`/`hora_max`; diálogo Ver casos; filtro `tarifa_normalizada_id` en `peajes_listar_pasadas`.  
**Verify:** `npx tsc --noEmit` app+spec EXIT 0; `ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts"` → **29 SUCCESS**.  
**DESARROLLO:** `peajes_listar_pasadas` con `tarifa_normalizada_id` aplicado (`20260813175138`). Smoke PASEO DEL BAJO 9731.46 → total 6.

### 2026-08-11 — AUBASA FECHA_HORA plantilla + tests

**Agente:** motor / plantillas  
**Scope:** fixture `aubasa.fixture.ts`, `FORMATEAR_FECHA_HORA` HHMMSS + `ELIMINAR_IVA`, motor specs AG309CO, docs `aubasa-plantilla-fecha-hora.md`, plantilla DESARROLLO `AUBASA-7-2026` (`2dd50d7a-356e-42f4-979b-a383cff54a59`)  
**Verify:** `ng test …/motor.spec.ts` → **56 SUCCESS** (28×2 browsers)  
**Pendiente usuario:** DELETE batches `5364164`/`5364165` + re-upload con plantilla nueva

### 2026-08-10 — AUSOL/AUSA fecha_hora −1 día (evidencia + fix)

**Agente:** integrador / motor
**Scope:** revisión `verification-pasadas-files` + fix preventivo algoritmo/plantilla
**Docs:** `docs/plan/ausa-ausol-fecha-hora-minus-one-day.md` (evidencia, SQL preview/apply +1 day, plantillas)
**Código:** `peajes-fecha.util.ts`, `estrategias-atomicas.ts`, fixtures AUSOL/Acceso Oeste, specs
**DESARROLLO plantillas:** `AUSOL-7-2026`, `AUSA-8-2026`, `AUSA-V2` → `FORMATEAR_FECHA_HORA` + `YYYY-MM-DD HH:MM:SS`  
**DESARROLLO data repair:** `UPDATE pasadas SET fecha_hora = fecha_hora + interval '1 day'` → **185** filas (`493556`+`493557`); spot-check `1851b71d-…` = `2026-07-13 14:13:49`

### 2026-08-10 — F04-5 Documentación backend + PRD sync

**Agente:** 04-documentador

- Creado `docs/backend/` (functions catalog, peajes RPC detail, supabase workflow/testing, edge stub).
- Sync tablas: `documentos-pasadas.md`; `auditoria-y-rpcs.md` → pointer a backend; eliminado `facturas-pasadas.md`.
- Actualizado `peaje-prd-short.md.md` (Paso 1/7/8/9 masiva+documentos, §11–14 DOCUMENTOS, RF-19–22, RN-12/13/16/17).
- Índices: `docs/INDEX.md`, `modulos/peajes.md`, `06-components/peajes/INDEX.md`, `06-tablas/*`.
- `feature_list.json`: F04-5 `passing`; `documentation_*` → 2026-08-10.
- Confirmado: sin `docs/08-sql/`.

### 2026-08-10 — Fix F13-RN16-FECHA + F13-5 omitir documentos inválidos (masiva)

**Agente:** 02-frontend-wizard-tablas

#### F13-RN16-FECHA

- **Causa:** `PeajesExcelService.normalizarCelda` convertía todo `Date` a `yyyy-MM-dd` (fix MDY 2026-08-05). ConsumosResumen mapea `Fecha`→`FECHA_HORA` sin transform; `toPostgresFechaHora` paddea `00:00:00` → falsos RN-16.
- **Fix:** `formatLocalDateTime` + `normalizarCeldaExcel` exportados en `peajes-fecha.util.ts`; Excel Date → `yyyy-MM-dd HH:mm:ss`. Sin paso de transformación.
- **Tests:** ZARATE 07/24 cuatro horas distintas; `ng test` peajes-excel + fecha.util OK.

#### F13-5 omitir documentos

- `WizardDocumentoGrupo.omitido` + `documentosIncluidos` / `documentosOmitidos` / `pasadasDeDocumentosIncluidos`.
- Paso 7: «Omitir documento» + «Omitir documentos con error y continuar».
- `puedeAvanzarA` / Paso 8 / Paso 9 ignoran omitidos; resumen final importados / omitidos+errores / confirm failures.
- **Verify:** `ng test` include peajes-excel, fecha.util, paso7, paso8, paso9 → **29 SUCCESS**.

### 2026-08-07 — Issue RN-16 / FECHA_HORA con ConsumosResumen.xlsx (rastreo)

**ID:** `F13-RN16-FECHA`  
**Sample:** `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (hoja `RESULTADO_1`, **1040** filas).  
**Síntoma:** Paso 8 → RPC `peajes_detectar_duplicados` (RN-16 / PRD).  
**Origen archivo:** Telepase (`scripts/telepeaje plus/`); el scraper no está en duda.

#### Motivo (causa raíz)

Clave de negocio RN-16:

```text
PASE_ID + FECHA_HORA + ESTACION_ID + PATENTE_ID
```

En la respuesta del wizard, `FECHA_HORA` aparece truncada a medianoche. Varias pasadas legítimas del mismo tag/dominio/estación el **mismo día** (distinta hora / vía) colapsan a la misma clave.

Ejemplo de valor en la respuesta:

```text
5e2f1508-d268-44f8-b142-98d6550b9bf9|2026-07-24 00:00:00+00|e5cce2bb-fb8e-4712-bd38-9419a2abbfd9|475d37b6-3b41-42ca-867d-510951b08475
motivo: Duplicado dentro del lote (RN-16)
columna: CLAVE_DUPLICADO
```

En el Excel, `Fecha` **sí trae hora** (`07/24/2026 13:37:24`, etc.).

#### Análisis del sample (resultados reales, 2026-08-07)

Inspección Node + `xlsx` sobre el archivo:

| Check sobre el XLSX | Resultado |
|---|---|
| Filas totales | **1040** |
| Filas 100% idénticas | **0** |
| Duplicados Tag Nº + **Fecha completa** + Estación + Dominio | **0** |
| Duplicados Tag Nº + **solo día** + Estación + Dominio | **165** filas “extra” / **138** grupos n>1 |
| Duplicados Tag + Fecha completa + Estación + Dominio + Vía | **0** |

Columnas: `Tag Nº`, `Dominio`, `Concesion`, `FACTURA`, `Estación`, `Vía`, `Fecha`, importes.

**Ejemplo real (filas Excel 2–5) — no son duplicados en origen:**

| Fila | Tag Nº | Dominio | Estación | Fecha (origen) | Vía |
|---|---|---|---|---|---|
| 2 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **13:37:24** | VIA 09 |
| 3 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **14:08:28** | VIA 52 |
| 4 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **23:26:45** | VIA 09 |
| 5 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **23:54:02** | VIA 53 |

Tras perder la hora → `…|2026-07-24 00:00:00+00|…` → RN-16 marca duplicados (alineado con filas 3–5 de la respuesta del wizard).

**Grupos más grandes (clave día-only):**

| Grupo | n |
|---|---:|
| `99779063\|07/22/2026\|ZARATE…\|AG533MF` | 6 |
| `99738712\|07/14/2026\|ZARATE…\|AG309CH` | 5 |
| `99779063\|07/24/2026\|ZARATE…\|AG533MF` | 4 |

#### Respuesta observada del wizard

Entrada asociada: `{ "registros": 1040 }`.  
Salida: errores `motivo: "Duplicado dentro del lote (RN-16)"`, `columna: "CLAVE_DUPLICADO"`, `valor` siempre con `00:00:00+00` (cientos de filas; patrón ZARATE / mismos tags del sample).

#### Decisión (2026-08-07)

- **No** se aplicó un paso de transformación en el wizard para alterar/reconstruir `FECHA_HORA` (decisión explícita del owner; se dejó igual).
- El sample en `scripts/telepeaje plus/202607-2/` queda como **fixture de evidencia / regresión**.
- Fix futuro: lectura/mapeo correcto de `Fecha` → `FECHA_HORA` (preservar `HH:mm:ss`), no un “parche” de transformación acordado fuera de alcance.

#### Cierre (2026-08-10)

- Fix aplicado en lectura Excel: `normalizarCeldaExcel` → `yyyy-MM-dd HH:mm:ss` (sin transform Paso 3). Feature `F13-RN16-FECHA` → `passing`.

#### Tests de regresión esperados (mismos resultados; que no vuelva a pasar)

Contra `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (o copia en fixtures si se mueve):

1. **Integridad del sample:**
   - `rows.length === 1040`
   - 0 filas JSON-idénticas
   - 0 colisiones Tag+FechaCompleta+Estación+Dominio
   - Baseline bug date-only: exactamente **165** colisiones Tag+día+Estación+Dominio
2. **Wizard / motor (cuando se corrija):**
   - Tras mapear `Fecha` → `FECHA_HORA`, ninguna pasada con hora origen ≠ medianoche debe quedar en `00:00:00`
   - Paso 8 / `peajes_detectar_duplicados` sobre las 1040: **0** errores RN-16 por pérdida de hora (el sample no tiene dups con fecha completa)
3. **Caso ZARATE 07/24/2026 Tag 99779063:** las 4 horas `13:37:24`, `14:08:28`, `23:26:45`, `23:54:02` → **4 claves RN-16 distintas**

Criterio de cierre: (2) y (3) en verde sin paso de transformación parche no acordado.

### 2026-08-05 — FECHA_HORA ISO (duplicados 22008)

- **Bug:** `peajes_detectar_duplicados` → `date/time field value out of range: "2026-13-07 …"` (Postgres DateStyle MDY ante `13/07/2026` concatenado por `COMBINAR_COLUMNAS`).
- **Fix:** Excel Date → `yyyy-MM-dd`; COMBINAR FECHA+HORA → `FORMATEAR_FECHA_HORA` ISO; `toPostgresFechaHora` en carga RPC; AUSOL-7-2026 orden 10 → `FORMATEAR_FECHA_HORA` / `DD/MM/YYYY HH:MM:SS`.
- **UI factura:** Paso 7 sigue mostrando `dd/MM/yyyy` en el date picker; persistencia interna `yyyy-MM-dd`.
- **Verify:** `ng test` peajes-fecha.util + motor → **28 SUCCESS**.

### 2026-08-05 — QUANTITY mapping + AUSOL-7-2026 DESARROLLO

- **Bug:** aplicar `AUSOL-7-2026` fallaba con `QUANTITY: Columna obligatoria no mapeada`.
- **Código:** `asegurarQuantityMapeoYPipeline` en wizard state; Paso 5 exige QUANTITY (etiqueta «valor generado»); `PeajesPlantillaApplyService` inyecta `ASIGNAR_VALOR { valor: 1 }` + mapeo si falta.
- **DESARROLLO:** plantilla `7c42ac64-e7b3-4c9d-9085-039f576d0e02` — config orden 100 `ASIGNAR_VALOR` valor=1; mapeos `QUANTITY→QUANTITY`.
- **Verify:** `ng test` apply+wizard-state+paso5 → **17 SUCCESS**.

### 2026-08-05 — F11 tolerancia 1% + Search Select Paso 1

- **Tolerancia:** migración `20260805113339_peajes_tolerancia_factura_uno_por_ciento.sql` — default `abs(subtotal)*0.01`; `p_tolerancia` explícito sigue como override. Paso 7/8/mock y docs (`validacion-carga`, wizard, auditoria, SQL task) alineados. F11-1 verification actualizada.
- **Search Select:** `app-search-select` (CVA `string | null`) en `shared/search-select`; Paso 1 Empresa + Plantilla; stitch mock + docs `docs/06-components/shared/search-select.md`.
- **Verify:** `npx supabase db reset --local --no-seed` OK; `npx supabase test db` **70 PASS**; `npx tsc --noEmit` OK; `ng test` search-select+paso1 **9 SUCCESS**. DESARROLLO no tocado.

### 2026-08-04 — F09 fix: restore mapeos (AUSOL ESTACION_ID)

- Causa: `validarDefinicionPlantilla` solo miraba `configuraciones`; AUSOL guarda `ESTACION→ESTACION_ID` en `mapeos`.
- Fix: motor acepta `mapeos`; Paso 4 los pasa, restaura snapshot, `facturaDirecta` o `irAExcepcion` 5|6; saves no pisan mapeos incompletos.
- Docs: PRD §4/§7.4, wizard.md, reconocimiento-estaciones.md. Specs en `motor.spec.ts` + `paso4-plantilla.component.spec.ts`.

### 2026-08-04 — Documentación de validación diagnóstica

- Se agregó `docs/06-components/peajes/validacion-carga.md` como referencia canónica de controles, errores, acciones correctivas y detalles técnicos del Paso 8.
- Documenta la resolución de códigos de proveedor a UUID, la tolerancia de subtotal de $5,00 y el uso del neto declarado cuando los descuentos no se desglosan por fila.
- Se enlazó desde el índice de componentes, la guía del wizard y el módulo Peajes.

### 2026-08-04 — F09 Plantillas recurrentes y reconocimiento de estaciones

- Se agregó la migración `20260804145440_peajes_plantillas_reconocimiento_estaciones.sql`: snapshot de mapeos en plantilla, tabla `plantilla_estaciones_reconocidas` y RPC transaccional de guardado.
- Paso 4 restaura mapeos y reconocimientos de la plantilla, valida catálogo de estaciones/patentes y solo salta a Paso 7 cuando no hay excepciones. Paso 7 recomienda crear una plantilla una sola vez y guarda pipeline, mapeos y relaciones confirmadas.
- Prioridad documentada: plantilla → alias de empresa → reconocimiento habitual. Los aliases por empresa no se eliminan.
- Verificación: `npx tsc --noEmit -p tsconfig.app.json` OK. Build Angular bloqueado por permisos de lectura del sandbox; reset Supabase local agotó tiempo del host. F09 queda `in_progress` hasta completar SQL y E2E local.

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
- **Docs:** shared date-range/SMS, facturas-pasadas, wizard; cuenta opcional vía migración `20260804141122_peajes_facturas_cuenta_nullable.sql` (docs → `docs/backend/`).
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
- ~~**F13-RN16-FECHA**~~ cerrado 2026-08-10: `normalizarCeldaExcel` preserva HMS.

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

### 2026-08-04 — F10-1 IVA opcional y operaciones numéricas

- Paso 2 ya no propone la receta `ESTACION + VIA`; las columnas siguen disponibles para el Paso 6.
- Se agregaron `ELIMINAR_IVA` (divide `IMPORTE_NETO` por 1,21 y redondea a dos decimales) y `OPERAR_NUMERO` (sumar, restar, multiplicar o dividir por valor fijo) al registro, descriptores, editor y catálogo SQL.
- `ELIMINAR_IVA` se recomienda de forma opcional cuando se detectan tarifa y bonificación; al persistirse en el pipeline de una plantilla se reaplica solo para esa empresa.
- Verificación: `npx tsc --noEmit -p tsconfig.app.json` y `git diff --check` OK. El bundle de specs focalizados compiló, pero ChromeHeadless no inició por error local de caché/cifrado, por lo que F10-1 sigue `in_progress`.

### 2026-08-12 — F14-0 Contrato CATEGORIA + integración F14-4

- `PasadaColumnKey` / `PASADA_COLUMN_KEYS` incluyen `'CATEGORIA'` (10 keys); **no** en `PASADA_COLUMNAS_OBLIGATORIAS` (Patrón A intacto).
- `construirPasadasDesdeMapeo` inicializa `CATEGORIA: null`; specs de `PasadaEstandarizada` actualizados.
- Provider auditoría ya era Supabase (F14-2); `contracts.local.ts` re-exporta canónico.
- Verify: `tsc` EXIT 0; `ng test` auditoria-tarifas 14/14; peajes-carga+paso8+paso9 9/9.
- Status: F14-0 + F14-4 `passing`. Pendiente: F14-3 (aliases/MVP); F14-6 dataset DESARROLLO (skip sin remote).

### 2026-08-12 — F14-4 Auditoría de tarifas (frontend, agente 02)

- Pantalla `/peajes/auditoria-tarifas` implementada bajo `auditoria-tarifas/`: filtros con debounce, tabla padre/detalle, escalera tarifaria (barra multiplicador + riel 24h), botones de status por catálogo, diálogo de comparación, progreso por peaje, Recalcular.
- Ruta registrada en `peajes.routes.ts`, permiso en `permission.guard.ts`, tarjeta en `peajes-home`.
- Servicio: mock tipado para specs; runtime usa `PeajesAuditoriaTarifasSupabaseService` (F14-2). `contracts.local.ts` re-exporta `models/auditoria-tarifas.contracts.ts`.
- Verificación: `tsc` OK, `ng test` auditoría 14/14, `clasificacion.verify.ts` OK, `npm run build` OK.


- La migración posterior `20260804175001_peajes_facturas_iva_total_manual.sql` agrega `facturas.iva` y elimina la restricción de total derivado: subtotal, percepciones, IVA y total son valores ingresados de factura. RAE se ignora.
- Paso 7 conserva la suma por centavos de las pasadas y compara únicamente subtotal contra pasadas, con tolerancia de $5,00. Se cubrió la factura AUSOL `0840-0557074` del `2026-08-01`: subtotal 560832.27, percepciones 24676.62, IVA 117774.78, total 703283.67.
- `npx supabase migration up --local` OK; `peajes_f01_test.sql` OK (46 pruebas, incluidas F11). La suite global mantiene un fallo preexistente de AUSOL: REVIEW 19 vs 18. `npx tsc --noEmit -p tsconfig.app.json` y `git diff --check` OK. La suite Angular focalizada generó el bundle, pero ChromeHeadless no termina en el host.
### 2026-08-20 — F15-1 Vista Express de carga de Peajes

- Implementado `PeajesCargaExpressComponent` en `wizard/carga-express/` con los pasos 1, 6, 7, 8 condicional y 9.
- Agregada la ruta `/peajes/carga-express`, tarjeta `Carga rápida` y permiso `peajes:read`.
- Paso 1 admite `expressMode`: exige plantilla y oculta el ejemplo MVP y configuración avanzada únicamente en Express.
- Agregada prueba focalizada del shell; `tsc` app/spec pasa y `ng build --configuration=development` genera el bundle. Karma/ChromeHeadless compila el bundle pero queda bloqueado por exports faltantes preexistentes en `peajes-home.component.spec.ts` y `permission.guard.spec.ts`.

### 2026-08-20 — F15-1 Patentes Express y pasos dinámicos

- Express incorpora `patentes-express` para altas individuales, altas masivas y exclusión de patentes nuevas.
- El stepper ordena Patentes antes de Estaciones y omite Estaciones cuando el reconocimiento es completo.
- `PeajesPlantillaApplyService` distingue excepciones de mapeo, patentes y estaciones; el wizard administrativo conserva el Paso 5 completo.
- `patente-reference.helper.ts` convierte códigos de proveedor a UUID y devuelve `null` para referencias no encontradas; Paso 8 bloquea antes de detectar duplicados o confirmar.
- Verificación: `npx tsc --noEmit -p tsconfig.app.json` y `tsconfig.spec.json` pasan; `ng build --configuration=development` pasa con warning preexistente NG8107 en Paso 9. ChromeHeadless no inicia en este host por `GPU process isn't usable`.

### 2026-08-21 — Skill de orquestación de planes

- Agregada `.agents/skills/plan-orchestrator/` para producir planes sin código de producto.
- Su salida canónica es `docs/plan/<epic>/PLAN_<epic>.md`, con planes de frontend/backend/testing solo si aplican; asigna dueños, skills, olas y evidencia de verificación.
- Las tareas planificadas se registran como `not_started` y se sincronizan con esta bitácora; ningún plan puede marcar una feature como `passing`.

### 2026-09-02 — F14-10 fecha_aparicion (CLI)

- Columna `tarifas_normalizadas.fecha_aparicion timestamptz NULL`: primera `pasadas.fecha_hora` del nivel.
- Backfill `MIN(fecha_hora)` agrupado por `tarifa_normalizada_id`.
- Trigger `trg_pasadas_fecha_aparicion` en INSERT/UPDATE de `tarifa_normalizada_id` o `fecha_hora`: setea si NULL, adelanta si es más temprana, no pisa hacia adelante.
- `pwbi_tarifas` expone `Fecha_Aparicion` al final del SELECT. Docs Power BI / tablas / backend actualizados.
- Verify: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` → **232 PASS**. Feature `F14-10` passing. DESARROLLO: MCP `apply_migration` (remoto `20260902194010`); 1142/1142 niveles backfilleados, 0 mismatches. `db push --linked` sigue en 403.

### 2026-09-08 — F14-16 Task 10 documentación canónica

**Agente:** 04-documentacion (Task 10)  
**Scope:** docs de comportamiento implementado; F14-16 `passing`. Sin código de producto.  
**Páginas:** `docs/06-tablas/peajes/tarifas-tarifa-importe.md`, `docs/backend/peajes/tarifas-tarifa-importe.md`. Índices y compatibilidad (`tarifas-normalizadas.md` retenida).  
**Evidencia Task 9 copiada:** pgTAP 14/412; Node 53/53; Angular 35+52; tsc app+spec EXIT 0; local only.  
**Diferidos documentados:** `asociarTrasConfirmacion` no cableado; backfill volumen real no probado; `pwbi_tarifas_v2` no clon; `_stg_precio_last` staging; sin DROP legado.  
**Constraint:** sin DESARROLLO; sin commit.

### 2026-09-08 — F14-16 Task 9 verificación independiente (local)

**Agente:** 01-backend-tester (Task 9)  
**Scope:** evidencia de gates locales; no implementación; F14-16 permanece `in_progress`.  
**Verify:** `npx supabase start` EXIT 0; `npx supabase db reset --local --no-seed` EXIT 0; `npx supabase test db` Files=14 Tests=412 PASS; `node --test scripts/peajes-catalogo-audit/*.test.mjs` 53/53 skipped 0 (sentido-split unskipped); `ng test` adapter+tarifa-validation+paso8 **35 SUCCESS**; `ng test` auditoria-tarifas **52 SUCCESS**; `tsc --noEmit` app+spec EXIT 0. Paridad Task 7 GREEN: unexplained 0; 0/0/0 pasadas tras `--no-seed` explicado.  
**Diferidos (Task 10 / follow-up):** `asociarTrasConfirmacion` no cableado post-confirm; `pwbi_tarifas_v2` LEFT JOIN puede dejar Importe NULL; v2 no es clon de columnas de `pwbi_tarifas`; backfill de pasadas de volumen real no corrido.  
**Constraint:** sin DESARROLLO; sin `db reset --linked`; sin commit; no `passing`.

### 2026-09-07 — F14-16 registro y freeze F14-12..F14-15

**Agente:** documentación (Task 1)  
**Scope:** registro docs-only de F14-16 `in_progress`; freeze de F14-12..F14-15 (superseded by F14-16, never implemented). Wave 0 / F14-11 `passing` intacto.  
**Plan ejecutable:** `docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`. Wave 0 histórico: `PLAN_refactor_tarifas_importe.md`.  
**Constraint:** additive/shadow; `tarifas_normalizadas` permanece como camino de compatibilidad (tabla, columnas, FKs, writers, firmas RPC, vistas, `pasadas.tarifa_normalizada_id`). Sin SQL/TS. Sin DESARROLLO. Sin commit. F14-16 no `passing`.
