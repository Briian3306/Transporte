# Handoff del proyecto — 2026-09-08

## Handoff F14-18 — Refresh Tarifas Paso 9 (`passing` CLI)

Paso 9 detecta candidatos distintos vs `tarifas`/`tarifa_importe` (1% inclusivo) y abre diálogo xl/top solo para `NEW_TARIFF` / `STATUS_*`. Guardar append inmutable. `CONTEXT_INCOMPLETE` bloquea confirmar.

- Migración: `20260908150000_peajes_refresh_tarifas_paso9.sql`
- pgTAP: `peajes_refresh_tarifas_test.sql` (40); suite Files=16 Tests=467
- Angular: `TarifaRefreshServiceImpl` + `tarifa-refresh-dialog` + board extraído; focused specs **50 SUCCESS**; tsc EXIT 0
- Tres casos SQL (AUSOL CAMPANA / `docs/plan/csv/557074.csv`): CURRENT 3976.59, HISTORICAL 2796.36, NEW 4771.95 NO_PICO. Guardar txn + ROLLBACK.
- Autopistas Urbanas CSV no mapea a estaciones sembradas (`VAR`/`KDT`/`PB2`); proxy AUSA VARELA 19985.09 → NEW
- Wizard UI no verificada en browser esta sesión
- Docs: `docs/backend/peajes/refresh-tarifas-paso9.md`
- `tarifas_normalizadas` y firmas F14-16 se retienen

## Handoff F14-17 — Tarifario RPCs CLI (`passing`)

`/peajes/tarifario` ya no usa el mock vivo. Provider: `PeajesTarifarioSupabaseService` → cuatro RPCs INVOKER sobre `tarifas` + `tarifa_importe`.

- Migración: `20260908140000_peajes_tarifario_rpcs.sql`
- pgTAP: `supabase/tests/peajes_tarifario_rpc_test.sql` (15 assertions; Files=15 Tests=427)
- Guardar: INSERT `tarifa_importe`; trigger promociona `current_tarifa_id`. Identidad faltante se crea. `importe > 0`.
- Seed: `pnpm seed:local` incluye `seed:tarifario-v2`
- Specs de componentes siguen en `TarifarioMockService`
- Docs: `docs/06-components/peajes/tarifario.md` + `docs/backend/peajes/tarifario.md`
- Sin DESARROLLO. Sin commit.

F14-16 schema/matching se retiene. Matching de pasadas no cambió.

## Handoff F14-16 — Task 10 docs + `passing` (2026-09-08)

F14-16 **`passing`** en CLI local. Docs canónicos:

- Tablas: `docs/06-tablas/peajes/tarifas-tarifa-importe.md`
- Backend: `docs/backend/peajes/tarifas-tarifa-importe.md`

`tarifas_normalizadas` **se retiene** (tabla, FKs, writers, firmas RPC, `pwbi_tarifas`, `pasadas.tarifa_normalizada_id`). No DROP de legado.

**Diferidos (no paper over):**

1. `asociarTrasConfirmacion` implementado en `TarifaValidationService`; **no** cableado tras `peajes_confirmar_carga` (la carga sigue `peajes_normalizar_tarifas`).
2. Backfill de volumen real de `pasadas.tarifa_importe_id` no probado fuera de pgTAP (`--no-seed` → pasadas 0/0/0).
3. `pwbi_tarifas_v2` es paralela, no clon drop-in de `pwbi_tarifas`; LEFT JOIN puede dejar `Importe` NULL.
4. `_stg_precio_last` es staging local, no catálogo de runtime.
5. Sin write DESARROLLO. Sin commit.

Task 9 (2026-09-08, local): `db reset --local --no-seed` EXIT 0; `test db` Files=14 Tests=412; Node 53/53; ng adapter+validation+paso8 35 SUCCESS; auditoria-tarifas 52 SUCCESS; tsc app+spec EXIT 0.

F14-17 Tarifario UI sigue mock (`in_progress`); swap RPC no es esta feature.

## Handoff F14-17 — Tarifario UI mock (2026-09-07)

UI de precios actuales lista contra **mock stateful**. No esperar F14-16 para usar `/peajes/tarifario`.

- Rutas: `/peajes/tarifario` y `/peajes/tarifario/:peajeId/:estacionId/:sentido`
- Token: `PEAJES_TARIFARIO_SERVICE` → `TarifarioMockService` en `tarifario.routes.ts`
- Permiso: `peajes:manage`; tarjeta home **Tarifario** (`fa-tags`)
- Componentes no importan mock vs Supabase
- Faltante = `—`; New vacío omitido del payload; sentido exacto IDA/VUELTA/AMBAS
- Verify: `ng test` `**/peajes/tarifario/**/*.spec.ts` **30 SUCCESS**; home + permission **12 SUCCESS**
- Doc UI: `docs/06-components/peajes/tarifario.md`
- Browser: `/peajes/tarifario` pide login; el smoke visual list→editor queda pendiente de sesión `peajes:manage`
- **Bloqueado (editor Supabase):** `PeajesTarifarioSupabaseService` + RPCs `peajes_listar_tarifas_actuales` / `peajes_obtener_tarifario_editor` / `peajes_guardar_tarifas_actuales` / `peajes_listar_tarifa_historial` + pgTAP. F14-16 matching v2 está `passing`; esos RPC de editor **no** forman parte de F14-16. Swap: una línea `useClass` cuando existan. Sin DESARROLLO. Sin commit.

## Handoff F14-16 — registro y freeze F14-12..F14-15 (histórico 2026-09-07)

**Histórico.** F14-16 quedó `passing` el 2026-09-08 (Task 10). Esta sección conserva el freeze de alcance.

F14-16 se registró `in_progress` (docs only). Additive/shadow: **no eliminar `tarifas_normalizadas`**. La tabla, columnas, FKs, writers, firmas RPC existentes, vistas y `pasadas.tarifa_normalizada_id` permanecen como camino de compatibilidad. Un retiro futuro es otro proyecto, fuera de F14-16.

- Plan ejecutable: `docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`
- Wave 0 F14-11: `passing` intacto (CSV/Excel; sin SQL)
- F14-12..F14-15: superseded by F14-16, never implemented (sentido, puntero current, Cross auditado, flag IVA, historia inmutable)
- Owner: `01-backend-supabase`; depende de F14-11
- Product docs: `docs/06-tablas/peajes/tarifas-tarifa-importe.md` y `docs/backend/peajes/tarifas-tarifa-importe.md` (Task 10)
- No write DESARROLLO. No commit.

## Handoff F14-11 Wave 0 — fixtures CSV/Excel (histórico 2026-09-04)

**Histórico.** Wave 0 **hecho** (F14-11 `passing`). Esta sección conserva rutas de fixtures; **no** es instrucción vigente de SQL/ETL/UI. F14-12..F14-15 están superseded by F14-16 y **never implemented** — no implementarlas. El trabajo SQL/ETL/UI vigente es **F14-16** (`docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`).

- Plan Wave 0 (fixtures, sin SQL): `docs/plan/refactor-tarifas-importe/PLAN_refactor_tarifas_importe.md`
- Catálogo: `scripts/peajes-catalogo-audit/fixtures/tarifas.csv` (todas las claves PICO/NO_PICO)
- Importes: `scripts/peajes-catalogo-audit/fixtures/tarifas_importe.csv`
- Excel: `scripts/peajes-catalogo-audit/out/tarifas-tarifas-importe.xlsx` (solo `tarifas` y `tarifas_importe`)
- Tests: `node --test scripts/peajes-catalogo-audit/*.test.mjs` (21 PASS)
- Validación unitaria `has_pico`: mismas categorías en PICO y NO_PICO.
- Excel revisado completo: `auditoria-catalogo-20260904.xlsx` (no sobrescrito).
- No DROP de `tarifas_normalizadas`. No write DESARROLLO.

## Handoff F14-11..F14-15 — plan Wave 0 (histórico 2026-09-04; superseded)

**Histórico / superseded.** El plan de 2026-09-04 proponía F14-12..F14-15 como SQL/ETL/UI. Ese contrato **nunca se implementó** y quedó superseded by **F14-16**. No implementar F14-12..F14-15. SQL/ETL/UI vigente: F14-16 / `docs/plan/refactor-tarifas-importe/PLAN_migracion-gradual-tarifas-tarifa-importe.md`.

- Plan Wave 0 (fixtures, sin SQL): `docs/plan/refactor-tarifas-importe/PLAN_refactor_tarifas_importe.md`
- Excel fuente completa: `scripts/peajes-catalogo-audit/out/auditoria-catalogo-20260904.xlsx`
- Ownership original de F14-12..F14-15 (obsoleto, no ejecutar): `01` schema/ETL/RPC; `02` Angular; `04`/`05` docs/QA. El owner vigente de SQL/ETL/UI es F14-16 (`01-backend-supabase`).

## Fuente de verdad

## Handoff invoice AI (PLAN Tasks 6–7) — 2026-08-24 catch-up

QA/docs. **No commit.** Product code (Tasks 1–5) is on disk; this session documented it and re-ran deterministic checks.

### Ownership / credentials

- **Server** owns OpenRouter credentials (`OPENROUTER_API_URL`, `OPENROUTER_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`). Never `NG_APP_OPENROUTER_*`.
- **Frontend** owns UI and ephemeral wizard state (optional PDF, text in memory, suggestions, click-to-apply).
- **This feature makes no Supabase write.**

### Feature statuses (keep F17; do not reuse F16)

| Plan label | Canonical | Status | Notes |
|---|---|---|---|
| F16-1 contracts/proxy | F17-1 | `passing` | Handler 10 pass + ng 47; proxy inspected |
| F16-2 PDF/early analysis | F17-2 | `passing` | Paso 1 / state / PDF services in 47 SUCCESS |
| F16-3 Paso 7 | F17-3 | `in_progress` | Specs green; **visual `/peajes/carga-express` not done** |
| F16-4 real-PDF regression | F17-4 | `in_progress` | Manifest + skip-live OK; **live OpenRouter unauthorized** |
| F16-5 QA/docs | F17-5 | `in_progress` | wizard.md updated; blocked on visual + live |

### Remaining gaps

1. Live OpenRouter (`RUN_OPENROUTER_LIVE_TESTS=1`) not authorized — two paid calls against the immutable PDFs.
2. Manual visual QA on `/peajes/carga-express`: simple CSV/XLSX + optional PDF + template → Paso 7 candidates; without PDF; invalid PDF; retry on error; replacing PDF clears stale suggestions.
3. No git commit.

### Verify this session (verbatim)

- `node --test netlify/functions/peajes-invoice-ai.test.js` → tests 10 pass 10 fail 0 EXIT 0
- `node --test netlify/functions/peajes-invoice-ai.fixtures.test.js` → tests 1 pass EXIT 0
- `node scripts/verify-invoice-ai-fixtures.mjs` → skipped live EXIT 0
- `pnpm exec ng test --include services/ai + paso1 + paso7 + peajes-wizard-state --watch=false --browsers=ChromeHeadless` → TOTAL: 47 SUCCESS
- `npx tsc --noEmit -p tsconfig.app.json` EXIT 0; `tsconfig.spec.json` EXIT 0
- `npx ng build --configuration=development` EXIT 0 (pre-existing NG8107 paso9-revision)

## Handoff F16 — DONE local (2026-08-21)

- F16-0..3 `passing` en `feature_list.json`. Ruta `/peajes/auditoria-estaciones`; tarjeta home distinta de **Auditoría de tarifas** (F14).
- Catálogos visibles con `peajes:manage` (sección `catalogos` + cards por ruta). `/peajes/catalogos/empresas` en el guard.
- Seed: `config.toml` / `npm run seed:local` aplican empresas/peajes, padres de pasadas (`seed_peajes_pasadas_fks.sql`), `pasadas_rows.sql` (~8326) y F14. Nunca `db reset --linked`.
- Plan canónico: `docs/plan/auditoria-reconocimiento-estaciones/PLAN_auditoria-reconocimiento-estaciones.md`.
- Repro principal: guardar una relación, recrear Paso 6 y continuar sin seleccionar otra vez. Cubrir claves equivalentes `0001`/`1` para `67486ca3-6e88-49a8-b628-7f41e946da5a` y `3`/`0003` para `60014adb-62f4-4ad9-86a0-50bd36efd1e3`; son fixtures locales, nunca constantes de producción.
- Ruta propuesta: `/peajes/auditoria-estaciones`; `['3','5']` es válido y se muestra como contexto. Solo reporta un posible problema cuando el perfil numérico secuencial del ámbito tenga huecos/inversiones, por ejemplo `1,2,3,5` ⇒ falta candidata `4`.
- Los casos se persisten por fingerprint y se gestionan como PENDIENTE, VALIDADO, DESCARTADO, REQUIERE_CORRECCION o CORREGIDO. El detalle ofrece preview y confirmación para “solo futuros” (catálogo/alias) o “futuros + históricos” (solo pasadas exactas del preview), dejando before/after trazable. La auditoría nunca interviene directamente en Paso 6.
- Propiedad: 00 contratos; 01 migración/RPC/servicio/pgTAP; 02 Paso 6/UI; 04 docs después de verde; 05 ruta/home/permisos/integración/evidencias.
- Supabase CLI local es el entorno de prueba. No `db push --linked` ni update remoto sin nueva autorización. DESARROLLO se limita a SELECT/read-only.

Consultar, en este orden: `docs/plan/peaje-prd-short.md.md`, `feature_list.json`, `docs/claude-progress.md` y el código actual. Las migraciones reales están en `supabase/migrations`; no existe documentación SQL duplicada.

## Estado Peajes

- F00–F05: `passing`; MVP integrado con rutas `/peajes`, wizard, catálogos, plantillas, motor y servicios Supabase.
- F06-1/2/3: `in_progress`; seeds y workflows Acceso Oeste.
- F06-5: `not_started`; falta E2E local completo.
- F07-1: `in_progress`; seed/reconocimiento AUSOL.
- F08-1: `in_progress`; auditoría, vista, DataTable y CRUD de pasadas.
- F09-1: `in_progress`; plantillas guardan mapeos y reconocimientos de estación. Falta ejecutar reset/tests Supabase locales y E2E MVP/Autopistas Urbanas.
- F10-1: `in_progress`; IVA opcional y operaciones numéricas ya implementados. Falta repetir el test focalizado con ChromeHeadless funcional y ejecutar la verificación de reimportación de los fixtures MVP/AUSOL.
- F11-1: `in_progress`; factura persiste subtotal, percepciones, IVA y total ingresados. Solo subtotal se valida contra pasadas (tolerancia **1% del subtotal**); cubre factura real AUSOL 0840-0557074. Migración `20260805113339` + pgTAP F01 50 OK (CLI 70 PASS). ChromeHeadless OK en search-select/paso1; DESARROLLO no push.

## Contratos operativos

- Global de plantillas: `empresa_id === '__global__'`.
- Una pasada referencia `estacion_id`; el peaje se deriva desde la estación.
- El motor usa estrategias registradas; no se ejecuta código dinámico desde JSON.
- No usar `ChecklistTemplateService` ni `checklist_templates` en Peajes.
- Prioridad de estaciones F09: snapshot de plantilla → `estaciones_alias_proveedor` por empresa → reconocedor normal.

## Próximas verificaciones

1. Completar seeds idempotentes y pruebas Supabase CLI locales.
2. Ejecutar E2E Acceso Oeste (`387882.csv`) y AUSOL (`557074.csv`) con conteos y totales documentados.
3. Cerrar pruebas de gestión de pasadas y actualizar evidencias de `feature_list.json`.
4. Ejecutar `init.sh` en un entorno con Bash/WSL o documentar una alternativa Windows.

## F14 — Auditoría tarifas (2026-08-12)

**F14-0 (agente 00 / integrador) — DONE**

- Contrato: `'CATEGORIA'` en `PasadaColumnKey` y `PASADA_COLUMN_KEYS` (10 keys); **ausente** de `PASADA_COLUMNAS_OBLIGATORIAS` (RN-15 / Patrón A).
- Wizard: `construirPasadasDesdeMapeo` inicializa `CATEGORIA: null` (Patrón A por defecto).
- Desbloquea F14-3 (aliases Paso 2, MVP fixtures, persistencia mapeo).

**F14-1 / F14-2 (agente 01) — DONE + gap-fill 2026-08-21 (CLI, sin push remoto)**

- Contratos canónicos: `models/auditoria-tarifas.contracts.ts` (re-export desde `contracts.local.ts`).
- Servicio: `PeajesAuditoriaTarifasSupabaseService`; provider swapped en `auditoria-tarifas.routes.ts`.
- RPCs: `peajes_listar_tarifas_normalizadas` (`p_filtros` con `peaje_ids[]` / `solo_muestra_confiable`, `p_sort` = `campo:dir`); `peajes_confirmar_status_tarifa` acepta N asignaciones multi-estación; `peajes_recalcular_tarifas` respeta `confirmado_manual`; `peajes_grupos_similares_tarifa` devuelve `tarifa_ids[]` ordenados por importe.
- Enganche: `peajes_confirmar_carga` persiste `categoria` y **llama** `peajes_normalizar_tarifas` (migración `20260821141019`). Firma pública intacta. Angular conserva segundo `.rpc` idempotente (B-10) hasta que DESARROLLO reciba el hook.
- Verify 2026-08-21: `db reset --local --no-seed` OK; `test db` 198 PASS; carga spec 1 SUCCESS. F14-6 sigue abierto.

**F14-4 — DONE (UI + provider real) + gap-fill 2026-08-21**

- Pantalla `/peajes/auditoria-tarifas` + tarjeta home; runtime Supabase.
- Gap-fill: expand al click de fila padre (stopPropagation en acciones/peaje); catálogo incluye `POSIBLE_HORARIO`; sugerencia ignora `PENDIENTE`/`CONFIRMADO`; CSS móvil `at__` (sticky estación, hide multiplicador/desvío en tablet, 44px bajo 720px).

**F14-3 — DONE (wizard CATEGORIA) + gap-fill 2026-08-21**

- `column-recognition.ts`: kind `categoria`, aliases inline, `rec-categoria` (sin pipeline).
- Fixtures MVP/AU: `CATEGORIA` incluida + `MVP_MAPEO_SUGERIDO` / `AU_MAPEO_SUGERIDO`.
- Paso 5: destino opcional; payload carga ya propaga `categoria` trim (01).
- Gap-fill: descartar `rec-categoria` excluye la columna y limpia el destino → Patrón A.
- Verify 2026-08-21: tsc OK; focused 90 SUCCESS. Wizard full 129/5: fallos Paso 6 / carga-express preexistentes → 05.

**F14-5 — DONE (docs)**

- Componentes: `reconocimiento-columnas.md`, `reconocimiento-estaciones.md`, `auditoria-tarifas.md`, wizard Paso 5.
- Tablas: `tarifas-normalizadas.md` + cols F14 en `documentos-pasadas.md`.
- Módulo / INDEX + backend index ya enlazaba 6 RPC.

**F14-6 DESARROLLO (2026-08-13) — recalc + reconcile DONE; local tests + E2E UI pendientes**

Project-ref confirmado: `kfffigvyvtzyczeiadxh`.

1. Migraciones F14 en remoto. `tarifas_status_catalogo` seeded (18 filas PICO/NO_PICO × 9 peajes).
2. Backfill `pasadas.categoria` (Telepase only): **1750** updated; ConsumosResumen **1711** `categoria IS NULL` (Patrón A).
3. **Recalcular DONE**: `peajes_recalcular_tarifas` × 9 peajes → `tarifas_normalizadas` **281**; **3465/3465** pasadas con `tarifa_normalizada_id`. Por peaje: CORREDORES VIALES 1394 · AUSA 783 · AUTOPISTA OESTE 410 · AUBASA 233 · RUTAS SUR 206 · AUSOL 185 · CORREDOR VIAL 5 172 · UNIDAD EJECUTORA 80 · CONEXION ALTO DELTA 2.
4. Reconcile: ConsumosResumen **1015+696=1711**; 0 cargas `202607-2`. CSV 119 vs DB: 117/119 keys (2 alias `KM. 244` vs `KM 244`); cases 116/117 (ZARATE 1500: DB 89 vs CSV 114). ZARATE 5 niveles CATEGORIA; desvío UTC 4/5 ±0.01. `pwbi_pasadas.Tarifa_Status` expuesto.
5. **Pendiente F14-6**: `ng test`/`motor.verify` local; E2E manual confirmación PICO/NO_PICO en `/peajes/auditoria-tarifas`; R1 CSV `PATRON=B` confirmar con PO; R2 NC `0104-00077675`.
6. `fecha_desde`/`fecha_hasta` en listar agregado: no-ops documentados.

## F14-7 — Plantillas CATEGORIA (2026-08-13) — DONE

- **Problema:** plantillas Telepase tenían `{ columnaOrigen: "CATEGORIA", excluida: true }` → wizard Paso 5 restauraba Patrón A.
- **Fix:** migración `20260813100000_peajes_plantillas_mapeo_categoria.sql` (idempotente, solo jsonb `mapeos`).
- **DESARROLLO:** apply vía MCP `apply_migration` (project-ref `kfffigvyvtzyczeiadxh` confirmado). Plantillas actualizadas: AUSA-8-2026, AUSA-V2, AUSA-V3, AUSOL-7-2026, AUBASA-7-2026, AU-OESTE-V1-08-26, CORRE-VIALES-V1. **No tocadas:** MASIVOOO, Acceso Oeste, Demo.
- **Verify remoto:** cat_activa=1 (Telepase) / 0 (MASIVOOO); pasadas intactas; tarifas 281.
- **Verify repo:** spec CATEGORIA restore en `peajes-plantilla-apply.service.spec.ts`; paso5 8/8.
- **Pendiente:** smoke wizard §6.2 (carga CSV AUSA + ConsumosResumen MASIVOOO) — manual/QA.
## Riesgos

La principal incertidumbre es la falta de evidencia final para F06/F07/F08, no una ausencia conocida del MVP. No hacer merge a `main` ni afirmar `passing` sin comandos reproducibles y resultados registrados. No pushear F14 a DESARROLLO sin autorización explícita.
