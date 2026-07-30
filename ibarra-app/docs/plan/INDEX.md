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
- Caso de aceptación: [ejemplo-mvp-procesamiento-pasadas.md](./ejemplo-mvp-procesamiento-pasadas.md).
- Estado y dependencias: `../../feature_list.json`.
- Protocolo de ownership: `../../AGENTS.md`.
- Bitácora vigente: `../claude-progress.md`.

## Entornos Supabase

El alcance real disponible es **Local CLI → Producción**. No existe Testing ni PreDEV/DEV para este proyecto. Cada agente debe validar con Local CLI; ningún agente debe enlazar, hacer `db push`, desplegar funciones ni alterar Producción. Esas acciones requieren una autorización explícita posterior del usuario y las realiza únicamente quien designe el usuario.

## Reglas de coordinación

- Una feature sólo pasa a `passing` con evidencia del comando y resultado en `feature_list.json`.
- Ningún agente modifica archivos fuera de su ownership. Las necesidades cruzadas se registran en `docs/session-handoff.md` una vez que 00 haya creado/normalizado esa bitácora.
- Los agentes 02 y 03 pueden usar mocks tipados que respeten los contratos de 00 hasta que 01 entregue el servicio real.
- No reutilizar `checklist_templates` ni `ChecklistTemplateService`.
- Los prompts de cada plan deben ejecutarse desde `ibarra-app/`; esa es la única raíz de coordinación.

> Última actualización: julio de 2026
