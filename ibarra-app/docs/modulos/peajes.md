# Módulo — Peajes

## Resumen

Módulo de automatización de carga de pasadas de peaje (PRD `peaje-prd-es.md`): wizard Excel → transformaciones/plantillas → mapeo a Structure Goal → relación estación/peaje → factura → validación → persistencia en Supabase. Dominio aislado dentro de `ibarra-app` (Angular 19 + Supabase). Estado documentado: **F00–F03 `passing`**; integración final **F05 pendiente**.

## Índice

- [Resumen](#resumen)
- [Propósito y alcance](#propósito-y-alcance)
- [Flujo principal](#flujo-principal)
- [Estructura de código](#estructura-de-código)
- [Integración host](#integración-host)
- [Documentación hija](#documentación-hija)
- [Estado de features](#estado-de-features)
- [Pendiente Agente 05](#pendiente-agente-05)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Propósito y alcance

- Cargar archivos `.xlsx` de pasadas de proveedores.
- Aplicar plantillas/algoritmos (Builder + Strategy).
- Mapear a columnas estándar y asociar estaciones/peajes.
- Validar importes vs factura y anti-duplicados.
- Confirmar carga con auditoría (`registros_carga_peajes`).

**Fuera de alcance MVP (PRD §5.2):** auth/RBAC granular interno del módulo (solo respeta `peajes:read` del host).

**No reutilizar:** `checklist_templates` / `ChecklistTemplateService`.

---

## Flujo principal

```text
Upload Excel → Preview (≤10) → Transformaciones → Plantilla
  → Mapeo Structure Goal → Relación estaciones → Factura
  → Validación → Revisión / confirmarCarga
```

Datos: pasada → `estacion_id`; peaje derivado. Recurso global: `empresa_id === '__global__'`.

---

## Estructura de código

```text
src/app/components/peajes/
  models/           # Contratos Fase 0
  services/         # Implementaciones Supabase (F01)
  wizard/           # UI wizard + mocks (F02)
  catalogos/        # UI catálogos (F02)
  plantillas/       # Motor + UI + mocks (F03)
  peajes-home.*
  peajes.routes.ts  # Solo home hasta merge 05
```

Migraciones: `supabase/migrations/20260730*_peajes_*.sql`  
Tests SQL: `supabase/tests/peajes_f01_test.sql`

---

## Integración host

| Elemento | Estado |
|----------|--------|
| Ruta `/peajes` | OK (home) |
| `peajes:read` en `ROUTE_PERMISSIONS` | OK (Fase 0) |
| Tarjeta dashboard `id: 'peajes'` | OK |
| Subrutas wizard/catalogos/plantillas | **Pendiente merge 05** |
| `system_modules` peajes en DESARROLLO | **Pendiente** (condicional; omitido en CLI vacío) |
| Links reales en home (“Próximamente”) | **Pendiente 05** |

---

## Documentación hija

| Área | Índice |
|------|--------|
| Modelo de datos / tablas | [docs/06-tablas/peajes/](../06-tablas/peajes/INDEX.md) |
| Componentes UI | [docs/06-components/peajes/](../06-components/peajes/INDEX.md) |
| SQL F01 | [docs/08-sql/peajes/F01-schema/](../08-sql/peajes/F01-schema/README.md), [F01-rpc/](../08-sql/peajes/F01-rpc/README.md) |
| Planes agentes | [docs/plan/INDEX.md](../plan/INDEX.md) |
| Handoff | [docs/session-handoff.md](../session-handoff.md) |
| Bitácora | [docs/claude-progress.md](../claude-progress.md) |

---

## Estado de features

| Bloque | Status |
|--------|--------|
| F00 Setup | `passing` |
| F01 Backend Supabase | `passing` (CLI 30/30) |
| F02 Wizard & catálogos | `passing` (mocks) |
| F03 Plantillas & motor | `passing` (mocks persistencia) |
| F04 Documentación | `passing` (esta entrega) |
| F05 Integrador/QA | `not_started` |

---

## Pendiente Agente 05

1. Merge de fragmentos de rutas en `peajes.routes.ts` (wizard + catalogos + plantillas) sin duplicados.
2. Swap mocks → `Peajes*SupabaseService` en providers.
3. Actualizar `peajes-home` con links reales.
4. E2E PRD §21 (`F05-1`).
5. Alinear códigos catálogo SQL ↔ `StrategyRegistry` si se persisten algoritmos desde UI.
6. `system_modules` peajes en DESARROLLO tras `db push --linked` autorizado.
7. **Sin push a `main`**; push feature/DESARROLLO solo con autorización.

---

## Verificación

Documentada por agentes 01–03 (no re-ejecutada por 04 salvo existencia de archivos):

```text
npx supabase db reset --local --no-seed → OK
npx supabase test db → PASS 30/30
ng build --configuration=development → OK
ng test peajes wizard+catalogos → 12 SUCCESS
npx tsx …/plantillas/motor.verify.ts → PASS
```

F04: existencia y enlaces de docs en índices (ver evidencia en `feature_list.json`).

---

## Referencias

- PRD: [peaje-prd-es.md](../plan/peaje-prd-es.md)
- Ejemplo: [ejemplo-mvp-procesamiento-pasadas.md](../plan/ejemplo-mvp-procesamiento-pasadas.md)
- Features: `feature_list.json`
- Protocolo: `AGENTS.md`

---

> Última actualización: julio 2026
