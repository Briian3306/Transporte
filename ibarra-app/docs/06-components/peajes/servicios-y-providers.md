# Servicios y providers — Peajes

## Resumen

Mapa de contratos (Fase 0), implementaciones Supabase (F01 `passing`) y mocks aún activos en UI (F02/F03). Guía de swap para Agente 05 / Integrador.

## Índice

- [Resumen](#resumen)
- [Tokens e interfaces](#tokens-e-interfaces)
- [Implementaciones](#implementaciones)
- [Swap recomendado](#swap-recomendado)
- [Referencias](#referencias)

---

## Tokens e interfaces

Definidos en `src/app/components/peajes/models/` (`peajes-services.contracts.ts` + export de tokens).

| Token / interfaz | Responsabilidad |
|------------------|-----------------|
| `PEAJES_CATALOGO_SERVICE` / `PeajesCatalogoService` | CRUD catálogos + sugerir estación |
| `PEAJES_CARGA_SERVICE` / `PeajesCargaService` | Validar, duplicados, confirmar carga |
| `PEAJES_PLANTILLAS_SERVICE` / `PeajesPlantillasService` | Plantillas, configs, algoritmos |
| `PEAJES_MOTOR_TRANSFORMACION` / `PeajesMotorTransformacion` | Pipeline Strategy/Builder |

---

## Implementaciones

| Interfaz | Real (F01) | Mock UI (F02/F03) |
|----------|------------|-------------------|
| Catálogo | `PeajesCatalogoSupabaseService` | `PeajesCatalogoMockService` |
| Carga | `PeajesCargaSupabaseService` | `PeajesCargaMockService` |
| Plantillas | `PeajesPlantillasSupabaseService` | `PeajesPlantillasMockService` |
| Motor | `PeajesMotorTransformacionService` | — (no mock) |

Export barrel: `src/app/components/peajes/services/index.ts`.

Global: `PEAJES_GLOBAL_EMPRESA_ID = '__global__'`.

Acceso Supabase: solo vía `SupabaseService.getClient()` / `executeWithRetry` (sin clientes sueltos).

---

## Swap recomendado

En `wizard.routes.ts`, `PeajesWizardComponent.providers`, `catalogos.routes.ts` y providers de plantillas:

```ts
import {
  PeajesCatalogoSupabaseService,
  PeajesCargaSupabaseService,
  PeajesPlantillasSupabaseService,
} from '../services';

{ provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService }
{ provide: PEAJES_CARGA_SERVICE, useExisting: PeajesCargaSupabaseService }
{ provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService }
```

Quitar `PEAJES_CATALOGOS_MOCK_PROVIDERS` / `useClass: *MockService`.

**Ownership:** Agente 04 no edita esos archivos; el cambio lo hace 05 (o 02/03 bajo coordinación).

---

## Referencias

- Handoff: [docs/session-handoff.md](../../session-handoff.md)
- Tablas/RPC: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md)

---

> Última actualización: julio 2026
