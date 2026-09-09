# PLAN 05 — Integración y QA final

## Objetivo

Integrar entregas verificadas, resolver conflictos de rutas/permisos bajo su ownership y certificar el caso end-to-end del PRD antes de cualquier autorización de Producción.

## Dependencias y ownership

- Es el único plan final. Requiere las dependencias de `F05-1`…`F05-3` y la documentación disponible de 04.
- Es el único autorizado a consolidar `peajes.routes.ts` y el mapa de permisos si hubo conflictos.
- Actualiza coordinación: `feature_list.json`, bitácora y handoff.

## Plan de ejecución

1. Leer PRD, caso §21, todos los handoffs, commits y evidencias. Resolver primero inconsistencias de contratos, rutas, mocks residuales y permisos.
2. Ejecutar el flujo de diez registros: carga, selección, transformaciones, plantilla, mapeo, estaciones, factura, validación, revisión y confirmación. Verificar los importes, relación estación→peaje y auditoría.
3. Ejecutar build/tests Angular y reset/test Local CLI de Supabase. Distinguir `PASS`, `FAIL` y `BLOCKED` por infraestructura; no marcar éxito si una prueba no corrió.
4. Verificar que la documentación representa el código final, actualizar estados y registrar evidencia. Commit de integración solamente si la definición de terminado se cumple.
5. Producción queda fuera de este plan: preparar únicamente un reporte de cambios candidatos y esperar autorización explícita del usuario.

## Prompt para Cursor

```text
Actuá como el agente 05 (Integrador/QA) y ejecutá este plan sólo cuando 00, 01, 02, 03 y la documentación disponible hayan terminado sus dependencias. Leé `AGENTS.md`, `feature_list.json`, todos los handoffs, `docs/plan/peaje-prd-es.md` y `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`. Inspeccioná los commits y el árbol final antes de editar.

Sos el único autorizado a resolver conflictos en `peajes.routes.ts` y el mapa de permisos. Eliminá mocks sólo cuando el servicio real compatible esté disponible. Ejecutá F05-1…F05-3: reproducí el ejemplo de 10 registros y confirmá el resultado normalizado, relación estación→peaje, total 102060.00, factura, persistencia y auditoría. Corré build/tests Angular y `pnpm supabase db reset --local --no-seed` + `pnpm supabase test db` cuando Local CLI esté disponible; clasificá cualquier limitación como BLOCKED con evidencia.

Actualizá `feature_list.json`, progreso y handoff con comandos/resultados; no declares passing sin prueba. No ejecutes comandos remotos contra Producción, no hagas `db push --linked` ni deploy: Producción requiere autorización explícita posterior del usuario. Commit de integración sólo si corresponde. Entregá una matriz PASS/FAIL/BLOCKED y una lista de candidatos para Producción, sin aplicar nada remoto.
```
