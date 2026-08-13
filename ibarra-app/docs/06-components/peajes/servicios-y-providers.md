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
| `PEAJES_AUDITORIA_TARIFAS_SERVICE` / `PeajesAuditoriaTarifasService` | Listar/confirmar/recalcular tarifas normalizadas (F14) |

Contratos F14: `models/auditoria-tarifas.contracts.ts`. Guía de pantalla: [auditoria-tarifas.md](./auditoria-tarifas.md).

---

## Implementaciones

| Interfaz | Real | Mock UI / tests |
|----------|------|-----------------|
| Catálogo | `PeajesCatalogoSupabaseService` | `PeajesCatalogoMockService` |
| Carga | `PeajesCargaSupabaseService` | `PeajesCargaMockService` |
| Plantillas | `PeajesPlantillasSupabaseService` | `PeajesPlantillasMockService` |
| Motor | `PeajesMotorTransformacionService` | — (no mock) |
| Auditoría tarifas | `PeajesAuditoriaTarifasSupabaseService` (provider en `auditoria-tarifas.routes.ts`) | `AuditoriaTarifasMockService` (specs) |

Export barrel: `src/app/components/peajes/services/index.ts`.

Global: `PEAJES_GLOBAL_EMPRESA_ID = '__global__'`.

Acceso Supabase: solo vía `SupabaseService.getClient()` / `executeWithRetry` (sin clientes sueltos).

---

## Swap recomendado

**Aplicado por Agente 05.** Providers en `peajes.providers.ts` + rutas:

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

Mocks tipados quedan solo para unit tests (`PEAJES_CATALOGOS_MOCK_PROVIDERS`, specs de plantillas).

---

## Referencias

- Handoff: [docs/session-handoff.md](../../session-handoff.md)
- Tablas/RPC: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md)
- Auditoría tarifas UI: [auditoria-tarifas.md](./auditoria-tarifas.md)
- Auditoría tarifas backend: [docs/backend/peajes/auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md)

---

> Última actualización: 2026-08-13
