# Handoff del proyecto — 2026-08-04

## Fuente de verdad

Consultar, en este orden: `docs/plan/peaje-prd-es.md`, `feature_list.json`, `docs/claude-progress.md` y el código actual. Las migraciones reales están en `supabase/migrations`; no existe documentación SQL duplicada.

## Estado Peajes

- F00–F05: `passing`; MVP integrado con rutas `/peajes`, wizard, catálogos, plantillas, motor y servicios Supabase.
- F06-1/2/3: `in_progress`; seeds y workflows Acceso Oeste.
- F06-5: `not_started`; falta E2E local completo.
- F07-1: `in_progress`; seed/reconocimiento AUSOL.
- F08-1: `in_progress`; auditoría, vista, DataTable y CRUD de pasadas.

## Contratos operativos

- Global de plantillas: `empresa_id === '__global__'`.
- Una pasada referencia `estacion_id`; el peaje se deriva desde la estación.
- El motor usa estrategias registradas; no se ejecuta código dinámico desde JSON.
- No usar `ChecklistTemplateService` ni `checklist_templates` en Peajes.

## Próximas verificaciones

1. Completar seeds idempotentes y pruebas Supabase CLI locales.
2. Ejecutar E2E Acceso Oeste (`387882.csv`) y AUSOL (`557074.csv`) con conteos y totales documentados.
3. Cerrar pruebas de gestión de pasadas y actualizar evidencias de `feature_list.json`.
4. Ejecutar `init.sh` en un entorno con Bash/WSL o documentar una alternativa Windows.

## Riesgos

La principal incertidumbre es la falta de evidencia final para F06/F07/F08, no una ausencia conocida del MVP. No hacer merge a `main` ni afirmar `passing` sin comandos reproducibles y resultados registrados.
