# AGENTS.md — Peajes (Module Automation Tool) · Transporte Ibarra

## Overview

Módulo Angular 19 (standalone components) + Supabase que se incorpora al proyecto
existente `ibarra-app/` (Transporte Ibarra), implementando el PRD
`docs/plan/peaje-prd-es.md`: un asistente guiado que carga, transforma, mapea, valida y
almacena pasadas de peaje, y las asocia a una factura.

El módulo `peajes` se construye como **dominio aislado** dentro de la app
compartida: rutas propias, permiso propio (`peajes:read`), modelos y servicios
propios, tablas propias. **No debe modificar** Checklists, Stock, Incidentes,
Flota ni Neumáticos, ni reutilizar `checklist_templates` / `ChecklistTemplateService`.

## Fuente de verdad (en este orden si hay conflicto)

1. `docs/plan/peaje-prd-es.md` — spec funcional y de datos. Ante cualquier duda, el PRD
  manda sobre cualquier supuesto de este archivo.
2. `feature_list.json` (raíz) — estado canónico de features, agente dueño y pasos
  de verificación.
3. `docs/claude-progress.md` — bitácora de sesiones / estado verificado actual.
4. `docs/session-handoff.md` — handoff entre sesiones/agentes (obligatorio si el
  trabajo queda a medias o se delega).
5. `init.sh` — instalación + verificación base (crear en Fase 0 si el repo host
  no lo tiene).



## Modelo de agentes en paralelo (leer antes de tocar cualquier archivo)

Este módulo se construye con varios agentes/subagentes corriendo en sesiones
separadas. Para evitar colisiones, cada agente tiene un alcance de archivos
estricto. **Nunca edites un archivo fuera de tu alcance**: si necesitás un
cambio ahí, anotalo en `docs/session-handoff.md` y que lo resuelva el agente
dueño, o el agente 05 (Integrador) al final.


| #   | Agente                      | Skill principal                                                                            | Puede crear/editar (alcance exclusivo)                                                                                                                                                                                                                                     | Depende de                                                               |
| --- | --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 00  | Orquestador / Setup         | `.agents/skills/documentacion-proyecto`                                                    | `app.routes.ts` (solo la entrada de peajes, una vez), `src/app/components/peajes/peajes.routes.ts`, entrada de permiso `peajes:read`, tarjeta del dashboard, modelos base (`src/app/components/peajes/models/*`), **interfaces/contratos** de servicio (no implementación) | — (corre primero, solo)                                                  |
| 01  | Backend Supabase            | `.agents/skills/backend-supabase-write` (+ `supabase`, `supabase-postgres-best-practices`) | `supabase/migrations/*peajes*`, `supabase/functions/*peajes*`, `docs/08-sql/peajes/*`, implementación de servicios Angular que llaman a Supabase bajo `src/app/components/peajes/**/services/*.service.ts` (implementación, no la interfaz)                                | 00                                                                       |
| 02  | Frontend Wizard & Tablas    | `.agents/skills/peajes-wizard-tablas`                                                      | `src/app/components/peajes/wizard/**`, `src/app/components/peajes/catalogos/**` (Peajes, Estaciones, Patentes, Pases)                                                                                                                                                      | 00 (contratos); usa mocks hasta que 01 entregue las tablas de catálogo   |
| 03  | Frontend Plantillas & Motor | `.agents/skills/peajes-plantillas-builder`                                                 | `src/app/components/peajes/plantillas/**` (UI builder + motor Strategy/Builder en TS)                                                                                                                                                                                      | 00 (contratos); usa mocks hasta que 01 entregue las tablas de plantillas |
| 04  | Documentador                | `.agents/skills/documentacion-proyecto`                                                    | `docs/06-components/peajes/**`, `docs/06-tablas/peajes/**`, `docs/modulos/peajes.md`, `INDEX.md` relacionados                                                                                                                                                              | 01, 02, 03 (documenta lo que ya existe, no lo que se planea)             |
| 05  | Integrador / QA             | (lectura de todo lo anterior)                                                              | resuelve conflictos en `peajes.routes.ts` / mapa de permisos, corre verificación completa, actualiza `feature_list.json`, `docs/claude-progress.md`, `docs/session-handoff.md`                                                                                             | 01, 02, 03, 04                                                           |


Reglas:

1. El **agente 00 debe terminar y comitear antes** de que arranquen 01/02/03:
  estos construyen contra los contratos que deja 00, no entre sí.
2. 01, 02 y 03 pueden correr **en paralelo** una vez que 00 terminó. Tocan
  carpetas disjuntas, así que los conflictos de archivo deberían ser raros; la
   única superficie compartida son los **modelos/interfaces de 00** — nadie más
   los edita sin pasar por `docs/session-handoff.md`.
3. Si 02 o 03 necesitan una capacidad de backend que todavía no existe,
  construyen contra un mock tipado (`of(mockData)` / arreglo en memoria) que
   implemente la misma interfaz, y dejan el contrato exacto que necesitan para
   01 anotado en `docs/session-handoff.md`.
4. El agente 04 solo documenta después de que 01/02/03 marcan una feature como
  `passing` en `feature_list.json` — no debe inventar comportamiento que aún
   no existe.
5. El agente 05 corre al final, en serie, y es el único autorizado a tocar
  `peajes.routes.ts` o el mapa de permisos si 01/02/03 agregaron rutas de
   forma independiente y hay que fusionarlas.



## Flujo de arranque (toda sesión, todo agente)

1. `pwd`, confirmar que estás dentro de `ibarra-app/`.
2. Leer `docs/claude-progress.md` y `docs/session-handoff.md` si existe.
3. Leer `feature_list.json`; filtrar por tu `agent_owner`; tomar la feature de
  mayor prioridad en `not_started`/`in_progress` y ponerla en `in_progress`.
4. `git log --oneline -5`.
5. Correr `./init.sh` (crearlo en Fase 0 si no existe: instala deps + smoke test
  de `ng build`/`ng test`).
6. Si el baseline falla, arreglar eso antes de sumar features nuevas.



## Antes de implementar cualquier cosa

1. Leer `docs/plan/peaje-prd-es.md` para el comportamiento exacto de la feature
  (Sección 4 = pasos del wizard, Sección 7 = motor/plantillas, Secciones 11-14
   = modelo de datos, Sección 15 = reglas de negocio).
2. Leer tu skill en `.agents/skills/` (ver tabla de arriba) antes de escribir
  código.
3. Confirmar que los pasos de `verification` de la feature en
  `feature_list.json` son los que realmente vas a correr; si están mal,
   corregirlos explícitamente y explicar por qué en `docs/claude-progress.md`.
4. No salir de tu alcance de archivos (tabla de arriba).



## Definición de terminado (por feature en `feature_list.json`)

1. La implementación cumple el comportamiento del PRD para ese RF/RN.
2. Los pasos de verificación corrieron y pasaron (`ng test`, `ng build`,
  `pnpm supabase db reset --local --no-seed`, `pnpm supabase test db`, según
   corresponda).
3. Evidencia registrada en `feature_list.json` → `evidence` (comando +
  resultado).
4. Documentación actualizada (agente 04, después de la implementación), o
  diferida explícitamente con nota.
5. `./init.sh` sigue corriendo limpio desde un clon nuevo.

Si falta algo, la feature queda `in_progress`/`blocked` — nunca `passing`.

## Fin de sesión (todo agente)

1. Actualizar `feature_list.json` (status + evidence) solo de tus features.
2. Agregar entrada en `docs/claude-progress.md`.
3. Completar `docs/session-handoff.md` si el trabajo queda a medias o se
  delega, o si necesitás algo del alcance de otro agente.
4. Commitear con mensaje descriptivo una vez que la verificación pasa.



## Preguntas abiertas a resolver en Fase 0 (Agente 00)

El PRD (§20) y esta plantilla se escribieron antes de inspeccionar el repo real
de `ibarra-app`. Confirmar antes de scaffolding:

- [ ] Convención real de carpetas: `src/app/components/...` (según PRD §1.1) vs
  ```
  `src/app/features/...` (según plantilla de proyecto hermano) — **seguir
  la convención que ya use el dashboard/otros módulos existentes**, no
  asumir.
  ```
- [ ] Librería de UI real (¿PrimeNG? ¿Angular Material? ¿Bootstrap?) y tokens de
  ```
  diseño en `src/styles.css`.
  ```
- [ ] Forma exacta de `GranularPermissionService` y cómo las tarjetas del
  ```
  `DashboardModule` leen permisos.
  ```
- [ ] Project refs reales de Supabase (Local CLI / DEV / PROD) para
  ```
  `ibarra-app` — **no reutilizar** los refs de OrdenCompra Ibarra
  (`edxoqshrzdqpnldktpzy` / `uurlssweuhshbwpxxatw`), pertenecen a otro
  proyecto.
  ```
- [ ] Si `SupabaseService` ya expone un wrapper genérico de query/RPC que los
  ```
  servicios de Peajes deberían reutilizar.
  ```



## Stack (PRD §17)

Angular 19 (standalone) · RxJS · Supabase/PostgreSQL · Supabase Edge Functions
(solo si hace falta) · Supabase Storage (opcional, para conservar el archivo
original) · Netlify (hosting frontend) · Auth/RLS/roles explícitamente **fuera
del alcance del MVP** (PRD §5.2) — el módulo solo respeta el permiso
`peajes:read` que ya existe en la app host para mostrar/ocultar la tarjeta del
dashboard.
