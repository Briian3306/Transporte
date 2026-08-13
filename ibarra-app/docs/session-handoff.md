# Handoff del proyecto — 2026-08-04

## Fuente de verdad

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

**F14-1 / F14-2 (agente 01) — DONE (CLI, sin push remoto)**

- Contratos canónicos: `models/auditoria-tarifas.contracts.ts` (re-export desde `contracts.local.ts`).
- Servicio: `PeajesAuditoriaTarifasSupabaseService`; provider swapped en `auditoria-tarifas.routes.ts`.
- RPCs: `peajes_listar_tarifas_normalizadas` (`p_filtros` con `peaje_ids[]` / `solo_muestra_confiable`, `p_sort` = `campo:dir`); `peajes_confirmar_status_tarifa` acepta N asignaciones multi-estación; `peajes_recalcular_tarifas` respeta `confirmado_manual`; `peajes_grupos_similares_tarifa` devuelve `tarifa_ids[]` ordenados por importe.
- Enganche: `peajes_confirmar_carga` persiste `categoria`; normalización post-commit vía segundo `.rpc` (opción b).

**F14-4 — DONE (UI + provider real)**

- Pantalla `/peajes/auditoria-tarifas` + tarjeta home; specs 14/14 con mock; runtime Supabase.

**F14-3 — DONE (wizard CATEGORIA)**

- `column-recognition.ts`: kind `categoria`, aliases inline, `rec-categoria` (sin pipeline).
- Fixtures MVP/AU: `CATEGORIA` incluida + `MVP_MAPEO_SUGERIDO` / `AU_MAPEO_SUGERIDO`.
- Paso 5: destino opcional en UI; `construirPasadasDesdeMapeo` + payload carga ya propagaban `categoria`.
- Verify: wizard specs **96 SUCCESS** (include `**/*.spec.ts`).

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
## Riesgos

La principal incertidumbre es la falta de evidencia final para F06/F07/F08, no una ausencia conocida del MVP. No hacer merge a `main` ni afirmar `passing` sin comandos reproducibles y resultados registrados. No pushear F14 a DESARROLLO sin autorización explícita.
