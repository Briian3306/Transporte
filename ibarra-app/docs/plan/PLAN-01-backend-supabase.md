# PLAN 01 — Backend Supabase

## Objetivo

Implementar la persistencia, reglas transaccionales, auditoría y servicios Angular de Peajes mediante migraciones reproducibles, después de la entrega de 00.

## Dependencias y ownership

- Requiere `F00-3` en `passing` y el SHA/contrato señalado en el handoff.
- Atiende `F01-1` a `F01-9` en su orden de dependencias.
- Puede editar únicamente migraciones/funciones Peajes y las implementaciones de servicios Peajes. No edita modelos/contratos, wizard, catálogos, plantillas ni rutas.

## Plan de ejecución

1. Leer la skill `backend-supabase-write` y las skills requeridas realmente disponibles. Adaptar sus instrucciones de entornos: el flujo permitido es **Local CLI → Producción autorizada**, por lo que se elimina cualquier paso DEV/Testing/PreDEV y no se ejecuta ningún comando remoto.
2. Validar el contrato 00 y el modelo del PRD §§11–15. Diseñar migraciones incrementales para catálogos, facturas/pasadas, plantillas/configuraciones, algoritmos/pasos, restricciones, FKs e índices.
3. Implementar las RPC transaccionales: cálculo/validación de factura, duplicados, sobrescritura completa de plantilla, expansión/validación de algoritmos y auditoría de carga. Mantener los campos de trazabilidad del PRD y la idempotencia de la clave de pasada.
4. Implementar servicios Angular concretos compatibles con las interfaces de 00. Si 02 o 03 tienen mocks, conservar la misma forma de respuesta.
5. Por cada cambio, documentar la migración en `supabase/migrations/` y registrar verificación Local CLI en `feature_list.json`/`docs/claude-progress.md`. No incluir claves ni datos sensibles.
6. Ejecutar `pnpm supabase db reset --local --no-seed` y `pnpm supabase test db` cuando el entorno local esté disponible. Si Docker/CLI no está disponible, registrar `BLOCKED` con el error exacto y no simular éxito.
7. Actualizar sólo `F01-*`, el progreso/handoff y realizar commit sólo con verificación aplicable satisfactoria.

## Criterio de salida

Las migraciones aplican localmente y las pruebas de BD cubren las reglas F01. Los contratos consumibles por 02/03 quedan implementados o se entrega un handoff con la incompatibilidad concreta.

## Prompt para Cursor

```text
Actuá como el agente 01 (Backend Supabase) del módulo Peajes. No comiences hasta que F00-3 esté `passing` y exista su SHA/handoff. Leé `AGENTS.md`, `feature_list.json`, `docs/plan/peaje-prd-es.md` (sobre todo §§11–15 y §21), el handoff y la skill `.agents/skills/backend-supabase-write`; leé también las companion skills que estén instaladas antes de escribir SQL.

Tu scope exclusivo es F01-1…F01-9: `supabase/migrations/*peajes*`, funciones Peajes e implementaciones de servicios Angular de Peajes. No edites modelos/contratos de 00, rutas, wizard, catálogos o plantillas. Implementá migraciones reproducibles, FKs e índices, RPCs transaccionales para cálculo/validación, duplicados, sobrescritura de plantilla, algoritmos y auditoría; respetá la relación pasada→estación→peaje y nunca reutilices Checklists.

El único flujo de entorno autorizado es Local CLI. No existe DEV, Testing ni PreDEV: ignorá toda instrucción heredada que intente enlazar o desplegar a esos entornos. No ejecutes comandos contra Producción, `db push --linked`, deploy de funciones ni cambios remotos; Producción exige autorización explícita posterior del usuario. Ejecutá reset/test locales si la infraestructura existe; si no, dejá evidencia BLOCKED exacta.

Actualizá sólo F01 con comandos/resultados, escribí SQL docs reproducibles sin secretos, dejá handoff para 02/03 y hacé commit descriptivo sólo con las verificaciones aprobadas. Reportá PASS/FAIL/BLOCKED.
```
