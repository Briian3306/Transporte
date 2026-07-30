---
name: peajes-wizard-tablas
description: >-
  Guía al agente 02 (Frontend Wizard & Tablas) del módulo Peajes en ibarra-app:
  wizard de carga Excel, preview, mapeo, factura, validación, catálogos
  (peajes, estaciones, patentes, pases). Usar el patrón UI existente del repo
  (standalone Angular 19, CSS/SCSS custom, Font Awesome). Consumir contratos de
  agente 00; mocks tipados hasta que 01 entregue servicios reales.
---

# Peajes — Wizard y Tablas (Agente 02)

## Cuándo usar

Implementar `F02-*` bajo:

- `src/app/components/peajes/wizard/**`
- `src/app/components/peajes/catalogos/**`

Leer antes: `AGENTS.md`, `docs/plan/peaje-prd-es.md` (§4 pasos 1–2 y 5–9, §§7.5, 8, 15, §21), `docs/session-handoff.md`, contratos en `src/app/components/peajes/models/`.

## Ownership — no salir

| Permitido | Prohibido |
|-----------|-----------|
| `wizard/**`, `catalogos/**` | `plantillas/**` (agente 03) |
| Tests de esos paths | Editar modelos/contratos de 00 |
| Mocks tipados que implementen interfaces de 00 | Migraciones SQL / servicios Supabase reales (01) |
| Extensiones de rutas hijas solo vía handoff a 05 | `checklist_templates` / `ChecklistTemplateService` |

## Patrón UI del host (obligatorio)

Este repo **no** usa PrimeNG, Angular Material ni Bootstrap como kit principal.

| Elemento | Convención real |
|----------|-----------------|
| Carpetas | `src/app/components/<modulo>/` (no `features/`) |
| Componentes | `standalone: true`, `inject()`, template/style aparte |
| Estilos | CSS/SCSS propio del módulo + `src/styles.css` (utilidades, cards, botones) |
| Iconos | Font Awesome (`fas fa-*`) |
| Textos | Español |
| Permisos | `PermissionGuard` + `GranularPermissionService`; módulo `peajes` |
| Dashboard | Tarjeta con `id: 'peajes'`, ya registrada por 00 |

Seguí el look de Stock / Incidentes / Dashboard (cards, headers, botones `.btn`, estados loading/error). No introducir un design system nuevo.

## Contratos a consumir (agente 00)

Importar desde `src/app/components/peajes/models/`:

- Entidades: `Pasada`, `Peaje`, `Estacion`, `Patente`, `Pase`, `Factura`, …
- Interfaces de servicio: catálogos, carga, validación, persistencia
- Columnas estándar: `PasadaColumnKey` / mapeo a Structure Goal

Hasta que F01-* esté `passing`, usar mocks (`of(...)` / arrays) que respeten esas interfaces. Anotar en `docs/session-handoff.md` cualquier método faltante.

## Reglas de dominio críticas

- Pasada referencia **estación**; el peaje se obtiene vía `estacion.peaje_id` (no guardar `peaje_id` en la pasada).
- Preview máximo **10 filas**.
- Solo `.xlsx` en paso 1.
- Errores de validación: fila, columna, valor, motivo (RNF-08).
- No reutilizar plantillas de Checklists.

## Entornos

Frontend no aplica migraciones. Si necesitás datos reales, pedí a 01; el testing SQL de 01 es **Supabase CLI**, no DESARROLLO.

## Verificación

Correr los `ng test --include=...` de cada F02 y un build aplicable. Actualizar solo features F02 en `feature_list.json` con evidencia.
