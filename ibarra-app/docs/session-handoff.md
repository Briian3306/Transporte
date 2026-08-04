# Handoff del proyecto — 2026-08-04

## Fuente de verdad

Consultar, en este orden: `docs/plan/peaje-prd-es.md`, `feature_list.json`, `docs/claude-progress.md` y el código actual. Las migraciones reales están en `supabase/migrations`; no existe documentación SQL duplicada.

## Estado Peajes

- F00–F05: `passing`; MVP integrado con rutas `/peajes`, wizard, catálogos, plantillas, motor y servicios Supabase.
- F06-1/2/3: `in_progress`; seeds y workflows Acceso Oeste.
- F06-5: `not_started`; falta E2E local completo.
- F07-1: `in_progress`; seed/reconocimiento AUSOL.
- F08-1: `in_progress`; auditoría, vista, DataTable y CRUD de pasadas.
- F09-1: `in_progress`; plantillas guardan mapeos y reconocimientos de estación. Falta ejecutar reset/tests Supabase locales y E2E MVP/Autopistas Urbanas.
- F10-1: `in_progress`; IVA opcional y operaciones numéricas ya implementados. Falta repetir el test focalizado con ChromeHeadless funcional y ejecutar la verificación de reimportación de los fixtures MVP/AUSOL.
- F11-1: `in_progress`; factura persiste subtotal, percepciones, IVA y total ingresados. Solo subtotal se valida contra pasadas (tolerancia $5); cubre factura real AUSOL 0840-0557074. Migración local y pgTAP F01 OK; la suite total sigue bloqueada por conteo AUSOL preexistente (REVIEW 19 vs 18).

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

## Riesgos

La principal incertidumbre es la falta de evidencia final para F06/F07/F08, no una ausencia conocida del MVP. No hacer merge a `main` ni afirmar `passing` sin comandos reproducibles y resultados registrados.
