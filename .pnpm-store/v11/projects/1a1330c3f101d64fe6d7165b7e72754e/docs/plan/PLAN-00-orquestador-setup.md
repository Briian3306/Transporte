# PLAN 00 — Orquestador y setup

## Objetivo

Establecer una base compilable y contratos estables para que Backend, Wizard/Tablas y Plantillas trabajen sin conflictos. Este es el único plan que se ejecuta primero y en solitario.

## Dependencias y ownership

- Sin dependencias funcionales. Debe completar y entregar `F00-1` a `F00-4`.
- Sólo puede modificar los archivos asignados al agente 00 en `../../AGENTS.md`: entrada de Peajes en rutas, permiso, tarjeta del dashboard, `src/app/components/peajes/models/**` y contratos de servicio; además de los archivos de coordinación que el protocolo le asigna.
- No implementa servicios Supabase, wizard, catálogos ni plantillas.

## Plan de ejecución

1. Desde `ibarra-app/`, inspeccionar el dashboard, rutas, permiso granular, servicios Supabase existentes, UI kit y estructura de módulos. Corregir las rutas documentales antes de codificar: el PRD real es `docs/plan/peaje-prd-es.md`, no `docs/PRD-Peajes.md`.
2. Normalizar el paquete de coordinación: dejar un único punto canónico y accesible para `AGENTS.md`, `feature_list.json`, `docs/claude-progress.md`, `docs/session-handoff.md`, `init.sh` y las skills. No duplicar archivos con estados divergentes; registrar la ubicación final en el handoff.
3. Verificar que las skills `peajes-wizard-tablas`, `peajes-plantillas-builder`, `supabase`, `backend-documenter` y `backend-tester`, así como los seis agentes `.claude/agents/`, estén realmente presentes antes de habilitar la fase paralela. Si faltan, dejar la fase bloqueada y especificar el path requerido; no inventar sus instrucciones.
4. Implementar la integración mínima aislada: ruta `/peajes`, guard/permiso `peajes:read`, tarjeta del dashboard y rutas hijas vacías/lazy según la convención hallada.
5. Crear los modelos del dominio y contratos de servicio que requieren los otros agentes. Incluir expresamente las entidades del PRD: pasada, peaje, estación, patente, pase, factura, plantilla/configuración y algoritmo/pasos; preservar que una pasada referencia estación y el peaje se deriva desde ésta.
6. Ejecutar el baseline definido por `init.sh` o crear el script mínimo si falta, registrar evidencia de compilación y completar `F00-*`. Commit de entrega.
7. Publicar en el handoff: SHA de entrega, paths de contratos, decisiones de UI/permiso, ubicación canónica de coordinación y cualquier bloqueo. Recién entonces habilitar 01, 02 y 03.

## Criterio de salida

- `F00-1`…`F00-4` están `passing` con evidencia.
- Los tres agentes paralelos pueden importar contratos sin editar sus modelos.
- El baseline está verde o se dejó un bloqueo reproducible; en ese caso no se inicia la fase 1.

## Prompt para Cursor

```text
Actuá como el agente 00 (Orquestador/Setup) del módulo Peajes. Trabajá desde la raíz `ibarra-app/`, que también contiene el paquete de coordinación. Antes de editar, leé `AGENTS.md`, `docs/plan/peaje-prd-es.md`, `feature_list.json`, `docs/claude-progress.md` y el handoff si existe. Tu fuente funcional es el PRD y no implementes código de otros agentes.

Usá la metodología de `.agents/skills/documentacion-proyecto` para localizar los artefactos reales y evitar duplicados. Primero inspeccioná el repositorio y resolvé por evidencia la estructura Angular, UI kit, rutas, dashboard, `GranularPermissionService`, wrapper Supabase y ubicación canónica de coordinación. Confirmá que existen las skills frontend y los seis subagentes; si faltan, registrá un bloqueo exacto y no habilites paralelismo.

Implementá exclusivamente F00-1 a F00-4: integración aislada `/peajes`, permiso `peajes:read`, tarjeta, rutas base, modelos y contratos tipados. No implementes servicios Supabase, wizard, catálogos ni plantillas; no toques módulos existentes y no reutilices `checklist_templates` ni `ChecklistTemplateService`.

Ejecutá `./init.sh` o el baseline equivalente, actualizá solamente tus features con evidencia, dejá un handoff con SHA, contratos y decisiones, y hacé un commit descriptivo sólo si la verificación pasa. Entregá un resumen con PASS/FAIL/BLOCKED y no lances otros agentes.
```
