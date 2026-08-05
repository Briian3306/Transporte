# Modelo de datos — Peajes

## Resumen

El dominio Peajes persiste catálogos, facturas/pasadas, plantillas de transformación, algoritmos combinados y registros de auditoría de carga. Es un dominio aislado: **no** reutiliza `checklist_templates` ni tablas de Checklists.

## Índice

- [Resumen](#resumen)
- [Diagrama de relaciones](#diagrama-de-relaciones)
- [Reglas de dominio implementadas](#reglas-de-dominio-implementadas)
- [Contratos TypeScript](#contratos-typescript)
- [Servicios Angular](#servicios-angular)
- [Referencias](#referencias)

---

## Diagrama de relaciones

```text
peajes 1──* estaciones
patentes 1──* pases
estaciones ←── pasadas ──→ pases, patentes, facturas
plantillas_configuracion 1──* configuraciones_plantilla
algoritmos_combinados 1──* algoritmo_combinado_pasos
configuraciones_plantilla.algoritmo_combinado_id → algoritmos_combinados (nullable)
peajes_algoritmos_catalogo ←── algoritmo_combinado_pasos.algoritmo_codigo
facturas ←── registros_carga_peajes
```

Regla clave (PRD §12 / RN-05): la **pasada referencia `estacion_id`**; el peaje se deriva vía estación (`pasadas_con_peaje`). No existe `peaje_id` en `pasadas`.

---

## Reglas de dominio implementadas

| Regla | Implementación |
|-------|----------------|
| Pasada → estación (no peaje directo) | Columna `pasadas.estacion_id` + vista `pasadas_con_peaje` |
| Anti-duplicados (RN-16) | `UNIQUE (pase_id, fecha_hora, estacion_id, patente_id)` + RPC `peajes_detectar_duplicados` |
| Importe neto = precio − bonificación | CHECK en tabla + RPC `peajes_calcular_importe_neto` |
| Tolerancia factura (RN-13/17) | `peajes_validar_factura_pasadas`: default `abs(subtotal) * 0.01` |
| Tolerancia fila (RN-11) | `peajes_tolerancia_importe()` = `0.01` |
| Recurso global plantillas/algoritmos | `empresa_id text` admite `'__global__'` |
| Algoritmos: solo códigos de catálogo (RN-20) | FK a `peajes_algoritmos_catalogo`; motor TS usa `StrategyRegistry` |
| RLS MVP (§5.2) | Policies `*_authenticated_all` (acceso pleno a `authenticated`) |
| `system_modules` peajes | Insert condicional si existe tabla host RBAC (omitido en CLI vacío) |

---

## Contratos TypeScript

Modelos e interfaces en `src/app/components/peajes/models/`:

- `peajes.models.ts` — entidades
- `peajes.types.ts` — `PasadaColumnKey`, estados, tipos de configuración
- `peajes-services.contracts.ts` — `PeajesCatalogoService`, `PeajesCargaService`, `PeajesPlantillasService`, `PeajesMotorTransformacion`

Structure Goal (columnas estándar):

`PASADA_ID`, `FECHA_HORA`, `PASE_ID`, `PATENTE_ID`, `ESTACION_ID`, `PRECIO`, `BONIFICACION`, `QUANTITY`, `IMPORTE_NETO`

---

## Servicios Angular

| Contrato | Implementación real (F01) | Uso UI actual |
|----------|---------------------------|---------------|
| `PeajesCatalogoService` | `PeajesCatalogoSupabaseService` | UI aún con mock (swap pendiente 05) |
| `PeajesCargaService` | `PeajesCargaSupabaseService` | UI aún con mock (swap pendiente 05) |
| `PeajesPlantillasService` | `PeajesPlantillasSupabaseService` | UI aún con mock (swap pendiente 05) |
| `PeajesMotorTransformacion` | `PeajesMotorTransformacionService` | Consumido por wizard pasos 3–4 y UI plantillas |

Constante global: `PEAJES_GLOBAL_EMPRESA_ID === '__global__'` (alineada a `GLOBAL_EMPRESA_ID` del mock).

---

## Referencias

### Extensión AUSOL

La estación mantiene `latitud`, `longitud`, `camino` y `estado_geocodificacion`; los aliases proveedor-estación se modelan en una tabla relacional con alcance de empresa, no solo como texto libre.

- Detalle tablas: [catalogos.md](./catalogos.md), [facturas-pasadas.md](./facturas-pasadas.md), [plantillas-algoritmos.md](./plantillas-algoritmos.md), [auditoria-y-rpcs.md](./auditoria-y-rpcs.md)
- Migraciones: `supabase/migrations/20260730*_peajes_*.sql`
- Módulo: [docs/modulos/peajes.md](../../modulos/peajes.md)
- PRD: [docs/plan/peaje-prd-es.md](../../plan/peaje-prd-es.md) (§11–15)

---

> Última actualización: julio 2026
