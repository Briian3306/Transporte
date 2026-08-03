# Planes de ejecución — Módulo Peajes

## Resumen

Estos documentos convierten el PRD de Peajes y el `feature_list.json` en una ejecución coordinada por agentes de Cursor. Son planes de trabajo: no implementan el módulo ni autorizan despliegues remotos.

La aplicación y el paquete de coordinación están centralizados en `ibarra-app/`: `AGENTS.md`, `feature_list.json` y `.agents/skills/`. La fase 00 valida su consistencia antes de que haya trabajo paralelo.

## Orden obligatorio

1. [PLAN-00-orquestador-setup.md](./PLAN-00-orquestador-setup.md) — único agente inicial y punto de sincronización.
2. En paralelo, únicamente después de que 00 registre y entregue sus contratos: [PLAN-01-backend-supabase.md](./PLAN-01-backend-supabase.md), [PLAN-02-frontend-wizard-tablas.md](./PLAN-02-frontend-wizard-tablas.md) y [PLAN-03-frontend-plantillas-builder.md](./PLAN-03-frontend-plantillas-builder.md).
3. [PLAN-04-documentador.md](./PLAN-04-documentador.md) — después de que las features documentadas estén verificadas como `passing`.
4. [PLAN-05-integrador-qa.md](./PLAN-05-integrador-qa.md) — único agente final.

## Fuentes canónicas

- PRD: [peaje-prd-es.md](./peaje-prd-es.md).
- Caso de aceptación Demo: [ejemplo-mvp-procesamiento-pasadas.md](./ejemplo-mvp-procesamiento-pasadas.md).
- Caso Autopistas Urbanas (CSV): [ejemplo-autopistas-urbanas-pasadas.md](./ejemplo-autopistas-urbanas-pasadas.md) — fuente [csv/autopistas_urbanas.csv](./csv/autopistas_urbanas.csv).
- Datos ejemplo: [csv/](./csv/) (`1947768.xlsx` Demo, `autopistas_urbanas.csv`).
- Testing plan (transform/validate MVP): [testing_plan.md](./testing_plan.md).
- Motor transformaciones (patrones): `../../.agents/skills/peajes-transformaciones-motor/SKILL.md`.
- Testing transformaciones: `../../.agents/skills/peajes-testing-transformaciones/SKILL.md`.
- Evidencia Acceso Oeste: [prueba-workflow-387882-acceso-oeste.md](./prueba-workflow-387882-acceso-oeste.md).
- Ejemplo AUSOL: [ejemplo-ausol-procesamiento-pasadas.md](./ejemplo-ausol-procesamiento-pasadas.md) y [prueba-workflow-557074-ausol.md](./prueba-workflow-557074-ausol.md).
- Estado y dependencias: `../../feature_list.json`.
- Protocolo de ownership: `../../AGENTS.md`.
- Bitácora vigente: `../claude-progress.md`.

## Entornos Supabase

Solo hay **dos** entornos en este flujo:

| Entorno | Rol |
|---------|-----|
| **Supabase CLI** (local) | Testing / verificación obligatoria de migraciones y SQL |
| **DESARROLLO** (remoto `kfffigvyvtzyczeiadxh`) | Desarrollo remoto |

No hay staging/prod separados. Todo testing SQL se hace contra **Supabase CLI**; no usar MCP remoto como fuente de verdad de testing. **No** reutilizar project refs de OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`). Push a DESARROLLO requiere CLI verde y autorización explícita del usuario cuando corresponda. Detalle: `.agents/skills/backend-supabase-write/entornos.md`.

## Reglas de coordinación

- Una feature sólo pasa a `passing` con evidencia del comando y resultado en `feature_list.json`.
- Ningún agente modifica archivos fuera de su ownership. Las necesidades cruzadas se registran en `docs/session-handoff.md` una vez que 00 haya creado/normalizado esa bitácora.
- Los agentes 02 y 03 pueden usar mocks tipados que respeten los contratos de 00 hasta que 01 entregue el servicio real.
- No reutilizar `checklist_templates` ni `ChecklistTemplateService`.
- Los prompts de cada plan deben ejecutarse desde `ibarra-app/`; esa es la única raíz de coordinación.

> Última actualización: julio de 2026
