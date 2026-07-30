# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-es.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`

## Estado actual

Fecha de preparación: 2026-07-29

El proyecto Transporte Ibarra ya existe y contiene módulos funcionales de Checklists, Incidentes, Flota, Neumáticos, Stock y RBAC. Peajes se incorporará como un módulo funcional independiente dentro de la aplicación Angular existente.

Decisiones vigentes:

1. La entrada de dashboard será `id: 'peajes'`.
2. La ruta base del módulo será `/peajes`.
3. El permiso base será `peajes:read`.
4. Las plantillas de Peajes no reutilizarán `checklist_templates` ni `ChecklistTemplateService`.
5. El MVP permite sobrescribir la configuración vigente; el versionado histórico es futuro.
6. El PRD en español es la fuente de verdad funcional.
7. Supabase se modifica únicamente mediante migraciones nuevas y validación local antes de cualquier entorno remoto.

## Features

Consultar `feature_list.json`. No iniciar una feature que tenga dependencias incompletas.

## Orden de ejecución recomendado

1. Integración base del módulo y permisos.
2. Persistencia de plantillas y algoritmos combinados.
3. Motor Builder + Strategy.
4. Editor frontend de plantillas y algoritmos.
5. Wizard de carga y procesamiento.
6. QA, regresión y entrega.

Los pasos 3 y 4 pueden ejecutarse en paralelo después de completar la persistencia, siempre que el motor y la UI no editen los mismos archivos.

## Registro de sesiones

### 2026-07-29 — Preparación multiagente

- Verificado que el repositorio ya tiene `AGENTS.md` específico para Transporte Ibarra.
- Añadido protocolo multiagente, ownership de archivos y matriz de responsabilidades a `AGENTS.md`.
- Creado `feature_list.json` con dependencias, actores, alcance y verificaciones.
- Definida la separación entre las plantillas de Peajes y las plantillas de Checklists.
- No se ha implementado código del módulo Peajes en esta preparación.
- No se han ejecutado migraciones ni cambios remotos de Supabase.

## Bloqueos y riesgos

- El módulo Peajes aún no tiene componentes, rutas ni migraciones implementados.
- Antes de crear tablas se debe confirmar el diseño final con el PRD y preparar la migración local.
- La existencia o nomenclatura exacta de permisos en Supabase debe validarse antes de habilitar el dashboard.
- No marcar features como `passing` sin evidencia de comandos ejecutados.

## Próximo paso

Implementar `peajes-project-context`: registrar la ruta base, el elemento `peajes` en el dashboard y el permiso correspondiente, sin modificar el comportamiento de los módulos existentes.
