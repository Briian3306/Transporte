# Handoff del proyecto — 2026-08-04

## Fuente de verdad

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
